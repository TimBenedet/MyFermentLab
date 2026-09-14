import type { ReactNode } from 'react';
import { NEUTRAL_TEXT_CLASS } from '../lib/status';

export interface MetricRowProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly toneClass?: string;
}

/**
 * Ligne « label à gauche / valeur à droite ».
 * Rend des `<span>` et non des `<div>` : la carte est un `<button>`, donc seuls
 * les contenus « phrasing » y sont valides.
 */
export function MetricRow({ label, children, toneClass = NEUTRAL_TEXT_CLASS }: MetricRowProps) {
  return (
    <span className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className={`text-[12px] font-medium tabular-nums ${toneClass}`}>{children}</span>
    </span>
  );
}
