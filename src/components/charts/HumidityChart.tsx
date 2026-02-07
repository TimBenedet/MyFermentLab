import { useState } from 'react'
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

interface Props {
  humidityHistory: HumidityDataPoint[]
  targetHumidity: number
  className?: string
  projectId?: string
}

function formatDay(seconds: number): string {
  const days = seconds / 86400
  return `J${Math.floor(days)}`
}

export function HumidityChart({ humidityHistory, targetHumidity, className, projectId }: Props) {
  const { addHumidityReading } = useBrewingActions()
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const handleAddPoint = () => {
    const humidity = parseFloat(inputValue)
    if (projectId && !isNaN(humidity) && humidity >= 0 && humidity <= 100) {
      addHumidityReading(projectId, humidity)
      setInputValue('')
      setShowInput(false)
    }
  }

  const data = humidityHistory.map(p => ({
    time: p.time,
    humidity: Math.round(p.humidity * 10) / 10,
    setpoint: Math.round(p.setpoint * 10) / 10,
  }))

  if (data.length === 0) {
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

      <div className="flex-1 min-h-[160px]">
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
              tickFormatter={formatDay}
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
              labelFormatter={(v: number) => formatDay(v)}
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
      </div>
    </div>
  )
}
