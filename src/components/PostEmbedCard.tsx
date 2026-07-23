import { BadgeCheck, ExternalLink, Heart, MessageCircle } from 'lucide-react'
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
// partagees en messages prives. Le clic ouvre la vraie publication sur
// Instagram dans le navigateur par defaut (via le lien permanent /p/<code>/).
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

      {post.permalink ? (
        <a
          className="pe-media-link"
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          title="Ouvrir sur Instagram"
        >
          <img
            className="pe-media"
            src={img}
            alt={`Publication de ${post.author.username}`}
            loading="lazy"
          />
          <span className="pe-open-overlay">
            <ExternalLink size={14} /> Ouvrir sur Instagram
          </span>
        </a>
      ) : (
        <img
          className="pe-media"
          src={img}
          alt={`Publication de ${post.author.username}`}
          loading="lazy"
        />
      )}

      {showAuthor && post.caption && <div className="pe-caption">{post.caption}</div>}

      <div className="pe-footer">
        <span className="pe-stat like">
          <Heart size={16} /> {formatCount(post.likeCount)}
        </span>
        <span className="pe-stat">
          <MessageCircle size={16} /> {formatCount(post.commentCount)}
        </span>
        {post.permalink && (
          <a
            className="pe-stat pe-external"
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} /> Voir sur Instagram
          </a>
        )}
      </div>
    </div>
  )
}
