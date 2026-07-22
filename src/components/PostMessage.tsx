import { Heart, MapPin, MessageCircle, BadgeCheck } from 'lucide-react'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { generatePostImage } from '../lib/avatars'
import { formatCount, formatMessageTime } from '../lib/format'

export function PostMessage({ post }: { post: Post }) {
  const img = post.imageUrl ?? generatePostImage(post.id + post.author.username)

  return (
    <div className="msg first">
      <div className="msg-gutter">
        <Avatar user={post.author} size={40} />
      </div>
      <div className="msg-body">
        <div className="msg-head">
          <span className="msg-author">{post.author.username}</span>
          {post.author.isVerified && (
            <span className="verified-badge" title="Compte verifie">
              <BadgeCheck size={16} fill="currentColor" stroke="#313338" />
            </span>
          )}
          <span className="msg-time">{formatMessageTime(post.takenAt)}</span>
        </div>

        {post.caption && <div className="msg-text">{post.caption}</div>}
        {post.location && (
          <div className="post-location">
            <MapPin size={11} style={{ verticalAlign: 'middle' }} /> {post.location}
          </div>
        )}

        <div className="post-embed">
          <img
            className="pe-media"
            src={img}
            alt={`Publication de ${post.author.username}`}
            loading="lazy"
          />
          <div className="pe-footer">
            <span className="pe-stat like">
              <Heart size={16} /> {formatCount(post.likeCount)}
            </span>
            <span className="pe-stat">
              <MessageCircle size={16} /> {formatCount(post.commentCount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
