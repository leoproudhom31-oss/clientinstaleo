// POST /api/login
// Trois formes de corps possibles :
//   { username, password }                          -> connexion initiale
//   { username, code, twoFactorIdentifier, method } -> double authentification
//   { username, challengeCode }                     -> resolution d'un challenge
//
// La connexion se fait cote serveur : le mot de passe ne touche jamais le
// moindre script Instagram/Meta.

const { readJson, json } = require('./_lib/http')
const {
  newClient,
  persist,
  serializeState,
  preLogin,
  currentUserSafe,
  mapUser,
  handleError,
} = require('./_lib/ig')
const {
  writeChallenge,
  readChallenge,
  clearChallenge,
} = require('./_lib/session')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Methode non autorisee' })
  }
  if (process.env.ENABLE_LIVE_LOGIN === 'false') {
    return json(res, 403, {
      error: 'La connexion reelle est desactivee sur ce deploiement.',
      code: 'live_disabled',
    })
  }

  const body = await readJson(req)
  // On retire un éventuel « @ » en debut : l'identifiant ne le contient pas.
  const username = (body.username || '').trim().replace(/^@+/, '')
  const { password, code, twoFactorIdentifier, method, challengeCode } = body

  // --- Etape 3 : l'utilisateur soumet le code de verification (challenge) ---
  if (challengeCode) {
    return resolveChallenge(req, res, challengeCode, username)
  }

  if (!username || (!password && !code)) {
    return json(res, 400, { error: 'Identifiants manquants.' })
  }

  const ig = newClient(username)
  console.log(`[api:login] tentative pour "${username}" (${code ? '2FA' : 'identifiants'})`)

  try {
    if (code && twoFactorIdentifier) {
      await ig.account.twoFactorLogin({
        username,
        verificationCode: String(code).trim(),
        twoFactorIdentifier,
        verificationMethod: method === '3' ? '3' : '1', // 3 = appli TOTP, 1 = SMS
        trustThisDevice: '1',
      })
    } else {
      await preLogin(ig)
      await ig.account.login(username, password)
    }

    const user = await currentUserSafe(ig, username)
    clearChallenge(res)
    await persist(res, ig)
    console.log(`[api:login] reussite pour "${username}"`)
    return json(res, 200, { user: mapUser(user) })
  } catch (e) {
    console.warn(`[api:login] echec pour "${username}" : ${e?.name || e?.message}`)
    // --- Double authentification requise ---
    if (e?.name === 'IgLoginTwoFactorRequiredError') {
      const info = e.response?.body?.two_factor_info || {}
      return json(res, 200, {
        twoFactorRequired: true,
        twoFactorIdentifier: info.two_factor_identifier,
        username: info.username || username,
        method: info.totp_two_factor_on ? '3' : '1',
        hint: info.totp_two_factor_on
          ? 'Code de ton application d’authentification'
          : info.obfuscated_phone_number
            ? `Code envoye au ${info.obfuscated_phone_number}`
            : 'Code recu par SMS',
      })
    }

    // --- Checkpoint / connexion inhabituelle : on declenche l'envoi d'un code ---
    if (e?.name === 'IgCheckpointError') {
      return startChallenge(res, ig, username)
    }

    if (e?.name === 'IgLoginInvalidUserError') {
      return json(res, 401, {
        error:
          'Identifiant introuvable. Saisis ton nom d’utilisateur, sans « @ » et sans utiliser l’adresse e-mail.',
        code: 'invalid_user',
      })
    }

    if (e?.name === 'IgLoginBadPasswordError') {
      return json(res, 401, {
        error:
          'Identifiants refuses par Instagram. Verifie ton mot de passe (surtout si tu l’as change recemment). Plus fiable : utilise le bouton « Se connecter avec Instagram » (fenetre officielle).',
        code: 'bad_credentials',
      })
    }
    return handleError(res, e)
  }
}

// Demande a Instagram d'envoyer un code de verification, puis memorise l'etat
// du challenge dans un cookie temporaire chiffre.
async function startChallenge(res, ig, username) {
  try {
    await ig.challenge.auto(true) // choisit une methode et envoie le code
    const step = ig.state.checkpoint?.step_name
    writeChallenge(res, {
      igState: await serializeState(ig),
      checkpoint: ig.state.checkpoint,
      username,
    })
    return json(res, 200, {
      challengeRequired: true,
      username,
      hint:
        step === 'delta_login_review'
          ? 'Instagram a peut-etre demande de confirmer « C’etait moi ». Saisis le code recu par e-mail/SMS.'
          : 'Instagram a detecte une connexion inhabituelle. Saisis le code envoye par e-mail ou SMS.',
    })
  } catch {
    return json(res, 401, {
      error:
        'Instagram demande une verification que ce client ne peut pas resoudre automatiquement. Valide la connexion depuis l’app officielle, puis reessaie.',
      code: 'checkpoint',
    })
  }
}

// Soumet le code du challenge en restaurant l'etat memorise.
async function resolveChallenge(req, res, challengeCode, username) {
  const pending = readChallenge(req)
  if (!pending || !pending.igState) {
    return json(res, 400, {
      error: 'Session de verification expiree. Recommence la connexion.',
      code: 'challenge_expired',
    })
  }

  const ig = newClient(pending.username || username)
  try {
    await ig.state.deserialize(pending.igState)
    if (pending.checkpoint) ig.state.checkpoint = pending.checkpoint
    await ig.challenge.sendSecurityCode(String(challengeCode).trim())

    const user = await currentUserSafe(ig, pending.username || username)
    clearChallenge(res)
    await persist(res, ig)
    return json(res, 200, { user: mapUser(user) })
  } catch (e) {
    if (e?.name === 'IgResponseError' || e?.response?.body?.message) {
      return json(res, 401, {
        error: 'Code incorrect ou expire. Verifie et reessaie.',
        code: 'bad_challenge_code',
      })
    }
    return handleError(res, e)
  }
}
