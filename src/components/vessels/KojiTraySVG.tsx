import { useMemo } from 'react'

interface KojiTrayProps {
  name: string
  temperature: number
  humidity?: number
  heating?: boolean
  humidityRelayOn?: boolean
  width?: number
  height?: number
}

export function KojiTraySVG({
  name,
  temperature,
  humidity,
  heating = false,
  humidityRelayOn = false,
  width = 180,
  height = 260,
}: KojiTrayProps) {
  const cx = width / 2

  // Base / tray — wide, sits in the lower third
  const baseW = width - 20
  const baseH = 50
  const baseX = 10
  const baseY = height - 70

  // Dome / greenhouse lid — arc above the base
  const domeTopY = 30
  const domeH = baseY - domeTopY

  // Grain tray inside the base
  const grainW = baseW - 12
  const grainH = baseH - 10
  const grainX = baseX + 6
  const grainY = baseY + 5

  // Rice grain pattern
  const grains = useMemo(() => {
    const items = []
    const cols = Math.floor(grainW / 8)
    const rows = Math.floor(grainH / 7)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = grainX + 3 + c * 8 + (r % 2) * 4
        const y = grainY + 3 + r * 7
        if (x > grainX + grainW - 4) continue
        items.push(
          <ellipse
            key={`g-${r}-${c}`}
            cx={x}
            cy={y}
            rx={2.5}
            ry={1.5}
            fill="#d4c9a0"
            opacity={0.35 + (r * c * 7) % 3 * 0.12}
            transform={`rotate(${15 + (c * 13 + r * 7) % 30}, ${x}, ${y})`}
          />
        )
      }
    }
    return items
  }, [grainW, grainH, grainX, grainY])

  // White koji bloom on top of grains
  const bloom = useMemo(() => {
    const spots = []
    for (let i = 0; i < 10; i++) {
      const x = grainX + 6 + (i * 37 + 13) % (grainW - 12)
      const y = grainY + 1 + (i * 11) % 5
      const r = 4 + (i * 7) % 4
      spots.push(
        <ellipse
          key={`b-${i}`}
          cx={x}
          cy={y}
          rx={r}
          ry={r * 0.5}
          fill="white"
          opacity={0.08 + (i % 3) * 0.04}
        />
      )
    }
    return spots
  }, [grainW, grainX, grainY])

  // Vapor particles when humidifier active
  const vapor = useMemo(() => {
    if (!humidityRelayOn) return null
    return Array.from({ length: 6 }, (_, i) => {
      const x = baseX + 20 + Math.random() * (baseW - 40)
      const r = 1.5 + Math.random() * 2
      const delay = i * 0.5
      const duration = 2.5 + Math.random() * 2
      const rise = -(40 + Math.random() * 50)
      const drift = (Math.random() - 0.5) * 12
      return (
        <circle
          key={i}
          cx={x}
          cy={baseY - 8}
          r={r}
          fill="rgba(150,200,255,0.4)"
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
  }, [humidityRelayOn, baseX, baseW, baseY])

  return (
    <svg width={width} height={height + 30} viewBox={`0 0 ${width} ${height + 30}`}>
      {/* Dome / greenhouse lid — transparent arc */}
      <path
        d={`M ${baseX + 4} ${baseY}
            Q ${baseX + 4} ${domeTopY + 10} ${cx} ${domeTopY}
            Q ${baseX + baseW - 4} ${domeTopY + 10} ${baseX + baseW - 4} ${baseY}`}
        fill="rgba(180,220,255,0.04)"
        stroke={heating ? '#ff4757' : 'rgba(180,220,255,0.2)'}
        strokeWidth={heating ? 1.5 : 1}
        className={heating ? 'heating-active' : ''}
      />

      {/* Dome ribs — subtle structural lines */}
      {[0.3, 0.5, 0.7].map(t => {
        const ribX = baseX + 4 + (baseW - 8) * t
        const ribTopY = domeTopY + 10 + Math.abs(t - 0.5) * 2 * (domeH * 0.15)
        return (
          <line
            key={`rib-${t}`}
            x1={ribX}
            y1={baseY}
            x2={ribX}
            y2={ribTopY}
            stroke="rgba(180,220,255,0.08)"
            strokeWidth={0.5}
          />
        )
      })}

      {/* Horizontal rib */}
      <path
        d={`M ${baseX + 12} ${baseY - domeH * 0.45}
            Q ${cx} ${baseY - domeH * 0.55} ${baseX + baseW - 12} ${baseY - domeH * 0.45}`}
        fill="none"
        stroke="rgba(180,220,255,0.08)"
        strokeWidth={0.5}
      />

      {/* Base tray body */}
      <rect
        x={baseX}
        y={baseY}
        width={baseW}
        height={baseH}
        rx={4}
        fill="#12121a"
        stroke={heating ? '#ff4757' : '#2a2a3a'}
        strokeWidth={heating ? 2 : 1.5}
        className={heating ? 'heating-active' : ''}
      />

      {/* Grain fill background */}
      <rect
        x={grainX}
        y={grainY}
        width={grainW}
        height={grainH}
        rx={2}
        fill="#b8a878"
        opacity={0.25}
      />

      {/* Individual grains */}
      {grains}

      {/* Koji bloom */}
      {bloom}

      {/* Vapor particles */}
      {vapor}

      {/* Heating element at bottom of base */}
      {heating && (
        <path
          d={`M ${baseX + 12} ${baseY + baseH - 6} Q ${baseX + baseW * 0.3} ${baseY + baseH - 12} ${cx} ${baseY + baseH - 6} Q ${baseX + baseW * 0.7} ${baseY + baseH} ${baseX + baseW - 12} ${baseY + baseH - 6}`}
          fill="none"
          stroke="#ff4757"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="heating-active"
        />
      )}

      {/* Temperature badge — center of dome */}
      <rect
        x={cx - 28}
        y={baseY - domeH * 0.45 - 12}
        width={56}
        height={24}
        rx={4}
        fill="rgba(0,0,0,0.7)"
        stroke="#2a2a3a"
        strokeWidth={0.5}
      />
      <text
        x={cx}
        y={baseY - domeH * 0.45 + 5}
        textAnchor="middle"
        fill={temperature > 50 ? '#ff4757' : '#00d4aa'}
        fontSize={13}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {temperature.toFixed(1)}°
      </text>

      {/* Humidity badge — upper dome */}
      {humidity !== undefined && (
        <>
          <rect
            x={cx - 22}
            y={domeTopY + 14}
            width={44}
            height={18}
            rx={3}
            fill="rgba(0,0,0,0.6)"
            stroke="rgba(59,130,246,0.3)"
            strokeWidth={0.5}
          />
          <text
            x={cx}
            y={domeTopY + 26}
            textAnchor="middle"
            fill="#3b82f6"
            fontSize={10}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {humidity.toFixed(0)}%
          </text>
        </>
      )}


      {/* Pipe — humidity inlet at dome top */}
      <rect x={cx - 4} y={domeTopY - 6} width={8} height={8} rx={2} fill="#2a2a3a" />
      {/* Pipe — drain at base bottom */}
      <rect x={cx - 4} y={baseY + baseH - 2} width={8} height={10} rx={2} fill="#2a2a3a" />

      {/* Vessel name */}
      <text
        x={cx}
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
    </svg>
  )
}
