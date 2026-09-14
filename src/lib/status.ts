import type { StatusLevel } from '../types';

export const NOMINAL_BAND = 0.2; // °C
export const ALARM_THRESHOLD = 1; // °C
export const HUMIDITY_NOMINAL_BAND = 2; // points de %
export const HUMIDITY_ALARM_THRESHOLD = 5; // points de %

/**
 * Classe un écart. `band` en deçà ⇒ ok, `alarm` en deçà ⇒ warn, au-delà ⇒ alarm.
 * Les bandes d'humidité sont exprimées en points de %, pas en °C.
 */
export function classify(delta: number, band: number, alarm: number): StatusLevel {
  const magnitude = Math.abs(delta);
  if (magnitude <= band) return 'ok';
  if (magnitude <= alarm) return 'warn';
  return 'alarm';
}

export interface StatusStyle {
  readonly label: string;
  readonly description: string;
  readonly dotClass: string;
  readonly textClass: string;
  readonly pillClass: string;
  readonly hexColor: string;
}

/**
 * Classes Tailwind écrites en toutes lettres : aucune concaténation, sinon
 * Tailwind v4 ne les génère pas.
 */
export const STATUS_STYLES: Record<StatusLevel, StatusStyle> = {
  ok: {
    label: 'Nominal',
    description: 'Écart dans la bande nominale',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    pillClass: 'bg-emerald-500/10 ring-1 ring-emerald-500/30',
    hexColor: '#10b981',
  },
  warn: {
    label: 'Dérive',
    description: 'Écart hors bande nominale, sous le seuil d’alarme',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    pillClass: 'bg-amber-500/10 ring-1 ring-amber-500/30',
    hexColor: '#f59e0b',
  },
  alarm: {
    label: 'Alarme',
    description: 'Écart au-delà du seuil d’alarme',
    dotClass: 'bg-red-500',
    textClass: 'text-red-400',
    pillClass: 'bg-red-500/10 ring-1 ring-red-500/30',
    hexColor: '#ef4444',
  },
};

export const NEUTRAL_TEXT_CLASS = 'text-zinc-300';

/** Neutre si l'état est nominal : le vert reste réservé aux valeurs, pas aux libellés. */
export function toneClassFor(status: StatusLevel): string {
  return status === 'ok' ? NEUTRAL_TEXT_CLASS : STATUS_STYLES[status].textClass;
}

/** Couleur pleine, vert compris : pour la valeur qui doit sauter aux yeux. */
export function statusTextClass(status: StatusLevel): string {
  return STATUS_STYLES[status].textClass;
}
