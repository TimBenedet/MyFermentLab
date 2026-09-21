import type { Sample } from '../types';

/**
 * Ce que fait la boucle de régulation.
 *
 * `heating`, `cooling` et `holding` se déduisent de l'écart à la consigne
 * (`classifyRegulation`). `muted` ne se déduit de rien : il dit qu'un lot asservi
 * n'a **plus de mesure** — la seule information qui ne doit pas être devinée.
 */
export type RegulationState = 'heating' | 'cooling' | 'holding' | 'muted' | 'untargeted';

/** Demi-bande morte : en deçà, la boucle est considérée au repos. */
export const REGULATION_DEADBAND = 0.1;
/** Fenêtre de calcul de la vitesse de variation. */
export const RATE_WINDOW_MS = 15 * 60_000;

export interface RegulationStyle {
  readonly label: string;
  readonly description: string;
  readonly pillClass: string;
  readonly dotClass: string;
  /** Couleur du libellé seul, pour la variante sans pastille pleine. */
  readonly textClass: string;
}

/**
 * Rouge pour la chauffe, bleu pour le refroidissement, vert au repos.
 * Le code couleur est celui du geste, pas de l'état du ferment : une résistance
 * qui chauffe est rouge même quand la cuve est parfaitement nominale.
 * Classes littérales : Tailwind doit les voir écrites.
 */
export const REGULATION_STYLES: Record<RegulationState, RegulationStyle> = {
  heating: {
    label: 'Chauffe',
    description: 'Résistance active : la cuve est sous la consigne',
    pillClass: 'bg-red-500/10 ring-1 ring-red-500/30 text-red-400',
    dotClass: 'bg-red-500',
    textClass: 'text-red-400',
  },
  cooling: {
    label: 'Refroidissement',
    description: 'Circuit froid actif : la cuve est au-dessus de la consigne',
    pillClass: 'bg-metric-temperature/10 ring-1 ring-metric-temperature/30 text-metric-temperature',
    dotClass: 'bg-metric-temperature',
    textClass: 'text-metric-temperature',
  },
  holding: {
    label: 'À consigne',
    description: 'Écart dans la bande morte : la boucle est au repos',
    pillClass: 'bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-400',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
  },
  muted: {
    label: 'Sonde muette',
    description: 'Aucune mesure : les prises sont coupées',
    pillClass: 'bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-400',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-400',
  },
  untargeted: {
    label: 'Sans consigne',
    description: 'Aucune consigne de température : la chauffe n’est pas asservie',
    pillClass: 'bg-zinc-500/10 ring-1 ring-zinc-500/30 text-zinc-400',
    dotClass: 'bg-zinc-500',
    textClass: 'text-zinc-400',
  },
};

export function classifyRegulation(delta: number): RegulationState {
  if (delta < -REGULATION_DEADBAND) return 'heating';
  if (delta > REGULATION_DEADBAND) return 'cooling';
  return 'holding';
}

/**
 * Vitesse de variation en °C/h sur les 15 dernières minutes.
 * `null` si l'historique est trop court pour mesurer quoi que ce soit.
 *
 * Sur une heure pleine la mesure ne dirait rien : le cycle de régulation dure
 * 57 min, donc un aller-retour complet s'annule. 15 min capte la pente réelle.
 */
export function temperatureRate(history: readonly Sample[], nowMs: number): number | null {
  const last = history[history.length - 1];
  if (last === undefined) return null;

  const cutoff = nowMs - RATE_WINDOW_MS;
  // Moins de 15 min d'historique : une pente mesurée sur un point ou deux n'est que
  // du bruit amplifié par un dénominateur minuscule — on ne l'affiche pas.
  if (history[0].t > cutoff) return null;
  let reference = history[0];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].t <= cutoff) {
      reference = history[index];
      break;
    }
  }

  const hours = (last.t - reference.t) / 3_600_000;
  if (hours <= 0) return null;
  return (last.temperature - reference.temperature) / hours;
}
