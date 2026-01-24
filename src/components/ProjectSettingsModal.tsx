import { useState, useEffect } from 'react';
import { Project, Device } from '../types';
import './ProjectSettingsModal.css';

interface ProjectSettingsModalProps {
  project: Project;
  devices: Device[];
  usedDeviceIds: string[];
  onSave: (data: {
    humiditySensorId?: string;
    targetHumidity?: number;
  }) => Promise<void>;
  onClose: () => void;
}

export function ProjectSettingsModal({
  project,
  devices,
  usedDeviceIds,
  onSave,
  onClose
}: ProjectSettingsModalProps) {
  const [humiditySensorId, setHumiditySensorId] = useState(project.humiditySensorId || '');
  const [targetHumidity, setTargetHumidity] = useState(project.targetHumidity || 85);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrer les sondes d'humidite disponibles
  const humiditySensors = devices.filter(d =>
    d.type === 'humidity_sensor' &&
    (!usedDeviceIds.includes(d.id) || d.id === project.humiditySensorId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave({
        humiditySensorId: humiditySensorId || undefined,
        targetHumidity: humiditySensorId ? targetHumidity : undefined
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content project-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Parametres du projet</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="settings-section">
              <h3>Suivi de l'humidite</h3>

              <div className="form-group">
                <label htmlFor="humidity-sensor">Sonde d'humidite</label>
                {humiditySensors.length === 0 ? (
                  <div className="form-info">
                    Aucune sonde d'humidite disponible.
                  </div>
                ) : (
                  <select
                    id="humidity-sensor"
                    value={humiditySensorId}
                    onChange={(e) => setHumiditySensorId(e.target.value)}
                  >
                    <option value="">Aucune sonde</option>
                    {humiditySensors.map(sensor => (
                      <option key={sensor.id} value={sensor.id}>
                        {sensor.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {humiditySensorId && (
                <div className="form-group">
                  <label htmlFor="target-humidity">Humidite cible (%)</label>
                  <input
                    id="target-humidity"
                    type="number"
                    value={targetHumidity}
                    onChange={(e) => setTargetHumidity(Number(e.target.value))}
                    min="0"
                    max="100"
                    step="1"
                  />
                </div>
              )}
            </div>

            {error && <div className="form-error">{error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
