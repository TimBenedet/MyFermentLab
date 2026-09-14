import type { MetricIconKind } from '../lib/homeassistant';

export interface MetricIconProps {
  readonly kind: MetricIconKind;
  readonly className: string;
}

/**
 * Icônes de grandeur : trait uniquement, `currentColor`, aucune dépendance.
 * Aucune bibliothèque d'icônes n'est installée — la spec interdit toute
 * dépendance supplémentaire.
 */
export function MetricIcon({ kind, className }: MetricIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {kind === 'temperature' ? (
        <>
          <path d="M8 2.6a2 2 0 0 1 2 2v5.7a3.1 3.1 0 1 1-4 0V4.6a2 2 0 0 1 2-2Z" />
          <circle cx="8" cy="11.7" r="1.4" />
        </>
      ) : null}

      {kind === 'humidity' ? (
        <path d="M8 2.4c2.3 2.7 3.6 4.6 3.6 6.2a3.6 3.6 0 0 1-7.2 0c0-1.6 1.3-3.5 3.6-6.2Z" />
      ) : null}

      {kind === 'power' ? (
        <>
          <path d="M8 2.6v5.2" />
          <path d="M11.7 4.7a5 5 0 1 1-7.4 0" />
        </>
      ) : null}
    </svg>
  );
}
