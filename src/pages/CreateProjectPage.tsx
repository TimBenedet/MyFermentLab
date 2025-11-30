import { useState } from 'react';
import { FermentationType, FERMENTATION_TYPES, Device } from '../types';

interface CreateProjectPageProps {
  devices: Device[];
  onCreateProject: (data: {
    name: string;
    fermentationType: FermentationType;
    sensorId: string;
    outletId: string;
    targetTemperature: number;
    controlMode: 'manual' | 'automatic';
  }) => void;
  onCancel: () => void;
}

export function CreateProjectPage({ devices, onCreateProject, onCancel }: CreateProjectPageProps) {
  const [name, setName] = useState('');
  const [fermentationType, setFermentationType] = useState<FermentationType>('beer');
  const [sensorId, setSensorId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [controlMode, setControlMode] = useState<'manual' | 'automatic'>('automatic');

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');
  const config = FERMENTATION_TYPES[fermentationType];

  const canSubmit = name.trim() && sensorId && outletId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      const defaultTemp = Math.round((config.minTemp + config.maxTemp) / 2);
      onCreateProject({
        name: name.trim(),
        fermentationType,
        sensorId,
        outletId,
        targetTemperature: defaultTemp,
        controlMode
      });
    }
  };

  return (
    <div className="create-project-page">
      <div className="page-header">
        <h1>Nouveau Projet</h1>
        <button className="btn-text" onClick={onCancel}>
          ← Retour
        </button>
      </div>

      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Informations du projet</h2>

          <div className="form-group">
            <label htmlFor="project-name" className="form-label">
              Nom du projet
            </label>
            <input
              id="project-name"
              type="text"
              className="form-input"
              placeholder="Ex: Bière IPA Printemps 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fermentation-type" className="form-label">
              Type de fermentation
            </label>
            <select
              id="fermentation-type"
              className="form-select"
              value={fermentationType}
              onChange={(e) => setFermentationType(e.target.value as FermentationType)}
            >
              {Object.entries(FERMENTATION_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.icon} {config.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-section">
          <h2>Configuration des appareils</h2>

          <div className="form-group">
            <label htmlFor="sensor" className="form-label">
              🌡️ Sonde de température
            </label>
            {sensors.length === 0 ? (
              <div className="form-warning">
                Aucune sonde disponible. Ajoutez-en une dans la gestion des appareils.
              </div>
            ) : (
              <select
                id="sensor"
                className="form-select"
                value={sensorId}
                onChange={(e) => setSensorId(e.target.value)}
                required
              >
                <option value="">Sélectionner une sonde</option>
                {sensors.map(sensor => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.name} {sensor.ip ? `(${sensor.ip})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="outlet" className="form-label">
              🔌 Prise connectée (tapis chauffant)
            </label>
            {outlets.length === 0 ? (
              <div className="form-warning">
                Aucune prise disponible. Ajoutez-en une dans la gestion des appareils.
              </div>
            ) : (
              <select
                id="outlet"
                className="form-select"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                required
              >
                <option value="">Sélectionner une prise</option>
                {outlets.map(outlet => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} {outlet.ip ? `(${outlet.ip})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="control-mode" className="form-label">
              ⚙️ Mode de contrôle
            </label>
            <select
              id="control-mode"
              className="form-select"
              value={controlMode}
              onChange={(e) => setControlMode(e.target.value as 'manual' | 'automatic')}
            >
              <option value="automatic">Automatique (régulation automatique)</option>
              <option value="manual">Manuel (contrôle manuel de la prise)</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Créer le projet
          </button>
        </div>
      </form>
    </div>
  );
}
