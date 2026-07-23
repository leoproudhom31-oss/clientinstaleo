// Mapping des reponses Instagram -> types de l'UI.
// Module pur (aucune dependance lourde) : reutilise par la voie
// instagram-private-api ET par la voie session web (Electron).

// Toutes les images passent par notre endpoint /api/img : la page ne parle
// jamais directement aux serveurs de Meta.
function imgProxy(url) {
  if (!url) return null
  return `/api/img?u=${encodeURIComponent(url)}`
}

// Comme imgProxy, mais pour les videos (stories video, reels) : passe par
// /api/media qui supporte le streaming par plages (Range) et conserve le
// type MIME d'origine. La page ne contacte jamais directement les CDN de Meta.
function mediaProxy(url) {
  if (!url) return null
  return `/api/media?u=${encodeURIComponent(url)}`
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

// Extrait le media video/reel d'un element du fil (pour l'onglet Reels), qu'il
// soit direct (media_or_ad) ou injecte comme suggestion (explore_story). Le fil
// timeline contient deja des reels ; on ne garde que les videos/clips.
function extractClip(feedItem) {
  const m =
    feedItem?.media_or_ad ||
    feedItem?.explore_story?.media_or_ad ||
    feedItem?.explore_story?.media ||
    feedItem?.media
  if (!m || !m.user || m.taken_at == null) return null
  const isClip =
    m.product_type === 'clips' ||
    m.media_type === 2 ||
    (Array.isArray(m.video_versions) && m.video_versions.length > 0)
  return isClip ? m : null
}

// Profil complet renvoye par web_profile_info (bio + compteurs), forme
// GraphQL differente du reste de l'API (edge_followed_by.count, etc.).
function mapProfile(u) {
  if (!u) return null
  return {
    pk: String(u.id ?? u.pk ?? u.pk_id ?? ''),
    username: u.username ?? '',
    fullName: u.full_name ?? '',
    avatarUrl: imgProxy(u.profile_pic_url_hd || u.profile_pic_url),
    isVerified: !!u.is_verified,
    isPrivate: !!u.is_private,
    biography: u.biography ?? '',
    followerCount: Number(u.edge_followed_by?.count ?? u.follower_count ?? 0),
    followingCount: Number(u.edge_follow?.count ?? u.following_count ?? 0),
    postCount: Number(u.edge_owner_to_timeline_media?.count ?? u.media_count ?? 0),
  }
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
    // /p/<code>/ resout correctement aussi bien une publication qu'un reel :
    // c'est le format de lien permanent le plus fiable.
    permalink: item.code ? `https://www.instagram.com/p/${item.code}/` : null,
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

// Reconnait une entree de journal decrivant une reaction ("X reacted 😂 to
// your message" / variantes localisees) pour lui donner une icone dediee au
// lieu du traitement generique des evenements systeme.
const REACTION_LOG_RE = /react/i

// Determine la categorie d'un item de conversation + son libelle d'affichage.
// Categories utilisees par l'UI : text | like | media | share | call | system
// | reaction_log | unsupported.
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
    const description = item.action_log?.description || 'Evenement de la conversation'
    return {
      itemType: REACTION_LOG_RE.test(description) ? 'reaction_log' : 'system',
      text: description,
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

// Reactions emoji attachees DIRECTEMENT a ce message (contrairement aux
// entrees action_log ci-dessus, qui sont des lignes de journal separees) :
// Instagram les expose sous item.reactions.emojis quand le message reagi est
// encore recent. On les affiche comme des pastilles sous la bulle concernee,
// comme le ferait Discord ou Messenger.
function mapReactions(item) {
  const emojis = item?.reactions?.emojis
  if (!Array.isArray(emojis) || emojis.length === 0) return undefined
  return emojis.map((r) => ({
    senderId: String(r.sender_id ?? ''),
    emoji: r.emoji || '❤️',
  }))
}

function mapMessage(item) {
  const { itemType, text, embed } = describeItem(item)
  const reactions = mapReactions(item)
  return {
    id: String(item.item_id ?? item.timestamp ?? Math.random()),
    senderId: String(item.user_id ?? ''),
    text,
    timestamp: tsSeconds(item.timestamp),
    itemType,
    ...(embed ? { embed } : {}),
    ...(reactions ? { reactions } : {}),
  }
}

// --- Stories -----------------------------------------------------------------

function bestVideo(item) {
  const v = item?.video_versions
  return v && v.length ? v[0].url : null
}

// Un element de story (une photo ou une video de ~5-15 s). On expose toujours
// une image (poster) — meme pour une video — pour un affichage immediat.
function mapStoryItem(item) {
  const isVideo = item?.media_type === 2 || (item?.video_versions?.length > 0)
  return {
    id: String(item.id ?? item.pk ?? Math.random()),
    takenAt: Number(item.taken_at) || Math.floor(Date.now() / 1000),
    isVideo: Boolean(isVideo),
    imageUrl: imgProxy(firstImage(item)),
    videoUrl: isVideo ? mediaProxy(bestVideo(item)) : null,
    duration: Number(item.video_duration) || null,
  }
}

// Un reel = une publication centree sur la video. On repart de mapPost (auteur,
// legende, poster, likes, permalink) et on ajoute la video + le nombre de vues.
function mapReel(item) {
  const m = item?.media || item
  if (!m || !m.user) return null
  const base = mapPost(m)
  return {
    ...base,
    videoUrl: mediaProxy(bestVideo(m)),
    viewCount: Number(m.play_count ?? m.view_count ?? m.ig_play_count ?? 0) || 0,
  }
}

// Une entree du carrousel de stories : un compte + ses stories du moment.
function mapStoryTray(tray) {
  const user = mapUser(tray.user)
  const items = Array.isArray(tray.items) ? tray.items.map(mapStoryItem) : []
  const seen =
    tray.seen != null && tray.latest_reel_media != null
      ? Number(tray.seen) >= Number(tray.latest_reel_media)
      : false
  return {
    // reel_id = pk de l'utilisateur (sert a recharger les items a la demande).
    id: String(tray.id ?? tray.user?.pk ?? user.pk),
    user,
    seen,
    mediaCount: Number(tray.media_count) || items.length,
    items,
    takenAt: Number(tray.latest_reel_media) || 0,
  }
}

// Une entree du fil d'activite (news/inbox) : j'aime, commentaire, abonnement.
// Instagram fournit le texte deja localise dans args.text.
function mapNotification(story) {
  const a = story.args || story || {}
  const media = Array.isArray(a.media) ? a.media[0] : null
  return {
    id: String(story.pk ?? a.tuuid ?? a.timestamp ?? Math.random()),
    text: a.text || '',
    timestamp: Number(a.timestamp) || 0,
    profilePic: imgProxy(a.profile_image),
    thumbnail: media ? imgProxy(media.image) : null,
    profileId: String(a.profile_id ?? ''),
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
  mediaProxy,
  mapUser,
  firstImage,
  extractMedia,
  mapPost,
  previewText,
  mapMessage,
  mapThreadPreview,
  mapStoryItem,
  mapStoryTray,
  mapReel,
  extractClip,
  mapProfile,
  mapNotification,
  tsSeconds,
  MEDIA_TYPES,
  SHARE_TYPES,
}
