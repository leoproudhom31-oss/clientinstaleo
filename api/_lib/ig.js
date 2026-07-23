// Enveloppe autour de instagram-private-api :
//  - creation/restauration du client depuis la session cookie
//  - mapping des reponses Instagram vers les types de l'UI
//  - proxy d'images (evite que le navigateur contacte le CDN de Meta)

const { IgApiClient } = require('instagram-private-api')
const { readSession, writeSession } = require('./session')
const { json } = require('./http')
const map = require('./map.cjs')

// Optionnel : route TOUT le trafic Instagram via un proxy (idealement
// residentiel/mobile). C'est LA solution quand Instagram bloque les IP de
// datacenter (Vercel/AWS) et renvoie de faux "mot de passe incorrect".
function applyProxy(ig) {
  const proxy = process.env.IG_PROXY
  if (proxy) ig.state.proxyUrl = proxy
  return ig
}

function newClient(seedUsername) {
  const ig = new IgApiClient()
  applyProxy(ig)
  if (seedUsername) ig.state.generateDevice(seedUsername)
  return ig
}

async function clientFromSession(req) {
  const state = readSession(req)
  if (!state) return null
  const ig = new IgApiClient()
  await ig.state.deserialize(state)
  applyProxy(ig)
  return ig
}

// Serialise l'etat du client (sans les constantes, pour reduire la taille).
async function serializeState(ig) {
  const serialized = await ig.state.serialize()
  delete serialized.constants
  return serialized
}

// Sauvegarde la session (rafraichie) dans le cookie apres chaque requete.
async function persist(res, ig) {
  writeSession(res, await serializeState(ig))
}

// Flux "pre-connexion" : imite un vrai appareil pour limiter les checkpoints.
// Best-effort : un echec ici ne doit pas bloquer la connexion.
async function preLogin(ig) {
  try {
    await ig.simulate.preLoginFlow()
  } catch {
    /* non bloquant */
  }
}

// Recupere l'utilisateur courant sans jamais planter.
async function currentUserSafe(ig, fallbackUsername) {
  try {
    return await ig.account.currentUser()
  } catch {
    let pk = ''
    try {
      pk = ig.state.cookieUserId
    } catch {
      /* pas encore de cookie utilisateur */
    }
    return { pk, username: fallbackUsername }
  }
}

// Gestion centralisee des erreurs Instagram.
function handleError(res, e) {
  const name = e?.name || ''
  if (name === 'IgCheckpointError') {
    return json(res, 401, {
      error: 'Instagram demande une verification (checkpoint).',
      code: 'checkpoint',
    })
  }
  if (name === 'IgLoginRequiredError' || name === 'IgUserHasLoggedOutError') {
    return json(res, 401, { error: 'Session expiree.', code: 'expired' })
  }
  const msg = e?.response?.body?.message || e?.message
  return json(res, 502, {
    error: typeof msg === 'string' ? msg : 'Erreur cote Instagram.',
    code: 'ig_error',
  })
}

module.exports = {
  newClient,
  clientFromSession,
  persist,
  serializeState,
  preLogin,
  currentUserSafe,
  handleError,
  // Re-export des mappers (definis dans map.cjs) pour compatibilite.
  ...map,
}
