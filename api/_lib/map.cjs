// Mapping des reponses Instagram -> types de l'UI.
// Module pur (aucune dependance lourde) : reutilise par la voie
// instagram-private-api ET par la voie session web (Electron).

// Toutes les images passent par notre endpoint /api/img : la page ne parle
// jamais directement aux serveurs de Meta.
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

// Types de messages (item_type) qu'Instagram peut envoyer dans un thread
// Direct, regroupes par categorie pour un rendu propre (icone + libelle) au
// lieu d'un "…" generique.
const MEDIA_TYPES = ['media', 'raven_media', 'voice_media', 'animated_media']
const SHARE_TYPES = [
  'media_share',
  'clip',
  'felix_share',
  'story_share',
  'reel_share',
  'xma_media_share',
  'xma_story_share',
  'xma_reel_mention',
  'profile',
  'link',
  'location',
]

// Pas d'emoji ici : l'UI affiche deja une icone dediee a cote de ce libelle
// (voir MEDIA_ICON dans DMView.tsx). Les doubler serait redondant.
function mediaLabel(item) {
  if (item.item_type === 'voice_media') return 'Message vocal'
  if (item.item_type === 'animated_media') return 'GIF'
  if (item.item_type === 'raven_media') return 'Media ephemere'
  return item.media?.media_type === 2 ? 'Video' : 'Photo'
}

function shareLabel(item) {
  switch (item.item_type) {
    case 'clip':
      return 'Reel partage'
    case 'felix_share':
      return 'IGTV partagee'
    case 'story_share':
    case 'xma_story_share':
      return 'Story partagee'
    case 'reel_share':
      return 'Reponse a une story'
    case 'xma_reel_mention':
      return 'Mention dans une story'
    case 'profile':
      return `Profil partage${item.profile?.username ? ' : @' + item.profile.username : ''}`
    case 'link':
      return item.link?.text || 'Lien'
    case 'location':
      return item.location?.name || 'Position partagee'
    default:
      return 'Publication partagee'
  }
}

// Pour media_share et clip, Instagram fournit l'objet media complet (meme
// forme que dans le fil) : on peut donc en extraire un vrai apercu (image,
// legende, auteur) plutot qu'une simple etiquette. Les autres types partages
// (story/reel/IGTV) sont souvent ephemeres ou dans un format non documente
// de facon fiable : on garde une etiquette pour eux plutot que de deviner un
// champ qui pourrait ne pas exister.
function shareEmbed(item) {
  if (item.item_type === 'media_share' && item.media_share?.user) {
    return mapPost(item.media_share)
  }
  if (item.item_type === 'clip') {
    const clipMedia = item.clip?.clip || item.clip
    if (clipMedia?.user) return mapPost(clipMedia)
  }
  return null
}

// Determine la categorie d'un item de conversation + son libelle d'affichage.
// Categories utilisees par l'UI : text | like | media | share | call | system
// | unsupported.
function describeItem(item) {
  if (!item) return { itemType: 'text', text: '' }
  const raw = item.item_type

  if (raw === 'text') return { itemType: 'text', text: item.text || '' }
  if (raw === 'like') return { itemType: 'like', text: '❤️' }
  if (MEDIA_TYPES.includes(raw)) return { itemType: 'media', text: mediaLabel(item) }
  if (SHARE_TYPES.includes(raw)) {
    return { itemType: 'share', text: shareLabel(item), embed: shareEmbed(item) }
  }
  if (raw === 'video_call_event') {
    return { itemType: 'call', text: '📞 Appel' }
  }
  if (raw === 'action_log') {
    return {
      itemType: 'system',
      text: item.action_log?.description || 'Evenement de la conversation',
    }
  }
  if (raw === 'placeholder') {
    return {
      itemType: 'unsupported',
      text:
        item.placeholder?.message ||
        item.placeholder?.title ||
        'Message non disponible dans ce client',
    }
  }
  return {
    itemType: 'unsupported',
    text: item.text || 'Element non pris en charge par ce client',
  }
}

// Conserve pour l'apercu de conversation (liste des DM).
function previewText(item) {
  return describeItem(item).text
}

function tsSeconds(micro) {
  const n = Number(micro)
  if (!n) return Math.floor(Date.now() / 1000)
  return Math.floor(n / 1_000_000)
}

function mapMessage(item) {
  const { itemType, text, embed } = describeItem(item)
  return {
    id: String(item.item_id ?? item.timestamp ?? Math.random()),
    senderId: String(item.user_id ?? ''),
    text,
    timestamp: tsSeconds(item.timestamp),
    itemType,
    ...(embed ? { embed } : {}),
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

module.exports = {
  imgProxy,
  mapUser,
  firstImage,
  extractMedia,
  mapPost,
  previewText,
  mapMessage,
  mapThreadPreview,
  tsSeconds,
  MEDIA_TYPES,
  SHARE_TYPES,
}
