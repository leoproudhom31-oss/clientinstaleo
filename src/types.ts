// Types partages entre l'UI et la couche API.

export interface User {
  pk: string
  username: string
  fullName: string
  avatarUrl: string | null
  isVerified?: boolean
  isPrivate?: boolean
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

export interface Message {
  id: string
  senderId: string
  text: string | null
  timestamp: number // timestamp en secondes
  itemType: 'text' | 'media' | 'like' | 'placeholder'
  mediaUrl?: string | null
}

export interface Thread extends ThreadPreview {
  messages: Message[]
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
