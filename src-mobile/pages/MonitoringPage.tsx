import { useState, useEffect } from 'react';
import { Project, Device, FERMENTATION_TYPES } from '../../src/types';
import { apiService } from '../../src/services/api.service';

interface MonitoringPageProps {
  project: Project;
  devices: Device[];
  onToggleOutlet: () => void;
  onUpdateTarget: (target: number) => void;
  onToggleMode: () => void;
  onRefresh: () => void;
  role: 'admin' | 'viewer' | null;
}

interface OutletHistoryEntry {
  timestamp: number;
  state: boolean;
  source: string;
  temperature?: number;
}

export function MonitoringPage({
  project,
  devices,
  onToggleOutlet,
  onUpdateTarget,
  onToggleMode,
  onRefresh,
  role
}: MonitoringPageProps) {
  const [localTarget, setLocalTarget] = useState(project.targetTemperature);
  const [activeTab, setActiveTab] = useState<'control' | 'history'>('control');
  const [outletHistory, setOutletHistory] = useState<OutletHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveTemp, setLiveTemp] = useState<number | null>(null);

  const config = FERMENTATION_TYPES[project.fermentationType];

  useEffect(() => {
    setLocalTarget(project.targetTemperature);
  }, [project.targetTemperature]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, project.id]);

  // Live temperature polling
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await apiService.getLiveTemperature(project.id);
        setLiveTemp(data.temperature);
      } catch (error) {
        console.error('Failed to fetch live temp:', error);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => clearInterval(interval);
  }, [project.id]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiService.getOutletHistory(project.id, '-7d');
      setOutletHistory(data.outletHistory || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusInfo = () => {
    const temp = liveTemp ?? project.currentTemperature;
    const diff = temp - project.targetTemperature;
    if (Math.abs(diff) <= 0.5) {
      return { text: 'Stable', class: 'status-stable' };
    } else if (diff > 0) {
      return { text: 'Chauffage', class: 'status-hot' };
    } else {
      return { text: 'Refroidissement', class: 'status-cold' };
    }
  };

  const status = getStatusInfo();
  const currentTemp = liveTemp ?? project.currentTemperature;
  const tempDiff = currentTemp - project.targetTemperature;

  const formatDuration = (startTime: number, endTime: number) => {
    const duration = endTime - startTime;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTargetChange = (delta: number) => {
    const newTarget = Math.max(config.minTemp, Math.min(config.maxTemp, localTarget + delta));
    setLocalTarget(newTarget);
  };

  const handleApplyTarget = () => {
    if (localTarget !== project.targetTemperature) {
      onUpdateTarget(localTarget);
    }
  };

  return (
    <div className="monitoring-page">
      {/* Project Header */}
      <div className="monitoring-header">
        <div className="project-badge">
          <span className="badge-icon">{config.icon}</span>
          <span className="badge-name">{project.name}</span>
        </div>
        <div className={`status-badge ${status.class}`}>
          <span className="status-led"></span>
          {status.text}
        </div>
      </div>

      {/* Main Temperature Display */}
      <div className="temp-hero">
        <div className="temp-ring" style={{ '--progress': Math.min(100, Math.max(0, ((currentTemp - config.minTemp) / (config.maxTemp - config.minTemp)) * 100)) + '%' } as React.CSSProperties}>
          <div className="temp-ring-inner">
            <span className="temp-current">{currentTemp.toFixed(1)}</span>
            <span className="temp-unit">°C</span>
          </div>
        </div>
        <div className="temp-meta">
          <div className={`temp-diff ${tempDiff > 0 ? 'hot' : tempDiff < 0 ? 'cold' : 'stable'}`}>
            {tempDiff > 0 ? '+' : ''}{tempDiff.toFixed(1)}°C
          </div>
          <div className="temp-target-display">
            Cible: {project.targetTemperature}°C
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          className={`action-btn ${project.controlMode === 'automatic' ? 'active' : ''}`}
          onClick={onToggleMode}
          disabled={role !== 'admin'}
        >
          <span className="action-icon">⚙️</span>
          <span className="action-label">{project.controlMode === 'automatic' ? 'AUTO' : 'MANUEL'}</span>
        </button>
        <button
          className={`action-btn heating ${project.outletActive ? 'active' : ''}`}
          onClick={onToggleOutlet}
          disabled={role !== 'admin' || project.controlMode === 'automatic'}
        >
          <span className="action-icon">🔥</span>
          <span className="action-label">{project.outletActive ? 'ACTIF' : 'ARRÊT'}</span>
        </button>
        <button className="action-btn" onClick={onRefresh}>
          <span className="action-icon">🔄</span>
          <span className="action-label">REFRESH</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="control-tabs">
        <button
          className={`tab-btn ${activeTab === 'control' ? 'active' : ''}`}
          onClick={() => setActiveTab('control')}
        >
          Contrôle
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Historique
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'control' ? (
          <div className="control-panel">
            <h3>Température cible</h3>
            <div className="target-control">
              <button
                className="target-btn minus"
                onClick={() => handleTargetChange(-0.5)}
                disabled={role !== 'admin'}
              >
                −
              </button>
              <div className="target-display">
                <span className="target-value">{localTarget}</span>
                <span className="target-unit">°C</span>
              </div>
              <button
                className="target-btn plus"
                onClick={() => handleTargetChange(0.5)}
                disabled={role !== 'admin'}
              >
                +
              </button>
            </div>
            {localTarget !== project.targetTemperature && (
              <button
                className="apply-btn"
                onClick={handleApplyTarget}
                disabled={role !== 'admin'}
              >
                Appliquer
              </button>
            )}

            {/* Info Cards */}
            <div className="info-cards">
              <div className="info-card">
                <div className="info-icon">📊</div>
                <div className="info-content">
                  <span className="info-label">Écart</span>
                  <span className={`info-value ${Math.abs(tempDiff) <= 0.5 ? 'good' : 'warning'}`}>
                    {tempDiff > 0 ? '+' : ''}{tempDiff.toFixed(1)}°C
                  </span>
                </div>
              </div>
              <div className="info-card">
                <div className="info-icon">⚡</div>
                <div className="info-content">
                  <span className="info-label">Chauffage</span>
                  <span className={`info-value ${project.outletActive ? 'active' : ''}`}>
                    {project.outletActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="history-panel">
            <h3>Historique chauffage</h3>
            {historyLoading ? (
              <div className="loading-state">
                <div className="loading-spinner small"></div>
                <span>Chargement...</span>
              </div>
            ) : outletHistory.length === 0 ? (
              <div className="empty-history">
                <span>Aucun historique</span>
              </div>
            ) : (
              <div className="history-list">
                {outletHistory.slice(0, 20).map((entry, index) => {
                  const nextEntry = outletHistory[index + 1];
                  const duration = nextEntry ? formatDuration(entry.timestamp, nextEntry.timestamp) : null;

                  return (
                    <div key={index} className={`history-item ${entry.state ? 'on' : 'off'}`}>
                      <div className="history-indicator">
                        <span className={`history-dot ${entry.state ? 'on' : 'off'}`}></span>
                      </div>
                      <div className="history-content">
                        <div className="history-state">
                          {entry.state ? '🔥 Activé' : '❄️ Désactivé'}
                        </div>
                        <div className="history-time">{formatTime(entry.timestamp)}</div>
                        {duration && entry.state && (
                          <div className="history-duration">Durée: {duration}</div>
                        )}
                      </div>
                      {entry.temperature && (
                        <div className="history-temp">{entry.temperature.toFixed(1)}°C</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
