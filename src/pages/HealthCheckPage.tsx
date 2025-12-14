import { useState, useEffect } from 'react';
import { apiService, HealthCheckReport, HealthCheckResult } from '../services/api.service';
import './HealthCheckPage.css';

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
        return 'Operationnel';
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

    // Cas special pour les prises connectees
    if (check.service === 'Prises Connectées' && check.details.outlets) {
      return (
        <div className="scada-details-outlets">
          {check.details.outlets.map((outlet: { id: string; name: string; state: string }) => (
            <div key={outlet.id} className="scada-outlet-item">
              <span className={`scada-outlet-dot ${outlet.state}`}>
                {outlet.state === 'on' ? '●' : '○'}
              </span>
              <span className="scada-outlet-name">{outlet.name}</span>
            </div>
          ))}
        </div>
      );
    }

    // Cas special pour VM Home Assistant
    if (check.service === 'VM Home Assistant' && check.details.ip) {
      return (
        <div className="scada-details-info">
          <span>IP: {check.details.ip}:{check.details.port}</span>
          {check.details.latency && <span>Latence: {check.details.latency}ms</span>}
        </div>
      );
    }

    // Cas special pour Home Assistant
    if (check.service === 'Home Assistant' && check.details.version) {
      return (
        <div className="scada-details-info">
          <span>Version: {check.details.version}</span>
          {check.details.latency && <span>Latence: {check.details.latency}ms</span>}
        </div>
      );
    }

    // Cas special pour InfluxDB
    if (check.service === 'InfluxDB' && check.details.version) {
      return (
        <div className="scada-details-info">
          <span>Version: {check.details.version}</span>
          <span>{check.details.message}</span>
        </div>
      );
    }

    // Cas special pour les capteurs actifs
    if (check.service === 'Capteurs Actifs' && check.details.sensors) {
      return (
        <div className="scada-details-sensors">
          {check.details.sensors.map((sensor: { project: string; sensor: string; status: string; temperature?: string; ageMinutes?: number }, index: number) => (
            <div key={index} className={`scada-sensor-item ${sensor.status}`}>
              <span className={`scada-sensor-dot ${sensor.status}`}>
                {sensor.status === 'ok' ? '●' : sensor.status === 'warning' ? '◐' : '○'}
              </span>
              <div className="scada-sensor-info">
                <span className="scada-sensor-project">{sensor.project}</span>
                <span className="scada-sensor-name">{sensor.sensor}</span>
              </div>
              {sensor.temperature && (
                <span className="scada-sensor-temp">{sensor.temperature}°C</span>
              )}
              {sensor.ageMinutes !== undefined && (
                <span className={`scada-sensor-age ${sensor.status}`}>
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
      <div className="scada-health-page">
        <div className="scada-health-header">
          <div className="scada-health-header-left">
            <button className="scada-btn-back" onClick={onBack}>
              <span>←</span> Retour
            </button>
            <h1 className="scada-health-title">Etat du Systeme</h1>
          </div>
        </div>
        <div className="scada-health-loading">
          <div className="scada-loading-spinner"></div>
          <p>Verification des services...</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="scada-health-page">
        <div className="scada-health-header">
          <div className="scada-health-header-left">
            <button className="scada-btn-back" onClick={onBack}>
              <span>←</span> Retour
            </button>
            <h1 className="scada-health-title">Etat du Systeme</h1>
          </div>
        </div>
        <div className="scada-health-error">
          <div className="scada-error-icon">✗</div>
          <p>{error}</p>
          <button className="scada-btn-retry" onClick={loadHealthCheck}>
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scada-health-page">
      <div className="scada-health-header">
        <div className="scada-health-header-left">
          <button className="scada-btn-back" onClick={onBack}>
            <span>←</span> Retour
          </button>
          <h1 className="scada-health-title">Etat du Systeme</h1>
        </div>
        <button
          className={`scada-btn-refresh ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          title="Actualiser"
        >
          ↻
        </button>
      </div>

      {report && (
        <>
          <div className={`scada-health-overall ${report.overall}`}>
            <div className="scada-overall-content">
              <div className={`scada-overall-badge ${report.overall}`}>
                <span className="scada-overall-icon">{getStatusIcon(report.overall)}</span>
                <span className="scada-overall-label">{getStatusLabel(report.overall)}</span>
              </div>
              <div className="scada-overall-info">
                <span className="scada-overall-title">Statut Global</span>
                <span className="scada-overall-timestamp">
                  Derniere verification : {formatTimestamp(report.timestamp)}
                </span>
              </div>
            </div>
          </div>

          <div className="scada-health-grid">
            {report.checks.map((check) => (
              <div
                key={check.service}
                className={`scada-health-card ${check.status}`}
              >
                <div className="scada-card-header">
                  <div className={`scada-card-icon ${check.status}`}>
                    {getStatusIcon(check.status)}
                  </div>
                  <div className="scada-card-title-section">
                    <h3 className="scada-card-title">{check.service}</h3>
                    <span className={`scada-card-status ${check.status}`}>
                      <span className="led"></span>
                      {getStatusLabel(check.status)}
                    </span>
                  </div>
                </div>
                <p className="scada-card-message">{check.message}</p>
                {renderDetails(check)}
              </div>
            ))}
          </div>

          <div className="scada-health-footer">
            <p>Verifications automatiques toutes les heures</p>
          </div>
        </>
      )}
    </div>
  );
}
