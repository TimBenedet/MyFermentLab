import { formatMeasure, formatPercent, formatSigned } from '../lib/format';
import { assess, worstStatus } from '../lib/reading';
import { STATUS_STYLES } from '../lib/status';
import type { BatchId, FermentReading } from '../types';
import { MetricRow } from './MetricRow';
import { StatusDot } from './StatusDot';

export interface FermentationCardProps {
  readonly reading: FermentReading;
  readonly onOpen: (id: BatchId) => void;
}

export function FermentationCard({ reading, onOpen }: FermentationCardProps) {
  const { config, current } = reading;
  const assessment = assess(reading);
  const status = worstStatus(assessment);
  const humiditySetpoint = config.setpoints.humidity;

  const ariaLabel =
    `${config.name} : ${formatMeasure(current.temperature, 1)} degrés, ` +
    `consigne ${formatMeasure(config.setpoints.temperature, 1)} degrés, ` +
    `écart ${formatSigned(assessment.temperatureDelta, 2)} degré, ` +
    `état ${STATUS_STYLES[status].label.toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(config.id)}
      aria-label={ariaLabel}
      className="group flex h-full min-h-0 flex-col gap-1.5 rounded-xl border border-anthracite-800 bg-anthracite-900 px-3.5 py-3 text-left transition-colors hover:border-accent-500/50 hover:bg-anthracite-850 focus-visible:border-accent-400 focus-visible:outline-none"
    >
      <span className="flex flex-col gap-0.5">
        {/* Le contexte occupe toute la largeur : coincé à côté de la pastille,
            « Cuve 1 · fermentation principale » se tronquait à « Cuve 1 · ferm… ». */}
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-[12px] font-semibold text-zinc-100">
            {config.name}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusDot status={status} />
            <span
              aria-hidden="true"
              className="text-zinc-600 transition-colors group-hover:text-accent-400"
            >
              ›
            </span>
          </span>
        </span>
        <span className="truncate text-[10px] text-zinc-500">{config.context}</span>
      </span>

      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1">
          <span className="text-2xl font-medium leading-none tabular-nums text-zinc-100">
            {formatMeasure(current.temperature, 1)}
          </span>
          <span className="text-[11px] text-zinc-500">°C</span>
        </span>
        <span className="text-[12px] tabular-nums text-zinc-400">
          {formatSigned(assessment.temperatureDelta, 2)}
        </span>
      </span>

      <span className="flex flex-col">
        <MetricRow label="Consigne">
          {formatMeasure(config.setpoints.temperature, 1)} °C
        </MetricRow>

        {humiditySetpoint !== null && current.humidity !== null ? (
          <>
            <MetricRow label="Humidité" toneClass="text-teal-300">
              {formatPercent(current.humidity, 1)}
            </MetricRow>
            <MetricRow label="Écart HR">
              {assessment.humidityDelta === null
                ? '—'
                : `${formatSigned(assessment.humidityDelta, 1)} pts`}
            </MetricRow>
          </>
        ) : (
          <MetricRow label="Humidité">
            <span className="font-normal text-zinc-500">non instrumentée</span>
          </MetricRow>
        )}

        {assessment.density !== null ? (
          <>
            <MetricRow label="Densité" toneClass="text-violet-300">
              {formatMeasure(assessment.density, 3)}
            </MetricRow>
            <MetricRow label="Atténuation">
              {assessment.attenuation === null ? '—' : formatPercent(assessment.attenuation, 1)}
            </MetricRow>
          </>
        ) : null}
      </span>
    </button>
  );
}
