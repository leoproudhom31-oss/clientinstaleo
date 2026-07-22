import { avatarFor } from '../lib/avatars'
import type { User } from '../types'

type Status = 'online' | 'idle' | 'offline' | 'none'

interface Props {
  user?: Pick<User, 'username' | 'fullName' | 'avatarUrl'>
  seed?: string
  label?: string
  url?: string | null
  size?: number
  status?: Status
  onChat?: boolean
}

export function Avatar({
  user,
  seed,
  label,
  url,
  size = 40,
  status = 'none',
  onChat = false,
}: Props) {
  const s = seed ?? user?.username ?? 'anon'
  const lbl = label ?? user?.fullName ?? user?.username ?? '?'
  const src = avatarFor(s, url ?? user?.avatarUrl, lbl)

  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <img
        className="avatar"
        src={src}
        alt={lbl}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size }}
      />
      {status !== 'none' && (
        <span
          className={`avatar-status ${status} ${onChat ? 'on-chat' : ''}`}
        />
      )}
    </div>
  )
}
