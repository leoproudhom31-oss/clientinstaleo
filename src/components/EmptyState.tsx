import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: string
  children?: ReactNode
}

export function EmptyState({ icon, title, children }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  )
}
