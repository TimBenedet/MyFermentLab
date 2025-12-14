import { useState, useMemo } from 'react';
import { Project, FERMENTATION_TYPES } from '../types';
import { TemperatureChart } from '../components/TemperatureChart';
import { DensityChart } from '../components/DensityChart';
import { HumidityChart } from '../components/HumidityChart';
import { TemperatureAlert } from '../components/TemperatureAlert';
import { OutletControl } from '../components/OutletControl';
import './MonitoringPage.css';

interface MonitoringPageProps {
  project: Project;
  onUpdateTarget: (temp: number) => void;
  onToggleOutlet: () => void;
  onAddDensity: (density: number, timestamp: number) => void;
  onAddHumidity?: (humidity: number, timestamp: number) => void;
  onToggleControlMode?: () => void;
  onRefreshTemperature?: () => void;
  onBack: () => void;
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
  onBack,
  role
}: MonitoringPageProps) {
  const [localTarget, setLocalTarget] = useState(project.targetTemperature);

  const config = FERMENTATION_TYPES[project.fermentationType];
  const diff = project.targetTemperature - project.currentTemperature;

  const getStatus = () => {
    if (Math.abs(diff) < 0.5) return { text: 'Stable', class: '' };
    if (diff > 0) return { text: 'Chauffage', class: 'heating' };
    return { text: 'Refroidissement', class: 'cooling' };
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
      setLocalTarget(prev => Math.min(maxTemp, prev + 0.5));
    }
  };

  const handleDecreaseTemp = () => {
    if (localTarget > minTemp) {
      setLocalTarget(prev => Math.max(minTemp, prev - 0.5));
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
      default: return '';
    }
  };

  const typeClass = getTypeClass();

  return (
    <div className="scada-monitoring-page">
      {/* Back button */}
      <button className="scada-back-btn" onClick={onBack}>
        <span>&#8592;</span> Retour aux projets
      </button>

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

            <div className="scada-tank-layout">
              {/* Tank visualization */}
              <div className={`scada-tank-card active ${typeClass}`}>
                <div className="scada-tank-header">
                  <div>
                    <div className="scada-tank-name">{project.name}</div>
                    <div className="scada-tank-type">{config.name}</div>
                  </div>
                  <div className={`scada-tank-status ${status.class}`}>
                    <span className="led"></span>
                    {status.text}
                  </div>
                </div>

                <div className="scada-tank-visual">
                  <div className="scada-tank-container">
                    <div className="scada-tank-neck"></div>
                    <div className="scada-tank-body">
                      <div
                        className={`scada-tank-liquid ${typeClass}`}
                        style={{ height: `${liquidLevel}%` }}
                      >
                        <div className="scada-liquid-surface">
                          <div className="scada-wave"></div>
                        </div>
                        <div className="scada-foam"></div>
                        <div className="scada-bubbles">
                          <div className="scada-bubble"></div>
                          <div className="scada-bubble"></div>
                          <div className="scada-bubble"></div>
                          <div className="scada-bubble"></div>
                          <div className="scada-bubble"></div>
                          <div className="scada-bubble"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="scada-tank-temp-display">
                    <span className="temp-value">{project.currentTemperature.toFixed(1)}</span>
                    <span className="temp-unit">°C</span>
                  </div>
                </div>
              </div>

              {/* Project metrics panel */}
              <div className="scada-metrics-panel">
                <div className="scada-metrics-row">
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">&#127919;</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Temperature cible</span>
                      <span className="scada-metric-value highlight">{project.targetTemperature}°C</span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">&#128197;</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Duree fermentation</span>
                      <span className="scada-metric-value">{fermentationDuration} jours</span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">&#128200;</div>
                    <div className="scada-metric-info">
                      <span className="scada-metric-label">Ecart temperature</span>
                      <span className={`scada-metric-value ${Math.abs(diff) < 0.5 ? 'success' : Math.abs(diff) < 2 ? 'warning' : 'error'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                  <div className="scada-metric-card">
                    <div className="scada-metric-icon">&#9889;</div>
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
                        <div className="scada-metric-icon">&#128167;</div>
                        <div className="scada-metric-info">
                          <span className="scada-metric-label">Humidite actuelle</span>
                          <span className="scada-metric-value highlight">
                            {project.currentHumidity?.toFixed(1) ?? '—'}%
                          </span>
                        </div>
                      </div>
                      <div className="scada-metric-card">
                        <div className="scada-metric-icon">&#127919;</div>
                        <div className="scada-metric-info">
                          <span className="scada-metric-label">Humidite cible</span>
                          <span className="scada-metric-value">
                            {project.targetHumidity ?? '—'}%
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Charts Section */}
          <div className="scada-charts-grid">
            {/* Temperature Chart */}
            <div className="scada-chart-card fade-in">
              <div className="scada-chart-header">
                <h3 className="scada-chart-title">Evolution Temperature</h3>
              </div>
              <div className="scada-chart-container">
                <TemperatureChart
                  data={project.history}
                  targetTemperature={project.targetTemperature}
                  type={project.fermentationType}
                />
              </div>
            </div>

            {/* Density Chart for beer */}
            {project.fermentationType === 'beer' && (
              <div className="scada-chart-card fade-in">
                <div className="scada-chart-header">
                  <h3 className="scada-chart-title">Evolution Densite</h3>
                </div>
                <div className="scada-chart-container">
                  <DensityChart
                    data={project.densityHistory || []}
                    type={project.fermentationType}
                    onAddDensity={onAddDensity}
                    role={role}
                  />
                </div>
              </div>
            )}

            {/* Humidity Chart for mushrooms */}
            {project.fermentationType === 'mushroom' && (
              <div className="scada-chart-card fade-in">
                <div className="scada-chart-header">
                  <h3 className="scada-chart-title">Evolution Humidite</h3>
                </div>
                <div className="scada-chart-container">
                  <HumidityChart
                    data={project.humidityHistory || []}
                    targetHumidity={project.targetHumidity}
                    onAddHumidity={onAddHumidity}
                    role={role}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <aside className="scada-right-panel">
          {/* Temperature Control Panel */}
          <div className="scada-control-panel fade-in">
            <div className="scada-control-header">
              <span className="scada-control-title">Controle Temperature</span>
              <span className={`scada-control-mode ${project.controlMode === 'manual' ? 'manual' : ''}`}>
                {project.controlMode === 'automatic' ? 'AUTO' : 'MANUEL'}
              </span>
            </div>
            <div className="scada-control-body">
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
                  -
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

              {/* Mode Toggle */}
              {onToggleControlMode && (
                <div className="scada-mode-buttons">
                  <button
                    className={`scada-btn-mode ${project.controlMode === 'automatic' ? 'active' : ''}`}
                    onClick={onToggleControlMode}
                    disabled={role === 'viewer'}
                  >
                    &#9881; Auto
                  </button>
                  <button
                    className={`scada-btn-mode ${project.controlMode === 'manual' ? 'active' : ''}`}
                    onClick={onToggleControlMode}
                    disabled={role === 'viewer'}
                  >
                    &#9995; Manuel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Outlet Control Panel */}
          <div className="scada-control-panel fade-in">
            <div className="scada-control-header">
              <span className="scada-control-title">Prises Connectees</span>
            </div>
            <div className="scada-control-body">
              <OutletControl
                project={project}
                onToggleOutlet={onToggleOutlet}
                role={role}
              />
            </div>
          </div>

          {/* System Health */}
          <div className="scada-alerts-panel fade-in">
            <div className="scada-alerts-header">
              <span className="scada-alerts-title">Etat du Systeme</span>
            </div>
            <div className="scada-health-section" style={{ borderTop: 'none' }}>
              <div className="scada-health-grid">
                <div className="scada-health-item">
                  <div className="scada-health-indicator ok"></div>
                  <span className="scada-health-label">Home Assistant</span>
                </div>
                <div className="scada-health-item">
                  <div className="scada-health-indicator ok"></div>
                  <span className="scada-health-label">InfluxDB</span>
                </div>
                <div className="scada-health-item">
                  <div className={`scada-health-indicator ${project.sensorId ? 'ok' : 'warning'}`}></div>
                  <span className="scada-health-label">Capteurs</span>
                </div>
                <div className="scada-health-item">
                  <div className={`scada-health-indicator ${project.outletId ? 'ok' : 'warning'}`}></div>
                  <span className="scada-health-label">Prises</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
