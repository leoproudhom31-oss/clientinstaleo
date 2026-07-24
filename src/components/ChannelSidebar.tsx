import {
  Bell,
  Bookmark,
  Clapperboard,
  Compass,
  Hash,
  Heart,
  MessageSquare,
  PenSquare,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserCircle,
  Circle,
} from 'lucide-react'
import { useStore } from '../state/store'
import { spaceMeta } from '../lib/spaces'
import { Avatar } from './Avatar'
import { UserPanel } from './UserPanel'
import { formatRelative } from '../lib/format'
import { useIncremental } from '../lib/useIncremental'
import { errorHint } from '../lib/errors'
import type { ThreadPreview } from '../types'

const FEED_CHANNELS = [
  { id: 'accueil', label: 'accueil', icon: Hash },
  { id: 'stories', label: 'stories', icon: Circle },
  { id: 'reels', label: 'reels', icon: Clapperboard },
  { id: 'saved', label: 'enregistres', icon: Bookmark },
]

function DmItem({ t }: { t: ThreadPreview }) {
  const { activeThreadId, openThread } = useStore()
  const primary = t.users[0]
  return (
    <div
      className={`channel-item channel-dm ${activeThreadId === t.id ? 'active' : ''}`}
      onClick={() => openThread(t.id)}
    >
      <Avatar
        user={primary}
        seed={t.id}
        label={t.title}
        size={32}
        status={t.unread ? 'online' : 'offline'}
      />
      <div className="ci-text">
        <span className="ci-label">{t.title}</span>
        <span className="ci-sub">
          {t.isGroup ? `${t.users.length + 1} membres · ` : ''}
          {formatRelative(t.lastActivity)}
        </span>
      </div>
      {t.unread && <span className="ci-badge">1</span>}
    </div>
  )
}

export function ChannelSidebar() {
  const {
    space,
    feedChannel,
    setFeedChannel,
    threads,
    threadsLoading,
    error,
    errorCode,
    refreshInbox,
    setNewChatOpen,
  } = useStore()
  const meta = spaceMeta(space)
  const dm = useIncremental(threads, 12, 10)

  return (
    <aside className="channel-sidebar">
      <div className="sidebar-header">
        {space === 'direct' ? <MessageSquare size={18} /> : null}
        <span>{meta.label}</span>
        <span className="shield" title="Aucun tracker charge">
          <ShieldCheck size={18} />
        </span>
      </div>

      <div className="channel-list scroll">
        {space === 'feed' && (
          <>
            <div className="channel-category">
              <span>Canaux</span>
            </div>
            {FEED_CHANNELS.map((c) => {
              const Icon = c.icon
              return (
                <div
                  key={c.id}
                  className={`channel-item ${feedChannel === c.id ? 'active' : ''}`}
                  onClick={() => setFeedChannel(c.id)}
                >
                  <span className="ci-icon">
                    <Icon size={18} />
                  </span>
                  <span className="ci-label">{c.label}</span>
                </div>
              )
            })}
          </>
        )}

        {space === 'direct' && (
          <>
            <div className="channel-category">
              <span>Messages prives</span>
              <button
                className="newchat-btn"
                onClick={() => setNewChatOpen(true)}
                title="Nouvelle conversation"
              >
                <PenSquare size={15} />
              </button>
            </div>
            {threadsLoading && (
              <div className="channel-item" style={{ cursor: 'default' }}>
                <span className="ci-label" style={{ color: 'var(--text-faint)' }}>
                  Chargement…
                </span>
              </div>
            )}
            {!threadsLoading && error && (
              <div className="sidebar-error">
                <div className="sidebar-error-msg">
                  <TriangleAlert size={15} />
                  <span>{error}</span>
                </div>
                {errorHint(errorCode) && (
                  <p className="sidebar-error-hint">{errorHint(errorCode)}</p>
                )}
                <button className="sidebar-error-retry" onClick={refreshInbox}>
                  <RefreshCw size={13} /> Reessayer
                </button>
              </div>
            )}
            {!threadsLoading && !error && threads.length === 0 && (
              <div className="channel-item" style={{ cursor: 'default' }}>
                <span className="ci-sub">Aucune conversation</span>
              </div>
            )}
            {dm.visible.map((t) => (
              <DmItem key={t.id} t={t} />
            ))}
            {dm.hasMore && (
              <div
                ref={dm.sentinelRef}
                className="channel-item"
                style={{ cursor: 'default', justifyContent: 'center' }}
              >
                <span className="spinner" />
              </div>
            )}
          </>
        )}

        {space === 'explore' && (
          <div className="channel-category">
            <Compass size={14} /> <span>Explorer</span>
          </div>
        )}
        {space === 'notifications' && (
          <div className="channel-category">
            <Bell size={14} /> <span>Activite</span>
          </div>
        )}
        {space === 'profile' && (
          <div className="channel-category">
            <UserCircle size={14} /> <span>Mon compte</span>
          </div>
        )}
        {space === 'notifications' && (
          <div className="channel-item" style={{ cursor: 'default' }}>
            <span className="ci-icon">
              <Heart size={18} />
            </span>
            <span className="ci-label">j’aime & commentaires</span>
          </div>
        )}
      </div>

      <UserPanel />
    </aside>
  )
}
