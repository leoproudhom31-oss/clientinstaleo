// POST /api/login
// Corps : { username, password }  ou  { username, code, twoFactorIdentifier }
// La connexion se fait cote serveur : le mot de passe ne touche jamais
// le moindre script Instagram/Meta.

const { readJson, json } = require('./_lib/http')
const { newClient, persist, mapUser, handleError } = require('./_lib/ig')

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
  const username = (body.username || '').trim()
  const { password, code, twoFactorIdentifier } = body

  if (!username || (!password && !code)) {
    return json(res, 400, { error: 'Identifiants manquants.' })
  }

  const ig = newClient(username)

  try {
    if (code && twoFactorIdentifier) {
      await ig.account.twoFactorLogin({
        username,
        verificationCode: String(code).trim(),
        twoFactorIdentifier,
        verificationMethod: '1', // 1 = SMS/app
        trustThisDevice: '1',
      })
    } else {
      await ig.account.login(username, password)
    }

    let user
    try {
      user = await ig.account.currentUser()
    } catch {
      user = { pk: ig.state.cookieUserId, username }
    }

    await persist(res, ig)
    return json(res, 200, { user: mapUser(user) })
  } catch (e) {
    if (e?.name === 'IgLoginTwoFactorRequiredError') {
      const info = e.response?.body?.two_factor_info || {}
      return json(res, 200, {
        twoFactorRequired: true,
        twoFactorIdentifier: info.two_factor_identifier,
        username: info.username || username,
      })
    }
    if (e?.name === 'IgCheckpointError') {
      return json(res, 401, {
        error:
          "Instagram demande une verification (checkpoint). Valide la connexion depuis l'app officielle, puis reessaie.",
        code: 'checkpoint',
      })
    }
    if (
      e?.name === 'IgLoginBadPasswordError' ||
      e?.name === 'IgLoginInvalidUserError'
    ) {
      return json(res, 401, {
        error: 'Nom d’utilisateur ou mot de passe incorrect.',
        code: 'bad_credentials',
      })
    }
    return handleError(res, e)
  }
}
