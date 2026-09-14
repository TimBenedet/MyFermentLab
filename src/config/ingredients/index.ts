import { HOPS } from './hops';
import { MALTS } from './malts';
import { YEASTS } from './yeasts';
import type { CatalogIngredient, FermentKind, IngredientFamily } from '../../types';

/**
 * Référentiel d'ingrédients de brasserie : malts, houblons, levures.
 *
 * Il est **local et statique**, comme le thème et les recettes — aucune API, aucun
 * accès réseau. Chaque famille est écrite dans son fichier, avec sa provenance en
 * tête : les fourchettes viennent des fiches produit des producteurs, pas d'une base
 * recopiée quelque part. Un chiffre à corriger se corrige donc **ici**, en une ligne,
 * sans toucher au code.
 */
export const FAMILY_LABELS: Readonly<Record<IngredientFamily, string>> = {
  malt: 'Malts',
  hop: 'Houblons',
  yeast: 'Levures',
};

/** Le référentiel entier, dans l'ordre d'affichage : malts, houblons, levures. */
export const CATALOG: readonly CatalogIngredient[] = [...MALTS, ...HOPS, ...YEASTS];

/**
 * Familles proposées par type de ferment. Un brassin se compose de malts, de houblons
 * et d'une levure ; un hydromel n'utilise qu'une levure ; un koji, un miso ou une sauce
 * soja ne sortent pas du référentiel de brasserie — leur formulaire reste en texte
 * libre, ce qui vaut mieux qu'une liste qui ne leur parle pas.
 */
export const FAMILIES_BY_KIND: Readonly<Record<FermentKind, readonly IngredientFamily[]>> = {
  beer: ['malt', 'hop', 'yeast'],
  mead: ['yeast'],
  koji: [],
  miso: [],
  soy: [],
  garum: [],
};
