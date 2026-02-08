import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { useBrewing } from '../../context/BrewingContext'
import { fetchProjectHistory, type BackendHistoryPoint } from '../../api/projects'

const timeRanges = [
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21600 },
  { label: '1j', seconds: 86400 },
  { label: '1s', seconds: 604800 },
  { label: 'Tout', seconds: Infinity },
]

function formatTimestamp(epochSec: number, rangeSeconds: number): string {
  const d = new Date(epochSec * 1000)
  if (rangeSeconds <= 3600) {
    // 15m, 1h: show HH:MM:SS
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  if (rangeSeconds <= 86400) {
    // 6h, 1d: show HH:MM
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  // 1w+: show day + HH:MM
  return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatTooltipTime(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

interface Props {
  fermenterId?: string  // if provided, show single fermenter
  backendProjectId?: string  // if provided, fetch backend history for long ranges
  className?: string
}

export function TemperatureChart({ fermenterId, backendProjectId, className }: Props) {
  const { state } = useBrewing()
  const [range, setRange] = useState(1)
  const [backendHistory, setBackendHistory] = useState<BackendHistoryPoint[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Filter to single fermenter if ID provided
  const fermenters = fermenterId
    ? state.fermenters.filter(f => f.id === fermenterId)
    : state.fermenters

  const selectedRange = timeRanges[range]

  // Fetch backend history when switching to longer ranges
  useEffect(() => {
    if (!backendProjectId || selectedRange.seconds <= 900) {
      setBackendHistory([])
      return
    }

    let cancelled = false
    setLoadingHistory(true)
    fetchProjectHistory(backendProjectId)
      .then(result => {
        if (!cancelled) setBackendHistory(result.history)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false) })

    return () => { cancelled = true }
  }, [backendProjectId, selectedRange.seconds])

  // Merge data: use backend history for longer ranges, local for short
  const data = useMemo(() => {
    if (fermenters.length === 0) return []

    const nowSec = Date.now() / 1000
    const cutoff = selectedRange.seconds === Infinity ? 0 : nowSec - selectedRange.seconds

    // Use backend history if available and range > 15m
    if (backendHistory.length > 0 && selectedRange.seconds > 900) {
      // Backend data: {timestamp (ms), temperature}
      // Downsample for large datasets
      const filtered = backendHistory.filter(p => p.timestamp / 1000 > cutoff)
      const maxPoints = 500
      const step = Math.max(1, Math.floor(filtered.length / maxPoints))

      return filtered
        .filter((_, i) => i % step === 0 || i === filtered.length - 1)
        .map(p => ({
          time: p.timestamp / 1000,
          [fermenters[0]?.id ?? 'temp']: p.temperature,
        }))
    }

    // Local data from fermenter history
    const timeMap = new Map<number, Record<string, number>>()

    for (const f of fermenters) {
      for (const point of f.temperatureHistory) {
        if (point.time < cutoff) continue
        const key = Math.round(point.time)
        if (!timeMap.has(key)) timeMap.set(key, { time: key })
        timeMap.get(key)![f.id] = point.temp
        timeMap.get(key)![`${f.id}_sp`] = point.setpoint
      }
    }

    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
  }, [fermenters, backendHistory, selectedRange.seconds])

  if (fermenters.length === 0) {
    return (
      <div className="scada-card">
        <span className="scada-label">Historique Températures</span>
        <div className="h-[160px] flex items-center justify-center text-[10px] text-scada-text-muted">
          {fermenterId ? 'En attente de données...' : 'Ajoutez des fermenteurs pour voir les courbes'}
        </div>
      </div>
    )
  }

  return (
    <div className={`scada-card flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="scada-label">Historique Températures</span>
        <div className="flex gap-1 flex-wrap justify-end">
          {timeRanges.map((tr, i) => (
            <button
              key={tr.label}
              onClick={() => setRange(i)}
              className={`px-2.5 sm:px-2 py-1.5 sm:py-0.5 text-[10px] sm:text-[9px] rounded uppercase tracking-wider transition-colors ${
                i === range
                  ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                  : 'text-scada-text-muted hover:text-scada-text-secondary border border-transparent'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[160px]">
        {loadingHistory ? (
          <div className="h-full flex items-center justify-center text-[10px] text-scada-text-muted">
            Chargement de l'historique...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25" />
              <XAxis
                dataKey="time"
                tickFormatter={(v: number) => formatTimestamp(v, selectedRange.seconds)}
                stroke="#555566"
                fontSize={9}
                fontFamily="monospace"
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#555566"
                fontSize={9}
                fontFamily="monospace"
                domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
                tickFormatter={(v: number) => `${v}°`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a25',
                  border: '1px solid #2a2a3a',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                }}
                labelFormatter={(v: number) => formatTooltipTime(v)}
                formatter={(value: number) => [`${value.toFixed(1)}°C`]}
              />
              {!fermenterId && (
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }}
                />
              )}

              {/* One line per fermenter */}
              {fermenters.map(f => (
                <Line
                  key={f.id}
                  type="monotone"
                  dataKey={f.id}
                  name={f.name}
                  stroke={f.color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}

              {/* Setpoint reference line */}
              {fermenters.length > 0 && (
                <ReferenceLine
                  y={fermenters[0].setpoint}
                  stroke="#ffaa00"
                  strokeDasharray="6 3"
                  strokeWidth={0.5}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
