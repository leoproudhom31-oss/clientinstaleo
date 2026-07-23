import { useEffect, useRef } from 'react'
import { Compass, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import { EmptyState } from './EmptyState'
import { errorHint } from '../lib/errors'

export function ExploreView() {
  const {
    explore,
    exploreLoading,
    exploreLoadingMore,
    loadMoreExplore,
    openUserProfile,
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
        if (entries[0].isIntersecting) loadMoreExplore()
      },
      { root, rootMargin: '1000px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode, loadMoreExplore, explore.length])

  return (
    <div className="content">
      <div className="messages scroll" ref={containerRef}>
        <div className="messages-inner">
          <div style={{ padding: '28px 16px 4px' }}>
            <div className="empty-icon" style={{ width: 64, height: 64, marginBottom: 12 }}>
              <Compass size={30} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 28 }}>
              Explorer
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Decouvre de nouveaux comptes et publications.{' '}
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

          {exploreLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement de l'explorateur…
            </div>
          )}

          {!exploreLoading && !error && explore.length === 0 && (
            <EmptyState icon={<Compass size={40} />} title="Rien a explorer">
              Aucune publication a decouvrir pour le moment.
            </EmptyState>
          )}

          {explore.length > 0 && (
            <div className="explore-grid">
              {explore.map((post) => (
                <button
                  key={post.id}
                  className="explore-item"
                  onClick={() => openUserProfile(post.author)}
                  title={`Voir le profil de ${post.author.username}`}
                >
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.caption?.slice(0, 40) || ''} loading="lazy" />
                  ) : (
                    <div className="explore-item-empty" />
                  )}
                  <span className="explore-item-user">@{post.author.username}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'live' && !exploreLoading && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
          {exploreLoadingMore && (
            <div className="loading-full" style={{ padding: 20 }}>
              <span className="spinner" /> Chargement…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
