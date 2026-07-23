import { useEffect, useState } from 'react'
import { BadgeCheck, ExternalLink, Grid3x3, Lock, X } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { api, ApiError } from '../lib/api'
import { formatCount } from '../lib/format'
import { generatePostImage } from '../lib/avatars'
import type { Post, User } from '../types'

export function UserProfileModal() {
  const { profileUser, closeUserProfile, mode } = useStore()
  const [full, setFull] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeUserProfile()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeUserProfile])

  // Charge la fiche complete (bio, compteurs, publications) en mode connecte.
  useEffect(() => {
    if (!profileUser) return
    setFull(null)
    setPosts([])
    setError(null)
    if (mode !== 'live') return
    let cancelled = false
    setLoading(true)
    api
      .user(profileUser.username)
      .then(({ user, posts: p }) => {
        if (cancelled) return
        setFull(user)
        setPosts(p)
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

  if (!profileUser) return null
  const u = full ?? profileUser
  const igUrl = `https://www.instagram.com/${u.username}/`

  return (
    <div className="modal-overlay" onMouseDown={closeUserProfile}>
      <div className="profile-popout" onMouseDown={(e) => e.stopPropagation()}>
        <button
          className="icon-btn profile-popout-close"
          onClick={closeUserProfile}
          aria-label="Fermer"
        >
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
            {/* Compteurs facon Instagram */}
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
                {posts.slice(0, 9).map((post, i) => (
                  <img
                    key={post.id}
                    src={post.imageUrl ?? generatePostImage(`${u.username}-${post.id}-${i}`)}
                    alt={post.caption ? post.caption.slice(0, 40) : ''}
                    title={post.caption || undefined}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}
          {!loading && !error && mode === 'live' && posts.length === 0 && u.isPrivate && (
            <p className="pp-empty">
              <Lock size={14} /> Ce compte est prive.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
