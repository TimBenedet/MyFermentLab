import { useState, useMemo } from 'react'
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

const timeRanges = [
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: 'All', seconds: Infinity },
]

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  fermenterId?: string  // if provided, show single fermenter
  className?: string
}

export function TemperatureChart({ fermenterId, className }: Props = {}) {
  const { state } = useBrewing()
  const [range, setRange] = useState(1)

  // Filter to single fermenter if ID provided
  const fermenters = fermenterId
    ? state.fermenters.filter(f => f.id === fermenterId)
    : state.fermenters

  // Merge all fermenter histories into unified timeline
  const data = useMemo(() => {
    if (fermenters.length === 0) return []

    // Collect all unique timestamps
    const timeMap = new Map<number, Record<string, number>>()

    for (const f of fermenters) {
      for (const point of f.temperatureHistory) {
        const key = Math.round(point.time)
        if (!timeMap.has(key)) timeMap.set(key, { time: key })
        timeMap.get(key)![f.id] = point.temp
        timeMap.get(key)![`${f.id}_sp`] = point.setpoint
      }
    }

    const allData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time)

    const selectedRange = timeRanges[range]
    if (selectedRange.seconds === Infinity) return allData

    const cutoff = state.totalElapsedSeconds - selectedRange.seconds
    return allData.filter(p => p.time > cutoff)
  }, [fermenters, range, state.totalElapsedSeconds])

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
        <div className="flex gap-1">
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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#555566"
              fontSize={9}
              fontFamily="monospace"
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#555566"
              fontSize={9}
              fontFamily="monospace"
              domain={['auto', 'auto']}
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
              labelFormatter={(v: number) => `T+ ${formatTime(v)}`}
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
      </div>
    </div>
  )
}
