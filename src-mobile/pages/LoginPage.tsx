import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login, loginAsViewer } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(password);
    } catch {
      setError('Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleViewerLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await loginAsViewer();
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">🧪</div>
          <h1>MyFermentLab</h1>
          <p>Mobile</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="password"
              placeholder="Mot de passe admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              disabled={loading}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn primary" disabled={loading || !password}>
            {loading ? 'Connexion...' : 'Connexion Admin'}
          </button>

          <div className="login-divider">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="login-btn secondary"
            onClick={handleViewerLogin}
            disabled={loading}
          >
            Mode Consultation
          </button>
        </form>
      </div>
    </div>
  );
}
