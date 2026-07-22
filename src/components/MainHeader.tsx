import { Hash, ShieldCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../state/store'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  showMembersToggle?: boolean
}

export function MainHeader({
  icon,
  title,
  description,
  showMembersToggle,
}: Props) {
  const { toggleMembers, membersVisible } = useStore()
  return (
    <header className="main-header">
      <span className="mh-icon">{icon ?? <Hash size={22} />}</span>
      <span className="mh-title">{title}</span>
      {description && (
        <>
          <span className="mh-divider" />
          <span className="mh-desc">{description}</span>
        </>
      )}
      <div className="mh-actions">
        <span
          className="icon-btn"
          title="Aucun script de tracking n'est charge sur cette page"
          style={{ color: 'var(--green)', gap: 6, width: 'auto', padding: '0 8px' }}
        >
          <ShieldCheck size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>0 tracker</span>
        </span>
        {showMembersToggle && (
          <button
            className="icon-btn"
            title={membersVisible ? 'Masquer les membres' : 'Afficher les membres'}
            onClick={toggleMembers}
            style={{ color: membersVisible ? 'var(--interactive-active)' : undefined }}
          >
            <Users size={22} />
          </button>
        )}
      </div>
    </header>
  )
}
