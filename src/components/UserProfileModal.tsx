import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, ExternalLink, Grid3x3, Lock, X } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { StoryViewer } from './StoryViewer'
import { api, ApiError } from '../lib/api'
import { formatCount } from '../lib/format'
import { generatePostImage } from '../lib/avatars'
import type { Highlight, Post, StoryItem, StoryTray, User } from '../types'

export function UserProfileModal() {
  const { profileUser, closeUserProfile, openPost, mode } = useStore()
  const [full, setFull] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextMaxId, setNextMaxId] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightAt, setHighlightAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeUserProfile()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeUserProfile])

  // Charge la fiche complete (bio, compteurs, publications, highlights).
  useEffect(() => {
    if (!profileUser) return
    setFull(null)
    setPosts([])
    setHighlights([])
    setHasMore(false)
    setNextMaxId(null)
    setError(null)
    if (mode !== 'live') return
    let cancelled = false
    setLoading(true)
    api
      .user(profileUser.username)
      .then(({ user, posts: p, hasMore: h, nextMaxId: n }) => {
        if (cancelled) return
        setFull(user)
        setPosts(p)
        setHasMore(h)
        setNextMaxId(n)
        // Highlights en arriere-plan (echec tolere).
        api
          .highlights(user.pk)
          .then((r) => !cancelled && setHighlights(r.highlights))
          .catch(() => undefined)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : 'Profil indisponible.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileUser, mode])

  const loadMore = useCallback(async () => {
    const u = full ?? profileUser
    if (!u || !hasMore || !nextMaxId || loadingMore) return
    setLoadingMore(true)
    try {
      const { posts: p, hasMore: h, nextMaxId: n } = await api.userPosts(u.pk, nextMaxId)
      setPosts((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...p.filter((x) => !seen.has(x.id))]
      })
      setHasMore(h)
      setNextMaxId(n)
    } catch {
      /* on garde ce qui est deja charge */
    } finally {
      setLoadingMore(false)
    }
  }, [full, profileUser, hasMore, nextMaxId, loadingMore])

  if (!profileUser) return null
  const u = full ?? profileUser
  const igUrl = `https://www.instagram.com/${u.username}/`

  // Chaque highlight devient une "tray" pour la visionneuse ; ses items sont
  // charges a la demande via reels_media (prefixe highlight:).
  const highlightTrays: StoryTray[] = highlights.map((h) => ({
    id: h.id,
    user: u,
    seen: false,
    mediaCount: 0,
    items: [],
    takenAt: 0,
  }))
  const loadHighlightItems = (id: string): Promise<StoryItem[]> =>
    api.storyReel(id).then((r) => r.items)

  return (
    <div className="modal-overlay" onMouseDown={closeUserProfile}>
      <div className="profile-popout" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn profile-popout-close" onClick={closeUserProfile} aria-label="Fermer">
          <X size={20} />
        </button>

        <div className="profile-banner" />

        <div className="profile-popout-body">
          <div className="profile-popout-avatar">
            <Avatar user={u} size={80} />
          </div>

          <div className="profile-popout-name">
            <span className="pp-fullname">{u.fullName || u.username}</span>
            {u.isVerified && (
              <span className="verified-badge" title="Compte verifie">
                <BadgeCheck size={18} fill="currentColor" stroke="var(--bg-floating, #232428)" />
              </span>
            )}
          </div>
          <div className="pp-username">
            @{u.username}
            {u.isPrivate && (
              <span className="pp-private" title="Compte prive">
                <Lock size={12} /> prive
              </span>
            )}
          </div>

          <div className="pp-card">
            <div className="pp-stats">
              <div>
                <strong>{formatCount(u.postCount ?? posts.length)}</strong>
                <span>publications</span>
              </div>
              <div>
                <strong>{u.followerCount != null ? formatCount(u.followerCount) : '—'}</strong>
                <span>abonnes</span>
              </div>
              <div>
                <strong>{u.followingCount != null ? formatCount(u.followingCount) : '—'}</strong>
                <span>abonnements</span>
              </div>
            </div>

            {u.biography && (
              <div className="pp-section">
                <h4>A propos</h4>
                <p className="pp-bio">{u.biography}</p>
              </div>
            )}

            <a className="btn btn-primary pp-ig-btn" href={igUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink size={16} /> Voir sur Instagram
            </a>
          </div>

          {/* Stories a la une (highlights) */}
          {highlights.length > 0 && (
            <div className="pp-section" style={{ width: '100%' }}>
              <h4>A la une</h4>
              <div className="pp-highlights">
                {highlights.map((h, i) => (
                  <button key={h.id} className="pp-highlight" onClick={() => setHighlightAt(i)}>
                    <span className="pp-highlight-ring">
                      {h.cover ? (
                        <img src={h.cover} alt={h.title} loading="lazy" />
                      ) : (
                        <span className="pp-highlight-empty" />
                      )}
                    </span>
                    <span className="pp-highlight-title">{h.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-full" style={{ padding: 20 }}>
              <span className="spinner" /> Chargement du profil…
            </div>
          )}
          {error && <div className="form-error" style={{ margin: '4px 0' }}>{error}</div>}

          {!loading && posts.length > 0 && (
            <div className="pp-section" style={{ width: '100%' }}>
              <h4>
                <Grid3x3 size={14} /> Publications
              </h4>
              <div className="pp-grid">
                {posts.map((post, i) => (
                  <button
                    key={post.id}
                    className="pp-grid-item"
                    onClick={() => openPost(post.id)}
                    title={post.caption || 'Voir la publication'}
                  >
                    <img
                      src={post.imageUrl ?? generatePostImage(`${u.username}-${post.id}-${i}`)}
                      alt={post.caption ? post.caption.slice(0, 40) : ''}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              {hasMore && (
                <button className="btn btn-secondary pp-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <span className="spinner" /> : 'Voir plus de publications'}
                </button>
              )}
            </div>
          )}
          {!loading && !error && mode === 'live' && posts.length === 0 && u.isPrivate && (
            <p className="pp-empty">
              <Lock size={14} /> Ce compte est prive.
            </p>
          )}
        </div>
      </div>

      {highlightAt !== null && highlightTrays.length > 0 && (
        <StoryViewer
          trays={highlightTrays}
          initialTray={highlightAt}
          onClose={() => setHighlightAt(null)}
          loadItems={loadHighlightItems}
        />
      )}
    </div>
  )
}
