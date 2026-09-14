import { STATUS_STYLES } from '../lib/status';
import type { StatusLevel } from '../types';

export interface StatusDotProps {
  readonly status: StatusLevel;
  readonly showLabel?: boolean;
}

/** Pastille d'état : pilule teintée et arrondie, ou simple point sans libellé. */
export function StatusDot({ status, showLabel = true }: StatusDotProps) {
  const style = STATUS_STYLES[status];

  if (!showLabel) {
    return (
      <span
        className={`inline-flex h-2 w-2 shrink-0 rounded-full ${style.dotClass}`}
        title={style.description}
      >
        <span className="sr-only">{style.label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.pillClass} ${style.textClass}`}
      title={style.description}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dotClass}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
