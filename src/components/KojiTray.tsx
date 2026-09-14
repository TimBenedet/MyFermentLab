import { useId } from 'react';
import { mulberry32 } from '../lib/random';
import type { KojiVesselConfig } from '../types';

const CONTAINER = { x: 26, y: 16, width: 108, height: 218, radius: 14 };
const BED_BOTTOM_Y = 228;
const CREST_BASE_Y = 152;
const CRUST_THICKNESS = 13;
const CREST_SEED = 0x3c4d5e;
const SPORE_SEED = 0xc9d29b;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Spore {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly delay: number;
}

/** Bord supérieur dentelé : 17 points, écarts de 0, ±1, ±2, ±3. */
function buildCrest(seed: number): readonly Point[] {
  const random = mulberry32(seed);
  const deltas = [0, 1, -1, 2, -2, 3, -3];
  const count = 17;
  const xFrom = 30;
  const xTo = 130;
  const points: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const x = xFrom + ((xTo - xFrom) * index) / (count - 1);
    const delta = deltas[Math.floor(random() * deltas.length)];
    points.push({ x, y: CREST_BASE_Y + delta });
  }
  return points;
}

/** Lit de substrat : un seul chemin, solide, du bord dentelé jusqu'au fond. */
function bedPath(points: readonly Point[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  const head = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  return `${head} L ${last.x} ${BED_BOTTOM_Y} L ${first.x} ${BED_BOTTOM_Y} Z`;
}

/** Croûte : bande plate qui suit exactement la dentelure (aller puis retour décalé). */
function crustPath(points: readonly Point[]): string {
  const forward = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const backward = [...points]
    .reverse()
    .map((point) => `L ${point.x} ${point.y + CRUST_THICKNESS}`)
    .join(' ');
  return `${forward} ${backward} Z`;
}

function buildSpores(seed: number): readonly Spore[] {
  const random = mulberry32(seed);
  const spores: Spore[] = [];
  for (let index = 0; index < 16; index += 1) {
    spores.push({
      cx: 36 + random() * 88,
      cy: CREST_BASE_Y + CRUST_THICKNESS + 12 + random() * 42,
      r: 1.2 + random() * 1.7,
      delay: 10 + random() * 6,
    });
  }
  return spores;
}

const CREST = buildCrest(CREST_SEED);
const SPORES = buildSpores(SPORE_SEED);

/** Bac de koji : substrat solide dentelé, croûte de sporulation, spores en suspension. */
export function KojiTray({ vessel }: { vessel: KojiVesselConfig }) {
  const rawId = useId();
  const clipId = `koji-container-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      viewBox="0 0 160 250"
      role="img"
      aria-label={`Schéma de ${vessel.label}, substrat et croûte de sporulation`}
      className="h-full w-full"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={CONTAINER.x}
            y={CONTAINER.y}
            width={CONTAINER.width}
            height={CONTAINER.height}
            rx={CONTAINER.radius}
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

      <g clipPath={`url(#${clipId})`}>
        <path d={bedPath(CREST)} fill={vessel.substrate} />
        <path d={crustPath(CREST)} fill={vessel.spore} />
        {SPORES.map((spore) => (
          <circle
            key={`${spore.cx}-${spore.cy}`}
            cx={spore.cx}
            cy={spore.cy}
            r={spore.r}
            fill={vessel.spore}
            fillOpacity={0.7}
            className="animate-bubble motion-reduce:animate-none"
            style={{
              animationDelay: `${spore.delay}s`,
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
        ))}
      </g>
    </svg>
  );
}
