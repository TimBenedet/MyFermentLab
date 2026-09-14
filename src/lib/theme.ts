import { STATUS_STYLES } from './status';

/**
 * Deux thèmes, une seule feuille de style.
 *
 * L'essentiel du travail se fait dans `src/index.css` : les échelles déclarées
 * dans `@theme` sont redéfinies sous `[data-theme='light']`, et toutes les
 * classes littérales des composants (`bg-anthracite-900`, `text-zinc-100`,
 * `text-emerald-400`…) suivent sans qu'aucun d'eux ne change.
 *
 * Reste ce que les classes ne peuvent pas porter : les couleurs passées en
 * valeur brute à Recharts (`stroke`, `fill`), qui ne lisent pas les variables.
 * C'est ce que décrit `ChartPalette`, choisi ici selon le thème courant.
 */
export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'fermentation4.theme';

export interface ChartPalette {
  /**
   * Une teinte par grandeur suivie. Elle n'exprime pas un état : elle identifie
   * la mesure, et c'est ce qui permet de retrouver une courbe sans lire le titre.
   */
  readonly metric: {
    readonly temperature: string;
    readonly humidity: string;
    readonly density: string;
  };
  /** Bande nominale, tracée en aire sous la courbe. */
  readonly band: string;
  /** Consigne : gris neutre, c'est une référence et non une mesure. */
  readonly target: string;
  readonly grid: string;
  readonly axis: string;
  readonly tick: string;
}

/**
 * Les mêmes rôles, deux fois. En clair les teintes s'assombrissent : un bleu
 * clair ou un turquoise 300 ne se lit plus sur blanc, alors qu'ils tiennent sur
 * l'anthracite. Le rôle ne change pas, seule la valeur s'adapte.
 */
export const CHART_PALETTES: Readonly<Record<ThemeName, ChartPalette>> = {
  dark: {
    metric: { temperature: '#7fb2ff', humidity: '#4fd1c5', density: '#a78bfa' },
    band: STATUS_STYLES.ok.hexColor,
    target: '#5f646c',
    grid: '#1e2a38',
    axis: '#223040',
    tick: '#8b98a5',
  },
  light: {
    metric: { temperature: '#2563eb', humidity: '#0d9488', density: '#7c3aed' },
    band: '#059669',
    target: '#94a3b8',
    grid: '#dbe3ee',
    axis: '#c8d3e6',
    tick: '#64748b',
  },
};

function isThemeName(value: string | null): value is ThemeName {
  return value === 'dark' || value === 'light';
}

/** Thème mémorisé, `dark` par défaut. */
export function readStoredTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeName(stored) ? stored : 'dark';
  } catch {
    // Navigation privée ou stockage refusé : le thème par défaut suffit.
    return 'dark';
  }
}

/**
 * Pose le thème sur `<html>` — c'est lui qui pilote les variables CSS — et le
 * mémorise. Appelé avant le premier rendu (`main.tsx`) puis à chaque bascule.
 */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Même raison : l'absence de mémoire ne doit pas empêcher la bascule.
  }
}
