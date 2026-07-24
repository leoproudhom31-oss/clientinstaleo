import { Bell, RefreshCw, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import { EmptyState } from './EmptyState'
import { formatRelative } from '../lib/format'
import { errorHint } from '../lib/errors'

export function NotificationsView() {
  const {
    notifications,
    notificationsLoading,
    refreshNotifications,
    error,
    errorCode,
  } = useStore()

  return (
    <div className="content">
      <div className="messages scroll">
        <div className="messages-inner">
          <div style={{ padding: '28px 16px 4px' }}>
            <div className="empty-icon" style={{ width: 64, height: 64, marginBottom: 12 }}>
              <Bell size={30} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 28 }}>
              Notifications
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Tes j'aime, commentaires et nouveaux abonnes.{' '}
              <span style={{ color: 'var(--green)' }}>
                <ShieldCheck size={13} style={{ verticalAlign: 'middle' }} /> Aucun
                script Instagram/Meta n'est charge.
              </span>
            </p>
          </div>

          {error && (
            <div className="form-error" style={{ margin: '12px 16px' }}>
              {error}
              {errorHint(errorCode) && ` — ${errorHint(errorCode)}`}
              <button
                className="sidebar-error-retry"
                style={{ marginTop: 8 }}
                onClick={refreshNotifications}
              >
                <RefreshCw size={13} /> Reessayer
              </button>
            </div>
          )}

          {notificationsLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement des notifications…
            </div>
          )}

          {!notificationsLoading && !error && notifications.length === 0 && (
            <EmptyState icon={<Bell size={40} />} title="Rien de neuf">
              Tes j'aime, commentaires et abonnements s'afficheront ici.
            </EmptyState>
          )}

          <div className="notif-list">
            {notifications.map((n) => (
              <div key={n.id} className="notif-row">
                {n.profilePic ? (
                  <img className="notif-avatar" src={n.profilePic} alt="" loading="lazy" />
                ) : (
                  <div className="notif-avatar notif-avatar-empty" />
                )}
                <div className="notif-text">
                  <span>{n.text}</span>
                  {n.timestamp > 0 && (
                    <span className="notif-time">{formatRelative(n.timestamp)}</span>
                  )}
                </div>
                {n.thumbnail && (
                  <img className="notif-thumb" src={n.thumbnail} alt="" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
