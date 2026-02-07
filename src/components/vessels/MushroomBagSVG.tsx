import { useMemo } from 'react'

interface MushroomBagProps {
  name: string
  temperature: number
  humidity?: number
  heating?: boolean
  humidityRelayOn?: boolean
  width?: number
  height?: number
}

export function MushroomBagSVG({
  name,
  temperature,
  humidity,
  heating = false,
  humidityRelayOn = false,
  width = 180,
  height = 260,
}: MushroomBagProps) {
  const cx = width / 2

  // Same greenhouse structure as KojiTraySVG
  const baseW = width - 20
  const baseH = 50
  const baseX = 10
  const baseY = height - 70

  const domeTopY = 30
  const domeH = baseY - domeTopY

  // Substrate in the base tray
  const substrateW = baseW - 12
  const substrateH = baseH - 10
  const substrateX = baseX + 6
  const substrateY = baseY + 5

  // Mushrooms growing from substrate up into the dome
  const mushrooms = useMemo(() => {
    const positions = [
      { x: substrateX + substrateW * 0.18, stemH: 55, capW: 20, capH: 9 },
      { x: substrateX + substrateW * 0.38, stemH: 75, capW: 26, capH: 12 },
      { x: substrateX + substrateW * 0.58, stemH: 65, capW: 22, capH: 10 },
      { x: substrateX + substrateW * 0.78, stemH: 45, capW: 18, capH: 8 },
    ]
    return positions.map((p, i) => {
      const stemTop = baseY - p.stemH
      return (
        <g key={`m-${i}`}>
          {/* Stem */}
          <rect
            x={p.x - 2.5}
            y={stemTop}
            width={5}
            height={p.stemH}
            rx={2}
            fill="#c4b896"
            opacity={0.5}
          />
          {/* Cap — dome shape */}
          <path
            d={`M ${p.x - p.capW / 2} ${stemTop}
                Q ${p.x - p.capW / 2} ${stemTop - p.capH * 1.3} ${p.x} ${stemTop - p.capH}
                Q ${p.x + p.capW / 2} ${stemTop - p.capH * 1.3} ${p.x + p.capW / 2} ${stemTop}
                Z`}
            fill="#8B7355"
            opacity={0.5}
            stroke="#6B5540"
            strokeWidth={0.5}
          />
          {/* Cap highlight */}
          <path
            d={`M ${p.x - p.capW * 0.2} ${stemTop - 1}
                Q ${p.x - p.capW * 0.2} ${stemTop - p.capH * 0.8} ${p.x} ${stemTop - p.capH * 0.7}
                Q ${p.x + p.capW * 0.2} ${stemTop - p.capH * 0.8} ${p.x + p.capW * 0.2} ${stemTop - 1}
                Z`}
            fill="#a08960"
            opacity={0.25}
          />
        </g>
      )
    })
  }, [substrateX, substrateW, baseY])

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

      {/* Substrate fill */}
      <rect
        x={substrateX}
        y={substrateY}
        width={substrateW}
        height={substrateH}
        rx={2}
        fill="#3a2d1e"
        opacity={0.5}
      />

      {/* Mushrooms growing from substrate into dome */}
      {mushrooms}

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
