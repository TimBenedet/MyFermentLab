import { useState, useMemo, useEffect } from 'react';
import { Project, FERMENTATION_TYPES, TemperatureReading, DensityReading, HumidityReading } from '../types';
import { TemperatureChart } from '../components/TemperatureChart';
import { DensityChart } from '../components/DensityChart';
import { HumidityChart } from '../components/HumidityChart';
import { TemperatureAlert } from '../components/TemperatureAlert';
import { apiService } from '../services/api.service';
import './MonitoringPage.css';

// Sensor frozen detection - 10 minutes without temperature change
const SENSOR_FROZEN_THRESHOLD = 10 * 60 * 1000; // 10 minutes in ms

const isSensorFrozen = (project: Project): boolean => {
  if (project.archived) return false;
  if (!project.lastTemperatureUpdate) return false;

  const timeSinceLastChange = Date.now() - project.lastTemperatureUpdate;
  return timeSinceLastChange > SENSOR_FROZEN_THRESHOLD;
};

const getSensorFrozenDuration = (project: Project): string => {
  if (!project.lastTemperatureUpdate) return '';
  const minutes = Math.floor((Date.now() - project.lastTemperatureUpdate) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}min`;
};

interface OutletHistoryEntry {
  timestamp: number;
  state: boolean;
  source: string;
  temperature?: number;
}

// Generate mock temperature data for 7 days
function generateMockTemperatureData(targetTemp: number, days: number = 7): TemperatureReading[] {
  const now = Date.now();
  const data: TemperatureReading[] = [];
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // Generate data every 30 minutes
  for (let t = startTime; t <= now; t += 30 * 60 * 1000) {
    const noise = (Math.random() - 0.5) * 2; // +/- 1C noise
    const oscillation = Math.sin((t - startTime) / (12 * 60 * 60 * 1000) * Math.PI) * 0.5;
    const temp = targetTemp + noise + oscillation;

    data.push({
      timestamp: t,
      temperature: Math.round(temp * 10) / 10
    });
  }

  return data;
}

// Generate mock density data for 7 days (fermentation curve)
function generateMockDensityData(days: number = 7): DensityReading[] {
  const now = Date.now();
  const data: DensityReading[] = [];
  const startTime = now - days * 24 * 60 * 60 * 1000;

  const og = 1.052; // Original gravity
  const fg = 1.010; // Final gravity

  // Density measurements at specific days
  const measurementDays = [0, 1, 2, 3, 5, 7];

  for (const day of measurementDays) {
    if (day > days) break;
    const t = startTime + day * 24 * 60 * 60 * 1000;
    // Exponential decay
    const progress = 1 - Math.exp(-day * 0.5);
    const density = og - (og - fg) * progress;

    data.push({
      timestamp: t,
      density: Math.round(density * 1000) / 1000
    });
  }

  return data;
}

// Generate mock humidity data for 7 days (mushroom cultivation)
function generateMockHumidityData(targetHumidity: number = 85, days: number = 7): HumidityReading[] {
  const now = Date.now();
  const data: HumidityReading[] = [];
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // Generate data every 30 minutes
  for (let t = startTime; t <= now; t += 30 * 60 * 1000) {
    const noise = (Math.random() - 0.5) * 8; // +/- 4% noise
    const oscillation = Math.sin((t - startTime) / (6 * 60 * 60 * 1000) * Math.PI) * 3; // faster oscillation for humidity
    let humidity = targetHumidity + noise + oscillation;
    // Clamp between 0 and 100
    humidity = Math.max(0, Math.min(100, humidity));

    data.push({
      timestamp: t,
      humidity: Math.round(humidity * 10) / 10
    });
  }

  return data;
}

interface MonitoringPageProps {
  project: Project;
  onUpdateTarget: (temp: number) => void;
  onToggleOutlet: () => void;
  onAddDensity: (density: number, timestamp: number) => void;
  onAddHumidity?: (humidity: number, timestamp: number) => void;
  onToggleControlMode?: () => void;
  onRefreshTemperature?: () => void;
  role: 'admin' | 'viewer' | null;
}

export function MonitoringPage({
  project,
  onUpdateTarget,
  onToggleOutlet,
  onAddDensity,
  onAddHumidity,
  onToggleControlMode,
  onRefreshTemperature,
  role
}: MonitoringPageProps) {
  const [localTarget, setLocalTarget] = useState(project.targetTemperature);
  const [controlPanelTab, setControlPanelTab] = useState<'control' | 'history'>('control');
  const [outletHistory, setOutletHistory] = useState<OutletHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const config = FERMENTATION_TYPES[project.fermentationType];

  // Synchronize localTarget with project.targetTemperature when it changes
  useEffect(() => {
    setLocalTarget(project.targetTemperature);
  }, [project.targetTemperature]);

  // Load outlet history when switching to history tab
  useEffect(() => {
    if (controlPanelTab === 'history') {
      loadOutletHistory();
    }
  }, [controlPanelTab, project.id]);

  const loadOutletHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiService.getOutletHistory(project.id, '-7d');
      setOutletHistory(data.outletHistory.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load outlet history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatHistoryDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatHistoryTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'automatic': return 'Auto';
      case 'manual': return 'Manuel';
      default: return source;
    }
  };

  const calculateDuration = (index: number) => {
    if (index === 0) return null;
    const current = outletHistory[index];
    const previous = outletHistory[index - 1];
    const durationMs = previous.timestamp - current.timestamp;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}min`;
    if (minutes > 0) return `${minutes}min ${seconds}s`;
    return `${seconds}s`;
  };

  // Use mock data if no real data available (for demo purposes)
  const temperatureHistory = useMemo(() => {
    if (project.history && project.history.length > 0) {
      return project.history;
    }
    return generateMockTemperatureData(project.targetTemperature, 7);
  }, [project.history, project.targetTemperature]);

  const densityHistoryData = useMemo(() => {
    if (project.densityHistory && project.densityHistory.length > 0) {
      return project.densityHistory;
    }
    if (project.fermentationType === 'beer') {
      return generateMockDensityData(7);
    }
    return [];
  }, [project.densityHistory, project.fermentationType]);

  // Use mock data for humidity if no real data available (for mushroom/koji demo)
  const humidityHistoryData = useMemo(() => {
    if (project.humidityHistory && project.humidityHistory.length > 0) {
      return project.humidityHistory;
    }
    if (project.fermentationType === 'mushroom' || project.fermentationType === 'koji') {
      return generateMockHumidityData(project.targetHumidity || 85, 7);
    }
    return [];
  }, [project.humidityHistory, project.fermentationType, project.targetHumidity]);

  // Get current humidity (real or from mock data)
  const currentHumidity = useMemo(() => {
    if (project.currentHumidity !== undefined) {
      return project.currentHumidity;
    }
    if (humidityHistoryData.length > 0) {
      return humidityHistoryData[humidityHistoryData.length - 1].humidity;
    }
    return null;
  }, [project.currentHumidity, humidityHistoryData]);

  // Écart = température actuelle - cible
  // Positif = trop chaud, Négatif = trop froid
  const diff = project.currentTemperature - project.targetTemperature;

  const getStatus = () => {
    if (Math.abs(diff) < 0.5) return { text: 'Stable', class: '' };
    // diff > 0 = trop chaud = besoin de refroidissement
    if (diff > 0) return { text: 'Refroidissement', class: 'cooling' };
    // diff < 0 = trop froid = besoin de chauffage
    return { text: 'Chauffage', class: 'heating' };
  };

  const status = getStatus();

  // Calculate fermentation duration
  const fermentationDuration = useMemo(() => {
    const start = new Date(project.createdAt);
    const now = new Date();
    const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }, [project.createdAt]);

  // Calculate liquid level (simulate based on time)
  const liquidLevel = useMemo(() => {
    return Math.max(50, 90 - fermentationDuration * 2);
  }, [fermentationDuration]);

  // Circular gauge calculations
  const circumference = 2 * Math.PI * 80;
  const minTemp = config.minTemp;
  const maxTemp = config.maxTemp;
  const progress = (localTarget - minTemp) / (maxTemp - minTemp);
  const strokeDashoffset = circumference - (progress * circumference);

  const handleIncreaseTemp = () => {
    if (localTarget < maxTemp) {
      setLocalTarget(prev => Math.round(Math.min(maxTemp, prev + 0.1) * 10) / 10);
    }
  };

  const handleDecreaseTemp = () => {
    if (localTarget > minTemp) {
      setLocalTarget(prev => Math.round(Math.max(minTemp, prev - 0.1) * 10) / 10);
    }
  };

  const handleApplyTemp = () => {
    onUpdateTarget(localTarget);
  };

  const getTypeClass = () => {
    switch (project.fermentationType) {
      case 'beer': return 'beer';
      case 'koji': return 'koji';
      case 'mushroom': return 'mushroom';
      case 'mead': return 'mead';
      case 'sourdough': return 'sourdough';
      default: return '';
    }
  };

  const typeClass = getTypeClass();

  return (
    <div className="scada-monitoring-page">
      {/* Temperature Alert */}
      <TemperatureAlert project={project} />

      <div className="scada-monitoring-layout">
        {/* Main Content */}
        <div className="scada-main-content">
          {/* Process Overview Section */}
          <section className={`scada-section ${typeClass} fade-in`}>
            <div className="scada-section-header">
              <h2 className="scada-section-title">Fermentation en cours</h2>
              <div className="scada-section-actions">
                {onRefreshTemperature && (
                  <button className="scada-btn-icon" onClick={onRefreshTemperature} title="Rafraichir">
                    &#8635;
                  </button>
                )}
                <button className="scada-btn-icon" title="Parametres">
                  &#9881;
                </button>
              </div>
            </div>

            <div className={project.fermentationType === 'mushroom' || project.fermentationType === 'koji' || project.fermentationType === 'sourdough' ? 'scada-chamber-layout' : 'scada-tank-layout'}>
              {/* Mushroom Grow Chamber visualization */}
              {project.fermentationType === 'mushroom' ? (
                <div className="scada-chamber-card active">
                  <div className="scada-chamber-header">
                    <div>
                      <div className="scada-chamber-name">{project.name}</div>
                      <div className="scada-chamber-type">{config.name}</div>
                    </div>
                    <div className="scada-chamber-status fruiting">
                      <span className="led"></span>
                      Fructification
                    </div>
                  </div>

                  <div className="scada-chamber-visual">
                    <div className="scada-grow-tent">
                      <div className="scada-tent-frame">
                        <div className="scada-tent-interior"></div>
                        <div className="scada-grow-light on"></div>
                        <div className="scada-mist-layer"></div>
                        <div className="scada-substrate-shelf">
                          {/* Substrate block 1 */}
                          <div className="scada-substrate-block">
                            <div className="scada-block-mycelium" style={{ height: '100%' }}></div>
                            <div className="scada-mushrooms-container">
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                            </div>
                          </div>
                          {/* Substrate block 2 */}
                          <div className="scada-substrate-block">
                            <div className="scada-block-mycelium" style={{ height: '100%' }}></div>
                            <div className="scada-mushrooms-container">
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                            </div>
                          </div>
                          {/* Substrate block 3 */}
                          <div className="scada-substrate-block">
                            <div className="scada-block-mycelium" style={{ height: '100%' }}></div>
                            <div className="scada-mushrooms-container">
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                              <div className="scada-mushroom">
                                <div className="scada-mushroom-cap"></div>
                                <div className="scada-mushroom-stem"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : project.fermentationType === 'koji' ? (
                /* Koji Incubation Chamber visualization */
                <div className="scada-koji-chamber-card active">
                  <div className="scada-koji-header">
                    <div>
                      <div className="scada-koji-name">{project.name}</div>
                      <div className="scada-koji-type">{config.name}</div>
                    </div>
                    <div className="scada-koji-status growing">
                      <span className="led"></span>
                      Croissance active
                    </div>
                  </div>

                  <div className="scada-koji-visual">
                    <div className="scada-koji-container">
                      <div className="scada-koji-lid">
                        <div className="scada-vent-holes">
                          <div className="scada-vent-hole"></div>
                          <div className="scada-vent-hole"></div>
                          <div className="scada-vent-hole"></div>
                          <div className="scada-vent-hole"></div>
                          <div className="scada-vent-hole"></div>
                        </div>
                      </div>
                      <div className="scada-koji-body">
                        <div className="scada-koji-window">
                          <div className="scada-spore-particles">
                            <div className="scada-spore"></div>
                            <div className="scada-spore"></div>
                            <div className="scada-spore"></div>
                            <div className="scada-spore"></div>
                            <div className="scada-spore"></div>
                            <div className="scada-spore"></div>
                          </div>
                          <div className="scada-substrate-tray">
                            <div className="scada-mycelium-layer">
                              <div className="scada-mycelium-texture"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="scada-koji-display">
                      <div className="scada-display-item">
                        <div className="scada-display-value temp">{project.currentTemperature.toFixed(1)}°C</div>
                        <div className="scada-display-label">Temp.</div>
                      </div>
                    </div>

                    {/* Mobile only: Status badge inside card */}
                    <div className={`scada-status-badge mobile-only ${status.class}`}>
                      <span className="led"></span>
                      Etat : {status.text}
                    </div>
                  </div>
                </div>
              ) : project.fermentationType === 'sourdough' ? (
                /* Sourdough/Levain jar visualization */
                <div className="scada-sourdough-card active">
                  <div className="scada-sourdough-header">
                    <div>
                      <div className="scada-sourdough-name">{project.name}</div>
                      <div className="scada-sourdough-type">{config.name}</div>
                    </div>
                    <div className="scada-sourdough-status active">
                      <span className="led"></span>
                      Fermentation active
                    </div>
                  </div>

                  <div className="scada-sourdough-visual">
                    <div className="scada-sourdough-container">
                      {/* Jar lid */}
                      <div className="scada-sourdough-lid">
                        <div className="scada-lid-rim"></div>
                        <div className="scada-lid-top"></div>
                      </div>
                      {/* Jar body */}
                      <div className="scada-sourdough-jar">
                        <div className="scada-jar-glass">
                          {/* Level marks */}
                          <div className="scada-jar-marks">
                            <div className="scada-jar-mark" style={{ bottom: '75%' }}></div>
                            <div className="scada-jar-mark" style={{ bottom: '50%' }}></div>
                            <div className="scada-jar-mark" style={{ bottom: '25%' }}></div>
                          </div>
                          {/* Starter content */}
                          <div className="scada-starter-content" style={{ height: `${liquidLevel}%` }}>
                            <div className="scada-starter-surface">
                              <div className="scada-starter-dome"></div>
                            </div>
                            <div className="scada-starter-body">
                              <div className="scada-starter-bubbles">
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                                <div className="scada-starter-bubble"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="scada-sourdough-display">
                      <div className="scada-display-item">
                        <div className="scada-display-value temp">{project.currentTemperature.toFixed(1)}°C</div>
                        <div className="scada-display-label">Temp.</div>
                      </div>
                    </div>

                    {/* Mobile only: Status badge inside card */}
                    <div className={`scada-status-badge mobile-only ${status.class}`}>
                      <span className="led"></span>
                      Etat : {status.text}
                    </div>
                  </div>
                </div>
              ) : (
                /* Tank visualization for beer/mead - Cylindro-conique */
                <div className={`scada-tank-card active ${typeClass}`}>
                  <div className="scada-tank-header">
                    <div>
                      <div className="scada-tank-name">{project.name}</div>
                      <div className="scada-tank-type">{config.name}</div>
                    </div>
                  </div>

                  <div className="scada-tank-visual">
                    <div className="scada-silo">
                      <div className="scada-silo-roof">
                        <div className="scada-silo-cap"></div>
                      </div>
                      <div className="scada-silo-body">
                        <div className="scada-silo-rivets row1">
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                        </div>
                        <div className="scada-silo-rivets row2">
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                          <div className="scada-rivet"></div>
                        </div>
                        <div
                          className={`scada-silo-liquid ${typeClass}`}
                          style={{ height: `${liquidLevel}%` }}
                        >
                          <div className="scada-silo-bubbles">
                            <div className="scada-silo-bubble"></div>
                            <div className="scada-silo-bubble"></div>
                            <div className="scada-silo-bubble"></div>
                            <div className="scada-silo-bubble"></div>
                            <div className="scada-silo-bubble"></div>
                            <div className="scada-silo-bubble"></div>
                          </div>
                        </div>
                      </div>
                      <div className="scada-silo-base"></div>
                    </div>

                    <div className="scada-tank-temp-display">
                      <span className="temp-value">{project.currentTemperature.toFixed(1)}</span>
                      <span className="temp-unit">°C</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Project metrics panel */}
              <div className="scada-metrics-panel">
                <div className={`scada-status-badge ${status.class}`}>
                  <span className="led"></span>
                  Etat : {status.text}
                </div>
                <div className="scada-metrics-row">
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">🎯</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Temp. cible</span>
                      <span className="scada-metric-value highlight">{project.targetTemperature}°C</span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">📅</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Duree</span>
                      <span className="scada-metric-value">{fermentationDuration} jours</span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">📊</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label" style={{ display: 'block', position: 'static' }}>Ecart</span>
                      <span
                        className="scada-metric-value"
                        style={{ color: Math.abs(diff) < 0.5 ? 'var(--success)' : Math.abs(diff) < 2 ? 'var(--warning)' : 'var(--error)' }}
                      >
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">⚡</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Chauffage</span>
                      <span className="scada-metric-value">
                        {project.outletActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>

                  {/* Humidity for mushrooms */}
                  {project.fermentationType === 'mushroom' && (
                    <>
                      <div className="scada-metric-card">
                        <div className="scada-metric-icon">💧</div>
                        <div className="scada-metric-info">
                          <span className="scada-metric-label">Humidite actuelle</span>
                          <span className="scada-metric-value highlight">
                            {currentHumidity?.toFixed(1) ?? '—'}%
                          </span>
                        </div>
                      </div>
                      <div className="scada-metric-card">
                        <div className="scada-metric-icon">🎯</div>
                        <div className="scada-metric-info">
                          <span className="scada-metric-label">Humidite cible</span>
                          <span className="scada-metric-value">
                            {project.targetHumidity ?? 85}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* Right Panel */}
        <aside className="scada-right-panel">
          {/* Temperature Control Panel with Tabs */}
          <div className="scada-control-panel fade-in">
            {/* Tab Header */}
            <div className="scada-panel-tabs">
              <button
                className={`scada-panel-tab ${controlPanelTab === 'control' ? 'active' : ''}`}
                onClick={() => setControlPanelTab('control')}
              >
                Controle Temperature
              </button>
              <button
                className={`scada-panel-tab ${controlPanelTab === 'history' ? 'active' : ''}`}
                onClick={() => setControlPanelTab('history')}
              >
                Historique
              </button>
            </div>

            {controlPanelTab === 'control' ? (
              /* Temperature Control Content */
              <div className="scada-control-body">
                {/* Mode Badge */}
                <div className="scada-mode-badge-container">
                  <span className={`scada-control-mode ${project.controlMode === 'manual' ? 'manual' : ''}`}>
                    {project.controlMode === 'automatic' ? 'AUTO' : 'MANUEL'}
                  </span>
                </div>

                {/* Circular Gauge */}
                <div className="scada-circular-gauge">
                  <svg className="scada-gauge-svg" viewBox="0 0 180 180">
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a08050"/>
                        <stop offset="100%" stopColor="#d4b584"/>
                      </linearGradient>
                    </defs>
                    <circle className="scada-gauge-track" cx="90" cy="90" r="80"/>
                    <circle
                      className="scada-gauge-progress"
                      cx="90"
                      cy="90"
                      r="80"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <div className="scada-gauge-center">
                    <div className="scada-gauge-temp">
                      <span>{localTarget}</span>
                      <span className="unit">°C</span>
                    </div>
                    <div className="scada-gauge-label">Cible</div>
                  </div>
                </div>

                <div className="scada-control-row">
                  <button
                    className="scada-btn scada-btn-adjust"
                    onClick={handleDecreaseTemp}
                    disabled={role === 'viewer'}
                  >
                    −
                  </button>
                  <button
                    className="scada-btn scada-btn-primary"
                    onClick={handleApplyTemp}
                    disabled={role === 'viewer'}
                  >
                    Appliquer
                  </button>
                  <button
                    className="scada-btn scada-btn-adjust"
                    onClick={handleIncreaseTemp}
                    disabled={role === 'viewer'}
                  >
                    +
                  </button>
                </div>

                {/* Sensor Frozen Alert */}
                {isSensorFrozen(project) && (
                  <div className="scada-sensor-frozen-alert">
                    <span className="frozen-icon">⚠️</span>
                    <span className="frozen-text">Sonde figée depuis {getSensorFrozenDuration(project)}</span>
                  </div>
                )}

                {/* Outlet Control */}
                <div className="scada-outlet-section">
                  <div className="scada-outlet-status">
                    <span className={`scada-outlet-indicator ${project.outletActive ? 'active' : 'inactive'}`}>
                      {project.outletActive ? '●' : '○'}
                    </span>
                    <div className="scada-outlet-info">
                      <div className="scada-outlet-label">Tapis chauffant</div>
                      <div className="scada-outlet-state" style={{ color: project.outletActive ? '#10B981' : '#EF4444' }}>
                        {project.outletActive ? 'Activé' : 'Désactivé'}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`scada-btn-outlet ${project.outletActive ? 'active' : 'inactive'}`}
                    onClick={onToggleOutlet}
                    disabled={project.controlMode === 'automatic' || role === 'viewer'}
                  >
                    {project.outletActive ? 'Désactiver' : 'Activer'}
                  </button>
                </div>

                {/* Mode Toggle */}
                {onToggleControlMode && (
                  <div className="scada-mode-buttons">
                    <button
                      className={`scada-btn-mode ${project.controlMode === 'automatic' ? 'active' : ''}`}
                      onClick={onToggleControlMode}
                      disabled={role === 'viewer'}
                    >
                      ⚙ Auto
                    </button>
                    <button
                      className={`scada-btn-mode ${project.controlMode === 'manual' ? 'active' : ''}`}
                      onClick={onToggleControlMode}
                      disabled={role === 'viewer'}
                    >
                      ✋ Manuel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* History Content */
              <div className="scada-history-body">
                {historyLoading ? (
                  <div className="scada-history-loading">Chargement...</div>
                ) : outletHistory.length === 0 ? (
                  <div className="scada-history-empty">Aucun historique disponible</div>
                ) : (
                  <div className="scada-history-list">
                    {outletHistory.map((entry, index) => (
                      <div key={entry.timestamp} className={`scada-history-entry ${entry.state ? 'on' : 'off'}`}>
                        <div className="scada-history-icon">
                          {entry.state ? '🔥' : '❄️'}
                        </div>
                        <div className="scada-history-details">
                          <div className="scada-history-action">
                            {entry.state ? 'Activé' : 'Désactivé'}
                            {entry.temperature !== undefined && (
                              <span className="scada-history-temp">
                                à {entry.temperature.toFixed(1)}°C
                              </span>
                            )}
                            <span className={`scada-history-source ${entry.source}`}>
                              {getSourceLabel(entry.source)}
                            </span>
                          </div>
                          <div className="scada-history-time">
                            {formatHistoryDate(entry.timestamp)} à {formatHistoryTime(entry.timestamp)}
                          </div>
                          {calculateDuration(index) && (
                            <div className="scada-history-duration">
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
        </aside>
      </div>

      {/* Charts Section - Full Width */}
      <div className={`scada-charts-fullwidth ${project.fermentationType === 'sourdough' ? 'single-chart' : ''}`}>
        {/* Temperature Chart */}
        <div className={`scada-chart-card fade-in ${project.fermentationType === 'sourdough' ? 'full-width' : ''}`}>
          <TemperatureChart
            data={temperatureHistory}
            targetTemperature={project.targetTemperature}
            type={project.fermentationType}
          />
        </div>

        {/* Density Chart for beer */}
        {project.fermentationType === 'beer' && (
          <div className="scada-chart-card fade-in">
            <DensityChart
              data={densityHistoryData}
              type={project.fermentationType}
              onAddDensity={onAddDensity}
              role={role}
            />
          </div>
        )}

        {/* Humidity Chart for mushrooms and koji */}
        {(project.fermentationType === 'mushroom' || project.fermentationType === 'koji') && (
          <div className="scada-chart-card fade-in">
            <HumidityChart
              data={humidityHistoryData}
              targetHumidity={project.targetHumidity}
              onAddHumidity={onAddHumidity}
              role={role}
            />
          </div>
        )}
      </div>
    </div>
  );
}
