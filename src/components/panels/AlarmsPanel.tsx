import { useRef, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, BellOff } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../../context/BrewingContext'

const severityConfig = {
  info: { icon: Info, color: '#4a9eff', bg: 'rgba(74, 158, 255, 0.1)', border: 'rgba(74, 158, 255, 0.3)' },
  warning: { icon: AlertTriangle, color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.1)', border: 'rgba(255, 170, 0, 0.3)' },
  critical: { icon: AlertCircle, color: '#ff4757', bg: 'rgba(255, 71, 87, 0.1)', border: 'rgba(255, 71, 87, 0.3)' },
}

export function AlarmsPanel() {
  const { state } = useBrewing()
  const { ackAlarm, ackAllAlarms } = useBrewingActions()
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeAlarms = state.alarms.filter(a => a.active && !a.acknowledged)
  const sortedAlarms = [...state.alarms].reverse().slice(0, 20)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [state.alarms.length])

  return (
    <div className="scada-card flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="scada-label">Alarmes</span>
          {activeAlarms.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono rounded-full bg-scada-danger/20 text-scada-danger border border-scada-danger/30 animate-pulse">
              {activeAlarms.length}
            </span>
          )}
        </div>
        {state.alarms.length > 0 && (
          <button
            onClick={ackAllAlarms}
            className="flex items-center gap-1 text-[9px] text-scada-text-muted hover:text-white transition-colors"
            title="Acquitter tout"
          >
            <BellOff size={10} />
            ACQ
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 max-h-[200px] overflow-y-auto pr-1">
        {sortedAlarms.length === 0 ? (
          <div className="text-center text-[10px] text-scada-text-muted py-4">
            Aucune alarme
          </div>
        ) : (
          sortedAlarms.map(alarm => {
            const config = severityConfig[alarm.severity]
            const Icon = config.icon
            const time = new Date(alarm.timestamp)

            return (
              <div
                key={alarm.id}
                className={`flex items-start gap-2 p-2 rounded border transition-all ${
                  alarm.acknowledged ? 'opacity-40' : ''
                }`}
                style={{
                  backgroundColor: alarm.acknowledged ? '#12121a' : config.bg,
                  borderColor: alarm.acknowledged ? '#2a2a3a' : config.border,
                }}
              >
                <Icon size={12} style={{ color: config.color }} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white leading-tight">{alarm.message}</div>
                  <div className="text-[8px] text-scada-text-muted mt-0.5">
                    {time.toLocaleTimeString('fr-FR')}
                  </div>
                </div>
                {!alarm.acknowledged && (
                  <button
                    onClick={() => ackAlarm(alarm.id)}
                    className="text-[8px] uppercase tracking-wider text-scada-text-muted hover:text-white shrink-0"
                  >
                    ACQ
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
