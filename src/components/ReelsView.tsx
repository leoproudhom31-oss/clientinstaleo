import { useEffect, useRef, useState } from 'react'
import { Clapperboard, ExternalLink, Heart, Play, ShieldCheck } from 'lucide-react'
import { useStore } from '../state/store'
import type { Reel } from '../types'
import { Avatar } from './Avatar'
import { EmptyState } from './EmptyState'
import { formatCount } from '../lib/format'
import { errorHint } from '../lib/errors'

function ReelCard({ reel }: { reel: Reel }) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="reel-card">
      <div className="reel-video" onClick={() => reel.videoUrl && setPlaying(true)}>
        {playing && reel.videoUrl ? (
          <video
            className="reel-media"
            src={reel.videoUrl}
            poster={reel.imageUrl ?? undefined}
            controls
            autoPlay
            loop
            playsInline
          />
        ) : (
          <>
            {reel.imageUrl ? (
              <img className="reel-media" src={reel.imageUrl} alt={reel.caption || 'Reel'} />
            ) : (
              <div className="reel-media reel-media-empty">
                <Clapperboard size={40} />
              </div>
            )}
            {reel.videoUrl && (
              <span className="reel-play">
                <Play size={26} fill="currentColor" />
              </span>
            )}
          </>
        )}
      </div>

      <div className="reel-info">
        <div className="reel-author">
          <Avatar user={reel.author} size={30} />
          <span className="reel-author-name">{reel.author.username}</span>
        </div>
        {reel.caption && <p className="reel-caption">{reel.caption}</p>}
        <div className="reel-stats">
          <span title="J'aime">
            <Heart size={14} /> {formatCount(reel.likeCount)}
          </span>
          {reel.viewCount > 0 && (
            <span title="Vues">
              <Play size={13} /> {formatCount(reel.viewCount)}
            </span>
          )}
          {reel.permalink && (
            <a
              className="reel-link"
              href={reel.permalink}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={13} /> Instagram
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReelsView() {
  const {
    reels,
    reelsLoading,
    reelsLoadingMore,
    loadMoreReels,
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
        if (entries[0].isIntersecting) loadMoreReels()
      },
      { root, rootMargin: '1000px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode, loadMoreReels, reels.length])

  return (
    <div className="content">
      <div className="messages scroll" ref={containerRef}>
        <div className="messages-inner">
          <div style={{ padding: '28px 16px 4px' }}>
            <div
              className="empty-icon"
              style={{ width: 64, height: 64, marginBottom: 12 }}
            >
              <Clapperboard size={30} color="var(--brand)" />
            </div>
            <h1 style={{ color: 'var(--header-primary)', margin: '0 0 6px', fontSize: 28 }}>
              Reels
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 15, lineHeight: 1.5 }}>
              Les videos courtes de tes abonnements, sans etre piste.{' '}
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

          {reelsLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement des reels…
            </div>
          )}

          {!reelsLoading && !error && reels.length === 0 && (
            <EmptyState icon={<Clapperboard size={40} />} title="Aucun reel">
              Aucun reel a afficher pour le moment.
            </EmptyState>
          )}

          {reels.length > 0 && (
            <div className="reel-grid">
              {reels.map((reel) => (
                <ReelCard key={reel.id} reel={reel} />
              ))}
            </div>
          )}

          {mode === 'live' && !reelsLoading && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
          {reelsLoadingMore && (
            <div className="loading-full" style={{ padding: 20 }}>
              <span className="spinner" /> Chargement…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
