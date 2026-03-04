import { useState, useEffect, useRef } from 'react'
import { Minus, Plus, Thermometer, Droplet, Check } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../../context/BrewingContext'
import { useConnection } from '../../context/ConnectionContext'
import { updateTargetTemperature, updateTargetHumidity, updateActivationThreshold, toggleOutlet, setControlMode } from '../../api/projects'
import { RelayIndicator } from '../fermenter/RelayIndicator'

interface Props {
  fermenterId: string
  backendProjectId?: string
}

type Tab = 'temp' | 'humidity'

export function ProjectControls({ fermenterId, backendProjectId }: Props) {
  const { state } = useBrewing()
  const { setSetpoint, setPidMode, toggleRelay, setHumiditySetpoint, setHumidityPidMode, toggleHumidityRelay } = useBrewingActions()
  const { mode, role } = useConnection()
  const isLive = mode === 'live' && !!backendProjectId
  const isViewer = role === 'viewer'

  const handleToggleRelay = (fId: string) => {
    toggleRelay(fId)
    if (isLive) toggleOutlet(backendProjectId!).catch(() => {})
  }
  const handleSetPidMode = (fId: string, pidMode: 'auto' | 'manual' | 'off') => {
    setPidMode(fId, pidMode)
    if (isLive) setControlMode(backendProjectId!, pidMode).catch(() => {})
  }

  const fermenter = state.fermenters.find(f => f.id === fermenterId)
  if (!fermenter) return null

  const hasHumidity = fermenter.humidity !== undefined && fermenter.humidityPid !== undefined

  return (
    <div className="scada-card space-y-3 h-full">
      {hasHumidity ? (
        <ControlsWithTabs
          fermenterId={fermenterId}
          fermenter={fermenter}
          backendProjectId={backendProjectId}
          isLive={isLive}
          setSetpoint={setSetpoint}
          setPidMode={handleSetPidMode}
          toggleRelay={handleToggleRelay}
          setHumiditySetpoint={setHumiditySetpoint}
          setHumidityPidMode={setHumidityPidMode}
          toggleHumidityRelay={toggleHumidityRelay}
          disabled={isViewer}
        />
      ) : (
        <TemperaturePanel
          fermenterId={fermenterId}
          fermenter={fermenter}
          backendProjectId={backendProjectId}
          isLive={isLive}
          setSetpoint={setSetpoint}
          setPidMode={handleSetPidMode}
          toggleRelay={handleToggleRelay}
          disabled={isViewer}
        />
      )}
    </div>
  )
}

/* Editable setpoint with +/-, manual input, and Apply button */
function SetpointEditor({
  value,
  label = 'Consigne',
  unit,
  step,
  min,
  max,
  onApply,
  disabled,
  accentColor = 'scada-accent',
}: {
  value: number
  label?: string
  unit: string
  step: number
  min: number
  max: number
  onApply: (v: number) => Promise<void>
  disabled?: boolean
  accentColor?: string
}) {
  const [localValue, setLocalValue] = useState(value)
  const [editing, setEditing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [dirty, setDirty] = useState(false) // user has modified the value
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local value from external prop ONLY when user hasn't touched it
  useEffect(() => {
    if (!dirty && !editing && !applying) {
      setLocalValue(value)
    }
  }, [value, dirty, editing, applying])

  const hasChanged = dirty && Math.abs(localValue - value) > 0.01

  const handleApply = async () => {
    setApplying(true)
    setStatus('idle')
    try {
      await onApply(localValue)
      setDirty(false)
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      console.error('[SetpointEditor] Apply failed:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    } finally {
      setApplying(false)
    }
  }

  const handleInputSubmit = () => {
    setEditing(false)
    const clamped = Math.max(min, Math.min(max, localValue))
    setLocalValue(clamped)
  }

  const markDirty = () => { setDirty(true); setStatus('idle') }
  const decrement = () => { setLocalValue(v => Math.max(min, +(v - step).toFixed(1))); markDirty() }
  const increment = () => { setLocalValue(v => Math.min(max, +(v + step).toFixed(1))); markDirty() }

  return (
    <div>
      <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button onClick={decrement} className="scada-btn-neutral p-2.5 sm:p-2" disabled={disabled}>
          <Minus size={16} />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="number"
            value={localValue}
            onChange={(e) => { setLocalValue(parseFloat(e.target.value) || 0); markDirty() }}
            onBlur={handleInputSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInputSubmit() }}
            className="font-mono text-lg font-bold text-white bg-scada-bg border border-scada-border rounded-lg w-20 text-center py-1 outline-none focus:border-scada-accent"
            step={step}
            min={min}
            max={max}
            autoFocus
          />
        ) : (
          <button
            onClick={() => { if (!disabled) { setEditing(true); setTimeout(() => inputRef.current?.select(), 50) } }}
            className="font-mono text-lg font-bold text-white w-20 text-center hover:bg-scada-bg rounded-lg py-1 transition-colors cursor-text"
            title="Cliquer pour saisir manuellement"
          >
            {unit === '%' ? `${localValue.toFixed(0)}${unit}` : `${localValue.toFixed(1)}${unit}`}
          </button>
        )}

        <button onClick={increment} className="scada-btn-neutral p-2.5 sm:p-2" disabled={disabled}>
          <Plus size={16} />
        </button>

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={disabled || !hasChanged || applying}
          className="flex items-center gap-1 px-3 py-2 text-[10px] font-semibold rounded-lg uppercase tracking-wider transition-all border"
          style={{
            background: status === 'success' ? 'rgba(0, 212, 170, 0.3)'
              : status === 'error' ? 'rgba(255, 71, 87, 0.2)'
              : hasChanged
                ? (accentColor === 'scada-cold' ? 'rgba(74, 158, 255, 0.2)' : 'rgba(0, 212, 170, 0.2)')
                : undefined,
            color: status === 'success' ? '#00d4aa'
              : status === 'error' ? '#ff4757'
              : hasChanged
                ? (accentColor === 'scada-cold' ? '#4a9eff' : '#00d4aa')
                : undefined,
            borderColor: status === 'success' ? 'rgba(0, 212, 170, 0.5)'
              : status === 'error' ? 'rgba(255, 71, 87, 0.4)'
              : hasChanged
                ? (accentColor === 'scada-cold' ? 'rgba(74, 158, 255, 0.4)' : 'rgba(0, 212, 170, 0.4)')
                : undefined,
            opacity: (!hasChanged && status === 'idle') ? 0.5 : 1,
            cursor: (!hasChanged && status === 'idle') ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={12} />
          {applying ? '...' : status === 'success' ? 'OK !' : status === 'error' ? 'Erreur' : 'Appliquer'}
        </button>
      </div>
    </div>
  )
}

/* Temperature-only panel (beer/mead) */
function TemperaturePanel({ fermenterId, fermenter, backendProjectId, isLive, setSetpoint, setPidMode, toggleRelay, disabled }: any) {
  const deviation = fermenter.temperature - fermenter.setpoint

  const handleApplyTemp = async (value: number) => {
    setSetpoint(fermenterId, value)
    if (isLive && backendProjectId) {
      await updateTargetTemperature(backendProjectId, value)
    }
  }

  const handleApplyThreshold = async (value: number) => {
    if (isLive && backendProjectId) {
      await updateActivationThreshold(backendProjectId, value)
    }
  }

  return (
    <>
      <div className="scada-label">Contrôles</div>

      <div className="bg-scada-bg rounded-lg p-3 text-center">
        <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Température</div>
        <div className={`font-mono text-2xl font-bold ${
          Math.abs(deviation) > 3 ? 'text-scada-danger' : Math.abs(deviation) > 1.5 ? 'text-scada-warning' : 'text-scada-accent'
        }`}>
          {fermenter.temperature.toFixed(1)}°C
        </div>
        <div className="text-[9px] text-scada-text-muted mt-1">
          Déviation: <span className={Math.abs(deviation) > 1 ? 'text-scada-warning' : 'text-scada-text-secondary'}>
            {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}°C
          </span>
        </div>
      </div>

      <SetpointEditor
        value={fermenter.setpoint}
        unit="°"
        step={0.5}
        min={0}
        max={100}
        onApply={handleApplyTemp}
        disabled={disabled}
      />

      {isLive && (
        <SetpointEditor
          value={fermenter.activationThreshold ?? 0.2}
          label="Seuil d'activation"
          unit="°"
          step={0.1}
          min={0.1}
          max={5}
          onApply={handleApplyThreshold}
          disabled={disabled}
          accentColor="scada-warning"
        />
      )}

      <div>
        <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Mode PID</div>
        <div className="flex gap-1">
          {(['auto', 'manual', 'off'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setPidMode(fermenterId, mode)}
              disabled={disabled}
              className={`flex-1 px-2 py-2.5 sm:py-1.5 text-[11px] sm:text-[10px] rounded uppercase font-medium transition-colors ${
                fermenter.pid.mode === mode
                  ? mode === 'auto' ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                    : mode === 'manual' ? 'bg-scada-warning/20 text-scada-warning border border-scada-warning/40'
                    : 'bg-scada-text-muted/20 text-scada-text-muted border border-scada-text-muted/40'
                  : 'text-scada-text-muted hover:text-white border border-transparent'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] text-scada-text-muted uppercase tracking-wider">Tapis chauffant</div>
          <div className="text-[10px] text-scada-text-secondary mt-0.5">
            PID output: {fermenter.pid.output.toFixed(0)}%
          </div>
        </div>
        <button onClick={() => toggleRelay(fermenterId)} disabled={disabled || fermenter.pid.mode === 'auto'}>
          <RelayIndicator on={fermenter.relayOn} size="md" />
        </button>
      </div>
    </>
  )
}

/* Tabbed panel for koji/mushroom (temperature + humidity) */
function ControlsWithTabs({ fermenterId, fermenter, backendProjectId, isLive, setSetpoint, setPidMode, toggleRelay, setHumiditySetpoint, setHumidityPidMode, toggleHumidityRelay, disabled }: any) {
  const [tab, setTab] = useState<Tab>('temp')

  const deviation = fermenter.temperature - fermenter.setpoint
  const humidityDeviation = fermenter.humidity - (fermenter.humiditySetpoint ?? 85)

  const handleApplyTemp = async (value: number) => {
    setSetpoint(fermenterId, value)
    if (isLive && backendProjectId) {
      await updateTargetTemperature(backendProjectId, value)
    }
  }

  const handleApplyHumidity = async (value: number) => {
    setHumiditySetpoint(fermenterId, value)
    if (isLive && backendProjectId) {
      await updateTargetHumidity(backendProjectId, value)
    }
  }

  const handleApplyThreshold = async (value: number) => {
    if (isLive && backendProjectId) {
      await updateActivationThreshold(backendProjectId, value)
    }
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 bg-scada-bg rounded-lg p-1">
        <button
          onClick={() => setTab('temp')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] rounded-md font-medium transition-colors ${
            tab === 'temp'
              ? 'bg-scada-bg-secondary text-scada-accent shadow-sm'
              : 'text-scada-text-muted hover:text-white'
          }`}
        >
          <Thermometer size={12} />
          Température
        </button>
        <button
          onClick={() => setTab('humidity')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] rounded-md font-medium transition-colors ${
            tab === 'humidity'
              ? 'bg-scada-bg-secondary text-scada-cold shadow-sm'
              : 'text-scada-text-muted hover:text-white'
          }`}
        >
          <Droplet size={12} />
          Humidité
        </button>
      </div>

      {tab === 'temp' ? (
        <>
          {/* Temperature display */}
          <div className="bg-scada-bg rounded-lg p-3 text-center">
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Température</div>
            <div className={`font-mono text-2xl font-bold ${
              Math.abs(deviation) > 3 ? 'text-scada-danger' : Math.abs(deviation) > 1.5 ? 'text-scada-warning' : 'text-scada-accent'
            }`}>
              {fermenter.temperature.toFixed(1)}°C
            </div>
            <div className="text-[9px] text-scada-text-muted mt-1">
              Déviation: <span className={Math.abs(deviation) > 1 ? 'text-scada-warning' : 'text-scada-text-secondary'}>
                {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}°C
              </span>
            </div>
          </div>

          <SetpointEditor
            value={fermenter.setpoint}
            unit="°"
            step={0.5}
            min={0}
            max={100}
            onApply={handleApplyTemp}
            disabled={disabled}
          />

          {isLive && (
            <SetpointEditor
              value={fermenter.activationThreshold ?? 0.2}
              label="Seuil d'activation"
              unit="°"
              step={0.1}
              min={0.1}
              max={5}
              onApply={handleApplyThreshold}
              disabled={disabled}
              accentColor="scada-warning"
            />
          )}

          {/* PID Mode */}
          <div>
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Mode PID</div>
            <div className="flex gap-1">
              {(['auto', 'manual', 'off'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPidMode(fermenterId, mode)}
                  className={`flex-1 px-2 py-2.5 sm:py-1.5 text-[11px] sm:text-[10px] rounded uppercase font-medium transition-colors ${
                    fermenter.pid.mode === mode
                      ? mode === 'auto' ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                        : mode === 'manual' ? 'bg-scada-warning/20 text-scada-warning border border-scada-warning/40'
                        : 'bg-scada-text-muted/20 text-scada-text-muted border border-scada-text-muted/40'
                      : 'text-scada-text-muted hover:text-white border border-transparent'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Relay */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-scada-text-muted uppercase tracking-wider">Tapis chauffant</div>
              <div className="text-[10px] text-scada-text-secondary mt-0.5">
                PID output: {fermenter.pid.output.toFixed(0)}%
              </div>
            </div>
            <button onClick={() => toggleRelay(fermenterId)} disabled={fermenter.pid.mode === 'auto'}>
              <RelayIndicator on={fermenter.relayOn} size="md" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Humidity display */}
          <div className="bg-scada-bg rounded-lg p-3 text-center">
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Humidité relative</div>
            <div className={`font-mono text-2xl font-bold ${
              Math.abs(humidityDeviation) > 10
                ? 'text-scada-danger'
                : Math.abs(humidityDeviation) > 5
                  ? 'text-scada-warning'
                  : 'text-scada-cold'
            }`}>
              {fermenter.humidity.toFixed(1)}%
            </div>
            <div className="text-[9px] text-scada-text-muted mt-1">
              Déviation: <span className={
                Math.abs(humidityDeviation) > 5 ? 'text-scada-warning' : 'text-scada-text-secondary'
              }>
                {humidityDeviation > 0 ? '+' : ''}{humidityDeviation.toFixed(1)}%
              </span>
            </div>
          </div>

          <SetpointEditor
            value={fermenter.humiditySetpoint ?? 85}
            unit="%"
            step={1}
            min={0}
            max={100}
            onApply={handleApplyHumidity}
            disabled={disabled}
            accentColor="scada-cold"
          />

          {/* Humidity PID Mode */}
          <div>
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Mode PID</div>
            <div className="flex gap-1">
              {(['auto', 'manual', 'off'] as const).map(mode => (
                <button
                  key={`h-${mode}`}
                  onClick={() => setHumidityPidMode(fermenterId, mode)}
                  className={`flex-1 px-2 py-2.5 sm:py-1.5 text-[11px] sm:text-[10px] rounded uppercase font-medium transition-colors ${
                    fermenter.humidityPid!.mode === mode
                      ? mode === 'auto' ? 'bg-scada-cold/20 text-scada-cold border border-scada-cold/40'
                        : mode === 'manual' ? 'bg-scada-warning/20 text-scada-warning border border-scada-warning/40'
                        : 'bg-scada-text-muted/20 text-scada-text-muted border border-scada-text-muted/40'
                      : 'text-scada-text-muted hover:text-white border border-transparent'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Humidifier Relay */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-scada-text-muted uppercase tracking-wider">Humidificateur</div>
              <div className="text-[10px] text-scada-text-secondary mt-0.5">
                PID output: {fermenter.humidityPid.output.toFixed(0)}%
              </div>
            </div>
            <button onClick={() => toggleHumidityRelay(fermenterId)} disabled={fermenter.humidityPid.mode === 'auto'}>
              <RelayIndicator on={fermenter.humidityRelayOn ?? false} size="md" />
            </button>
          </div>
        </>
      )}
    </>
  )
}
