import { Check, LogIn, LogOut, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen, me, mode, logout, setLoginOpen } =
    useStore()

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, setSettingsOpen])

  if (!settingsOpen) return null

  return (
    <div className="modal-overlay" onMouseDown={() => setSettingsOpen(false)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-body scroll">
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16 }}
            aria-label="Fermer"
          >
            <X size={22} />
          </button>

          <h2 className="modal-title">Parametres</h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '16px 0',
            }}
          >
            <Avatar user={me} size={48} status="online" />
            <div>
              <div
                style={{ fontWeight: 700, color: 'var(--header-primary)', fontSize: 18 }}
              >
                {me.username}
              </div>
              <span className={`tag ${mode === 'live' ? 'tag-live' : 'tag-demo'}`}>
                {mode === 'live' ? 'Connecte a Instagram' : 'Mode demo'}
              </span>
            </div>
          </div>

          <div className="privacy-card">
            <h4>
              <ShieldCheck size={16} /> Confidentialite
            </h4>
            <div className="privacy-row">
              <Check className="pr-ok" size={16} />
              Bloque : scripts Instagram/Meta, pixel de suivi, cookies
              publicitaires, analytics de la page.
            </div>
            <div className="privacy-row">
              <Check className="pr-ok" size={16} />
              Images de demo generees localement (data-URI) — zero requete
              externe.
            </div>
            <div className="privacy-row">
              <TriangleAlert className="pr-warn" size={16} />
              Cote serveur, Instagram voit toujours ton activite (c'est ton
              compte qui se connecte). Aucun client ne peut l'eviter.
            </div>
          </div>

          <div className="btn-row">
            {mode === 'live' ? (
              <button className="btn btn-danger" onClick={logout}>
                <LogOut size={18} /> Se deconnecter
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSettingsOpen(false)
                  setLoginOpen(true)
                }}
              >
                <LogIn size={18} /> Se connecter a Instagram
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => setSettingsOpen(false)}
            >
              Fermer
            </button>
          </div>

          <p className="form-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            InstaLeo — client alternatif open-source. Non affilie a Instagram ni
            a Meta.
          </p>
        </div>
      </div>
    </div>
  )
}
