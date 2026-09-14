import { NARROW_NBSP, formatCompact, formatMeasure, formatSigned } from './format';
import type { BrewWater, RecipeIngredient } from '../types';

/**
 * Eau de brassage : du volume voulu à l'eau à préparer.
 *
 * Le calcul part du **volume fini** et remonte la rivière, perte par perte — il faut
 * toujours plus d'eau que de bière, et chaque litre d'écart est une perte qu'on peut
 * nommer :
 *
 *   volume fini  →  ÷ contraction  →  + perte de cuve  →  + évaporation
 *                →  + absorption du grain  →  eau à préparer
 *
 * Le modèle est celui du **BIAB** : tout le volume part en une fois dans la cuve, il
 * n'y a donc qu'un seul total et pas d'eau de rinçage. Un empâtage classique en
 * demanderait deux — l'eau d'empâtage et celle de rinçage — et c'est précisément ce
 * que ce module ne fait pas.
 *
 * Deux pertes méritent qu'on s'y arrête, parce qu'elles ne se comportent pas comme les
 * autres :
 *
 *   · l'**évaporation** est une grandeur *absolue* — des litres par heure, imposés par
 *     la surface de la cuve et par le feu. Elle ne se divise pas avec la recette :
 *     brasser 10 L dans la cuve qui en fait 20 demande plus d'eau par litre que
 *     d'en brasser 20, et c'est ce que le calcul capture ;
 *   · l'**absorption** suit le grain — des litres par kilo, 0,5 quand on presse le sac.
 *     C'est la seule perte qui grandit avec la recette.
 */

/**
 * Contraction thermique : le moût refroidi occupe 3,98 % de moins que le moût
 * bouillant. Le chiffre n'est pas une convention de brasseur, il vient de la densité
 * de l'eau — 958,4 kg/m³ à 100 °C contre 998,2 à 20 °C, soit un rapport de 1,0415.
 */
export const SHRINKAGE_FACTOR = 0.96;

/** Bornes de saisie : au-delà, ce n'est plus une cuve mais une faute de frappe. */
export const MAX_WATER_LITRES = 500;
export const MAX_BOIL_MINUTES = 300;
export const MAX_BOIL_OFF_L_PER_H = 20;
export const MAX_KETTLE_LOSS_L = 50;
export const MAX_ABSORPTION_L_PER_KG = 2;

/**
 * Réglages d'une cuve, à défaut de les avoir mesurés : une cuve de 25 L qui évapore
 * 2,25 L/h, un litre laissé au fond, un sac qu'on presse.
 *
 * Le volume, lui, n'a pas de valeur par défaut : c'est la recette qui le pose.
 */
export const DEFAULT_WATER: Omit<BrewWater, 'volumeL'> = {
  boilMinutes: 90,
  boilOffLPerH: 2.25,
  kettleLossL: 1,
  absorptionLPerKg: 0.5,
};

/**
 * Le grain d'une recette : **les lignes en kilos**.
 *
 * C'est la convention du référentiel — un malt se pèse en kilos, un houblon et une
 * levure en grammes (`unitForFamily`). Additionner les grammes avec les kilos
 * compterait 90 g de houblon comme du grain et ferait lire « 5,5 kg » sur un empâtage
 * de 5,4 — le calcul serait juste à 0,05 L près, mais le chiffre affiché mentirait.
 *
 * Repli : une recette qui ne porte **aucun** kilo est une recette pesée en grammes,
 * tout entière — on la lit alors en grammes, sinon elle n'aurait pas de grain du tout.
 */
export function grainMassKg(ingredients: readonly RecipeIngredient[]): number {
  let kilos = 0;
  let grams = 0;
  for (const line of ingredients) {
    if (line.unit === 'kg') kilos += line.quantity;
    else if (line.unit === 'g') grams += line.quantity;
  }
  return Math.round((kilos > 0 ? kilos : grams / 1000) * 1000) / 1000;
}

/** Le détail d'un calcul d'eau, perte par perte. */
export interface WaterPlan {
  /** Volume visé au fermenteur, à 20 °C. */
  readonly finalL: number;
  /** Ce que la contraction thermique ajoute : le volume à chaud équivalent. */
  readonly shrinkageL: number;
  /** Volume à chaud qu'il faut obtenir pour remplir le fermenteur. */
  readonly hotL: number;
  /** Ce qui reste dans la cuve et n'ira pas au fermenteur. */
  readonly kettleLossL: number;
  /** Ce qui part en vapeur pendant l'ébullition. */
  readonly boilOffL: number;
  /** Volume à mesurer au démarrage de l'ébullition, grain égoutté. */
  readonly preBoilL: number;
  /** Eau retenue par le grain, qui ne rejoindra jamais la cuve. */
  readonly absorptionL: number;
  /** L'eau à préparer : la somme de tout ce qui précède. */
  readonly totalL: number;
  readonly grainKg: number;
  readonly boilMinutes: number;
  readonly boilOffLPerH: number;
  readonly absorptionLPerKg: number;
  /** Litres d'eau par kilo de grain ; `null` tant qu'aucun grain n'est pesé. */
  readonly ratioLPerKg: number | null;
}

/**
 * Le calcul complet. Les pertes s'ajoutent dans l'ordre du brassin : on refroidit
 * (contraction), on laisse le fond dans la cuve (perte de cuve), on a évaporé
 * (ébullition), et le grain a bu le reste.
 */
export function computeWater(water: BrewWater, grainKg: number): WaterPlan {
  const hotL = water.volumeL / SHRINKAGE_FACTOR;
  const boilOffL = (water.boilOffLPerH * water.boilMinutes) / 60;
  const preBoilL = hotL + water.kettleLossL + boilOffL;
  const absorptionL = grainKg * water.absorptionLPerKg;
  const totalL = preBoilL + absorptionL;
  return {
    finalL: water.volumeL,
    shrinkageL: hotL - water.volumeL,
    hotL,
    kettleLossL: water.kettleLossL,
    boilOffL,
    preBoilL,
    absorptionL,
    totalL,
    grainKg,
    boilMinutes: water.boilMinutes,
    boilOffLPerH: water.boilOffLPerH,
    absorptionLPerKg: water.absorptionLPerKg,
    ratioLPerKg: grainKg > 0 ? totalL / grainKg : null,
  };
}

/** Un volume, une décimale : « 27,9 L ». */
export function formatLitres(value: number): string {
  return `${formatMeasure(value, 1)} L`;
}

/** Un écart de volume, signé : « +0,8 L ». Le signe vient de `formatSigned`. */
function deltaLitres(value: number): string {
  return `${formatSigned(value, 1)} L`;
}

/** Une ligne du détail : ce qu'on ajoute, pourquoi, et combien. */
export interface WaterLine {
  readonly label: string;
  readonly hint: string;
  readonly value: string;
}

/**
 * Les pertes, nommées, dans l'ordre du calcul — du fermenteur vers la cuve. Le total
 * n'est pas une ligne de la liste : il se lit en tête, c'est la réponse.
 */
export function describeWater(plan: WaterPlan): readonly WaterLine[] {
  const lines: WaterLine[] = [
    {
      label: 'Volume final au fermenteur',
      hint: 'ce qu’on veut obtenir, à 20 °C',
      value: formatLitres(plan.finalL),
    },
    {
      label: 'Contraction thermique',
      hint: `4${NARROW_NBSP}% entre 100 °C et 20 °C`,
      value: deltaLitres(plan.shrinkageL),
    },
    {
      label: 'Évaporation',
      hint: `${plan.boilMinutes} min à ${formatCompact(plan.boilOffLPerH)} L/h`,
      value: deltaLitres(plan.boilOffL),
    },
    {
      label: 'Perte de cuve',
      hint: 'trub, houblon, espace mort',
      value: deltaLitres(plan.kettleLossL),
    },
    {
      label: 'Absorption du grain',
      hint: `${formatCompact(plan.grainKg)} kg × ${formatCompact(plan.absorptionLPerKg)} L/kg`,
      value: deltaLitres(plan.absorptionL),
    },
  ];
  if (plan.ratioLPerKg !== null) {
    lines.push({
      label: 'Ratio eau/grain',
      hint: 'le résultat d’un brassage BIAB, pas un choix',
      value: `${formatLitres(plan.ratioLPerKg)}/kg`,
    });
  }
  return lines;
}

/** Ce que le calcul dit de la cuve, en une phrase — le point qui surprend. */
export function waterFootnote(plan: WaterPlan): string {
  if (plan.ratioLPerKg === null) return 'Aucun grain pesé : le ratio reste à calculer.';
  return `${formatLitres(plan.ratioLPerKg)} d’eau par kilo de grain — une cuvée plus petite demande plus d’eau par litre, parce que l’évaporation ne se divise pas avec elle.`;
}
