import { BadgeCheck, Heart, MessageCircle } from 'lucide-react'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { generatePostImage } from '../lib/avatars'
import { formatCount } from '../lib/format'

interface Props {
  post: Post
  /** Affiche l'auteur + la legende dans la carte (utile quand le contexte
   * environnant ne les montre pas deja, ex. une publication partagee en DM). */
  showAuthor?: boolean
}

// Vignette d'une publication/reel : image + compteurs, facon apercu Discord
// d'un lien. Reutilisee dans le fil (PostMessage) et pour les publications
// partagees en messages prives.
export function PostEmbedCard({ post, showAuthor = false }: Props) {
  const img = post.imageUrl ?? generatePostImage(post.id + post.author.username)
  return (
    <div className="post-embed">
      {showAuthor && (
        <div className="pe-header">
          <Avatar user={post.author} size={24} />
          <span className="pe-author">{post.author.username}</span>
          {post.author.isVerified && (
            <BadgeCheck size={14} fill="var(--brand)" stroke="#2b2d31" />
          )}
        </div>
      )}
      <img
        className="pe-media"
        src={img}
        alt={`Publication de ${post.author.username}`}
        loading="lazy"
      />
      {showAuthor && post.caption && <div className="pe-caption">{post.caption}</div>}
      <div className="pe-footer">
        <span className="pe-stat like">
          <Heart size={16} /> {formatCount(post.likeCount)}
        </span>
        <span className="pe-stat">
          <MessageCircle size={16} /> {formatCount(post.commentCount)}
        </span>
      </div>
    </div>
  )
}
