import { MapPin, BadgeCheck } from 'lucide-react'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { formatMessageTime } from '../lib/format'
import { PostEmbedCard } from './PostEmbedCard'

export function PostMessage({ post }: { post: Post }) {
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

        <PostEmbedCard post={post} />
      </div>
    </div>
  )
}
