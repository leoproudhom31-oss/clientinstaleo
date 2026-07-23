// Client HTTP vers les fonctions serverless Vercel (/api/*).
// La session Instagram vit dans un cookie httpOnly chiffre cote serveur :
// on envoie donc credentials: 'include' a chaque appel.

import type {
  Message,
  Notification,
  Post,
  Reel,
  StoryItem,
  StoryTray,
  ThreadPreview,
  Thread,
  User,
} from '../types'

export class ApiError extends Error {
  code?: string
  twoFactorIdentifier?: string
  username?: string
  constructor(message: string, extra: Partial<ApiError> = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, extra)
  }
}

async function call<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur. En local, utilise `vercel dev` pour activer les routes /api.",
      { code: 'network' },
    )
  }

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new ApiError('Reponse invalide du serveur.', { code: 'parse' })
    }
  }

  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>
    throw new ApiError((d.error as string) || `Erreur ${res.status}`, {
      code: d.code as string | undefined,
      twoFactorIdentifier: d.twoFactorIdentifier as string | undefined,
      username: d.username as string | undefined,
    })
  }
  return data as T
}

export type LoginResponse =
  | { user: User; twoFactorRequired?: false; challengeRequired?: false }
  | {
      twoFactorRequired: true
      twoFactorIdentifier: string
      username: string
      method?: string
      hint?: string
    }
  | { challengeRequired: true; username: string; hint?: string }

export const api = {
  login(username: string, password: string): Promise<LoginResponse> {
    return call<LoginResponse>('login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  loginTwoFactor(
    username: string,
    code: string,
    twoFactorIdentifier: string,
    method: string,
  ): Promise<LoginResponse> {
    return call<LoginResponse>('login', {
      method: 'POST',
      body: JSON.stringify({ username, code, twoFactorIdentifier, method }),
    })
  },

  loginChallenge(username: string, challengeCode: string): Promise<LoginResponse> {
    return call<LoginResponse>('login', {
      method: 'POST',
      body: JSON.stringify({ username, challengeCode }),
    })
  },

  me(): Promise<{ user: User }> {
    return call<{ user: User }>('me')
  },

  logout(): Promise<{ ok: true }> {
    return call<{ ok: true }>('logout', { method: 'POST' })
  },

  feed(maxId?: string): Promise<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = maxId ? `?maxId=${encodeURIComponent(maxId)}` : ''
    return call<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }>(`feed${qs}`)
  },

  profile(
    maxId?: string,
  ): Promise<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = maxId ? `?maxId=${encodeURIComponent(maxId)}` : ''
    return call<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }>(`profile${qs}`)
  },

  // Fiche d'un compte quelconque (bio, compteurs) + 1re page de ses posts.
  user(
    username: string,
  ): Promise<{ user: User; posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    return call(`user?username=${encodeURIComponent(username)}`)
  },

  // Publications suivantes d'un profil (pagination).
  userPosts(
    userId: string,
    maxId?: string,
  ): Promise<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = new URLSearchParams({ userId })
    if (maxId) qs.set('maxId', maxId)
    return call(`user?${qs.toString()}`)
  },

  reels(maxId?: string): Promise<{ reels: Reel[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = maxId ? `?maxId=${encodeURIComponent(maxId)}` : ''
    return call<{ reels: Reel[]; hasMore: boolean; nextMaxId: string | null }>(`reels${qs}`)
  },

  saved(maxId?: string): Promise<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = maxId ? `?maxId=${encodeURIComponent(maxId)}` : ''
    return call<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }>(`saved${qs}`)
  },

  explore(maxId?: string): Promise<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }> {
    const qs = maxId ? `?maxId=${encodeURIComponent(maxId)}` : ''
    return call<{ posts: Post[]; hasMore: boolean; nextMaxId: string | null }>(`explore${qs}`)
  },

  notifications(): Promise<{ notifications: Notification[] }> {
    return call<{ notifications: Notification[] }>('notifications')
  },

  inbox(): Promise<{ threads: ThreadPreview[] }> {
    return call<{ threads: ThreadPreview[] }>('inbox')
  },

  stories(): Promise<{ trays: StoryTray[] }> {
    return call<{ trays: StoryTray[] }>('stories')
  },

  storyReel(reel: string): Promise<{ items: StoryItem[] }> {
    return call<{ items: StoryItem[] }>(`stories?reel=${encodeURIComponent(reel)}`)
  },

  thread(id: string, cursor?: string): Promise<{ thread: Thread }> {
    const qs = new URLSearchParams({ id })
    if (cursor) qs.set('cursor', cursor)
    return call<{ thread: Thread }>(`thread?${qs.toString()}`)
  },

  send(threadId: string, text: string): Promise<{ message: Message }> {
    return call<{ message: Message }>('send', {
      method: 'POST',
      body: JSON.stringify({ threadId, text }),
    })
  },
}
