import { BadgeCheck, Grid3x3, Lock, LogIn, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { generatePostImage } from '../lib/avatars'
import { api } from '../lib/api'
import { formatCount } from '../lib/format'
import type { Post, User } from '../types'

export function ProfileView() {
  const { me, mode, setLoginOpen, setSettingsOpen, openPost } = useStore()
  const [profile, setProfile] = useState<User>(me)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextMaxId, setNextMaxId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setProfile(me)
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
      setHasMore(false)
      setNextMaxId(null)
      return
    }
    setLoading(true)
    // Fiche complete (bio + compteurs) + 1re page de publications.
    api
      .user(me.username)
      .then(({ user, posts: p, hasMore: h, nextMaxId: n }) => {
        if (cancelled) return
        setProfile({ ...me, ...user })
        setPosts(p)
        setHasMore(h)
        setNextMaxId(n)
      })
      .catch(() => {
        // Repli : au moins les publications via /profile.
        if (cancelled) return
        api
          .profile()
          .then(({ posts: p, hasMore: h, nextMaxId: n }) => {
            if (cancelled) return
            setPosts(p)
            setHasMore(h)
            setNextMaxId(n)
          })
          .catch(() => {
            if (!cancelled) setPosts([])
          })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, me])

  const loadMore = useCallback(async () => {
    if (mode !== 'live' || !hasMore || !nextMaxId || loadingMore) return
    setLoadingMore(true)
    try {
      const { posts: p, hasMore: h, nextMaxId: n } = await api.profile(nextMaxId)
      setPosts((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...p.filter((x) => !seen.has(x.id))]
      })
      setHasMore(h)
      setNextMaxId(n)
    } catch {
      /* on garde ce qui est deja affiche */
    } finally {
      setLoadingMore(false)
    }
  }, [mode, hasMore, nextMaxId, loadingMore])

  useEffect(() => {
    if (mode !== 'live') return
    const el = sentinelRef.current
    const root = containerRef.current
    if (!el || !root) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { root, rootMargin: '800px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode, loadMore, posts.length])

  const stat = (n: number | undefined, fallback: number) =>
    n != null ? formatCount(n) : formatCount(fallback)

  return (
    <div className="content">
      <div className="messages scroll" ref={containerRef}>
        <div style={{ maxWidth: 860, margin: '0 auto', width: '100%', padding: 24 }}>
          <div className="profile-hero">
            <Avatar user={profile} size={112} status={mode === 'live' ? 'online' : 'none'} />
            <div className="profile-hero-info">
              <div className="profile-hero-name">
                <h1>{profile.username}</h1>
                {profile.isVerified && (
                  <span className="verified-badge" title="Compte verifie">
                    <BadgeCheck size={20} fill="currentColor" stroke="var(--bg-primary, #313338)" />
                  </span>
                )}
                {profile.isPrivate && (
                  <span className="pp-private" title="Compte prive">
                    <Lock size={12} /> prive
                  </span>
                )}
                <span className={`tag ${mode === 'live' ? 'tag-live' : 'tag-demo'}`}>
                  {mode === 'live' ? 'Connecte' : 'Demo'}
                </span>
              </div>

              <div className="profile-stats">
                <div>
                  <strong>{stat(profile.postCount, posts.length)}</strong> publications
                </div>
                <div>
                  <strong>{profile.followerCount != null ? formatCount(profile.followerCount) : '—'}</strong>{' '}
                  abonnes
                </div>
                <div>
                  <strong>{profile.followingCount != null ? formatCount(profile.followingCount) : '—'}</strong>{' '}
                  abonnements
                </div>
              </div>

              {profile.fullName && <div className="profile-fullname">{profile.fullName}</div>}
              {profile.biography && <p className="profile-bio">{profile.biography}</p>}

              <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
                {mode === 'demo' && (
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '8px 16px' }}
                    onClick={() => setLoginOpen(true)}
                  >
                    <LogIn size={16} /> Se connecter
                  </button>
                )}
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

          <div className="profile-grid-head">
            <Grid3x3 size={16} /> Publications
            {posts.length > 0 && <span>· {posts.length}</span>}
          </div>

          {loading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement de tes publications…
            </div>
          )}

          {!loading && posts.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>Aucune publication a afficher.</p>
          )}

          <div className="profile-grid">
            {posts.map((post, i) => (
              <button
                key={post.id}
                className="profile-grid-item"
                onClick={() => mode === 'live' && openPost(post.id)}
                title={post.caption || 'Voir la publication'}
              >
                <img
                  src={post.imageUrl ?? generatePostImage(`${profile.username}-${post.id}-${i}`)}
                  alt={post.caption ? post.caption.slice(0, 40) : ''}
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {mode === 'live' && hasMore && (
            <div ref={sentinelRef} className="loading-full" style={{ padding: 16 }}>
              {loadingMore && <span className="spinner" />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
