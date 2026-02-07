import { Play, Pause, RotateCcw, Gauge } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../../context/BrewingContext'

const speeds = [1, 2, 5, 10, 50]

export function SimulationControls() {
  const { state } = useBrewing()
  const { start, stop, reset, setSpeed } = useBrewingActions()

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Start/Stop */}
      {!state.isRunning ? (
        <button onClick={start} className="scada-btn-primary flex items-center gap-1.5">
          <Play size={12} /> Démarrer
        </button>
      ) : (
        <button onClick={stop} className="scada-btn-danger flex items-center gap-1.5">
          <Pause size={12} /> Pause
        </button>
      )}
      <button onClick={reset} className="scada-btn-neutral flex items-center gap-1.5">
        <RotateCcw size={12} /> Reset
      </button>

      {/* Speed */}
      <div className="flex items-center gap-1.5 ml-2">
        <Gauge size={12} className="text-scada-text-secondary" />
        <div className="flex gap-0.5">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 text-[9px] font-mono rounded transition-colors ${
                state.speed === s
                  ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                  : 'text-scada-text-muted hover:text-white border border-transparent'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Elapsed time */}
      {state.totalElapsedSeconds > 0 && (
        <span className="text-[10px] font-mono text-scada-text-secondary ml-auto">
          T+ {formatElapsed(state.totalElapsedSeconds)}
        </span>
      )}
    </div>
  )
}
