import { useState, useEffect } from 'react'
import { Thermometer, Power, Droplet, X, Cpu } from 'lucide-react'
import { fetchDevices } from '../../api/devices'
import type { BackendDevice } from '../../types/backend'

interface Props {
  projectType: string
  onConfirm: (sensorId: string | null, outletId: string | null, humiditySensorId: string | null) => void
  onSkip: () => void
  onClose: () => void
}

export function DeviceSelectModal({ projectType, onConfirm, onSkip, onClose }: Props) {
  const [devices, setDevices] = useState<BackendDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [sensorId, setSensorId] = useState<string | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)
  const [humiditySensorId, setHumiditySensorId] = useState<string | null>(null)

  const needsHumidity = projectType === 'koji' || projectType === 'mushroom'

  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sensors = devices.filter(d => d.type === 'sensor')
  const humiditySensors = devices.filter(d => d.type === 'humidity_sensor')
  const outlets = devices.filter(d => d.type === 'outlet')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-scada-bg-secondary border border-scada-border rounded-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Associer des devices</h3>
            <p className="text-[10px] text-scada-text-muted mt-0.5">Connecter des sondes physiques au projet</p>
          </div>
          <button onClick={onClose} className="text-scada-text-muted hover:text-white">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-sm text-scada-text-muted">Chargement des devices...</div>
        ) : (
          <div className="space-y-3">
            {/* Temperature sensor */}
            <SelectField
              icon={<Thermometer size={14} />}
              label="Sonde temperature"
              value={sensorId}
              onChange={setSensorId}
              options={sensors}
              color="scada-accent"
            />

            {/* Humidity sensor (koji/mushroom only) */}
            {needsHumidity && (
              <SelectField
                icon={<Droplet size={14} />}
                label="Sonde humidite"
                value={humiditySensorId}
                onChange={setHumiditySensorId}
                options={humiditySensors}
                color="scada-cold"
              />
            )}

            {/* Outlet */}
            <SelectField
              icon={<Power size={14} />}
              label="Prise connectee"
              value={outletId}
              onChange={setOutletId}
              options={outlets}
              color="scada-warning"
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onSkip}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-scada-text-muted border border-scada-border rounded-lg hover:text-white transition-colors"
          >
            <Cpu size={12} />
            Simulation
          </button>
          <button
            onClick={() => onConfirm(sensorId, outletId, humiditySensorId)}
            disabled={!sensorId}
            className="flex-1 px-3 py-2.5 bg-scada-accent/20 text-scada-accent border border-scada-accent/40 rounded-lg text-xs font-medium hover:bg-scada-accent/30 transition-colors disabled:opacity-50"
          >
            Connecter
          </button>
        </div>
      </div>
    </div>
  )
}

export function SelectField({ icon, label, value, onChange, options, color }: {
  icon: React.ReactNode
  label: string
  value: string | null
  onChange: (v: string | null) => void
  options: BackendDevice[]
  color: string
}) {
  return (
    <div>
      <label className={`text-[10px] text-${color} uppercase tracking-wider flex items-center gap-1 mb-1.5`}>
        {icon}
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
      >
        <option value="">-- Aucun --</option>
        {options.map(d => (
          <option key={d.id} value={d.id}>
            {d.name} {d.entityId ? `(${d.entityId})` : d.ip ? `(${d.ip})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
