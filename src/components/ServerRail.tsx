import {
  Bell,
  Compass,
  Home,
  Send,
  Shield,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react'
import type { SpaceId } from '../types'
import { useStore } from '../state/store'
import { SPACES, spaceMeta } from '../lib/spaces'
import { avatarFor } from '../lib/avatars'

const ICONS: Record<SpaceId, LucideIcon> = {
  feed: Home,
  direct: Send,
  explore: Compass,
  notifications: Bell,
  profile: UserIcon,
}

export function ServerRail() {
  const { space, setSpace, me } = useStore()

  function RailItem({ id }: { id: SpaceId }) {
    const meta = spaceMeta(id)
    const Icon = ICONS[id]
    const active = space === id
    return (
      <div
        className={`rail-item ${active ? 'active' : ''}`}
        onClick={() => setSpace(id)}
        role="button"
        aria-label={meta.label}
      >
        <span className="rail-pill" />
        <button className="rail-button">
          <Icon size={24} />
        </button>
        <span className="rail-tooltip">{meta.label}</span>
      </div>
    )
  }

  return (
    <nav className="server-rail">
      {/* Logo / accueil */}
      <div
        className={`rail-item ${space === 'feed' ? 'active' : ''}`}
        onClick={() => setSpace('feed')}
        role="button"
        aria-label="Accueil"
      >
        <span className="rail-pill" />
        <button
          className="rail-button"
          style={{ background: space === 'feed' ? 'var(--brand)' : undefined }}
        >
          <Shield size={26} fill={space === 'feed' ? '#fff' : 'none'} />
        </button>
        <span className="rail-tooltip">InstaLeo · sans trackers</span>
      </div>

      <div className="rail-sep" />

      {SPACES.filter((s) => s.id !== 'feed' && s.id !== 'profile').map((s) => (
        <RailItem key={s.id} id={s.id} />
      ))}

      <div style={{ flex: 1 }} />

      <div className="rail-sep" />
      {/* Profil (avatar) */}
      <div
        className={`rail-item ${space === 'profile' ? 'active' : ''}`}
        onClick={() => setSpace('profile')}
        role="button"
        aria-label="Profil"
      >
        <span className="rail-pill" />
        <button className="rail-button" style={{ padding: 0 }}>
          <img
            src={avatarFor(me.username, me.avatarUrl, me.fullName)}
            alt={me.username}
          />
        </button>
        <span className="rail-tooltip">{me.username}</span>
      </div>
    </nav>
  )
}
