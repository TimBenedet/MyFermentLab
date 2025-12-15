import { useState, useEffect } from 'react';
import { apiService, HealthCheckReport, HealthCheckResult } from '../../src/services/api.service';

interface HealthCheckPageProps {
  onBack: () => void;
}

export function HealthCheckPage({ onBack }: HealthCheckPageProps) {
  const [report, setReport] = useState<HealthCheckReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHealthCheck();
  }, []);

  const loadHealthCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getHealthCheck();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger le rapport de sante');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await apiService.getHealthCheck();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return '✓';
      case 'warning':
        return '!';
      case 'error':
        return '✗';
    }
  };

  const getStatusLabel = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'OK';
      case 'warning':
        return 'Attention';
      case 'error':
        return 'Erreur';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderDetails = (check: HealthCheckResult) => {
    if (!check.details) return null;

    if (check.service === 'Prises Connectées' && check.details.outlets) {
      return (
        <div className="health-details-outlets">
          {check.details.outlets.map((outlet: { id: string; name: string; state: string }) => (
            <div key={outlet.id} className="health-outlet-item">
              <span className={`health-outlet-dot ${outlet.state}`}></span>
              <span className="health-outlet-name">{outlet.name}</span>
            </div>
          ))}
        </div>
      );
    }

    if (check.service === 'Home Assistant' && check.details.version) {
      return (
        <div className="health-details-info">
          <span>v{check.details.version}</span>
        </div>
      );
    }

    if (check.service === 'InfluxDB' && check.details.version) {
      return (
        <div className="health-details-info">
          <span>v{check.details.version}</span>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="health-page">
        <div className="health-loading">
          <div className="loading-spinner"></div>
          <p>Verification des services...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="health-page">
        <div className="health-error">
          <div className="health-error-icon">✗</div>
          <p>{error}</p>
          <button className="health-retry-btn" onClick={loadHealthCheck}>
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="health-page">
      {report && (
        <>
          {/* Overall Status */}
          <div className={`health-overall ${report.overall}`}>
            <div className={`health-overall-badge ${report.overall}`}>
              <span className="health-overall-icon">{getStatusIcon(report.overall)}</span>
            </div>
            <div className="health-overall-info">
              <span className="health-overall-label">
                {report.overall === 'ok' ? 'Tout fonctionne' :
                 report.overall === 'warning' ? 'Attention requise' : 'Probleme detecte'}
              </span>
              <span className="health-overall-time">
                {formatTimestamp(report.timestamp)}
              </span>
            </div>
            <button
              className={`health-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>

          {/* Health Cards */}
          <div className="health-cards">
            {report.checks.map((check) => (
              <div key={check.service} className={`health-card ${check.status}`}>
                <div className="health-card-header">
                  <div className={`health-card-icon ${check.status}`}>
                    {getStatusIcon(check.status)}
                  </div>
                  <div className="health-card-title">
                    <h4>{check.service}</h4>
                    <span className={`health-card-status ${check.status}`}>
                      {getStatusLabel(check.status)}
                    </span>
                  </div>
                </div>
                <p className="health-card-message">{check.message}</p>
                {renderDetails(check)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
