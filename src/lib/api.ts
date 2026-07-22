// Client HTTP vers les fonctions serverless Vercel (/api/*).
// La session Instagram vit dans un cookie httpOnly chiffre cote serveur :
// on envoie donc credentials: 'include' a chaque appel.

import type { Message, Post, ThreadPreview, Thread, User } from '../types'

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
  | { user: User; twoFactorRequired?: false }
  | { twoFactorRequired: true; twoFactorIdentifier: string; username: string }

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
  ): Promise<LoginResponse> {
    return call<LoginResponse>('login', {
      method: 'POST',
      body: JSON.stringify({ username, code, twoFactorIdentifier }),
    })
  },

  me(): Promise<{ user: User }> {
    return call<{ user: User }>('me')
  },

  logout(): Promise<{ ok: true }> {
    return call<{ ok: true }>('logout', { method: 'POST' })
  },

  feed(): Promise<{ posts: Post[] }> {
    return call<{ posts: Post[] }>('feed')
  },

  inbox(): Promise<{ threads: ThreadPreview[] }> {
    return call<{ threads: ThreadPreview[] }>('inbox')
  },

  thread(id: string): Promise<{ thread: Thread }> {
    return call<{ thread: Thread }>(`thread?id=${encodeURIComponent(id)}`)
  },

  send(threadId: string, text: string): Promise<{ message: Message }> {
    return call<{ message: Message }>('send', {
      method: 'POST',
      body: JSON.stringify({ threadId, text }),
    })
  },
}
