// Types partages entre l'UI et la couche API.

export interface User {
  pk: string
  username: string
  fullName: string
  avatarUrl: string | null
  isVerified?: boolean
  isPrivate?: boolean
  /** Champs enrichis (fiche profil complete via web_profile_info). */
  biography?: string
  followerCount?: number
  followingCount?: number
  postCount?: number
}

export interface Post {
  id: string
  author: User
  takenAt: number // timestamp en secondes
  caption: string
  imageUrl: string | null
  likeCount: number
  commentCount: number
  location?: string | null
  /** Lien vers la vraie publication sur Instagram, si connu. */
  permalink?: string | null
}

export interface Reel extends Post {
  /** URL (proxifiee) de la video du reel. */
  videoUrl: string | null
  /** Nombre de vues/lectures. */
  viewCount: number
}

export interface StoryItem {
  id: string
  takenAt: number
  isVideo: boolean
  imageUrl: string | null
  videoUrl: string | null
  /** Duree de la video en secondes, si connue (sinon l'UI utilise une valeur par defaut). */
  duration: number | null
}

export interface StoryTray {
  /** reel_id (= pk du compte), sert a recharger les items a la demande. */
  id: string
  user: User
  seen: boolean
  mediaCount: number
  items: StoryItem[]
  takenAt: number
}

export interface Comment {
  id: string
  user: User
  text: string
  createdAt: number
  likeCount: number
}

export interface Highlight {
  id: string
  title: string
  cover: string | null
}

export interface Notification {
  id: string
  text: string
  timestamp: number
  profilePic: string | null
  thumbnail: string | null
  profileId: string
}

export interface ThreadPreview {
  id: string
  title: string
  users: User[]
  lastMessage: string
  lastActivity: number // timestamp en secondes
  unread: boolean
  isGroup: boolean
}

export type MessageItemType =
  | 'text'
  | 'like'
  | 'media'
  | 'share'
  | 'call'
  | 'system'
  | 'reaction_log'
  | 'unsupported'

export interface MessageReaction {
  senderId: string
  emoji: string
}

export interface DmMedia {
  kind: 'image' | 'video' | 'gif' | 'audio'
  url: string | null
  poster?: string | null
  duration?: number | null
}

export interface DmLink {
  url: string
  title: string
  summary: string
  image: string | null
  text: string
}

export interface Message {
  id: string
  senderId: string
  text: string | null
  timestamp: number // timestamp en secondes
  itemType: MessageItemType
  mediaUrl?: string | null
  /** Message optimiste dont l'envoi reel a echoue. */
  failed?: boolean
  /** Apercu (image, legende, auteur) pour une publication/reel partage. */
  embed?: Post | null
  /** Reactions emoji attachees a ce message precis. */
  reactions?: MessageReaction[]
  /** Media reel envoye dans la conversation (photo, video, GIF, note vocale). */
  media?: DmMedia | null
  /** Apercu d'un lien partage (ou partage cross-app). */
  link?: DmLink | null
}

export interface Thread extends ThreadPreview {
  messages: Message[]
  /** Pagination : d'autres messages plus anciens sont disponibles. */
  hasOlder?: boolean
  oldestCursor?: string | null
}

// Sessions "serveur" facon Discord dans le rail de gauche.
export type SpaceId = 'feed' | 'direct' | 'explore' | 'notifications' | 'profile'

export interface AuthState {
  status: 'demo' | 'live'
  user: User | null
}

// Reponses de l'API serverless.
export interface ApiError {
  error: string
  code?: string
  twoFactorIdentifier?: string
  username?: string
}
