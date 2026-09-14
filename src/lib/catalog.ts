import { CATALOG, FAMILIES_BY_KIND } from '../config/ingredients';
import { EN_DASH, formatMeasure, formatPercent, NARROW_NBSP } from './format';
import type {
  CatalogIngredient,
  CatalogRange,
  FermentKind,
  IngredientFamily,
  RecipeUnit,
} from '../types';

/**
 * Recherche et mise en mots du référentiel d'ingrédients.
 *
 * Le référentiel ne sert qu'au **menu déroulant** du formulaire : rien n'en est
 * recopié dans une recette, qui ne garde qu'un nom, un poids et une unité. Chercher
 * ici ne coûte donc rien à la relecture du stockage.
 */

/** Suggestions montrées par famille quand le champ est encore vide. */
const IDLE_PER_FAMILY = 4;
/** Suggestions montrées par famille dès qu'une recherche est lancée. */
const MATCH_PER_FAMILY = 6;

function decimalsOf(value: number): 0 | 1 {
  return Number.isInteger(value) ? 0 : 1;
}

/** « 3–5 », « 4,5–7 », « 78 » — une seule borne quand les deux se confondent. */
function rangeText(range: CatalogRange): string {
  const [min, max] = range;
  if (min === max) return formatMeasure(min, decimalsOf(min));
  return `${formatMeasure(min, decimalsOf(min))}${EN_DASH}${formatMeasure(max, decimalsOf(max))}`;
}

/** Détail chiffré complet : « 3–5 EBC · rendement 78–82 % · ≤ 10 % du grist ». */
export function describeIngredient(entry: CatalogIngredient): string {
  if (entry.family === 'malt') {
    const { colorEbc, yieldPct, maxPct } = entry.spec;
    const cap =
      maxPct === undefined || maxPct >= 100 ? '' : ` · ≤ ${formatPercent(maxPct, 0)} du grist`;
    return `${rangeText(colorEbc)} EBC · rendement ${rangeText(yieldPct)}${NARROW_NBSP}%${cap}`;
  }
  if (entry.family === 'hop') {
    return `α ${rangeText(entry.spec.alphaPct)}${NARROW_NBSP}%`;
  }
  const { attenuationPct, temperatureC, form } = entry.spec;
  return `atténuation ${rangeText(attenuationPct)}${NARROW_NBSP}% · ${rangeText(temperatureC)} °C · ${form}`;
}

/**
 * Version courte, pour la colonne de droite du menu : la couleur d'un malt, l'alpha
 * d'un houblon, l'atténuation d'une levure — ce qui distingue deux entrées voisines.
 */
export function shortSpec(entry: CatalogIngredient): string {
  if (entry.family === 'malt') return `${rangeText(entry.spec.colorEbc)} EBC`;
  if (entry.family === 'hop') return `α ${rangeText(entry.spec.alphaPct)}${NARROW_NBSP}%`;
  return `${rangeText(entry.spec.attenuationPct)}${NARROW_NBSP}%`;
}

/** Minuscules sans accent : « Mittelfrüh » doit se trouver en tapant « mittelfruh ». */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Une entrée répond à son nom, à ses sigles et à son origine : « EKG » sort le East
 * Kent Goldings, « Weyermann » sort tous ses malts, « Nouvelle-Zélande » ses houblons.
 */
function matches(entry: CatalogIngredient, needle: string): boolean {
  if (fold(entry.name).includes(needle)) return true;
  if (fold(entry.origin).includes(needle)) return true;
  return (entry.aliases ?? []).some((alias) => fold(alias).includes(needle));
}

/** Familles que ce type de ferment sait composer. */
export function familiesForKind(kind: FermentKind): readonly IngredientFamily[] {
  return FAMILIES_BY_KIND[kind];
}

/**
 * Suggestions pour un type de ferment et un début de nom, **groupées par famille dans
 * l'ordre du référentiel**. Champ vide : les premières entrées de chaque famille, de
 * quoi voir ce que la liste contient sans rien taper.
 */
export function suggestIngredients(kind: FermentKind, query: string): readonly CatalogIngredient[] {
  const families = FAMILIES_BY_KIND[kind];
  if (families.length === 0) return [];
  const needle = fold(query.trim());
  const limit = needle === '' ? IDLE_PER_FAMILY : MATCH_PER_FAMILY;
  const found: CatalogIngredient[] = [];
  for (const family of families) {
    const pool = CATALOG.filter(
      (entry) => entry.family === family && (needle === '' || matches(entry, needle)),
    );
    found.push(...pool.slice(0, limit));
  }
  return found;
}

/**
 * Unité naturelle d'une suggestion : un malt se pèse en kilos, un houblon et une levure
 * en grammes. Elle ne s'applique qu'à une ligne **encore vide** — une ligne déjà pesée
 * garde l'unité qu'on lui a donnée.
 */
export function unitForFamily(family: IngredientFamily): RecipeUnit {
  return family === 'malt' ? 'kg' : 'g';
}

/**
 * Milieu d'une fourchette publiée : c'est la valeur de départ d'un champ **modifiable**.
 * Le référentiel ne peut pas faire mieux — il publie « 3–5 EBC », pas la couleur de ton
 * sac — mais il évite de laisser la case vide devant un choix déjà fait.
 */
export function midpoint(range: CatalogRange): number {
  return Math.round(((range[0] + range[1]) / 2) * 100) / 100;
}

/** Couleur EBC proposée pour un malt ; `null` pour tout le reste. */
export function defaultEbc(entry: CatalogIngredient): number | null {
  return entry.family === 'malt' ? midpoint(entry.spec.colorEbc) : null;
}

/** Acides alpha proposés pour un houblon ; `null` pour tout le reste. */
export function defaultAlpha(entry: CatalogIngredient): number | null {
  return entry.family === 'hop' ? midpoint(entry.spec.alphaPct) : null;
}
