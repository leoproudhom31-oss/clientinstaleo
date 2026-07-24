import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { demoOffline, demoOnline } from '../lib/mock'
import type { User } from '../types'

function Row({ user, offline }: { user: User; offline?: boolean }) {
  const { openUserProfile } = useStore()
  return (
    <div
      className={`member-row clickable ${offline ? 'offline' : ''}`}
      onClick={() => openUserProfile(user)}
      title={`Voir le profil de ${user.username}`}
    >
      <Avatar
        user={user}
        size={32}
        status={offline ? 'offline' : 'online'}
        onChat={false}
      />
      <span className="mr-name">{user.username}</span>
    </div>
  )
}

export function MemberList() {
  const { space, activeThread, me, mode } = useStore()

  if (space === 'direct') {
    if (!activeThread) return null
    const members = [me, ...activeThread.users]
    return (
      <aside className="member-list scroll">
        <div className="member-cat">En ligne — {members.length}</div>
        {members.map((u) => (
          <Row key={u.pk} user={u} />
        ))}
      </aside>
    )
  }

  // Espace "feed"
  if (mode === 'live') {
    return (
      <aside className="member-list scroll">
        <div className="member-cat">Ton compte</div>
        <Row user={me} />
        <div className="member-cat">Info</div>
        <p style={{ padding: '4px 8px', fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.4 }}>
          La presence en ligne n'est pas exposee par l'API : on ne l'invente pas.
        </p>
      </aside>
    )
  }

  return (
    <aside className="member-list scroll">
      <div className="member-cat">En ligne — {demoOnline.length}</div>
      {demoOnline.map((u) => (
        <Row key={u.pk} user={u} />
      ))}
      <div className="member-cat">Hors ligne — {demoOffline.length}</div>
      {demoOffline.map((u) => (
        <Row key={u.pk} user={u} offline />
      ))}
    </aside>
  )
}
