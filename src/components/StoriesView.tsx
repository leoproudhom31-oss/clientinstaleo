import { useState } from 'react'
import { Circle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { EmptyState } from './EmptyState'
import { StoryViewer } from './StoryViewer'
import { errorHint } from '../lib/errors'

export function StoriesView() {
  const {
    stories,
    storiesLoading,
    refreshStories,
    loadStoryItems,
    error,
    errorCode,
  } = useStore()
  const [openAt, setOpenAt] = useState<number | null>(null)

  return (
    <div className="content">
      <div className="messages scroll">
        <div className="messages-inner">
          <div style={{ padding: '28px 16px 4px' }}>
            <div
              className="empty-icon"
              style={{ width: 64, height: 64, marginBottom: 12 }}
            >
              <Circle size={30} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 28 }}>
              Stories
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Les stories de tes abonnements, a lire sans etre piste.{' '}
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
                onClick={refreshStories}
              >
                <RefreshCw size={13} /> Reessayer
              </button>
            </div>
          )}

          {storiesLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement des stories…
            </div>
          )}

          {!storiesLoading && !error && stories.length === 0 && (
            <EmptyState icon={<Circle size={40} />} title="Aucune story">
              Aucun de tes abonnements n'a de story active pour le moment.
            </EmptyState>
          )}

          {!storiesLoading && stories.length > 0 && (
            <div className="story-grid">
              {stories.map((tray, i) => (
                <button
                  key={tray.id}
                  className="story-ring-item"
                  onClick={() => setOpenAt(i)}
                  title={`Voir la story de ${tray.user.username}`}
                >
                  <span className={`story-ring ${tray.seen ? 'seen' : ''}`}>
                    <Avatar user={tray.user} size={64} />
                  </span>
                  <span className="story-ring-name">{tray.user.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {openAt !== null && (
        <StoryViewer
          trays={stories}
          initialTray={openAt}
          onClose={() => setOpenAt(null)}
          loadItems={loadStoryItems}
        />
      )}
    </div>
  )
}
