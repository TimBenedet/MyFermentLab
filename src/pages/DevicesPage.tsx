import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Radio, Power, Thermometer, Droplet, RefreshCw } from 'lucide-react'
import { fetchDevices, createDevice, updateDevice, deleteDevice, toggleDevice } from '../api/devices'
import { useConnection } from '../context/ConnectionContext'
import type { BackendDevice } from '../types/backend'

export function DevicesPage() {
  const { mode, role } = useConnection()
  const [devices, setDevices] = useState<BackendDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<BackendDevice | null>(null)

  const loadDevices = useCallback(async () => {
    try {
      setError('')
      const data = await fetchDevices()
      setDevices(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'live') loadDevices()
    else setLoading(false)
  }, [mode, loadDevices])

  const sensors = devices.filter(d => d.type === 'sensor')
  const humiditySensors = devices.filter(d => d.type === 'humidity_sensor')
  const outlets = devices.filter(d => d.type === 'outlet')

  if (mode !== 'live') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="scada-card text-center py-12">
          <Radio size={32} className="text-scada-text-muted mx-auto mb-3" />
          <p className="text-scada-text-secondary text-sm">Mode simulation actif</p>
          <p className="text-scada-text-muted text-xs mt-1">Connectez-vous au backend pour gerer les devices</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Devices</h2>
          <p className="text-[10px] text-scada-text-muted uppercase tracking-wider">Sondes & Prises connectees</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDevices} className="scada-btn-neutral p-2" title="Rafraichir">
            <RefreshCw size={14} />
          </button>
          {role === 'admin' && (
            <button
              onClick={() => { setEditingDevice(null); setShowForm(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-scada-accent/20 text-scada-accent border border-scada-accent/40 rounded-lg text-xs font-medium hover:bg-scada-accent/30 transition-colors"
            >
              <Plus size={14} />
              Ajouter
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-scada-danger bg-scada-danger/10 rounded-lg px-3 py-2 border border-scada-danger/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="scada-card text-center py-8">
          <RefreshCw size={20} className="text-scada-text-muted mx-auto animate-spin mb-2" />
          <p className="text-sm text-scada-text-muted">Chargement...</p>
        </div>
      ) : (
        <>
          {/* Sensors */}
          <div>
            <div className="scada-label mb-2 flex items-center gap-1.5">
              <Thermometer size={12} />
              Capteurs ({sensors.length})
            </div>
            {sensors.length === 0 ? (
              <div className="scada-card text-center py-6 text-sm text-scada-text-muted">Aucun capteur</div>
            ) : (
              <div className="space-y-2">
                {sensors.map(d => (
                  <DeviceCard
                    key={d.id}
                    device={d}
                    onEdit={() => { setEditingDevice(d); setShowForm(true) }}
                    onDelete={async () => { await deleteDevice(d.id); loadDevices() }}
                    isAdmin={role === 'admin'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Humidity Sensors */}
          <div>
            <div className="scada-label mb-2 flex items-center gap-1.5">
              <Droplet size={12} />
              Sondes humidite ({humiditySensors.length})
            </div>
            {humiditySensors.length === 0 ? (
              <div className="scada-card text-center py-6 text-sm text-scada-text-muted">Aucune sonde humidite</div>
            ) : (
              <div className="space-y-2">
                {humiditySensors.map(d => (
                  <DeviceCard
                    key={d.id}
                    device={d}
                    onEdit={() => { setEditingDevice(d); setShowForm(true) }}
                    onDelete={async () => { await deleteDevice(d.id); loadDevices() }}
                    isAdmin={role === 'admin'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Outlets */}
          <div>
            <div className="scada-label mb-2 flex items-center gap-1.5">
              <Power size={12} />
              Prises ({outlets.length})
            </div>
            {outlets.length === 0 ? (
              <div className="scada-card text-center py-6 text-sm text-scada-text-muted">Aucune prise</div>
            ) : (
              <div className="space-y-2">
                {outlets.map(d => (
                  <DeviceCard
                    key={d.id}
                    device={d}
                    onEdit={() => { setEditingDevice(d); setShowForm(true) }}
                    onDelete={async () => { await deleteDevice(d.id); loadDevices() }}
                    onToggle={async () => { await toggleDevice(d.id); loadDevices() }}
                    isAdmin={role === 'admin'}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Form modal */}
      {showForm && (
        <DeviceFormModal
          device={editingDevice}
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            if (editingDevice) {
              await updateDevice(editingDevice.id, data)
            } else {
              await createDevice(data)
            }
            setShowForm(false)
            loadDevices()
          }}
        />
      )}
    </div>
  )
}

/* ─── Device Card ────────────────────────────── */

function DeviceCard({ device, onEdit, onDelete, onToggle, isAdmin }: {
  device: BackendDevice
  onEdit: () => void
  onDelete: () => void
  onToggle?: () => void
  isAdmin: boolean
}) {
  const isSensor = device.type === 'sensor' || device.type === 'humidity_sensor'

  return (
    <div className="scada-card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          device.type === 'humidity_sensor' ? 'bg-scada-cold/10 text-scada-cold'
            : isSensor ? 'bg-scada-accent/10 text-scada-accent'
            : 'bg-scada-warning/10 text-scada-warning'
        }`}>
          {device.type === 'humidity_sensor' ? <Droplet size={16} /> : isSensor ? <Thermometer size={16} /> : <Power size={16} />}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{device.name}</div>
          <div className="flex items-center gap-2 text-[10px] text-scada-text-muted">
            {device.entityId && <span>{device.entityId}</span>}
            {device.ip && <span>{device.ip}</span>}
            {!device.entityId && !device.ip && <span className="italic">Non configure</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onToggle && (
          <button onClick={onToggle} className="scada-btn-neutral p-2" title="Toggle">
            <Power size={14} />
          </button>
        )}
        {isAdmin && (
          <>
            <button onClick={onEdit} className="scada-btn-neutral p-2" title="Modifier">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-2 text-scada-text-muted hover:text-scada-danger transition-colors" title="Supprimer">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Device Form Modal ──────────────────────── */

function DeviceFormModal({ device, onClose, onSave }: {
  device: BackendDevice | null
  onClose: () => void
  onSave: (data: Omit<BackendDevice, 'id'>) => Promise<void>
}) {
  const [name, setName] = useState(device?.name || '')
  const [type, setType] = useState<BackendDevice['type']>(device?.type || 'sensor')
  const [ip, setIp] = useState(device?.ip || '')
  const [entityId, setEntityId] = useState(device?.entityId || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        name,
        type,
        ip: ip || undefined,
        entityId: entityId || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-scada-bg-secondary border border-scada-border rounded-xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{device ? 'Modifier Device' : 'Nouveau Device'}</h3>
          <button onClick={onClose} className="text-scada-text-muted hover:text-white">
            <Droplet size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] text-scada-text-muted uppercase tracking-wider block mb-1">Nom</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              placeholder="Sonde Sonoff 1"
              required
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-[10px] text-scada-text-muted uppercase tracking-wider block mb-1">Type</label>
            <div className="flex gap-2">
              {(['sensor', 'humidity_sensor', 'outlet'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                    type === t
                      ? t === 'sensor'
                        ? 'bg-scada-accent/15 text-scada-accent border-scada-accent/40'
                        : t === 'humidity_sensor'
                        ? 'bg-scada-cold/15 text-scada-cold border-scada-cold/40'
                        : 'bg-scada-warning/15 text-scada-warning border-scada-warning/40'
                      : 'border-scada-border text-scada-text-muted hover:text-white'
                  }`}
                >
                  {t === 'sensor' ? 'Temp.' : t === 'humidity_sensor' ? 'Humidite' : 'Prise'}
                </button>
              ))}
            </div>
          </div>

          {/* Entity ID */}
          <div>
            <label className="text-[10px] text-scada-text-muted uppercase tracking-wider block mb-1">Entity ID (Home Assistant)</label>
            <input
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              placeholder="sensor.sonde_sonoff_1_temperature"
            />
          </div>

          {/* IP */}
          <div>
            <label className="text-[10px] text-scada-text-muted uppercase tracking-wider block mb-1">IP (optionnel)</label>
            <input
              value={ip}
              onChange={e => setIp(e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              placeholder="192.168.1.x"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !name}
            className="w-full px-4 py-2.5 bg-scada-accent/20 text-scada-accent border border-scada-accent/40 rounded-lg text-sm font-medium hover:bg-scada-accent/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : device ? 'Modifier' : 'Creer'}
          </button>
        </form>
      </div>
    </div>
  )
}
