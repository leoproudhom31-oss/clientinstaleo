import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Send, Share2, X } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { api, ApiError } from '../lib/api'
import type { ThreadPreview } from '../types'

export function ShareToDMModal() {
  const { sharePost, closeShare } = useStore()
  const [threads, setThreads] = useState<ThreadPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeShare()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeShare])

  // Charge la liste des conversations a l'ouverture.
  useEffect(() => {
    if (!sharePost) return
    let cancelled = false
    setThreads([])
    setSentIds(new Set())
    setQuery('')
    setError(null)
    setLoading(true)
    api
      .inbox()
      .then(({ threads: t }) => !cancelled && setThreads(t))
      .catch(() => !cancelled && setError('Impossible de charger tes conversations.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [sharePost])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return threads
    return threads.filter((t) => t.title.toLowerCase().includes(q))
  }, [threads, query])

  if (!sharePost) return null

  const link = sharePost.permalink || `https://www.instagram.com/p/${sharePost.id}/`

  const shareTo = async (t: ThreadPreview) => {
    if (sendingId || sentIds.has(t.id)) return
    setSendingId(t.id)
    setError(null)
    try {
      // On envoie le lien : Instagram l'affiche comme un apercu de publication
      // chez le destinataire. C'est la seule voie d'ecriture fiable (composeur).
      await api.send(t.id, link)
      setSentIds((prev) => new Set(prev).add(t.id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "L'envoi a echoue.")
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={closeShare}>
      <div className="share-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn share-close" onClick={closeShare} aria-label="Fermer">
          <X size={20} />
        </button>

        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Share2 size={18} /> Partager en message
        </h2>

        <div className="share-preview">
          {sharePost.imageUrl && <img src={sharePost.imageUrl} alt="" loading="lazy" />}
          <div className="share-preview-text">
            <strong>{sharePost.author.username}</strong>
            <span>{sharePost.caption?.slice(0, 80) || 'Publication'}</span>
          </div>
        </div>

        <div className="share-search">
          <Search size={15} />
          <input
            placeholder="Rechercher une conversation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <div className="form-error" style={{ margin: '4px 0' }}>{error}</div>}

        <div className="share-list scroll">
          {loading && (
            <div className="loading-full" style={{ padding: 30 }}>
              <span className="spinner" /> Chargement…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="pp-empty" style={{ padding: 12 }}>Aucune conversation.</p>
          )}
          {filtered.map((t) => {
            const done = sentIds.has(t.id)
            return (
              <button
                key={t.id}
                className="share-row"
                onClick={() => shareTo(t)}
                disabled={done || sendingId === t.id}
              >
                <Avatar user={t.users[0]} seed={t.id} label={t.title} size={36} />
                <span className="share-row-title">{t.title}</span>
                {done ? (
                  <span className="share-sent">
                    <Check size={16} /> Envoye
                  </span>
                ) : sendingId === t.id ? (
                  <span className="spinner" />
                ) : (
                  <span className="share-send-btn">
                    <Send size={15} /> Envoyer
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
