import { useState, useEffect } from 'react';
import { Project } from '../types';
import { apiService } from '../services/api.service';

interface OutletControlProps {
  project: Project;
  onToggleOutlet: () => void;
  role: 'admin' | 'viewer' | null;
  variant?: 'default' | 'scada';
}

interface OutletHistoryEntry {
  timestamp: number;
  state: boolean;
  source: string;
}

export function OutletControl({ project, onToggleOutlet, role, variant = 'default' }: OutletControlProps) {
  const [activeTab, setActiveTab] = useState<'control' | 'history'>('control');
  const [history, setHistory] = useState<OutletHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const isScada = variant === 'scada';

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, project.id]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await apiService.getOutletHistory(project.id, '-7d');
      // Trier par date décroissante (plus récent en premier)
      setHistory(data.outletHistory.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load outlet history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'automatic':
        return 'Auto';
      case 'manual':
        return 'Manuel';
      default:
        return source;
    }
  };

  // Calculer la durée entre deux événements consécutifs
  const calculateDuration = (index: number) => {
    if (index === 0) return null; // Le plus récent n'a pas de durée
    const current = history[index];
    const previous = history[index - 1];
    const durationMs = previous.timestamp - current.timestamp;

    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else if (minutes > 0) {
      return `${minutes}min ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className={`panel-section outlet-control-panel ${isScada ? 'scada-outlet-panel' : ''}`}>
      <div className={`outlet-tabs ${isScada ? 'scada-outlet-tabs' : ''}`}>
        <button
          className={`outlet-tab ${isScada ? 'scada-outlet-tab' : ''} ${activeTab === 'control' ? 'active' : ''}`}
          onClick={() => setActiveTab('control')}
        >
          {isScada ? 'CONTROLE DE LA PRISE' : 'Controle de la prise'}
        </button>
        <button
          className={`outlet-tab ${isScada ? 'scada-outlet-tab' : ''} ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          {isScada ? 'HISTORIQUE' : 'Historique'}
        </button>
      </div>

      {activeTab === 'control' ? (
        <div className={`outlet-control ${isScada ? 'scada-outlet-control' : ''}`}>
          <div className={`outlet-status ${isScada ? 'scada-outlet-status' : ''}`}>
            <span className={`outlet-indicator ${isScada ? 'scada-outlet-indicator' : ''} ${project.outletActive ? 'active' : 'inactive'}`}>
              {project.outletActive ? '●' : '○'}
            </span>
            <div className="outlet-info">
              <div className={`outlet-label ${isScada ? 'scada-outlet-label' : ''}`}>Tapis chauffant</div>
              <div className={`outlet-state ${isScada ? 'scada-outlet-state' : ''}`} style={{ color: project.outletActive ? '#10B981' : '#EF4444' }}>
                {project.outletActive ? 'Activé' : 'Désactivé'}
              </div>
            </div>
          </div>
          <button
            className={`btn-outlet ${isScada ? 'scada-btn-outlet' : ''} ${project.outletActive ? 'active' : 'inactive'}`}
            onClick={onToggleOutlet}
            disabled={project.controlMode === 'automatic' || role === 'viewer'}
          >
            {project.outletActive ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      ) : (
        <div className={`outlet-history ${isScada ? 'scada-outlet-history' : ''}`}>
          {loading ? (
            <div className={`history-loading ${isScada ? 'scada-history-loading' : ''}`}>Chargement...</div>
          ) : history.length === 0 ? (
            <div className={`history-empty ${isScada ? 'scada-history-empty' : ''}`}>Aucun historique disponible</div>
          ) : (
            <div className={`history-list ${isScada ? 'scada-history-list' : ''}`}>
              {history.map((entry, index) => (
                <div key={entry.timestamp} className={`history-entry ${isScada ? 'scada-history-entry' : ''} ${entry.state ? 'on' : 'off'}`}>
                  <div className={`history-icon ${isScada ? 'scada-history-icon' : ''}`}>
                    {entry.state ? '🔥' : '❄️'}
                  </div>
                  <div className={`history-details ${isScada ? 'scada-history-details' : ''}`}>
                    <div className={`history-action ${isScada ? 'scada-history-action' : ''}`}>
                      {entry.state ? 'Activé' : 'Désactivé'}
                      <span className={`history-source ${isScada ? 'scada-history-source' : ''} ${entry.source}`}>
                        {getSourceLabel(entry.source)}
                      </span>
                    </div>
                    <div className={`history-time ${isScada ? 'scada-history-time' : ''}`}>
                      {formatDate(entry.timestamp)} à {formatTime(entry.timestamp)}
                    </div>
                    {calculateDuration(index) && (
                      <div className={`history-duration ${isScada ? 'scada-history-duration' : ''}`}>
                        Durée: {calculateDuration(index)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
