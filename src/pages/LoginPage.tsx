import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginAsViewer } = useAuth();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(password);
    } catch (err) {
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
    } catch (err) {
      setError('Erreur lors de la connexion en mode lecture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>MyFermentLab</h1>
          <p>Surveillance de fermentation</p>
        </div>

        <div className="login-options">
          <div className="login-option">
            <h2>Mode Lecture</h2>
            <p className="option-description">
              Consulter les projets et graphiques sans pouvoir modifier
            </p>
            <button
              className="btn-viewer"
              onClick={handleViewerLogin}
              disabled={loading}
            >
              Continuer en lecture seule
            </button>
          </div>

          <div className="login-divider">
            <span>ou</span>
          </div>

          <div className="login-option">
            <h2>Mode Administrateur</h2>
            <p className="option-description">
              Accès complet pour gérer les projets et devices
            </p>
            <form onSubmit={handleAdminLogin}>
              <input
                type="password"
                placeholder="Mot de passe admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="password-input"
                disabled={loading}
              />
              <button
                type="submit"
                className="btn-admin"
                disabled={loading || !password}
              >
                Se connecter
              </button>
            </form>
            {error && <p className="error-message">{error}</p>}
          </div>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1a1d23 0%, #2a2e33 100%);
          padding: 20px;
        }

        .login-container {
          background: #1f2328;
          border-radius: 12px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .login-header h1 {
          font-size: 32px;
          margin: 0 0 8px 0;
          color: #e6e7e9;
        }

        .login-header p {
          color: #8e9196;
          margin: 0;
        }

        .login-options {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .login-option {
          text-align: center;
        }

        .login-option h2 {
          font-size: 18px;
          margin: 0 0 8px 0;
          color: #e6e7e9;
        }

        .option-description {
          color: #8e9196;
          font-size: 14px;
          margin: 0 0 20px 0;
        }

        .btn-viewer, .btn-admin {
          width: 100%;
          padding: 14px 24px;
          border-radius: 6px;
          border: none;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-viewer {
          background: #2ea043;
          color: white;
        }

        .btn-viewer:hover:not(:disabled) {
          background: #2c974b;
        }

        .btn-admin {
          background: #1f6feb;
          color: white;
          margin-top: 12px;
        }

        .btn-admin:hover:not(:disabled) {
          background: #388bfd;
        }

        .btn-viewer:disabled, .btn-admin:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .password-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid #30363d;
          background: #0d1117;
          color: #e6e7e9;
          font-size: 14px;
        }

        .password-input:focus {
          outline: none;
          border-color: #1f6feb;
        }

        .login-divider {
          text-align: center;
          position: relative;
          margin: 10px 0;
        }

        .login-divider::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          width: 100%;
          height: 1px;
          background: #30363d;
        }

        .login-divider span {
          background: #1f2328;
          padding: 0 16px;
          color: #8e9196;
          position: relative;
          z-index: 1;
        }

        .error-message {
          color: #f85149;
          font-size: 14px;
          margin: 12px 0 0 0;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
      `}</style>
    </div>
  );
}
