import type { CatalogRange } from '../types';

/**
 * Modèles de cuve : des **fourchettes**, pas des mesures.
 *
 * Même principe que le référentiel d'ingrédients : une fiche publiée donne une
 * fourchette, l'application en prend le milieu pour remplir les champs — et le
 * brasseur corrige dès qu'il a mesuré chez lui.
 *
 * Ce qui distingue vraiment deux cuves, c'est l'**évaporation** : elle suit la surface
 * exposée et la puissance du feu, pas le volume brassé. Une marmite de 30 cm sur un feu
 * domestique évapore la moitié d'une marmite de 45 cm, et la même cuve évapore autant
 * qu'on y brasse 10 ou 20 litres.
 *
 * La **perte de cuve** dépend surtout du robinet : une sortie en fond laisse peu, un
 * robinet latéral qu'on ne peut pas incliner laisse beaucoup.
 *
 * L'**absorption**, elle, ne dépend presque pas de la cuve : c'est l'affaire du geste.
 * D'où la même fourchette partout — 0,5 quand on presse le sac, 0,8 quand on se contente
 * d'égoutter.
 */

export interface EquipmentPreset {
  readonly id: string;
  readonly name: string;
  readonly boilOffLPerH: CatalogRange;
  readonly kettleLossL: CatalogRange;
  /** Voir l'en-tête : ce n'est pas la cuve qui décide, c'est la façon de vider le grain. */
  readonly absorptionLPerKg: CatalogRange;
  /** Ce qui explique l'écart, et pourquoi il faudra mesurer un jour. */
  readonly note: string;
}

/** Ordre d'affichage : la première entrée est la cuve de départ d'une installation neuve. */
export const EQUIPMENT_PRESETS: readonly EquipmentPreset[] = [
  {
    id: 'brewzilla-45',
    name: 'BrewZilla 35 L + extension 45 L',
    boilOffLPerH: [2, 2.5],
    kettleLossL: [0.4, 0.8],
    absorptionLPerKg: [0.5, 0.8],
    note: 'Cuve large, à pleine puissance et sans couvercle : 2,25 L/h au milieu de la fourchette. Avec le condenseur de vapeur et les condensats renvoyés, compte plutôt 0,3 L/h. Le fond descend à 0,4 L avec un whirlpool, pompe et tuyau compris. Le réglage de l’absorption est le seul que ton geste change : 0,5 avec un sac pressé dans le panier, 0,8 avec le panier simplement égoutté.',
  },
  {
    id: 'brewzilla-35',
    name: 'BrewZilla 35 L, sans extension',
    boilOffLPerH: [2, 2.5],
    kettleLossL: [0.4, 0.8],
    absorptionLPerKg: [0.5, 0.8],
    note: 'Même cuve, moins de hauteur : l’évaporation ne change pas avec l’extension, seule la place disponible change. Ce modèle sert à brasser sous 20 L, ou à noter les réglages avant d’avoir la rehausse.',
  },
  {
    id: 'marmite-30',
    name: 'Marmite 25–30 L · gaz ou induction',
    boilOffLPerH: [1.5, 2.5],
    kettleLossL: [0.5, 1.5],
    absorptionLPerKg: [0.5, 0.8],
    note: 'Marmite de 28 à 32 cm sur un feu domestique, à gros bouillons. La perte de cuve dépend du robinet : 0,5 L avec une sortie en fond, jusqu’à 1,5 L avec un robinet latéral qu’on ne peut pas pencher.',
  },
  {
    id: 'marmite-45',
    name: 'Marmite 40–50 L · gaz ou induction',
    boilOffLPerH: [3, 4],
    kettleLossL: [0.5, 1.5],
    absorptionLPerKg: [0.5, 0.8],
    note: 'Une grande surface évapore presque deux fois plus qu’une petite. C’est ce qui fait qu’un brassin de 10 L y demande tant d’eau par litre : l’évaporation, elle, ne se divise pas avec la recette.',
  },
];
