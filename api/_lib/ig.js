// Enveloppe autour de instagram-private-api :
//  - creation/restauration du client depuis la session cookie
//  - mapping des reponses Instagram vers les types de l'UI
//  - proxy d'images (evite que le navigateur contacte le CDN de Meta)

const { IgApiClient } = require('instagram-private-api')
const { readSession, writeSession } = require('./session')
const { json } = require('./http')

function newClient(seedUsername) {
  const ig = new IgApiClient()
  if (seedUsername) ig.state.generateDevice(seedUsername)
  return ig
}

async function clientFromSession(req) {
  const state = readSession(req)
  if (!state) return null
  const ig = new IgApiClient()
  await ig.state.deserialize(state)
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

// Toutes les images passent par notre propre endpoint /api/img :
// le navigateur ne parle jamais directement a instagram/facebook.
function imgProxy(url) {
  if (!url) return null
  return `/api/img?u=${encodeURIComponent(url)}`
}

function mapUser(u) {
  if (!u) return { pk: '', username: 'inconnu', fullName: '', avatarUrl: null }
  return {
    pk: String(u.pk ?? u.pk_id ?? u.id ?? ''),
    username: u.username ?? 'inconnu',
    fullName: u.full_name ?? u.username ?? '',
    avatarUrl: imgProxy(u.profile_pic_url),
    isVerified: !!u.is_verified,
    isPrivate: !!u.is_private,
  }
}

function firstImage(item) {
  const candidates =
    item?.image_versions2?.candidates ??
    item?.carousel_media?.[0]?.image_versions2?.candidates
  if (candidates && candidates.length) return candidates[0].url
  return null
}

// Le fil renvoie parfois { media_or_ad } au lieu du media directement.
function extractMedia(feedItem) {
  const m = feedItem?.media_or_ad ?? feedItem
  if (!m || !m.user || m.taken_at == null) return null
  return m
}

function mapPost(item) {
  return {
    id: String(item.id ?? item.pk ?? item.code ?? Math.random()),
    author: mapUser(item.user),
    takenAt: Number(item.taken_at) || Math.floor(Date.now() / 1000),
    caption: item.caption?.text ?? '',
    imageUrl: imgProxy(firstImage(item)),
    likeCount: Number(item.like_count) || 0,
    commentCount: Number(item.comment_count) || 0,
    location: item.location?.name ?? null,
  }
}

function previewText(item) {
  if (!item) return ''
  switch (item.item_type) {
    case 'text':
      return item.text || ''
    case 'like':
      return '❤️'
    case 'media':
      return '📷 Photo'
    case 'raven_media':
      return '📷 Media ephemere'
    case 'media_share':
      return '📎 Publication partagee'
    case 'voice_media':
      return '🎤 Message vocal'
    case 'animated_media':
      return 'GIF'
    case 'link':
      return item.link?.text || '🔗 Lien'
    default:
      return item.text || '…'
  }
}

const MEDIA_TYPES = [
  'media',
  'raven_media',
  'media_share',
  'voice_media',
  'animated_media',
  'clip',
  'story_share',
  'reel_share',
]

function tsSeconds(micro) {
  const n = Number(micro)
  if (!n) return Math.floor(Date.now() / 1000)
  return Math.floor(n / 1_000_000)
}

function mapMessage(item) {
  let itemType = 'text'
  if (item.item_type === 'like') itemType = 'like'
  else if (MEDIA_TYPES.includes(item.item_type)) itemType = 'media'
  else if (item.item_type !== 'text') itemType = 'placeholder'
  return {
    id: String(item.item_id ?? item.timestamp ?? Math.random()),
    senderId: String(item.user_id ?? ''),
    text: item.item_type === 'text' ? item.text || '' : previewText(item),
    timestamp: tsSeconds(item.timestamp),
    itemType,
  }
}

function mapThreadPreview(t, selfPk) {
  const others = (t.users || []).filter((u) => String(u.pk) !== String(selfPk))
  const last = (t.items && t.items[0]) || t.last_permanent_item
  const title =
    t.thread_title || others.map((u) => u.username).join(', ') || 'Conversation'
  return {
    id: String(t.thread_id),
    title,
    users: others.map(mapUser),
    lastMessage: previewText(last),
    lastActivity: last ? tsSeconds(last.timestamp) : Math.floor(Date.now() / 1000),
    unread: Boolean(t.read_state),
    isGroup: Boolean(t.is_group) || others.length > 1,
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
  imgProxy,
  mapUser,
  mapPost,
  extractMedia,
  mapMessage,
  mapThreadPreview,
  previewText,
  handleError,
}
