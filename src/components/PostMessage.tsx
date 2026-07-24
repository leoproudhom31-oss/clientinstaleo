import { MapPin, BadgeCheck } from 'lucide-react'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { formatMessageTime } from '../lib/format'
import { PostEmbedCard } from './PostEmbedCard'
import { useStore } from '../state/store'

export function PostMessage({ post }: { post: Post }) {
  const { openUserProfile } = useStore()
  return (
    <div className="msg first">
      <div
        className="msg-gutter clickable"
        onClick={() => openUserProfile(post.author)}
        title={`Voir le profil de ${post.author.username}`}
      >
        <Avatar user={post.author} size={40} />
      </div>
      <div className="msg-body">
        <div className="msg-head">
          <span
            className="msg-author clickable"
            onClick={() => openUserProfile(post.author)}
          >
            {post.author.username}
          </span>
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
