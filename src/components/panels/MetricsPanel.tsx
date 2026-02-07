import { useBrewing } from '../../context/BrewingContext'
import { Thermometer, Zap, Activity } from 'lucide-react'

export function MetricsPanel() {
  const { state } = useBrewing()
  const { fermenters } = state

  if (fermenters.length === 0) return null

  const avgTemp = fermenters.reduce((s, f) => s + f.temperature, 0) / fermenters.length
  const relaysOn = fermenters.filter(f => f.relayOn).length
  const maxDeviation = Math.max(...fermenters.map(f => Math.abs(f.temperature - f.setpoint)))

  return (
    <div className="scada-card">
      <div className="scada-label mb-3">Vue globale</div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 rounded bg-scada-bg-secondary">
          <Thermometer size={13} className="text-scada-accent shrink-0" />
          <div className="flex-1">
            <div className="text-[9px] text-scada-text-muted">Temp. moyenne</div>
            <div className="font-mono text-sm font-bold text-white">{avgTemp.toFixed(1)}°C</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded bg-scada-bg-secondary">
          <Zap size={13} className={relaysOn > 0 ? 'text-scada-danger' : 'text-scada-text-muted'} />
          <div className="flex-1">
            <div className="text-[9px] text-scada-text-muted">Tapis chauffants</div>
            <div className="font-mono text-sm font-bold text-white">
              {relaysOn}/{fermenters.length} actif{relaysOn > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded bg-scada-bg-secondary">
          <Activity size={13} className={
            maxDeviation > 3 ? 'text-scada-danger' : maxDeviation > 1.5 ? 'text-scada-warning' : 'text-scada-accent'
          } />
          <div className="flex-1">
            <div className="text-[9px] text-scada-text-muted">Déviation max</div>
            <div className={`font-mono text-sm font-bold ${
              maxDeviation > 3 ? 'text-scada-danger' : maxDeviation > 1.5 ? 'text-scada-warning' : 'text-scada-accent'
            }`}>
              {maxDeviation.toFixed(1)}°C
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
