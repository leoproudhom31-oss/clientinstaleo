import { useEffect, useRef } from 'react'
import { Bookmark, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import { PostMessage } from './PostMessage'
import { EmptyState } from './EmptyState'
import { errorHint } from '../lib/errors'

export function SavedView() {
  const {
    saved,
    savedLoading,
    savedLoadingMore,
    loadMoreSaved,
    error,
    errorCode,
    mode,
  } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'live') return
    const el = sentinelRef.current
    const root = containerRef.current
    if (!el || !root) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreSaved()
      },
      { root, rootMargin: '1000px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode, loadMoreSaved, saved.length])

  return (
    <div className="content">
      <div className="messages scroll" ref={containerRef}>
        <div className="messages-inner">
          <div style={{ padding: '28px 16px 4px' }}>
            <div
              className="empty-icon"
              style={{ width: 64, height: 64, marginBottom: 12 }}
            >
              <Bookmark size={30} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 28 }}>
              Enregistres
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Les publications que tu as mises de cote.{' '}
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

          {savedLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement…
            </div>
          )}

          {!savedLoading && saved.length === 0 && !error && (
            <EmptyState icon={<Bookmark size={40} />} title="Rien d'enregistre">
              Tu n'as pas encore enregistre de publication.
            </EmptyState>
          )}

          {saved.map((post) => (
            <PostMessage key={post.id} post={post} />
          ))}

          {mode === 'live' && !savedLoading && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
          {savedLoadingMore && (
            <div className="loading-full" style={{ padding: 20 }}>
              <span className="spinner" /> Chargement…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
