import {
  Check,
  Instagram,
  Lock,
  MailCheck,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { api, ApiError } from '../lib/api'
import { desktop, isDesktop } from '../lib/desktop'

type Step = 'credentials' | 'twofactor' | 'challenge'

export function LoginModal() {
  const { loginOpen, setLoginOpen, onLoggedIn } = useStore()
  const [step, setStep] = useState<Step>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [twoFactorId, setTwoFactorId] = useState('')
  const [method, setMethod] = useState('1')
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setLoginOpen(false)
    setError(null)
    setPassword('')
    setCode('')
    setStep('credentials')
  }

  useEffect(() => {
    if (!loginOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginOpen])

  if (!loginOpen) return null

  function handleResponse(res: Awaited<ReturnType<typeof api.login>>) {
    if ('twoFactorRequired' in res && res.twoFactorRequired) {
      setTwoFactorId(res.twoFactorIdentifier)
      setMethod(res.method ?? '1')
      setHint(res.hint ?? '')
      setCode('')
      setStep('twofactor')
    } else if ('challengeRequired' in res && res.challengeRequired) {
      setHint(res.hint ?? '')
      setCode('')
      setStep('challenge')
    } else if ('user' in res) {
      onLoggedIn(res.user)
    }
  }

  // Connexion via une vraie fenetre Instagram (app de bureau) : la connexion a
  // lieu sur la page officielle, aucun robot detecte.
  async function browserLogin() {
    if (!desktop) return
    setBrowserLoading(true)
    setError(null)
    try {
      const r = await desktop.igLogin()
      if (r.cancelled) return
      if (!r.ok) {
        setError("La connexion Instagram n'a pas abouti. Reessaie.")
        return
      }
      const { user } = await api.me()
      onLoggedIn(user)
    } catch {
      setError(
        'Connexion etablie mais impossible de charger ton profil. Reessaie dans un instant.',
      )
    } finally {
      setBrowserLoading(false)
    }
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      handleResponse(await api.login(username.trim(), password))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitTwoFactor(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      handleResponse(
        await api.loginTwoFactor(username.trim(), code.trim(), twoFactorId, method),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitChallenge(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      handleResponse(await api.loginChallenge(username.trim(), code.trim()))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-body scroll">
          <button
            className="icon-btn"
            onClick={close}
            style={{ position: 'absolute', top: 16, right: 16 }}
            aria-label="Fermer"
          >
            <X size={22} />
          </button>

          {step === 'credentials' && (
            <>
              <h2 className="modal-title">Se connecter a Instagram</h2>
              <p className="modal-subtitle">
                {isDesktop
                  ? 'Connexion sur la vraie page Instagram, sans blocage.'
                  : 'Tes identifiants transitent uniquement par ton propre serveur.'}
              </p>

              {isDesktop && (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={browserLogin}
                    disabled={browserLoading}
                    style={{ marginTop: 8 }}
                  >
                    {browserLoading ? (
                      <span className="spinner" />
                    ) : (
                      <Instagram size={18} />
                    )}
                    {browserLoading
                      ? 'Fenetre Instagram ouverte…'
                      : 'Se connecter avec Instagram'}
                  </button>
                  <div className="privacy-row" style={{ marginTop: 10 }}>
                    <ShieldCheck className="pr-ok" size={16} />
                    Recommande : tu te connectes dans une vraie fenetre Instagram
                    (2FA gerees par Instagram), puis l'app reutilise ta session.
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      margin: '18px 0 6px',
                      color: 'var(--text-faint)',
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    <span style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
                    ou identifiants (avance)
                    <span style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
                  </div>
                </>
              )}

              {!isDesktop && (
                <div className="privacy-row" style={{ marginBottom: 8 }}>
                  <TriangleAlert className="pr-warn" size={16} />
                  La connexion reelle fonctionne surtout dans l'app de bureau
                  (npm start). Ici, prefere le mode demo.
                </div>
              )}

              <form onSubmit={submitCredentials}>
                <label className="form-label">
                  Nom d'utilisateur ou e-mail <span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
                <label className="form-label">
                  Mot de passe <span className="req">*</span>
                </label>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                {error && <div className="form-error">{error}</div>}

                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading || !username.trim() || !password}
                  >
                    {loading ? <span className="spinner" /> : <Lock size={18} />}
                    {loading ? 'Connexion…' : 'Se connecter'}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={close}>
                    Continuer en mode demo
                  </button>
                </div>
              </form>

              <div className="privacy-card">
                <h4>
                  <ShieldCheck size={16} /> Ce que fait ce client
                </h4>
                <div className="privacy-row">
                  <Check className="pr-ok" size={16} />
                  Aucun script Instagram/Meta, aucun pixel ni cookie tiers n'est
                  charge dans la page.
                </div>
                <div className="privacy-row">
                  <Check className="pr-ok" size={16} />
                  La connexion se fait cote serveur (fonction Vercel), la session
                  est chiffree dans un cookie httpOnly.
                </div>
                <div className="privacy-row">
                  <TriangleAlert className="pr-warn" size={16} />
                  Utilise l'API privee d'Instagram : contraire a ses CGU, a tes
                  risques. Une verification peut etre demandee.
                </div>
              </div>
            </>
          )}

          {step === 'twofactor' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <ShieldQuestion size={40} color="var(--brand)" />
              </div>
              <h2 className="modal-title">Double authentification</h2>
              <p className="modal-subtitle">
                {hint || 'Saisis le code de verification.'}
              </p>
              <CodeForm
                onSubmit={submitTwoFactor}
                code={code}
                setCode={setCode}
                loading={loading}
                error={error}
                onBack={() => {
                  setStep('credentials')
                  setError(null)
                }}
              />
            </>
          )}

          {step === 'challenge' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <MailCheck size={40} color="var(--yellow)" />
              </div>
              <h2 className="modal-title">Verification de securite</h2>
              <p className="modal-subtitle">
                {hint ||
                  'Instagram a detecte une connexion inhabituelle. Saisis le code envoye par e-mail ou SMS.'}
              </p>
              <CodeForm
                onSubmit={submitChallenge}
                code={code}
                setCode={setCode}
                loading={loading}
                error={error}
                onBack={() => {
                  setStep('credentials')
                  setError(null)
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeForm({
  onSubmit,
  code,
  setCode,
  loading,
  error,
  onBack,
}: {
  onSubmit: (e: React.FormEvent) => void
  code: string
  setCode: (v: string) => void
  loading: boolean
  error: string | null
  onBack: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <label className="form-label">Code de verification</label>
      <input
        className="form-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoFocus
        placeholder="123456"
        style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
      />
      {error && <div className="form-error">{error}</div>}
      <div className="btn-row">
        <button className="btn btn-primary" type="submit" disabled={loading || !code.trim()}>
          {loading ? <span className="spinner" /> : <Check size={18} />}
          {loading ? 'Verification…' : 'Valider'}
        </button>
        <button className="btn btn-secondary" type="button" onClick={onBack}>
          Retour
        </button>
      </div>
    </form>
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'live_disabled')
      return "La connexion reelle est desactivee sur ce deploiement (ENABLE_LIVE_LOGIN=false). Le mode demo reste disponible."
    if (err.code === 'challenge_expired')
      return 'La verification a expire. Recommence la connexion.'
    return err.message
  }
  return 'Une erreur inattendue est survenue.'
}
