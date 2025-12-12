import { useState, useEffect } from 'react';
import { apiService, HealthCheckReport, HealthCheckResult } from '../services/api.service';

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
      setError(err.message || 'Impossible de charger le rapport de santé');
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

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
    }
  };

  const getStatusLabel = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'Opérationnel';
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderDetails = (check: HealthCheckResult) => {
    if (!check.details) return null;

    // Cas spécial pour les outlets
    if (check.service === 'Smart Outlets' && check.details.outlets) {
      return (
        <div className="health-details-outlets">
          {check.details.outlets.map((outlet: { id: string; state: string }) => (
            <div key={outlet.id} className="outlet-item">
              <span className={`outlet-state ${outlet.state}`}>
                {outlet.state === 'on' ? '●' : '○'}
              </span>
              <span className="outlet-id">{outlet.id.replace('switch.smart_switch_', '').replace('_outlet', '')}</span>
            </div>
          ))}
        </div>
      );
    }

    // Cas spécial pour InfluxDB
    if (check.service === 'InfluxDB' && check.details.version) {
      return (
        <div className="health-details-info">
          <span>Version: {check.details.version}</span>
          <span>{check.details.message}</span>
        </div>
      );
    }

    // Cas spécial pour les capteurs
    if (check.service === 'Sensor Data' && check.details.temperature) {
      return (
        <div className="health-details-info">
          <span>Température: {check.details.temperature}°C</span>
          <span>Dernière mise à jour: {new Date(check.details.lastUpdated).toLocaleString('fr-FR')}</span>
        </div>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="health-check-page">
        <div className="page-header-compact">
          <button className="btn-text" onClick={onBack}>
            ← Retour
          </button>
          <h1>État du Système</h1>
        </div>
        <div className="health-loading">
          <div className="loading-spinner"></div>
          <p>Vérification des services...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="health-check-page">
        <div className="page-header-compact">
          <button className="btn-text" onClick={onBack}>
            ← Retour
          </button>
          <h1>État du Système</h1>
        </div>
        <div className="health-error">
          <span className="error-icon">✗</span>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadHealthCheck}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="health-check-page">
      <div className="page-header-compact">
        <button className="btn-text" onClick={onBack}>
          ← Retour
        </button>
        <h1>État du Système</h1>
        <button
          className="btn-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Actualiser"
        >
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      {report && (
        <>
          <div className="health-overall" style={{ borderColor: getStatusColor(report.overall) }}>
            <div
              className="overall-status"
              style={{ backgroundColor: getStatusColor(report.overall) }}
            >
              <span className="overall-icon">{getStatusIcon(report.overall)}</span>
              <span className="overall-label">{getStatusLabel(report.overall)}</span>
            </div>
            <div className="overall-info">
              <span className="overall-title">Statut Global du Système</span>
              <span className="overall-timestamp">
                Dernière vérification: {formatTimestamp(report.timestamp)}
              </span>
            </div>
          </div>

          <div className="health-checks-grid">
            {report.checks.map((check) => (
              <div
                key={check.service}
                className={`health-check-card ${check.status}`}
              >
                <div className="check-header">
                  <span
                    className="check-icon"
                    style={{ backgroundColor: getStatusColor(check.status) }}
                  >
                    {getStatusIcon(check.status)}
                  </span>
                  <div className="check-title">
                    <h3>{check.service}</h3>
                    <span
                      className="check-status-badge"
                      style={{ color: getStatusColor(check.status) }}
                    >
                      {getStatusLabel(check.status)}
                    </span>
                  </div>
                </div>
                <p className="check-message">{check.message}</p>
                {renderDetails(check)}
              </div>
            ))}
          </div>

          <div className="health-info">
            <p>
              Les vérifications automatiques sont effectuées toutes les heures.
              Un rapport est généré et enregistré dans les logs du backend.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
