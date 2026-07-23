import { Bookmark, Clapperboard, Rss, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import { PostMessage } from './PostMessage'
import { EmptyState } from './EmptyState'
import { useIncremental } from '../lib/useIncremental'
import { errorHint } from '../lib/errors'

const CHANNEL_LABELS: Record<string, string> = {
  accueil: 'accueil',
  stories: 'stories',
  reels: 'reels',
  saved: 'enregistres',
}

export function FeedView() {
  const { feed, feedLoading, feedChannel, error, errorCode } = useStore()
  const label = CHANNEL_LABELS[feedChannel] ?? feedChannel
  const { visible, hasMore, sentinelRef } = useIncremental(feed, 5, 5)

  if (feedChannel !== 'accueil') {
    const icon = feedChannel === 'reels' ? <Clapperboard size={40} /> : <Bookmark size={40} />
    return (
      <div className="content">
        <EmptyState icon={icon} title={`#${label}`}>
          Ce canal arrive bientot. Le fil <strong>#accueil</strong> est deja
          fonctionnel — sans aucun tracker.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="messages scroll">
        <div className="messages-inner">
          <div style={{ padding: '32px 16px 8px' }}>
            <div
              className="empty-icon"
              style={{ width: 68, height: 68, marginBottom: 12 }}
            >
              <Rss size={34} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 30 }}>
              Bienvenue sur #{label}
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Voici le debut du canal <strong>#{label}</strong>. Les publications
              de tes abonnements s'affichent comme des messages.{' '}
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
            </div>
          )}

          {feedLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement du fil…
            </div>
          )}

          {!feedLoading && feed.length === 0 && !error && (
            <EmptyState icon={<Rss size={40} />} title="Rien pour l'instant">
              Aucune publication a afficher.
            </EmptyState>
          )}

          {visible.map((post) => (
            <PostMessage key={post.id} post={post} />
          ))}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="loading-full"
              style={{ padding: 20 }}
            >
              <span className="spinner" /> Chargement…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
