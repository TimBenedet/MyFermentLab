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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const renderDetails = (check: HealthCheckResult) => {
    if (!check.details) return null;

    // Cas spécial pour les prises connectées
    if (check.service === 'Prises Connectées' && check.details.outlets) {
      return (
        <div className="health-details-outlets">
          {check.details.outlets.map((outlet: { id: string; name: string; state: string }) => (
            <div key={outlet.id} className="outlet-item">
              <span className={`outlet-state ${outlet.state}`}>
                {outlet.state === 'on' ? '●' : '○'}
              </span>
              <span className="outlet-name">{outlet.name}</span>
            </div>
          ))}
        </div>
      );
    }

    // Cas spécial pour VM Home Assistant
    if (check.service === 'VM Home Assistant' && check.details.ip) {
      return (
        <div className="health-details-info">
          <span>IP: {check.details.ip}:{check.details.port}</span>
          {check.details.latency && <span>Latence: {check.details.latency}ms</span>}
        </div>
      );
    }

    // Cas spécial pour Home Assistant
    if (check.service === 'Home Assistant' && check.details.version) {
      return (
        <div className="health-details-info">
          <span>Version: {check.details.version}</span>
          {check.details.latency && <span>Latence: {check.details.latency}ms</span>}
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

    // Cas spécial pour les capteurs actifs
    if (check.service === 'Capteurs Actifs' && check.details.sensors) {
      return (
        <div className="health-details-sensors">
          {check.details.sensors.map((sensor: { project: string; sensor: string; status: string; temperature?: string; ageMinutes?: number }, index: number) => (
            <div key={index} className={`sensor-item ${sensor.status}`}>
              <span className={`sensor-status-dot ${sensor.status}`}>
                {sensor.status === 'ok' ? '●' : sensor.status === 'warning' ? '◐' : '○'}
              </span>
              <div className="sensor-info">
                <span className="sensor-project">{sensor.project}</span>
                <span className="sensor-name">{sensor.sensor}</span>
              </div>
              {sensor.temperature && (
                <span className="sensor-temp">{sensor.temperature}°C</span>
              )}
              {sensor.ageMinutes !== undefined && (
                <span className={`sensor-age ${sensor.status}`}>
                  {sensor.ageMinutes < 60 ? `${sensor.ageMinutes}min` : `${Math.round(sensor.ageMinutes / 60)}h`}
                </span>
              )}
            </div>
          ))}
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
              <span className="overall-title">Statut Global</span>
              <span className="overall-timestamp">
                {formatTimestamp(report.timestamp)}
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
              Vérifications automatiques toutes les heures.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
