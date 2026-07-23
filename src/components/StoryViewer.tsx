import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { StoryItem, StoryTray } from '../types'
import { Avatar } from './Avatar'
import { formatRelative } from '../lib/format'

const IMAGE_DURATION = 5000 // ms par photo
const DEFAULT_VIDEO_DURATION = 10000 // repli si la duree video est inconnue

interface Props {
  trays: StoryTray[]
  initialTray: number
  onClose: () => void
  loadItems: (reelId: string) => Promise<StoryItem[]>
}

export function StoryViewer({ trays, initialTray, onClose, loadItems }: Props) {
  const [trayIndex, setTrayIndex] = useState(initialTray)
  const [itemIndex, setItemIndex] = useState(0)
  const [items, setItems] = useState<StoryItem[]>(trays[initialTray]?.items ?? [])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const tray = trays[trayIndex]
  const item = items[itemIndex] as StoryItem | undefined

  // Charge (ou recharge) les items du compte courant quand on change de tuile.
  useEffect(() => {
    let cancelled = false
    const t = trays[trayIndex]
    if (!t) return
    setItemIndex(0)
    setProgress(0)
    if (t.items.length) {
      setItems(t.items)
      return
    }
    setLoading(true)
    setItems([])
    loadItems(t.id)
      .then((res) => {
        if (!cancelled) setItems(res)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [trayIndex, trays, loadItems])

  const goNextTray = useCallback(() => {
    setTrayIndex((i) => {
      if (i + 1 < trays.length) return i + 1
      onClose()
      return i
    })
  }, [trays.length, onClose])

  const goPrevTray = useCallback(() => {
    setTrayIndex((i) => Math.max(0, i - 1))
  }, [])

  const next = useCallback(() => {
    setProgress(0)
    setItemIndex((idx) => {
      if (idx + 1 < items.length) return idx + 1
      goNextTray()
      return idx
    })
  }, [items.length, goNextTray])

  const prev = useCallback(() => {
    setProgress(0)
    setItemIndex((idx) => {
      if (idx > 0) return idx - 1
      goPrevTray()
      return idx
    })
  }, [goPrevTray])

  // Barre de progression + passage automatique a l'item suivant.
  useEffect(() => {
    if (loading || !item) return
    // Pour une video, on laisse l'element <video> piloter la fin (onEnded).
    if (item.isVideo) return
    const start = Date.now()
    const id = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / IMAGE_DURATION)
      setProgress(p)
      if (p >= 1) {
        window.clearInterval(id)
        next()
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [item, loading, next])

  // Clavier : fleches pour naviguer, Echap pour fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  if (!tray) return null

  return (
    <div className="story-overlay" onClick={onClose}>
      <button className="story-close" onClick={onClose} aria-label="Fermer">
        <X size={26} />
      </button>

      {trayIndex > 0 && (
        <button
          className="story-nav prev"
          onClick={(e) => {
            e.stopPropagation()
            goPrevTray()
          }}
          aria-label="Compte precedent"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <div className="story-stage" onClick={(e) => e.stopPropagation()}>
        {/* Barres de progression (une par item) */}
        <div className="story-progress">
          {items.map((_, i) => (
            <div key={i} className="story-progress-track">
              <div
                className="story-progress-fill"
                style={{
                  width:
                    i < itemIndex ? '100%' : i === itemIndex ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* En-tete : compte + heure */}
        <div className="story-head">
          <Avatar user={tray.user} size={34} />
          <div className="story-head-text">
            <span className="story-head-name">{tray.user.username}</span>
            {item && (
              <span className="story-head-time">{formatRelative(item.takenAt)}</span>
            )}
          </div>
        </div>

        {/* Media */}
        <div className="story-media">
          {loading && <div className="spinner" />}
          {!loading && !item && (
            <div className="story-empty">Story indisponible.</div>
          )}
          {!loading && item && item.isVideo && item.videoUrl && (
            <video
              key={item.id}
              ref={videoRef}
              className="story-visual"
              src={item.videoUrl}
              poster={item.imageUrl ?? undefined}
              autoPlay
              playsInline
              onEnded={next}
              onTimeUpdate={(e) => {
                const v = e.currentTarget
                const d = v.duration || DEFAULT_VIDEO_DURATION / 1000
                if (d) setProgress(Math.min(1, v.currentTime / d))
              }}
            />
          )}
          {!loading && item && (!item.isVideo || !item.videoUrl) && item.imageUrl && (
            <img className="story-visual" src={item.imageUrl} alt="Story" />
          )}
        </div>

        {/* Zones de clic invisibles : gauche = precedent, droite = suivant */}
        <button className="story-tap left" onClick={prev} aria-label="Precedent" />
        <button className="story-tap right" onClick={next} aria-label="Suivant" />
      </div>

      {trayIndex < trays.length - 1 && (
        <button
          className="story-nav next"
          onClick={(e) => {
            e.stopPropagation()
            goNextTray()
          }}
          aria-label="Compte suivant"
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  )
}
