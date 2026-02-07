import { useMemo } from 'react'

interface VesselProps {
  name: string
  temperature: number
  level: number
  targetTemp?: number
  heating?: boolean
  cooling?: boolean
  bubbles?: boolean
  liquidColor?: string
  width?: number
  height?: number
}

export function VesselSVG({
  name,
  temperature,
  level,
  targetTemp,
  heating = false,
  cooling = false,
  bubbles = false,
  liquidColor = '#DD8800',
  width = 120,
  height = 160,
}: VesselProps) {
  const bodyX = 10
  const bodyY = 20
  const bodyW = width - 20
  const bodyH = height - 40
  const liquidH = (bodyH * Math.min(level, 100)) / 100
  const liquidY = bodyY + bodyH - liquidH

  const bubbleElements = useMemo(() => {
    if (!bubbles || level < 5) return null
    return Array.from({ length: 6 }, (_, i) => {
      const cx = bodyX + 15 + Math.random() * (bodyW - 30)
      const r = 1.5 + Math.random() * 2
      const delay = i * 0.5
      const duration = 2 + Math.random() * 2
      const rise = -(liquidH * 0.6 + Math.random() * liquidH * 0.3)
      const drift = (Math.random() - 0.5) * 10
      return (
        <circle
          key={i}
          cx={cx}
          cy={liquidY + liquidH - 5}
          r={r}
          fill="rgba(255,255,255,0.4)"
          className="bubble"
          style={{
            '--delay': `${delay}s`,
            '--duration': `${duration}s`,
            '--rise': `${rise}px`,
            '--drift': `${drift}px`,
          } as React.CSSProperties}
        />
      )
    })
  }, [bubbles, level > 5, Math.floor(liquidH / 10)])

  return (
    <svg width={width} height={height + 30} viewBox={`0 0 ${width} ${height + 30}`}>
      {/* Vessel body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={6}
        fill="#12121a"
        stroke={cooling ? '#4a9eff' : heating ? '#ff4757' : '#2a2a3a'}
        strokeWidth={cooling || heating ? 2 : 1.5}
        className={heating ? 'heating-active' : cooling ? 'cooling-active' : ''}
      />

      {/* Liquid fill */}
      {level > 0 && (
        <rect
          x={bodyX + 1.5}
          y={liquidY}
          width={bodyW - 3}
          height={liquidH - 1}
          rx={level >= 98 ? 5 : 0}
          fill={liquidColor}
          opacity={0.7}
        />
      )}

      {/* Liquid surface wave */}
      {level > 2 && level < 98 && (
        <path
          d={`M ${bodyX + 2} ${liquidY} Q ${bodyX + bodyW * 0.25} ${liquidY - 2} ${bodyX + bodyW * 0.5} ${liquidY} Q ${bodyX + bodyW * 0.75} ${liquidY + 2} ${bodyX + bodyW - 2} ${liquidY}`}
          fill="none"
          stroke={liquidColor}
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      {/* Bubbles */}
      {bubbleElements}

      {/* Heating element at bottom */}
      {heating && (
        <g>
          <path
            d={`M ${bodyX + 15} ${bodyY + bodyH - 8} Q ${bodyX + bodyW * 0.3} ${bodyY + bodyH - 14} ${bodyX + bodyW * 0.5} ${bodyY + bodyH - 8} Q ${bodyX + bodyW * 0.7} ${bodyY + bodyH - 2} ${bodyX + bodyW - 15} ${bodyY + bodyH - 8}`}
            fill="none"
            stroke="#ff4757"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="heating-active"
          />
        </g>
      )}

      {/* Temperature display */}
      <rect
        x={bodyX + bodyW / 2 - 28}
        y={bodyY + bodyH / 2 - 12}
        width={56}
        height={24}
        rx={4}
        fill="rgba(0,0,0,0.7)"
        stroke="#2a2a3a"
        strokeWidth={0.5}
      />
      <text
        x={bodyX + bodyW / 2}
        y={bodyY + bodyH / 2 + 5}
        textAnchor="middle"
        fill={temperature > 80 ? '#ff4757' : temperature < 10 ? '#4a9eff' : '#00d4aa'}
        fontSize={13}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {temperature.toFixed(1)}°
      </text>

      {/* Level indicator on the right */}
      <rect x={bodyX + bodyW + 4} y={bodyY} width={4} height={bodyH} rx={2} fill="#1a1a25" stroke="#2a2a3a" strokeWidth={0.5} />
      <rect
        x={bodyX + bodyW + 4}
        y={bodyY + bodyH - liquidH}
        width={4}
        height={liquidH}
        rx={2}
        fill={liquidColor}
        opacity={0.6}
      />

      {/* Level text */}
      <text
        x={bodyX + bodyW + 12}
        y={bodyY + bodyH / 2 + 4}
        fill="#8888aa"
        fontSize={8}
        fontFamily="monospace"
      >
        {level.toFixed(0)}%
      </text>

      {/* Setpoint marker */}
      {targetTemp !== undefined && level > 0 && (
        <g>
          <line
            x1={bodyX - 2}
            y1={bodyY + bodyH - (bodyH * Math.min(Math.max((targetTemp / 105) * 100, 0), 100)) / 100}
            x2={bodyX + 8}
            y2={bodyY + bodyH - (bodyH * Math.min(Math.max((targetTemp / 105) * 100, 0), 100)) / 100}
            stroke="#ffaa00"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
        </g>
      )}

      {/* Vessel name */}
      <text
        x={width / 2}
        y={height + 20}
        textAnchor="middle"
        fill="#8888aa"
        fontSize={9}
        fontFamily="sans-serif"
        fontWeight="500"
        letterSpacing="1"
      >
        {name.toUpperCase()}
      </text>

      {/* Pipe connections - inlet top, outlet bottom */}
      <rect x={bodyX + bodyW / 2 - 4} y={bodyY - 8} width={8} height={10} rx={2} fill="#2a2a3a" />
      <rect x={bodyX + bodyW / 2 - 4} y={bodyY + bodyH - 2} width={8} height={10} rx={2} fill="#2a2a3a" />
    </svg>
  )
}
