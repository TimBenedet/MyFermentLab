import { Project, FERMENTATION_TYPES } from '../types';
import { TemperatureChart } from '../components/TemperatureChart';
import { DensityChart } from '../components/DensityChart';
import { HumidityChart } from '../components/HumidityChart';
import { TemperatureAlert } from '../components/TemperatureAlert';
import { OutletControl } from '../components/OutletControl';

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

export function MonitoringPage({ project, onUpdateTarget, onToggleOutlet, onAddDensity, onAddHumidity, onToggleControlMode, onRefreshTemperature, onBack, role }: MonitoringPageProps) {
  const config = FERMENTATION_TYPES[project.fermentationType];
  const diff = project.targetTemperature - project.currentTemperature;

  const getStatus = () => {
    if (Math.abs(diff) < 0.2) return { text: 'Stable', color: '#10B981' };
    if (diff > 0) return { text: 'Chauffage nécessaire', color: '#EF4444' };
    return { text: 'Refroidissement', color: '#3B82F6' };
  };

  const status = getStatus();

  return (
    <div className="monitoring-page">
      <div className="page-header-compact">
        <button className="btn-text" onClick={onBack}>
          ← Retour
        </button>
        <h1>{project.name}</h1>
        <span className="status-badge" style={{ backgroundColor: status.color }}>
          {status.text}
        </span>
      </div>

      {/* Alerte température */}
      <TemperatureAlert project={project} />

      <div className="monitoring-grid">
        <div className="control-panel">
          <OutletControl
            project={project}
            onToggleOutlet={onToggleOutlet}
            role={role}
          />

          <div className="panel-section">
            <div className="section-header-with-action">
              <h2>Températures</h2>
              {onRefreshTemperature && (
                <button
                  className="btn-refresh"
                  onClick={onRefreshTemperature}
                  title="Rafraîchir la température"
                >
                  ↻
                </button>
              )}
            </div>
            <div className="temperature-controls">
              <div className="temp-display">
                <div className="temp-label">Actuelle</div>
                <div className="temp-value" style={{ color: config.color }}>
                  {project.currentTemperature.toFixed(1)}°C
                </div>
              </div>

              <div className="temp-display">
                <div className="temp-label">Cible</div>
                <div className="temp-value" style={{ color: config.color }}>
                  {project.targetTemperature}°C
                </div>
              </div>
            </div>
          </div>

          {/* Section Humidité pour les champignons */}
          {project.fermentationType === 'mushroom' && (
            <div className="panel-section">
              <h2>Humidité</h2>
              <div className="temperature-controls">
                <div className="temp-display">
                  <div className="temp-label">Actuelle</div>
                  <div className="temp-value" style={{ color: '#3B82F6' }}>
                    {project.currentHumidity?.toFixed(1) ?? '—'}%
                  </div>
                </div>
                <div className="temp-display">
                  <div className="temp-label">Cible</div>
                  <div className="temp-value" style={{ color: '#3B82F6' }}>
                    {project.targetHumidity ?? '—'}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="panel-section panel-section-flex">
            <h2>Température cible</h2>
            <div className="slider-container">
              <input
                type="range"
                min={config.minTemp}
                max={config.maxTemp}
                value={project.targetTemperature}
                onChange={(e) => onUpdateTarget(Number(e.target.value))}
                className="temp-slider"
                style={{ background: `linear-gradient(to right, ${config.color}40 0%, ${config.color} 50%, ${config.color}80 100%)` }}
                disabled={role === 'viewer'}
              />
              <div className="slider-labels">
                <span>{config.minTemp}°C</span>
                <span>{config.maxTemp}°C</span>
              </div>
            </div>

            <div className="temp-buttons">
              <button
                className="temp-btn"
                onClick={() => onUpdateTarget(Math.max(config.minTemp, project.targetTemperature - 0.5))}
                disabled={role === 'viewer'}
              >
                -0.5°C
              </button>
              <button
                className="temp-btn"
                onClick={() => onUpdateTarget(Math.min(config.maxTemp, project.targetTemperature + 0.5))}
                disabled={role === 'viewer'}
              >
                +0.5°C
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Mode de contrôle</h2>
            <div className="control-mode-compact">
              {onToggleControlMode && (
                <>
                  <button
                    className={`btn-mode-toggle ${project.controlMode === 'automatic' ? 'active' : ''}`}
                    onClick={onToggleControlMode}
                    disabled={role === 'viewer'}
                  >
                    ⚙️ Auto
                  </button>
                  <button
                    className={`btn-mode-toggle ${project.controlMode === 'manual' ? 'active' : ''}`}
                    onClick={onToggleControlMode}
                    disabled={role === 'viewer'}
                  >
                    ✋ Manuel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`charts-section ${(project.fermentationType === 'beer' || project.fermentationType === 'mushroom') ? 'with-density' : ''}`}>
          <div className="chart-zone">
            <TemperatureChart
              data={project.history}
              targetTemperature={project.targetTemperature}
              type={project.fermentationType}
            />
          </div>
          {project.fermentationType === 'beer' && (
            <div className="chart-zone">
              <DensityChart
                data={project.densityHistory || []}
                type={project.fermentationType}
                onAddDensity={onAddDensity}
                role={role}
              />
            </div>
          )}
          {project.fermentationType === 'mushroom' && (
            <div className="chart-zone">
              <HumidityChart
                data={project.humidityHistory || []}
                targetHumidity={project.targetHumidity}
                onAddHumidity={onAddHumidity}
                role={role}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
