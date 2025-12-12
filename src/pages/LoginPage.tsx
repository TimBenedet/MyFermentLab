import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onViewHealth?: () => void;
}

export function LoginPage({ onViewHealth }: LoginPageProps) {
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

          {onViewHealth && (
            <>
              <div className="login-divider">
                <span>ou</span>
              </div>

              <div className="login-option">
                <button
                  className="btn-health"
                  onClick={onViewHealth}
                  disabled={loading}
                >
                  Santé du système
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1f1f1f;
          padding: 20px;
        }

        .login-container {
          background: #252525;
          border-radius: 12px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          border: 1px solid #333;
        }

        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .login-header h1 {
          font-size: 32px;
          margin: 0 0 8px 0;
          color: #fff;
        }

        .login-header p {
          color: #888;
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
          color: #fff;
        }

        .option-description {
          color: #888;
          font-size: 14px;
          margin: 0 0 20px 0;
        }

        .btn-viewer, .btn-admin, .btn-health {
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
          background: #10B981;
          color: white;
        }

        .btn-viewer:hover:not(:disabled) {
          background: #059669;
        }

        .btn-admin {
          background: #3B82F6;
          color: white;
          margin-top: 12px;
        }

        .btn-admin:hover:not(:disabled) {
          background: #2563EB;
        }

        .btn-health {
          background: transparent;
          color: #10B981;
          border: 1px solid #10B981;
        }

        .btn-health:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.1);
        }

        .btn-viewer:disabled, .btn-admin:disabled, .btn-health:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .password-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid #333;
          background: #1f1f1f;
          color: #fff;
          font-size: 14px;
          box-sizing: border-box;
        }

        .password-input:focus {
          outline: none;
          border-color: #10B981;
        }

        .password-input::placeholder {
          color: #666;
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
          background: #333;
        }

        .login-divider span {
          background: #252525;
          padding: 0 16px;
          color: #666;
          position: relative;
          z-index: 1;
        }

        .error-message {
          color: #EF4444;
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
