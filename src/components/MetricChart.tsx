import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatClock, formatMeasure } from '../lib/format';
import { windowStartOf } from '../lib/reading';
import type { ChartPalette } from '../lib/theme';
import type { Sample } from '../types';

export type MetricKind = 'temperature' | 'humidity' | 'density';

export interface MetricChartProps {
  readonly title: string;
  readonly unit: string;
  readonly metric: MetricKind;
  readonly data: readonly Sample[];
  readonly target: number | null;
  readonly targetLabel: string;
  /**
   * Couleurs du thème courant. Recharts ne lit pas les variables CSS : le trait,
   * l'aire, la grille et les axes lui sont donnés en valeur brute, et changent
   * donc avec le thème. La teinte de la courbe est déduite de `metric`.
   */
  readonly palette: ChartPalette;
  readonly decimals: 1 | 2 | 3;
  readonly minPadding: number;
  readonly bandHalfWidth: number;
  readonly windowEnd: number;
  readonly footnote: ReactNode;  /** Valeur courante, affichée à côté du titre. Absente quand elle figure déjà
   *  ailleurs sur la page. */
  readonly live?: string | undefined;}

interface ChartPoint {
  readonly t: number;
  readonly value: number;
}

const MAX_POINTS = 320;

function valueOf(sample: Sample, metric: MetricKind): number | null {
  if (metric === 'temperature') return sample.temperature;
  if (metric === 'humidity') return sample.humidity;
  return sample.density;
}

/** Sous-échantillonnage à pas constant, en conservant toujours le dernier point. */
function downsample(data: readonly Sample[], metric: MetricKind): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const sample of data) {
    const value = valueOf(sample, metric);
    if (value !== null) points.push({ t: sample.t, value });
  }
  if (points.length <= MAX_POINTS) return points;

  const step = Math.ceil(points.length / MAX_POINTS);
  const result: ChartPoint[] = [];
  for (let index = 0; index < points.length; index += step) result.push(points[index]);
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

interface Box {
  readonly width: number;
  readonly height: number;
}

/**
 * Pas de graduation candidats, du plus fin au plus grossier. Choisir dans cette
 * liste plutôt que de diviser l'intervalle par un nombre de ticks donne des
 * valeurs rondes : 0,1 °C et non 0,108 °C.
 */
const TICK_STEPS: readonly number[] = [
  0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10,
];

/**
 * Graduations régulières en valeurs rondes à l'intérieur du domaine.
 * Sans elles, Recharts tire ses propres ticks (« nice values ») et **élargit le
 * domaine** pour les faire tenir : sur une consigne à 19,5 °C la courbe se
 * retrouvait écrasée dans un axe 19,0 – 19,9, sur un graphe à moitié vide.
 */
function niceTicks(low: number, high: number, decimals: number, desired: number): number[] {
  const span = high - low;
  if (!Number.isFinite(span) || span <= 0) return [low];
  const raw = span / desired;
  const step = TICK_STEPS.find((candidate) => candidate >= raw) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const first = Math.ceil(low / step);
  const last = Math.floor(high / step);
  const ticks: number[] = [];
  for (let index = first; index <= last; index += 1) {
    ticks.push(Number((index * step).toFixed(decimals + 2)));
  }
  return ticks;
}

/**
 * Mesure la boîte du parent nous-mêmes. Le `ResponsiveContainer` de Recharts reste
 * bloqué sur une mesure initiale de 0 × 0 et n'est alors jamais relancé : la figure
 * reste vide. Une hauteur résolue mesurée ici est déterministe.
 *
 * La mesure est refaite **après chaque rendu**, pas seulement à la construction : un
 * changement de variante élargit la colonne sans que le `ResizeObserver` le rapporte,
 * et le graphe gardait la largeur de l'autre variante — sa carte paraissait alors
 * collée au bord droit. Le SVG porte une largeur explicite : c'est cette largeur qui
 * doit suivre la mise en page, jamais l'inverse.
 */
function useMeasuredBox() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });

  const measure = useCallback((): void => {
    const element = ref.current;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    setBox((previous) =>
      Math.abs(previous.width - rect.width) < 0.5 && Math.abs(previous.height - rect.height) < 0.5
        ? previous
        : { width: rect.width, height: rect.height },
    );
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, box };
}

interface ChartTooltipProps {
  readonly active?: boolean;
  readonly label?: number | string;
  readonly payload?: readonly { readonly value?: number | string }[];
  readonly unit: string;
  readonly decimals: 1 | 2 | 3;
}

function ChartTooltip({ active, label, payload, unit, decimals }: ChartTooltipProps) {
  if (active !== true || payload === undefined || payload.length === 0) return null;
  const raw = payload[0].value;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return (
    <div className="rounded-lg border border-anthracite-700 bg-anthracite-800 px-2.5 py-1.5">
      <div className="text-[10px] tabular-nums text-zinc-500">
        {formatClock(Number(label))}
      </div>
      <div className="text-[12px] font-medium tabular-nums text-zinc-100">
        {formatMeasure(value, decimals)}
        {unit === '' ? '' : ` ${unit}`}
      </div>
    </div>
  );
}

/** Graphe générique d'une grandeur sur 24 h glissantes. */
export function MetricChart({
  title,
  unit,
  metric,
  data,
  target,
  targetLabel,
  palette,
  decimals,
  minPadding,
  bandHalfWidth,
  windowEnd,
  footnote,
  live,
}: MetricChartProps) {
  const points = useMemo(() => downsample(data, metric), [data, metric]);
  const { ref, box } = useMeasuredBox();
  const color = palette.metric[metric];

  const domain = useMemo<[number, number]>(() => {
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const point of points) {
      if (point.value < low) low = point.value;
      if (point.value > high) high = point.value;
    }
    if (target !== null) {
      if (target < low) low = target;
      if (target > high) high = target;
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
    const margin = Math.max((high - low) * 0.18, minPadding);
    return [low - margin, high + margin];
  }, [minPadding, points, target]);

  const ticks = useMemo(
    () => niceTicks(domain[0], domain[1], decimals, 6),
    [decimals, domain],
  );

  // Fenêtre de temps : 24 h glissantes, ou la vie de l'historique s'il est plus jeune.
  const windowStart = useMemo(() => windowStartOf(data, windowEnd), [data, windowEnd]);
  /*
   * Les repères — bande de tolérance, ligne de consigne — ne se dessinent que là où le
   * lot a un historique. Sur un lot qui vient d'être lancé, la fenêtre est plus large que
   * la courbe : un rectangle qui court sur les minutes d'avant le lancement n'est plus un
   * repère, c'est un décor, et c'est tout ce qu'on voyait du graphe.
   */
  const firstSampleAt = points[0]?.t ?? windowEnd;
  // Recharts veut un couple de points, pas un tableau quelconque : le type le dit.
  const targetSegment = useMemo<
    readonly [{ readonly x: number; readonly y: number }, { readonly x: number; readonly y: number }]
  >(
    () => [
      { x: firstSampleAt, y: target ?? 0 },
      { x: windowEnd, y: target ?? 0 },
    ],
    [firstSampleAt, target, windowEnd],
  );

  return (
    <figure className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-anthracite-800 bg-anthracite-900 px-3.5 py-2.5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium text-zinc-300">{title}</span>
          {live === undefined ? null : (
            <span className="text-[12px] font-medium tabular-nums text-zinc-100">{live}</span>
          )}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500">{targetLabel}</span>
      </figcaption>

      {/*
       * Plancher de 120 px : hauteur résolue du parent, mesurée puis donnée à Recharts.
       * `min-w-0` est indispensable : le SVG porte une largeur explicite, et un élément
       * flexible refuse par défaut de descendre sous la largeur de son contenu — le
       * graphe imposait alors sa largeur à la colonne, qui débordait de la page.
       */}
      <div ref={ref} className="min-h-[120px] min-w-0 flex-1 overflow-hidden">
        {box.width > 0 && box.height > 0 ? (
          <AreaChart
            width={box.width}
            height={box.height}
            data={points}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={palette.grid} strokeDasharray="2 4" vertical={false} />

            {target !== null && bandHalfWidth > 0 ? (
              <ReferenceArea
                x1={firstSampleAt}
                x2={windowEnd}
                y1={target - bandHalfWidth}
                y2={target + bandHalfWidth}
                fill={palette.band}
                fillOpacity={0.14}
                strokeOpacity={0}
              />
            ) : null}

            {target !== null ? (
              <ReferenceLine segment={targetSegment} stroke={palette.target} strokeDasharray="4 4" />
            ) : null}

            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[windowStart, windowEnd]}
              tickFormatter={formatClock}
              minTickGap={56}
              tickLine={false}
              axisLine={{ stroke: palette.axis }}
              tick={{ fill: palette.tick, fontSize: 10 }}
            />
            <YAxis
              width={52}
              domain={domain}
              ticks={ticks}
              tickLine={false}
              axisLine={false}
              tick={{ fill: palette.tick, fontSize: 10 }}
              tickFormatter={(value: number) => formatMeasure(value, decimals)}
            />
            <Tooltip
              isAnimationActive={false}
              content={<ChartTooltip unit={unit} decimals={decimals} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={color}
              fillOpacity={0.14}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : null}
      </div>

      <div className="text-[10px] text-zinc-500">{footnote}</div>
    </figure>
  );
}
