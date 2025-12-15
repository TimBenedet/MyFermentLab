import { useState, useEffect } from 'react';
import { Device } from '../../src/types';
import { apiService } from '../../src/services/api.service';

interface DevicesPageProps {
  devices: Device[];
  onBack: () => void;
  role: 'admin' | 'viewer' | null;
}

export function DevicesPage({ devices, onBack, role }: DevicesPageProps) {
  const [outletStates, setOutletStates] = useState<Record<string, boolean | null>>({});
  const [togglingDevices, setTogglingDevices] = useState<Set<string>>(new Set());

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');
  const humiditySensors = devices.filter(d => d.type === 'humidity_sensor');

  useEffect(() => {
    loadOutletStates();
  }, [devices]);

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

  const handleToggle = async (deviceId: string) => {
    if (role !== 'admin') return;

    setTogglingDevices(prev => new Set(prev).add(deviceId));
    try {
      const result = await apiService.toggleDevice(deviceId);
      setOutletStates(prev => ({ ...prev, [deviceId]: result.isOn }));
    } catch (error) {
      console.error('Failed to toggle device:', error);
    } finally {
      setTogglingDevices(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  };

  const DeviceCard = ({ device, icon, showToggle = false }: { device: Device; icon: string; showToggle?: boolean }) => {
    const isOn = outletStates[device.id];
    const isToggling = togglingDevices.has(device.id);

    return (
      <div className="device-card">
        <div className="device-icon">{icon}</div>
        <div className="device-info">
          <h4>{device.name}</h4>
          {device.entityId && (
            <span className="device-entity">{device.entityId}</span>
          )}
          {device.ip && (
            <span className="device-ip">IP: {device.ip}</span>
          )}
        </div>
        {showToggle && device.entityId && role === 'admin' && (
          <button
            className={`toggle-btn ${isOn ? 'on' : 'off'} ${isToggling ? 'loading' : ''}`}
            onClick={() => handleToggle(device.id)}
            disabled={isToggling}
          >
            {isToggling ? (
              <div className="toggle-spinner"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="devices-page">
      <div className="page-section">
        <div className="section-header">
          <h2>🌡️ Sondes température</h2>
          <span className="section-count">{sensors.length}</span>
        </div>
        <div className="devices-list">
          {sensors.length === 0 ? (
            <div className="empty-section">Aucune sonde configurée</div>
          ) : (
            sensors.map(device => (
              <DeviceCard key={device.id} device={device} icon="🌡️" />
            ))
          )}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <h2>🔌 Prises connectées</h2>
          <span className="section-count">{outlets.length}</span>
        </div>
        <div className="devices-list">
          {outlets.length === 0 ? (
            <div className="empty-section">Aucune prise configurée</div>
          ) : (
            outlets.map(device => (
              <DeviceCard key={device.id} device={device} icon="🔌" showToggle />
            ))
          )}
        </div>
      </div>

      {humiditySensors.length > 0 && (
        <div className="page-section">
          <div className="section-header">
            <h2>💧 Sondes humidité</h2>
            <span className="section-count">{humiditySensors.length}</span>
          </div>
          <div className="devices-list">
            {humiditySensors.map(device => (
              <DeviceCard key={device.id} device={device} icon="💧" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
