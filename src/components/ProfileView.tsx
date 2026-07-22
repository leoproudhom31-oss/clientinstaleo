import { Grid3x3, LogIn, Settings } from 'lucide-react'
import { useStore } from '../state/store'
import { Avatar } from './Avatar'
import { generatePostImage } from '../lib/avatars'

export function ProfileView() {
  const { me, mode, setLoginOpen, setSettingsOpen } = useStore()

  return (
    <div className="content">
      <div className="messages scroll">
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: 24 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar user={me} size={96} status="online" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 26, color: 'var(--header-primary)' }}>
                  {me.username}
                </h1>
                <span className={`tag ${mode === 'live' ? 'tag-live' : 'tag-demo'}`}>
                  {mode === 'live' ? 'Connecte' : 'Demo'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{me.fullName}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                {mode === 'demo' ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '8px 16px' }}
                    onClick={() => setLoginOpen(true)}
                  >
                    <LogIn size={16} /> Se connecter
                  </button>
                ) : null}
                <button
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '8px 16px', background: 'var(--bg-input)' }}
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={16} /> Parametres
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '28px 0 12px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Grid3x3 size={16} /> Publications
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 4,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <img
                key={i}
                src={generatePostImage(`${me.username}-grid-${i}`)}
                alt=""
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4 }}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
