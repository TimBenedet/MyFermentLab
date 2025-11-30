import { Project, FERMENTATION_TYPES } from '../types';
import { TemperatureChart } from '../components/TemperatureChart';
import { DensityChart } from '../components/DensityChart';

interface MonitoringPageProps {
  project: Project;
  onUpdateTarget: (temp: number) => void;
  onToggleOutlet: () => void;
  onAddDensity: (density: number, timestamp: number) => void;
  onToggleControlMode?: () => void;
  onBack: () => void;
}

export function MonitoringPage({ project, onUpdateTarget, onToggleOutlet, onAddDensity, onToggleControlMode, onBack }: MonitoringPageProps) {
  const config = FERMENTATION_TYPES[project.fermentationType];
  const diff = project.targetTemperature - project.currentTemperature;

  const getStatus = () => {
    if (Math.abs(diff) < 0.5) return { text: 'Stable', color: '#10B981' };
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

      <div className="monitoring-grid">
        <div className="control-panel">
          <div className="panel-section">
            <h2>Contrôle de la prise</h2>
            <div className="outlet-control">
              <div className="outlet-status">
                <span className={`outlet-indicator ${project.outletActive ? 'active' : 'inactive'}`}>
                  {project.outletActive ? '●' : '○'}
                </span>
                <div className="outlet-info">
                  <div className="outlet-label">Tapis chauffant</div>
                  <div className="outlet-state" style={{ color: project.outletActive ? '#10B981' : '#EF4444' }}>
                    {project.outletActive ? 'Activé' : 'Désactivé'}
                  </div>
                </div>
              </div>
              <button
                className={`btn-outlet ${project.outletActive ? 'active' : 'inactive'}`}
                onClick={onToggleOutlet}
                disabled={project.controlMode === 'automatic'}
              >
                {project.outletActive ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </div>

          <div className="panel-section">
            <h2>Températures</h2>
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
              />
              <div className="slider-labels">
                <span>{config.minTemp}°C</span>
                <span>{config.maxTemp}°C</span>
              </div>
            </div>

            <div className="temp-buttons">
              <button
                className="temp-btn"
                onClick={() => onUpdateTarget(Math.max(config.minTemp, project.targetTemperature - 1))}
              >
                -1°C
              </button>
              <button
                className="temp-btn"
                onClick={() => onUpdateTarget(Math.min(config.maxTemp, project.targetTemperature + 1))}
              >
                +1°C
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
                  >
                    ⚙️ Auto
                  </button>
                  <button
                    className={`btn-mode-toggle ${project.controlMode === 'manual' ? 'active' : ''}`}
                    onClick={onToggleControlMode}
                  >
                    ✋ Manuel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`charts-section ${project.fermentationType === 'beer' ? 'with-density' : ''}`}>
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
