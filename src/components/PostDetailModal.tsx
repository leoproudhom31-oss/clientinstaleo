import { useEffect, useState } from 'react'
import { BadgeCheck, ExternalLink, Heart, MapPin, MessageCircle, X } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { api, ApiError } from '../lib/api'
import { formatCount, formatRelative } from '../lib/format'
import type { Comment, Post, User } from '../types'

export function PostDetailModal() {
  const { postId, closePost, openUserProfile } = useStore()
  const [post, setPost] = useState<Post | null>(null)
  const [likers, setLikers] = useState<User[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePost()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePost])

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    setPost(null)
    setLikers([])
    setComments([])
    setError(null)
    setLoading(true)
    api
      .post(postId)
      .then((r) => {
        if (cancelled) return
        setPost(r.post)
        setLikers(r.likers)
        setComments(r.comments)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Publication indisponible.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  if (!postId) return null

  const openAuthor = (u: User) => {
    closePost()
    openUserProfile(u)
  }

  return (
    <div className="modal-overlay" onMouseDown={closePost}>
      <div className="post-detail" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn post-detail-close" onClick={closePost} aria-label="Fermer">
          <X size={22} />
        </button>

        {loading && (
          <div className="loading-full" style={{ padding: 60 }}>
            <span className="spinner" /> Chargement…
          </div>
        )}
        {error && <div className="form-error" style={{ margin: 24 }}>{error}</div>}

        {post && (
          <div className="post-detail-grid">
            <div className="post-detail-media">
              {post.imageUrl ? (
                <img src={post.imageUrl} alt={post.caption?.slice(0, 60) || ''} />
              ) : (
                <div className="post-detail-media-empty" />
              )}
            </div>

            <div className="post-detail-side">
              <div className="post-detail-head">
                <span className="clickable" onClick={() => openAuthor(post.author)}>
                  <Avatar user={post.author} size={40} />
                </span>
                <div>
                  <div className="pd-author clickable" onClick={() => openAuthor(post.author)}>
                    {post.author.username}
                    {post.author.isVerified && (
                      <BadgeCheck size={14} fill="currentColor" stroke="var(--bg-floating,#232428)" />
                    )}
                  </div>
                  {post.location && (
                    <div className="pd-location">
                      <MapPin size={11} /> {post.location}
                    </div>
                  )}
                </div>
              </div>

              <div className="post-detail-scroll scroll">
                {post.caption && (
                  <div className="pd-caption">
                    <strong className="clickable" onClick={() => openAuthor(post.author)}>
                      {post.author.username}
                    </strong>{' '}
                    {post.caption}
                  </div>
                )}

                {comments.length > 0 ? (
                  comments.map((c) => (
                    <div key={c.id} className="pd-comment">
                      <span className="clickable" onClick={() => openAuthor(c.user)}>
                        <Avatar user={c.user} size={28} />
                      </span>
                      <div className="pd-comment-body">
                        <span>
                          <strong className="clickable" onClick={() => openAuthor(c.user)}>
                            {c.user.username}
                          </strong>{' '}
                          {c.text}
                        </span>
                        <span className="pd-comment-meta">
                          {c.createdAt > 0 && formatRelative(c.createdAt)}
                          {c.likeCount > 0 && ` · ${formatCount(c.likeCount)} j'aime`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="pd-empty">
                    <MessageCircle size={14} /> Aucun commentaire visible.
                  </p>
                )}
              </div>

              <div className="post-detail-foot">
                <div className="pd-stats">
                  <span>
                    <Heart size={15} /> {formatCount(post.likeCount)} j'aime
                  </span>
                  <span>
                    <MessageCircle size={15} /> {formatCount(post.commentCount)}
                  </span>
                </div>
                {likers.length > 0 && (
                  <div className="pd-likers">
                    {likers.slice(0, 8).map((u) => (
                      <span
                        key={u.pk}
                        className="pd-liker clickable"
                        title={u.username}
                        onClick={() => openAuthor(u)}
                      >
                        <Avatar user={u} size={24} />
                      </span>
                    ))}
                    <span className="pd-likers-label">
                      Aime par{' '}
                      <strong className="clickable" onClick={() => openAuthor(likers[0])}>
                        {likers[0].username}
                      </strong>
                      {post.likeCount > 1 && ` et ${formatCount(post.likeCount - 1)} autres`}
                    </span>
                  </div>
                )}
                {post.permalink && (
                  <a
                    className="btn btn-secondary pd-ig"
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink size={14} /> Voir sur Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
