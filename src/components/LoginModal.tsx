import { Check, Lock, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { api, ApiError } from '../lib/api'

type Step = 'credentials' | 'twofactor'

export function LoginModal() {
  const { loginOpen, setLoginOpen, onLoggedIn } = useStore()
  const [step, setStep] = useState<Step>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [twoFactorId, setTwoFactorId] = useState('')
  const [loading, setLoading] = useState(false)
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

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.login(username.trim(), password)
      if ('twoFactorRequired' in res && res.twoFactorRequired) {
        setTwoFactorId(res.twoFactorIdentifier)
        setStep('twofactor')
      } else if ('user' in res) {
        onLoggedIn(res.user)
      }
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
      const res = await api.loginTwoFactor(username.trim(), code.trim(), twoFactorId)
      if ('user' in res) onLoggedIn(res.user)
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

          {step === 'credentials' ? (
            <>
              <h2 className="modal-title">Se connecter a Instagram</h2>
              <p className="modal-subtitle">
                Tes identifiants transitent uniquement par ton propre serveur.
              </p>

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
                  risques. Une double authentification peut etre demandee.
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="modal-title">Double authentification</h2>
              <p className="modal-subtitle">
                Saisis le code recu par SMS ou via ton application
                d'authentification.
              </p>
              <form onSubmit={submitTwoFactor}>
                <label className="form-label">Code a 6 chiffres</label>
                <input
                  className="form-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                  placeholder="123456"
                />
                {error && <div className="form-error">{error}</div>}
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading || !code.trim()}
                  >
                    {loading ? <span className="spinner" /> : <Check size={18} />}
                    {loading ? 'Verification…' : 'Valider'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setStep('credentials')
                      setError(null)
                    }}
                  >
                    Retour
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'live_disabled')
      return "La connexion reelle est desactivee sur ce deploiement (ENABLE_LIVE_LOGIN=false). Le mode demo reste disponible."
    if (err.code === 'checkpoint')
      return "Instagram demande une verification supplementaire (checkpoint). Ouvre l'app officielle pour valider la connexion, puis reessaie."
    return err.message
  }
  return 'Une erreur inattendue est survenue.'
}
