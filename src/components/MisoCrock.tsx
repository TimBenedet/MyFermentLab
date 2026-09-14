import { useId } from 'react';
import { mulberry32 } from '../lib/random';
import type { CrockVesselConfig } from '../types';

const GRAIN_SEED = 0x5e6f70;
const GRAIN_COUNT = 34;
/** Bornes des grains : la largeur **intérieure** du pot, pas celle du monticule. */
const GRAIN_X_MIN = 26;
const GRAIN_X_MAX = 134;
const BODY_BOTTOM_Y = 230;
const BODY_WALL_X = 20;
const BODY_TOP_Y = 104;
/** Contour du corps : sert au tracé du verre et au rognage de la pâte. */
const BODY_PATH =
  `M ${BODY_WALL_X} ${BODY_TOP_Y} L 140 ${BODY_TOP_Y} L 140 204 ` +
  `Q 140 ${BODY_BOTTOM_Y} 116 ${BODY_BOTTOM_Y} L 44 ${BODY_BOTTOM_Y} ` +
  `Q ${BODY_WALL_X} ${BODY_BOTTOM_Y} ${BODY_WALL_X} 204 Z`;
/**
 * Fond de pâte placé sous le bord du pot : rogné au contour du corps, il ne peut
 * laisser aucun jour sombre entre la pâte et le fond du verre.
 */
const PASTE_BASE_Y = 240;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Mound {
  readonly x0: number;
  readonly x1: number;
  readonly apex: number; // position relative de la crête, 0 = gauche, 1 = droite
  readonly peakY: number;
  /** Niveau du bord, de 0 (fond du pot) à 1 (hauteur de la crête). Proche de 1,
   *  la surface devient presque de niveau : de la pâte tassée, pas un tas. */
  readonly edge: number;
  readonly colorIndex: number;
}

interface Grain {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly colorIndex: number;
}

/**
 * Trois monticules décalés : les crêtes ne se superposent pas, on les lit séparément.
 * Leurs bases **débordent des parois** (le `clipPath` recoupe) : sinon la pâte
 * s'arrêtait à x=28 et x=132 et laissait deux coins de fond de pot à nu, ce qui
 * se lisait comme une pâte qui ne remplit pas le verre.
 */
const MOUNDS: readonly Mound[] = [
  { x0: 12, x1: 142, apex: 0.36, peakY: 120, edge: 0.88, colorIndex: 0 },
  { x0: 52, x1: 150, apex: 0.44, peakY: 133, edge: 0.9, colorIndex: 1 },
  { x0: 16, x1: 146, apex: 0.5, peakY: 146, edge: 0.92, colorIndex: 2 },
];

/** Profil d'un monticule : niveau du bord aux extrémités, arrondi au sommet. */
function crestProfile(t: number, apex: number): number {
  const u = t <= apex ? (apex === 0 ? 1 : t / apex) : apex === 1 ? 1 : (1 - t) / (1 - apex);
  return Math.sin((Math.PI / 2) * u);
}

function crestY(t: number, mound: Mound): number {
  const level = mound.edge + (1 - mound.edge) * crestProfile(t, mound.apex);
  return PASTE_BASE_Y - (PASTE_BASE_Y - mound.peakY) * level;
}

/** Crête arrondie : courbes quadratiques passant par les points milieux. */
function smoothCrest(points: readonly Point[]): string {
  const first = points[0];
  let path = `M ${first.x} ${first.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const midX = (control.x + next.x) / 2;
    const midY = (control.y + next.y) / 2;
    path += ` Q ${control.x} ${control.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function moundPath(mound: Mound): string {
  const count = 11;
  const points: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push({ x: mound.x0 + (mound.x1 - mound.x0) * t, y: crestY(t, mound) });
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${smoothCrest(points)} L ${last.x} ${PASTE_BASE_Y} L ${first.x} ${PASTE_BASE_Y} Z`;
}

/** Grains posés sur la surface du monticule de devant, donc sur la pâte. */
function buildGrains(seed: number): readonly Grain[] {
  const surface = MOUNDS[MOUNDS.length - 1];
  const random = mulberry32(seed);
  const grains: Grain[] = [];
  for (let index = 0; index < GRAIN_COUNT; index += 1) {
    const cx = GRAIN_X_MIN + random() * (GRAIN_X_MAX - GRAIN_X_MIN);
    const t = (cx - surface.x0) / (surface.x1 - surface.x0);
    grains.push({
      cx,
      cy: crestY(t, surface) + 3 + random() * 11,
      r: 1.2 + random() * 1.6,
      colorIndex: index % 3,
    });
  }
  return grains;
}

const MOUND_PATHS = MOUNDS.map((mound) => moundPath(mound));
const GRAINS = buildGrains(GRAIN_SEED);

/**
 * Jarre de cellier : couvercle, col, épaule en trapèze, corps arrondi tracé en
 * #4a5058 avec un reflet vertical à 6 %. Trois monticules superposés — pâte à miso
 * ou moût de sauce soja, les couleurs venant de la configuration — du plus sombre au
 * plus clair, puis des grains en surface.
 * Aucune animation — ni une pâte ni un moût au repos ne font de bulles.
 */
export function MisoCrock({ vessel }: { vessel: CrockVesselConfig }) {
  const pasteAt = (index: number): string => vessel.paste[index % vessel.paste.length];
  const clipId = `crock-body-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      viewBox="0 0 160 250"
      role="img"
      aria-label={`Schéma de ${vessel.label}, pot de verre et ${vessel.contents}`}
      className="h-full w-full"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {/* Couvercle large, bouton et col : un pot à large ouverture, pas une bouteille */}
      <rect x="68" y="26" width="24" height="10" rx="4" fill="none" stroke="#4a5058" strokeWidth="2" />
      <rect x="34" y="36" width="92" height="16" rx="5" fill="none" stroke="#4a5058" strokeWidth="2" />
      <rect x="46" y="52" width="68" height="10" fill="none" stroke="#4a5058" strokeWidth="2" />

      {/* Épaule en trapèze puis corps arrondi */}
      <path d="M 46 62 L 114 62 L 140 104 L 20 104 Z" fill="none" stroke="#4a5058" strokeWidth="2" />
      <path d={BODY_PATH} fill="none" stroke="#4a5058" strokeWidth="2" />

      <g clipPath={`url(#${clipId})`}>
        {/* Trois monticules, du plus sombre au plus clair */}
        {MOUND_PATHS.map((path, index) => (
          <path key={index} d={path} fill={pasteAt(index)} />
        ))}

        {/* Grains de surface, en alternance des trois teintes */}
        {GRAINS.map((grain, index) => (
          <circle
            key={index}
            cx={grain.cx}
            cy={grain.cy}
            r={grain.r}
            fill={pasteAt(grain.colorIndex)}
          />
        ))}

        {/* Reflet du verre : contre la paroi, et par-dessus la pâte */}
        <rect x="23" y="108" width="6" height="112" rx="3" fill="#ffffff" fillOpacity={0.06} />
      </g>
    </svg>
  );
}
