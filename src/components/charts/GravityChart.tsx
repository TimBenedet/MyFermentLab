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
import type { GravityDataPoint } from '../../types/brewing'
import { useBrewingActions } from '../../context/BrewingContext'

interface Props {
  gravityHistory: GravityDataPoint[]
  og: number
  fg: number
  color: string
  className?: string
  projectId?: string
}

function formatDay(seconds: number): string {
  const days = seconds / 86400
  return `J${Math.floor(days)}`
}

function nowLocalDatetimeValue(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function GravityChart({ gravityHistory, og, fg, color, className, projectId }: Props) {
  const { addGravityReading } = useBrewingActions()
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [dateValue, setDateValue] = useState('')

  const openInput = () => {
    const data = gravityHistory.map(p => Math.round(p.gravity * 1000) / 1000)
    setInputValue(data[data.length - 1]?.toFixed(3) ?? og.toFixed(3))
    setDateValue(nowLocalDatetimeValue())
    setShowInput(true)
  }

  const handleAddPoint = () => {
    const gravity = parseFloat(inputValue)
    if (projectId && !isNaN(gravity) && gravity >= 0.990 && gravity <= 1.200) {
      const timestamp = dateValue ? new Date(dateValue).getTime() / 1000 : undefined
      addGravityReading(projectId, gravity, timestamp)
      setInputValue('')
      setDateValue('')
      setShowInput(false)
    }
  }

  const data = gravityHistory.map(p => ({
    time: p.time,
    gravity: Math.round(p.gravity * 1000) / 1000,
  }))

  const addButton = projectId && !showInput && (
    <button
      onClick={openInput}
      className="flex items-center gap-1 px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded bg-scada-accent/15 text-scada-accent border border-scada-accent/30 hover:bg-scada-accent/25 transition-colors"
    >
      <Plus size={10} />
      Mesure
    </button>
  )

  const inputForm = projectId && showInput && (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <input
        type="number"
        step="0.001"
        min="0.990"
        max="1.200"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAddPoint(); if (e.key === 'Escape') setShowInput(false) }}
        autoFocus
        placeholder="1.050"
        className="w-[72px] px-1.5 py-0.5 rounded bg-scada-bg border border-scada-accent/40 text-white text-[10px] font-mono focus:outline-none focus:border-scada-accent"
      />
      <input
        type="datetime-local"
        value={dateValue}
        onChange={e => setDateValue(e.target.value)}
        className="px-1.5 py-0.5 rounded bg-scada-bg border border-scada-accent/40 text-white text-[10px] font-mono focus:outline-none focus:border-scada-accent"
      />
      <button
        onClick={handleAddPoint}
        className="px-2 py-0.5 rounded bg-scada-accent/20 text-scada-accent border border-scada-accent/40 hover:bg-scada-accent/30 transition-colors text-[10px]"
      >
        OK
      </button>
      <button
        onClick={() => setShowInput(false)}
        className="px-1.5 py-0.5 rounded text-scada-text-muted hover:text-white transition-colors text-[10px]"
      >
        ✕
      </button>
    </div>
  )

  if (data.length === 0) {
    return (
      <div className={`scada-card flex flex-col ${className ?? ''}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="scada-label">Densité</span>
          {addButton}
        </div>
        {inputForm && <div className="mb-2">{inputForm}</div>}
        {!showInput && (
          <div className="flex-1 min-h-[120px] flex items-center justify-center text-[10px] text-scada-text-muted">
            En attente de données de densité...
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`scada-card flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="scada-label">Densité</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-scada-text-muted">
          <span>OG: {og.toFixed(3)}</span>
          <span>FG: {fg.toFixed(3)}</span>
          <span className="text-white font-bold">
            Actuel: {data[data.length - 1]?.gravity.toFixed(3)}
          </span>
          {addButton}
          {inputForm}
        </div>
      </div>

      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gravityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
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
              domain={[
                (dataMin: number) => Math.floor((Math.min(dataMin, fg) - 0.005) * 1000) / 1000,
                (dataMax: number) => Math.ceil((Math.max(dataMax, og) + 0.005) * 1000) / 1000,
              ]}
              tickFormatter={(v: number) => v.toFixed(3)}
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
              formatter={(value: number) => [value.toFixed(3), 'Densité']}
            />
            <ReferenceLine
              y={og}
              stroke="#ffaa00"
              strokeDasharray="6 3"
              strokeWidth={0.5}
              label={{ value: 'OG', position: 'left', fontSize: 8, fill: '#ffaa00' }}
            />
            <ReferenceLine
              y={fg}
              stroke="#00d4aa"
              strokeDasharray="6 3"
              strokeWidth={0.5}
              label={{ value: 'FG', position: 'left', fontSize: 8, fill: '#00d4aa' }}
            />
            <Area
              type="monotone"
              dataKey="gravity"
              stroke={color}
              strokeWidth={1.5}
              fill="url(#gravityGradient)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
