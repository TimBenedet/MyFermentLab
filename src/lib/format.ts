/** Signe moins typographique (U+2212), jamais le trait d'union ASCII. */
export const MINUS_SIGN = '\u2212';
/** Espace insécable étroite, pour « 75 % ». */
export const NARROW_NBSP = '\u202f';
/** Tiret demi-cadratin (U+2013) : entre deux bornes, jamais le trait d'union. */
export const EN_DASH = '\u2013';

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(decimals: number): Intl.NumberFormat {
  const cached = numberFormatters.get(decimals);
  if (cached !== undefined) return cached;
  const created = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
  numberFormatters.set(decimals, created);
  return created;
}

const clockFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const clockSecondsFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Mesure simple, virgule décimale, sans signe. */
export function formatMeasure(value: number, decimals: 0 | 1 | 2 | 3 = 1): string {
  return numberFormatter(decimals).format(value);
}

const compactFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
  useGrouping: false,
});

/**
 * Nombre sans zéro inutile : « 0,5 », « 2,25 », « 12 ». Pour les valeurs dont la
 * précision n'est pas connue — un ratio, une absorption réglée à la main, un poids
 * d'ingrédient — deux décimales au plus : « 0,50 » se lirait comme une mesure.
 */
export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

/** Écart signé : « +0,40 » / « −1,25 ». Ne rend jamais « -0,0 ». */
export function formatSigned(value: number, decimals: 1 | 2 | 3 = 1): string {
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded < 0 ? MINUS_SIGN : '+';
  return `${sign}${numberFormatter(decimals).format(Math.abs(rounded))}`;
}

/**
 * Pourcentage, espace insécable étroite avant le signe. Le signe moins est
 * **typographique** : une atténuation légèrement négative — un moût qui vient
 * d'être ensemencé, avant que la densité ne redescende — s'écrit « −0,6 % », pas
 * « -0,6 % ». Jamais de « −0,0 % » non plus.
 */
export function formatPercent(value: number, decimals: 0 | 1 | 2 | 3 = 1): string {
  const rounded = Number(value.toFixed(decimals));
  const sign = rounded < 0 ? MINUS_SIGN : '';
  return `${sign}${numberFormatter(decimals).format(Math.abs(rounded))}${NARROW_NBSP}%`;
}

/** Horloge courte « HH:MM ». */
export function formatClock(t: number): string {
  return clockFormatter.format(t);
}

/** Horloge d'acquisition « HH:MM:SS ». */
export function formatClockSeconds(t: number): string {
  return clockSecondsFormatter.format(t);
}

/**
 * Durée écoulée, de la plus fine à la plus large : « 45 s », « 12 min »,
 * « 3 h 05 », « 2 j ». Une seule unité de tête suffit : on lit l'âge d'un lot,
 * on ne le chronomètre pas.
 */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  if (seconds < 60) return `${seconds}${NARROW_NBSP}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${NARROW_NBSP}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest === 0
      ? `${hours}${NARROW_NBSP}h`
      : `${hours}${NARROW_NBSP}h${String(rest).padStart(2, '0')}`;
  }
  return `${Math.floor(hours / 24)}${NARROW_NBSP}j`;
}
