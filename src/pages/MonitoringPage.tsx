import { useState } from 'react';
import { Project, Device, FERMENTATION_TYPES } from '../types';
import { TemperatureChart } from '../components/TemperatureChart';
import { DensityChart } from '../components/DensityChart';
import { TemperatureAlert } from '../components/TemperatureAlert';

interface MonitoringPageProps {
  project: Project;
  devices: Device[];
  onUpdateTarget: (temp: number) => void;
  onToggleOutlet: () => void;
  onAddDensity: (density: number, timestamp: number) => void;
  onToggleControlMode?: () => void;
  onUpdateDevices?: (sensorId: string, outletId: string) => void;
  onRefreshTemperature?: () => void;
  onBack: () => void;
  role: 'admin' | 'viewer' | null;
}

export function MonitoringPage({ project, devices, onUpdateTarget, onToggleOutlet, onAddDensity, onToggleControlMode, onUpdateDevices, onRefreshTemperature, onBack, role }: MonitoringPageProps) {
  const [editingDevices, setEditingDevices] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(project.sensorId);
  const [selectedOutlet, setSelectedOutlet] = useState(project.outletId);

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');

  const currentSensor = devices.find(d => d.id === project.sensorId);
  const currentOutlet = devices.find(d => d.id === project.outletId);

  const handleSaveDevices = () => {
    if (onUpdateDevices && selectedSensor && selectedOutlet) {
      onUpdateDevices(selectedSensor, selectedOutlet);
      setEditingDevices(false);
    }
  };
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
                disabled={project.controlMode === 'automatic' || role === 'viewer'}
              >
                {project.outletActive ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </div>

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

          {role === 'admin' && !project.archived && (
            <div className="panel-section">
              <div className="section-header-with-action">
                <h2>Appareils</h2>
                {!editingDevices && (
                  <button className="btn-edit-small" onClick={() => setEditingDevices(true)}>
                    Modifier
                  </button>
                )}
              </div>
              {editingDevices ? (
                <div className="devices-edit-form">
                  <div className="form-group-compact">
                    <label>Sonde</label>
                    <select
                      value={selectedSensor}
                      onChange={(e) => setSelectedSensor(e.target.value)}
                      className="form-select-compact"
                    >
                      {sensors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group-compact">
                    <label>Prise</label>
                    <select
                      value={selectedOutlet}
                      onChange={(e) => setSelectedOutlet(e.target.value)}
                      className="form-select-compact"
                    >
                      {outlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="devices-edit-actions">
                    <button className="btn-cancel-small" onClick={() => {
                      setEditingDevices(false);
                      setSelectedSensor(project.sensorId);
                      setSelectedOutlet(project.outletId);
                    }}>
                      Annuler
                    </button>
                    <button className="btn-save-small" onClick={handleSaveDevices}>
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="devices-info">
                  <div className="device-row">
                    <span className="device-type">Sonde:</span>
                    <span className="device-name">{currentSensor?.name || 'Non configurée'}</span>
                  </div>
                  <div className="device-row">
                    <span className="device-type">Prise:</span>
                    <span className="device-name">{currentOutlet?.name || 'Non configurée'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
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
                role={role}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
