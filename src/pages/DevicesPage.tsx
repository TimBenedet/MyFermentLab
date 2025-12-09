import { useState, useEffect } from 'react';
import { Device } from '../types';
import { apiService } from '../services/api.service';

// Icône Power SVG
const PowerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

interface DevicesPageProps {
  devices: Device[];
  onAddDevice: (device: Omit<Device, 'id'>) => void;
  onDeleteDevice: (deviceId: string) => void;
  onBack: () => void;
  role: 'admin' | 'viewer' | null;
}

export function DevicesPage({ devices, onAddDevice, onDeleteDevice, onBack, role }: DevicesPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [deviceType, setDeviceType] = useState<'sensor' | 'outlet'>('sensor');
  const [deviceName, setDeviceName] = useState('');
  const [deviceIp, setDeviceIp] = useState('');
  const [entityId, setEntityId] = useState('');
  const [outletStates, setOutletStates] = useState<Record<string, boolean | null>>({});
  const [togglingDevices, setTogglingDevices] = useState<Set<string>>(new Set());

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');

  // Charger l'état des prises au montage
  useEffect(() => {
    const loadOutletStates = async () => {
      for (const outlet of outlets) {
        if (outlet.entityId) {
          try {
            const state = await apiService.getDeviceState(outlet.id);
            setOutletStates(prev => ({ ...prev, [outlet.id]: state.isOn }));
          } catch (error) {
            console.error(`Failed to get state for ${outlet.name}:`, error);
            setOutletStates(prev => ({ ...prev, [outlet.id]: null }));
          }
        }
      }
    };
    loadOutletStates();
  }, [devices]);

  const handleToggleOutlet = async (deviceId: string) => {
    setTogglingDevices(prev => new Set(prev).add(deviceId));
    try {
      const result = await apiService.toggleDevice(deviceId);
      setOutletStates(prev => ({ ...prev, [deviceId]: result.isOn }));
    } catch (error) {
      console.error('Failed to toggle outlet:', error);
    } finally {
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddDevice({
      name: deviceName.trim(),
      type: deviceType,
      ip: deviceIp.trim() || undefined,
      entityId: entityId.trim() || undefined
    });
    setDeviceName('');
    setDeviceIp('');
    setEntityId('');
    setShowForm(false);
  };

  return (
    <div className="devices-page">
      <div className="page-header">
        <div>
          <h1>Gestion des Appareils</h1>
          <p className="page-subtitle">{devices.length} appareil{devices.length > 1 ? 's' : ''} configuré{devices.length > 1 ? 's' : ''}</p>
        </div>
        <div className="page-actions">
          <button className="btn-text" onClick={onBack}>
            ← Retour
          </button>
          {role === 'admin' && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              + Ajouter un appareil
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Nouvel Appareil</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Type d'appareil</label>
                <select
                  className="form-select"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as 'sensor' | 'outlet')}
                >
                  <option value="sensor">Sonde de température</option>
                  <option value="outlet">Prise connectée</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nom</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Sonde cave"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Adresse IP (optionnel)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: 192.168.1.100"
                  value={deviceIp}
                  onChange={(e) => setDeviceIp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Entity ID Home Assistant (optionnel)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: sensor.temperature_cave"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="devices-sections">
        <div className="device-section">
          <h2>Sondes de température ({sensors.length})</h2>
          {sensors.length === 0 ? (
            <div className="empty-list">Aucune sonde configurée</div>
          ) : (
            <div className="device-list">
              {sensors.map(device => (
                <div key={device.id} className="device-item">
                  <div className="device-icon">🌡️</div>
                  <div className="device-info">
                    <div className="device-name">{device.name}</div>
                    <div className="device-details">
                      {device.ip && <span>IP: {device.ip}</span>}
                      {device.entityId && <span>Entity: {device.entityId}</span>}
                    </div>
                  </div>
                  {role === 'admin' && (
                    <button
                      className="btn-delete"
                      onClick={() => onDeleteDevice(device.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="device-section">
          <h2>Prises connectées ({outlets.length})</h2>
          {outlets.length === 0 ? (
            <div className="empty-list">Aucune prise configurée</div>
          ) : (
            <div className="device-list">
              {outlets.map(device => {
                const isOn = outletStates[device.id];
                const isToggling = togglingDevices.has(device.id);
                return (
                  <div key={device.id} className="device-item">
                    <div className="device-icon">🔌</div>
                    <div className="device-info">
                      <div className="device-name">{device.name}</div>
                      <div className="device-details">
                        {device.ip && <span>IP: {device.ip}</span>}
                        {device.entityId && <span>Entity: {device.entityId}</span>}
                      </div>
                    </div>
                    {role === 'admin' && device.entityId && (
                      <button
                        className={`btn-power ${isOn === true ? 'power-on' : isOn === false ? 'power-off' : ''}`}
                        onClick={() => handleToggleOutlet(device.id)}
                        disabled={isToggling}
                        title={isOn ? 'Éteindre' : 'Allumer'}
                      >
                        <PowerIcon />
                      </button>
                    )}
                    {role === 'admin' && (
                      <button
                        className="btn-delete"
                        onClick={() => onDeleteDevice(device.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
