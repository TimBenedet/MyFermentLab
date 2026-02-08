import { useState, useMemo, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Plus } from 'lucide-react'
import type { HumidityDataPoint } from '../../types/brewing'
import { useBrewingActions } from '../../context/BrewingContext'
import { fetchProjectHistory, type BackendHumidityPoint } from '../../api/projects'

const timeRanges = [
  { label: '1h', seconds: 3600 },
  { label: '6h', seconds: 21600 },
  { label: '24h', seconds: 86400 },
  { label: '7j', seconds: 604800 },
  { label: '30j', seconds: 2592000 },
  { label: 'Tout', seconds: Infinity },
]

function formatTimestamp(epochSec: number, rangeSeconds: number): string {
  const d = new Date(epochSec * 1000)
  if (rangeSeconds <= 3600) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  if (rangeSeconds <= 86400) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (rangeSeconds <= 604800) {
    return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function formatTooltipTime(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

interface Props {
  humidityHistory: HumidityDataPoint[]
  targetHumidity: number
  className?: string
  projectId?: string
  backendProjectId?: string
}

export function HumidityChart({ humidityHistory, targetHumidity, className, projectId, backendProjectId }: Props) {
  const { addHumidityReading } = useBrewingActions()
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [range, setRange] = useState(1)
  const [backendHistory, setBackendHistory] = useState<BackendHumidityPoint[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const selectedRange = timeRanges[range]

  // Fetch backend humidity history for longer ranges
  useEffect(() => {
    if (!backendProjectId || selectedRange.seconds <= 3600) {
      setBackendHistory([])
      return
    }

    let cancelled = false
    setLoadingHistory(true)
    fetchProjectHistory(backendProjectId)
      .then(result => {
        if (!cancelled) setBackendHistory(result.humidityHistory)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false) })

    return () => { cancelled = true }
  }, [backendProjectId, selectedRange.seconds])

  const handleAddPoint = () => {
    const humidity = parseFloat(inputValue)
    if (projectId && !isNaN(humidity) && humidity >= 0 && humidity <= 100) {
      addHumidityReading(projectId, humidity)
      setInputValue('')
      setShowInput(false)
    }
  }

  const data = useMemo(() => {
    const nowSec = Date.now() / 1000
    const cutoff = selectedRange.seconds === Infinity ? 0 : nowSec - selectedRange.seconds

    // Use backend history for longer ranges
    if (backendHistory.length > 0 && selectedRange.seconds > 3600) {
      const filtered = backendHistory.filter(p => p.timestamp / 1000 > cutoff)
      const maxPoints = 500
      const step = Math.max(1, Math.floor(filtered.length / maxPoints))

      return filtered
        .filter((_, i) => i % step === 0 || i === filtered.length - 1)
        .map(p => ({
          time: p.timestamp / 1000,
          humidity: Math.round(p.humidity * 10) / 10,
          setpoint: targetHumidity,
        }))
    }

    // Local data
    return humidityHistory
      .filter(p => p.time > cutoff)
      .map(p => ({
        time: p.time,
        humidity: Math.round(p.humidity * 10) / 10,
        setpoint: Math.round(p.setpoint * 10) / 10,
      }))
  }, [humidityHistory, backendHistory, selectedRange.seconds, targetHumidity])

  if (data.length === 0 && !loadingHistory) {
    return (
      <div className={`scada-card flex flex-col ${className ?? ''}`}>
        <span className="scada-label">Humidité</span>
        <div className="flex-1 min-h-[120px] flex items-center justify-center text-[10px] text-scada-text-muted">
          En attente de données d'humidité...
        </div>
      </div>
    )
  }

  const currentHumidity = data[data.length - 1]?.humidity

  return (
    <div className={`scada-card flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="scada-label">Humidité</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-scada-text-muted">
          <span>Cible: {targetHumidity}%</span>
          <span className="text-white font-bold">
            Actuel: {currentHumidity?.toFixed(1)}%
          </span>
          {projectId && !showInput && (
            <button
              onClick={() => { setShowInput(true); setInputValue(currentHumidity?.toFixed(0) ?? String(targetHumidity)) }}
              className="flex items-center gap-1 px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded bg-scada-cold/15 text-scada-cold border border-scada-cold/30 hover:bg-scada-cold/25 transition-colors"
            >
              <Plus size={10} />
              Mesure
            </button>
          )}
          {projectId && showInput && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddPoint(); if (e.key === 'Escape') setShowInput(false) }}
                autoFocus
                className="w-[56px] px-1.5 py-0.5 rounded bg-scada-bg border border-scada-cold/40 text-white text-[10px] font-mono focus:outline-none focus:border-scada-cold"
              />
              <button
                onClick={handleAddPoint}
                className="px-2 py-0.5 rounded bg-scada-cold/20 text-scada-cold border border-scada-cold/40 hover:bg-scada-cold/30 transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => setShowInput(false)}
                className="px-1.5 py-0.5 rounded text-scada-text-muted hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Time range selector */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {timeRanges.map((tr, i) => (
          <button
            key={tr.label}
            onClick={() => setRange(i)}
            className={`px-2.5 sm:px-2 py-1.5 sm:py-0.5 text-[10px] sm:text-[9px] rounded uppercase tracking-wider transition-colors ${
              i === range
                ? 'bg-scada-cold/20 text-scada-cold border border-scada-cold/40'
                : 'text-scada-text-muted hover:text-scada-text-secondary border border-transparent'
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-[160px]">
        {loadingHistory ? (
          <div className="h-full flex items-center justify-center text-[10px] text-scada-text-muted">
            Chargement de l'historique...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
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
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  name === 'humidity' ? 'Humidité' : 'Cible',
                ]}
              />
              <ReferenceLine
                y={targetHumidity}
                stroke="#00d4aa"
                strokeDasharray="6 3"
                strokeWidth={0.5}
                label={{ value: `${targetHumidity}%`, position: 'left', fontSize: 8, fill: '#00d4aa' }}
              />
              <Area
                type="monotone"
                dataKey="humidity"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fill="url(#humidityGradient)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
