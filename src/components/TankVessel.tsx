import { useId } from 'react';
import type { TankVesselConfig } from '../types';

const CONTAINER = { x: 26, y: 16, width: 108, height: 218, radius: 14 };
const LIQUID_TOP = 100;
const LIQUID_BOTTOM = 234;

interface Bubble {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly delay: number;
  readonly duration: number;
}

const BUBBLES: readonly Bubble[] = [
  { cx: 40, cy: 214, r: 2.6, delay: 0, duration: 6.4 },
  { cx: 52, cy: 222, r: 1.8, delay: 0.6, duration: 5.8 },
  { cx: 63, cy: 208, r: 3.1, delay: 1.2, duration: 7.1 },
  { cx: 76, cy: 220, r: 2.2, delay: 1.8, duration: 6.6 },
  { cx: 88, cy: 212, r: 1.6, delay: 2.4, duration: 5.4 },
  { cx: 99, cy: 224, r: 2.8, delay: 3, duration: 7.4 },
  { cx: 111, cy: 210, r: 2.1, delay: 3.6, duration: 6.2 },
  { cx: 121, cy: 221, r: 1.5, delay: 4.2, duration: 5.9 },
  { cx: 69, cy: 228, r: 2.4, delay: 4.8, duration: 6.9 },
];

/** Cuve fermée : contenant arrondi, aplat de liquide, bulles qui remontent. */
export function TankVessel({ vessel }: { vessel: TankVesselConfig }) {
  const rawId = useId();
  const suffix = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const containerClipId = `tank-container-${suffix}`;
  const liquidClipId = `tank-liquid-${suffix}`;

  return (
    <svg
      viewBox="0 0 160 250"
      role="img"
      aria-label={`Schéma de ${vessel.label}, liquide en cours de fermentation`}
      className="h-full w-full"
    >
      <defs>
        <clipPath id={containerClipId}>
          <rect
            x={CONTAINER.x}
            y={CONTAINER.y}
            width={CONTAINER.width}
            height={CONTAINER.height}
            rx={CONTAINER.radius}
          />
        </clipPath>
        <clipPath id={liquidClipId}>
          <rect
            x={CONTAINER.x}
            y={LIQUID_TOP}
            width={CONTAINER.width}
            height={LIQUID_BOTTOM - LIQUID_TOP}
          />
        </clipPath>
      </defs>

      <rect
        x={CONTAINER.x}
        y={CONTAINER.y}
        width={CONTAINER.width}
        height={CONTAINER.height}
        rx={CONTAINER.radius}
        fill="none"
        stroke="#3a3f47"
        strokeWidth="2"
      />

      <g clipPath={`url(#${containerClipId})`}>
        <rect
          x={CONTAINER.x}
          y={LIQUID_TOP}
          width={CONTAINER.width}
          height={LIQUID_BOTTOM - LIQUID_TOP}
          fill={vessel.liquid}
        />
        <g clipPath={`url(#${liquidClipId})`}>
          {BUBBLES.map((bubble) => (
            <circle
              key={`${bubble.cx}-${bubble.cy}`}
              cx={bubble.cx}
              cy={bubble.cy}
              r={bubble.r}
              fill="#ffffff"
              fillOpacity={0.45}
              className="animate-bubble motion-reduce:animate-none"
              style={{
                animationDelay: `${bubble.delay}s`,
                animationDuration: `${bubble.duration}s`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
              }}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}
