import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, PenSquare, Search, X } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { api, ApiError } from '../lib/api'
import type { User } from '../types'

export function NewConversationModal() {
  const { newChatOpen, setNewChatOpen, openThread, refreshInbox, setSpace } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [selected, setSelected] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNewChatOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setNewChatOpen])

  useEffect(() => {
    if (!newChatOpen) {
      setQuery('')
      setResults([])
      setSelected([])
      setError(null)
    }
  }, [newChatOpen])

  // Recherche debouncee.
  useEffect(() => {
    if (!newChatOpen) return
    window.clearTimeout(debounce.current)
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    debounce.current = window.setTimeout(() => {
      setSearching(true)
      api
        .searchUsers(q)
        .then(({ users }) => setResults(users))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => window.clearTimeout(debounce.current)
  }, [query, newChatOpen])

  if (!newChatOpen) return null

  const toggle = (u: User) => {
    setSelected((prev) =>
      prev.some((x) => x.pk === u.pk) ? prev.filter((x) => x.pk !== u.pk) : [...prev, u],
    )
  }

  const start = async () => {
    if (!selected.length || starting) return
    setStarting(true)
    setError(null)
    try {
      const { threadId } = await api.startThread(selected.map((u) => u.username))
      setNewChatOpen(false)
      setSpace('direct')
      refreshInbox()
      openThread(threadId)
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Impossible de creer la conversation. Reessaie.',
      )
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={() => setNewChatOpen(false)}>
      <div className="newchat-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="icon-btn share-close" onClick={() => setNewChatOpen(false)} aria-label="Fermer">
          <X size={20} />
        </button>
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PenSquare size={18} /> Nouvelle conversation
        </h2>

        {selected.length > 0 && (
          <div className="newchat-chips">
            {selected.map((u) => (
              <span key={u.pk} className="newchat-chip" onClick={() => toggle(u)}>
                {u.username} <X size={12} />
              </span>
            ))}
          </div>
        )}

        <div className="share-search">
          <Search size={15} />
          <input
            placeholder="Rechercher un compte…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <div className="form-error" style={{ margin: '4px 0' }}>{error}</div>}

        <div className="share-list scroll">
          {searching && (
            <div className="loading-full" style={{ padding: 20 }}>
              <span className="spinner" /> Recherche…
            </div>
          )}
          {!searching && query.trim() && results.length === 0 && (
            <p className="pp-empty" style={{ padding: 12 }}>Aucun compte trouve.</p>
          )}
          {results.map((u) => {
            const on = selected.some((x) => x.pk === u.pk)
            return (
              <button key={u.pk} className={`share-row ${on ? 'selected' : ''}`} onClick={() => toggle(u)}>
                <Avatar user={u} size={36} />
                <span className="share-row-title">
                  {u.username}
                  {u.isVerified && (
                    <BadgeCheck size={13} fill="currentColor" stroke="var(--bg-floating,#232428)" />
                  )}
                  <span className="newchat-fullname">{u.fullName}</span>
                </span>
                <span className={`newchat-check ${on ? 'on' : ''}`} />
              </button>
            )
          })}
        </div>

        <button className="btn btn-primary newchat-start" onClick={start} disabled={!selected.length || starting}>
          {starting ? (
            <>
              <span className="spinner" /> Creation…
            </>
          ) : selected.length > 1 ? (
            `Creer le groupe (${selected.length})`
          ) : (
            'Demarrer la conversation'
          )}
        </button>
      </div>
    </div>
  )
}
