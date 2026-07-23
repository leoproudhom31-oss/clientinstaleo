import {
  AtSign,
  Heart,
  Image as ImageIcon,
  Info,
  Phone,
  Share2,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../state/store'
import { MessageComposer } from './MessageComposer'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'
import {
  formatMessageTime,
  formatShortTime,
  shouldGroup,
} from '../lib/format'
import type { Message, User } from '../types'

const META_ICON: Record<string, typeof ImageIcon> = {
  media: ImageIcon,
  share: Share2,
  call: Phone,
  unsupported: Info,
}

function MessageRow({
  message,
  sender,
  grouped,
}: {
  message: Message
  sender: User
  grouped: boolean
}) {
  if (message.itemType === 'system') {
    return <div className="msg-system">{message.text}</div>
  }

  const Icon = META_ICON[message.itemType]

  return (
    <div className={`msg ${grouped ? 'grouped' : 'first'}`}>
      <div className="msg-gutter">
        {grouped ? (
          <span className="msg-timestamp-hover">
            {formatShortTime(message.timestamp)}
          </span>
        ) : (
          <Avatar user={sender} size={40} />
        )}
      </div>
      <div className="msg-body">
        {!grouped && (
          <div className="msg-head">
            <span className="msg-author">{sender.username}</span>
            <span className="msg-time">{formatMessageTime(message.timestamp)}</span>
          </div>
        )}

        {message.itemType === 'like' && (
          <div className="msg-like">
            <Heart size={18} color="var(--red)" fill="var(--red)" /> a aime un
            message
          </div>
        )}

        {message.itemType === 'text' && message.text && (
          <div className="msg-text">{message.text}</div>
        )}

        {Icon && (
          <div className={`msg-meta ${message.itemType}`}>
            <Icon size={15} />
            <span>{message.text}</span>
          </div>
        )}

        {message.failed && (
          <div className="msg-failed">
            <TriangleAlert size={13} /> Non envoye (Instagram a refuse le
            message)
          </div>
        )}
      </div>
    </div>
  )
}

export function DMView() {
  const { activeThread, threadLoading, olderLoading, loadOlderMessages, me } =
    useStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Distingue "nouveau message ajoute a la fin" (-> defiler vers le bas) de
  // "historique charge en haut" (-> garder la position de lecture actuelle).
  const prevFirstId = useRef<string | null>(null)
  const prevLastId = useRef<string | null>(null)
  const anchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)

  const userMap = useMemo(() => {
    const map = new Map<string, User>()
    map.set(me.pk, me)
    activeThread?.users.forEach((u) => map.set(u.pk, u))
    return map
  }, [activeThread, me])

  // Repere en haut de la liste : charge l'historique quand il devient visible.
  useEffect(() => {
    const el = sentinelRef.current
    const container = scrollRef.current
    if (!el || !container || !activeThread?.hasOlder) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !olderLoading) {
          anchor.current = {
            scrollHeight: container.scrollHeight,
            scrollTop: container.scrollTop,
          }
          loadOlderMessages()
        }
      },
      { root: container, rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [activeThread?.hasOlder, activeThread?.id, olderLoading, loadOlderMessages])

  useEffect(() => {
    const el = scrollRef.current
    const msgs = activeThread?.messages
    if (!el || !msgs || msgs.length === 0) return

    const firstId = msgs[0].id
    const lastId = msgs[msgs.length - 1].id
    const isInitial = prevFirstId.current === null
    const prepended = !isInitial && firstId !== prevFirstId.current
    const appended = !isInitial && lastId !== prevLastId.current

    if (prepended && anchor.current) {
      // Historique charge en haut : on garde le meme point de lecture.
      const { scrollHeight, scrollTop } = anchor.current
      el.scrollTop = el.scrollHeight - scrollHeight + scrollTop
      anchor.current = null
    } else if (isInitial || appended) {
      el.scrollTop = el.scrollHeight
    }

    prevFirstId.current = firstId
    prevLastId.current = lastId
  }, [activeThread?.messages, activeThread?.id])

  // Nouvelle conversation ouverte : on repart de zero pour la logique de scroll.
  useEffect(() => {
    prevFirstId.current = null
    prevLastId.current = null
    anchor.current = null
  }, [activeThread?.id])

  if (!activeThread && !threadLoading) {
    return (
      <div className="content">
        <EmptyState icon={<AtSign size={40} />} title="Tes messages prives">
          Selectionne une conversation dans la liste de gauche pour l'afficher
          ici, façon salon Discord.
        </EmptyState>
      </div>
    )
  }

  const fallbackUser = (id: string): User =>
    userMap.get(id) ?? {
      pk: id,
      username: 'inconnu',
      fullName: 'Inconnu',
      avatarUrl: null,
    }

  return (
    <div className="content">
      <div className="messages scroll" ref={scrollRef}>
        <div className="messages-inner">
          {threadLoading && (
            <div className="loading-full" style={{ padding: 40 }}>
              <span className="spinner" /> Chargement de la conversation…
            </div>
          )}

          {!threadLoading && activeThread && (
            <>
              {activeThread.hasOlder ? (
                <div ref={sentinelRef} className="load-older">
                  <span className="spinner" /> Chargement des messages
                  precedents…
                </div>
              ) : (
                <div style={{ padding: '32px 16px 8px' }}>
                  <Avatar
                    user={activeThread.users[0]}
                    seed={activeThread.id}
                    label={activeThread.title}
                    size={72}
                  />
                  <h1
                    style={{
                      color: 'var(--header-primary)',
                      margin: '12px 0 6px',
                      fontSize: 28,
                    }}
                  >
                    {activeThread.title}
                  </h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    Debut de ta conversation avec{' '}
                    <strong>{activeThread.title}</strong>.
                  </p>
                </div>
              )}

              {activeThread.messages.map((m, i) => {
                const prev = activeThread.messages[i - 1]
                const grouped = prev
                  ? shouldGroup(prev.timestamp, m.timestamp, prev.senderId === m.senderId)
                  : false
                return (
                  <MessageRow
                    key={m.id}
                    message={m}
                    sender={fallbackUser(m.senderId)}
                    grouped={grouped}
                  />
                )
              })}
            </>
          )}
        </div>
      </div>

      {activeThread && (
        <MessageComposer placeholder={`Envoyer un message a ${activeThread.title}`} />
      )}
    </div>
  )
}
