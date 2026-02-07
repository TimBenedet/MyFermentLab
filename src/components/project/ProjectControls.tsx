import { useState } from 'react'
import { Minus, Plus, Thermometer, Droplet } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../../context/BrewingContext'
import { useConnection } from '../../context/ConnectionContext'
import { updateTargetTemperature, toggleOutlet, setControlMode } from '../../api/projects'
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

  // Wrap actions to also call API in live mode
  const handleSetSetpoint = (fId: string, value: number) => {
    setSetpoint(fId, value)
    if (isLive) updateTargetTemperature(backendProjectId!, value).catch(() => {})
  }
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
          setSetpoint={handleSetSetpoint}
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
          setSetpoint={handleSetSetpoint}
          setPidMode={handleSetPidMode}
          toggleRelay={handleToggleRelay}
          disabled={isViewer}
        />
      )}
    </div>
  )
}

/* Temperature-only panel (beer/mead) */
function TemperaturePanel({ fermenterId, fermenter, setSetpoint, setPidMode, toggleRelay, disabled }: any) {
  const deviation = fermenter.temperature - fermenter.setpoint

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

      <div>
        <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Consigne</div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setSetpoint(fermenterId, fermenter.setpoint - 0.5)} className="scada-btn-neutral p-2" disabled={disabled}>
            <Minus size={14} />
          </button>
          <span className="font-mono text-lg font-bold text-white w-16 text-center">
            {fermenter.setpoint.toFixed(1)}°
          </span>
          <button onClick={() => setSetpoint(fermenterId, fermenter.setpoint + 0.5)} className="scada-btn-neutral p-2" disabled={disabled}>
            <Plus size={14} />
          </button>
        </div>
      </div>

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
function ControlsWithTabs({ fermenterId, fermenter, setSetpoint, setPidMode, toggleRelay, setHumiditySetpoint, setHumidityPidMode, toggleHumidityRelay, disabled }: any) {
  const [tab, setTab] = useState<Tab>('temp')

  const deviation = fermenter.temperature - fermenter.setpoint
  const humidityDeviation = fermenter.humidity - (fermenter.humiditySetpoint ?? 85)

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

          {/* Setpoint */}
          <div>
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Consigne</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setSetpoint(fermenterId, fermenter.setpoint - 0.5)} className="scada-btn-neutral p-2.5 sm:p-2">
                <Minus size={16} />
              </button>
              <span className="font-mono text-lg font-bold text-white w-16 text-center">
                {fermenter.setpoint.toFixed(1)}°
              </span>
              <button onClick={() => setSetpoint(fermenterId, fermenter.setpoint + 0.5)} className="scada-btn-neutral p-2.5 sm:p-2">
                <Plus size={16} />
              </button>
            </div>
          </div>

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

          {/* Humidity setpoint */}
          <div>
            <div className="text-[9px] text-scada-text-muted uppercase tracking-wider mb-2">Consigne</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setHumiditySetpoint(fermenterId, (fermenter.humiditySetpoint ?? 85) - 1)} className="scada-btn-neutral p-2.5 sm:p-2">
                <Minus size={16} />
              </button>
              <span className="font-mono text-lg font-bold text-white w-16 text-center">
                {(fermenter.humiditySetpoint ?? 85).toFixed(0)}%
              </span>
              <button onClick={() => setHumiditySetpoint(fermenterId, (fermenter.humiditySetpoint ?? 85) + 1)} className="scada-btn-neutral p-2.5 sm:p-2">
                <Plus size={16} />
              </button>
            </div>
          </div>

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
