import { LogIn, Settings } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'

export function UserPanel() {
  const { me, mode, setSettingsOpen, setLoginOpen } = useStore()

  return (
    <div className="user-panel">
      <div className="up-info" onClick={() => setSettingsOpen(true)}>
        <Avatar user={me} size={32} status="online" />
        <div className="up-text">
          <span className="up-name">{me.username}</span>
          <span className="up-status">
            {mode === 'live' ? 'Connecte · en ligne' : 'Mode demo'}
          </span>
        </div>
      </div>
      <div className="up-actions">
        {mode === 'demo' && (
          <button
            className="icon-btn"
            title="Se connecter a Instagram"
            onClick={() => setLoginOpen(true)}
          >
            <LogIn size={20} />
          </button>
        )}
        <button
          className="icon-btn"
          title="Parametres"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  )
}
