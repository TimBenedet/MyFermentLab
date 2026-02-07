import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, Cpu } from 'lucide-react'
import { login, loginAsViewer } from '../api/auth'
import { useConnection } from '../context/ConnectionContext'
import { FermentLogo } from '../components/layout/FermentLogo'

export function LoginPage() {
  const navigate = useNavigate()
  const { setMode, setRole, checkBackend } = useConnection()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(password)
      setRole(res.role)
      setMode('live')
      await checkBackend()
      navigate('/')
    } catch {
      setError('Mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  const handleViewer = async () => {
    setLoading(true)
    try {
      const res = await loginAsViewer()
      setRole(res.role)
      setMode('live')
      await checkBackend()
      navigate('/')
    } catch {
      setError('Backend indisponible')
    } finally {
      setLoading(false)
    }
  }

  const handleSimulation = () => {
    setMode('simulation')
    setRole(null)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-scada-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <FermentLogo size={48} className="text-scada-accent mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white tracking-wider">BrewSCADA</h1>
          <p className="text-[10px] text-scada-text-muted uppercase tracking-widest mt-1">Fermentation Monitor</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="scada-card space-y-4">
          <div className="scada-label">Connexion Admin</div>

          <div>
            <label className="text-[10px] text-scada-text-muted uppercase tracking-wider block mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              placeholder="Entrer le mot de passe"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-[11px] text-scada-danger bg-scada-danger/10 rounded-lg px-3 py-2 border border-scada-danger/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-scada-accent/20 text-scada-accent border border-scada-accent/40 rounded-lg text-sm font-medium hover:bg-scada-accent/30 transition-colors disabled:opacity-50"
          >
            <Lock size={14} />
            {loading ? 'Connexion...' : 'Connexion'}
          </button>
        </form>

        {/* Alternative modes */}
        <div className="mt-4 space-y-2">
          <button
            onClick={handleViewer}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-scada-bg-secondary border border-scada-border rounded-lg text-sm text-scada-text-secondary hover:text-white transition-colors disabled:opacity-50"
          >
            <Eye size={14} />
            Mode Viewer (lecture seule)
          </button>

          <button
            onClick={handleSimulation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-scada-text-muted hover:text-scada-text-secondary transition-colors"
          >
            <Cpu size={14} />
            Mode Simulation (hors-ligne)
          </button>
        </div>
      </div>
    </div>
  )
}
