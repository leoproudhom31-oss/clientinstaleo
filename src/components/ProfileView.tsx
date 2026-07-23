import { Grid3x3, LogIn, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { generatePostImage } from '../lib/avatars'
import { useIncremental } from '../lib/useIncremental'
import { api } from '../lib/api'
import type { Post } from '../types'

export function ProfileView() {
  const { me, mode, setLoginOpen, setSettingsOpen } = useStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (mode !== 'live') {
      // Demo : grille decorative generee localement.
      setPosts(
        Array.from({ length: 9 }).map((_, i) => ({
          id: `demo-grid-${i}`,
          author: me,
          takenAt: 0,
          caption: '',
          imageUrl: null,
          likeCount: 0,
          commentCount: 0,
        })),
      )
      return
    }
    setLoading(true)
    api
      .profile()
      .then(({ posts: p }) => {
        if (!cancelled) setPosts(p)
      })
      .catch(() => {
        if (!cancelled) setPosts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, me])

  // Rendu incremental : 9 vignettes, puis +9 au scroll.
  const { visible, hasMore, sentinelRef } = useIncremental(posts, 9, 9)

  return (
    <div className="content">
      <div className="messages scroll">
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: 24 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar user={me} size={96} status="online" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 26, color: 'var(--header-primary)' }}>
                  {me.username}
                </h1>
                <span className={`tag ${mode === 'live' ? 'tag-live' : 'tag-demo'}`}>
                  {mode === 'live' ? 'Connecte' : 'Demo'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{me.fullName}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {mode === 'demo' ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '8px 16px' }}
                    onClick={() => setLoginOpen(true)}
                  >
                    <LogIn size={16} /> Se connecter
                  </button>
                ) : null}
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 16px', background: 'var(--bg-input)' }}
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={16} /> Parametres
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '28px 0 12px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Grid3x3 size={16} /> Publications
            {posts.length > 0 && (
              <span style={{ color: 'var(--text-faint)' }}>· {posts.length}</span>
            )}
          </div>

          {loading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement de tes publications…
            </div>
          )}

          {!loading && posts.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Aucune publication a afficher.</p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
            }}
          >
            {visible.map((post, i) => (
              <img
                key={post.id}
                src={post.imageUrl ?? generatePostImage(`${me.username}-${post.id}-${i}`)}
                alt={post.caption ? post.caption.slice(0, 40) : ''}
                title={post.caption || undefined}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  objectFit: 'cover',
                  borderRadius: 4,
                  background: 'var(--bg-sidebar)',
                }}
                loading="lazy"
              />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="loading-full" style={{ padding: 16 }}>
              <span className="spinner" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
