interface RelayIndicatorProps {
  on: boolean
  onToggle?: () => void
  size?: 'sm' | 'md'
}

export function RelayIndicator({ on, onToggle, size = 'md' }: RelayIndicatorProps) {
  const isMd = size === 'md'

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 ${isMd ? 'px-2.5 py-1.5' : 'px-2 py-1'} rounded border transition-all ${
        on
          ? 'bg-scada-danger/15 border-scada-danger/40 text-scada-danger'
          : 'bg-scada-bg-secondary border-scada-border text-scada-text-muted hover:text-white'
      }`}
      title={on ? 'Tapis chauffant ON' : 'Tapis chauffant OFF'}
    >
      {/* Heating coil icon */}
      <svg width={isMd ? 16 : 12} height={isMd ? 16 : 12} viewBox="0 0 16 16">
        <path
          d="M3 12 Q5 6 8 12 Q11 6 13 12"
          fill="none"
          stroke={on ? '#ff4757' : '#555566'}
          strokeWidth={2}
          strokeLinecap="round"
          className={on ? 'heating-active' : ''}
        />
      </svg>
      <span className={`font-mono ${isMd ? 'text-[10px]' : 'text-[9px]'} uppercase tracking-wider`}>
        {on ? 'ON' : 'OFF'}
      </span>
      {on && (
        <span className="w-1.5 h-1.5 rounded-full bg-scada-danger animate-pulse" />
      )}
    </button>
  )
}
