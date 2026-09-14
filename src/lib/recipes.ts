import { FERMENT_KINDS } from '../config/fermentations';
import { NARROW_NBSP, formatCompact } from './format';
import { roleOf } from './homeassistant';
import { isRecord, readStoredList, writeStoredList } from './storage';
import {
  DEFAULT_WATER,
  MAX_ABSORPTION_L_PER_KG,
  MAX_BOIL_MINUTES,
  MAX_BOIL_OFF_L_PER_H,
  MAX_KETTLE_LOSS_L,
  MAX_WATER_LITRES,
} from './water';
import type {
  BrewWater,
  FermentKind,
  Recipe,
  RecipeDevice,
  RecipeIngredient,
  RecipeUnit,
} from '../types';

/**
 * Recettes : modèle, stockage et conversions.
 *
 * Aucun backend : les recettes vivent dans `localStorage`, comme le thème. Le
 * format stocké est **versionné** et relu de façon **défensive** (voir
 * `lib/storage.ts`) — c'est un stockage que l'utilisateur peut éditer à la main,
 * une entrée cassée ne doit pas vider la bibliothèque entière.
 */

const STORAGE_KEY = 'fermentation4.recipes';
const STORE_FIELD = 'recipes';
/**
 * v2 ajoute les sondes, v3 `archived`, v4 les prises (`devices` remplace `probes`),
 * v5 les mesures d'ingrédient (`ebc`, `aaPct`), v6 le calcul d'eau (`water`) : une
 * recette antérieure se relit sans appareil, sans mesure et sans plan d'eau, elle
 * n'est pas cassée — l'absence est un état, pas un manque.
 */
const STORE_VERSION = 6;

/** Unités proposées. `%` sert aux proportions : part du grist, du sel… */
export const RECIPE_UNITS: readonly RecipeUnit[] = ['g', 'kg', 'mL', 'L', '%'];

/** Au-delà, ce n'est plus un ingrédient mais une faute de frappe. */
export const MAX_QUANTITY = 1_000_000;

/** Bornes des mesures annexes : au-delà, c'est une saisie dans la mauvaise colonne. */
export const MAX_EBC = 2_000;
export const MAX_ALPHA_PCT = 50;

/**
 * Gardes de type plutôt que `Set<string>` : `has()` ne rétrécit pas une union,
 * une fonction `value is RecipeUnit` si — et sans transtypage.
 */
function isUnit(value: unknown): value is RecipeUnit {
  return typeof value === 'string' && RECIPE_UNITS.some((unit) => unit === value);
}

function isKind(value: unknown): value is FermentKind {
  return typeof value === 'string' && FERMENT_KINDS.some((kind) => kind === value);
}

/** Même garde, exposée : une production relit son type avec elle. */
export const isFermentKind = isKind;

let idCounter = 0;

/**
 * Identifiant local, unique dans le stockage. Pas d'UUID : ces clés ne sortent
 * jamais du navigateur, une horloge et un compteur suffisent.
 */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function emptyIngredient(): RecipeIngredient {
  return { id: createId('ing'), name: '', quantity: 0, unit: 'g' };
}

/** « 4,25 » — deux décimales au plus, virgule française, sans zéro inutile. */
export function formatQuantity(value: number): string {
  return formatCompact(value);
}

/** « 4,25 kg », « 12 % » (espace insécable étroite avant le pourcent). */
export function formatQuantityWithUnit(value: number, unit: RecipeUnit): string {
  const separator = unit === '%' ? NARROW_NBSP : ' ';
  return `${formatQuantity(value)}${separator}${unit}`;
}

export interface MeasuredRow {
  readonly quantity: number;
  readonly unit: RecipeUnit;
}

export interface RecipeTotal {
  readonly unit: RecipeUnit;
  readonly value: number;
}

/**
 * Totaux **par unité**, dans l'ordre d'apparition. Additionner des grammes et des
 * litres n'a pas de sens : on n'additionne donc que ce qui est comparable, et une
 * recette qui mélange les unités affiche plusieurs totaux plutôt qu'un total faux.
 * Liste vide en deçà de deux lignes — le total d'une ligne se lit déjà dessus.
 */
export function totalsOf(rows: readonly MeasuredRow[]): RecipeTotal[] {
  if (rows.length < 2) return [];
  const sums = new Map<RecipeUnit, number>();
  for (const row of rows) sums.set(row.unit, (sums.get(row.unit) ?? 0) + row.quantity);
  return [...sums.entries()].map(([unit, value]) => ({ unit, value }));
}

/** « 5,4 kg · 71 g » — les totaux d'une recette qui mélange les unités. */
export function describeTotals(totals: readonly RecipeTotal[]): string {
  return totals.map((total) => formatQuantityWithUnit(total.value, total.unit)).join(' · ');
}

/** « 1 sonde, 2 prises » — ce que la recette mesure et ce qu'elle commande. */
export function describeDevices(devices: readonly RecipeDevice[]): string {
  let sensors = 0;
  let outlets = 0;
  let untracked = 0;
  for (const device of devices) {
    const role = roleOf(device.entityId);
    if (role === 'sensor') sensors += 1;
    else if (role === 'outlet') outlets += 1;
    else untracked += 1;
  }

  const parts: string[] = [];
  if (sensors > 0) parts.push(`${sensors} ${sensors > 1 ? 'sondes' : 'sonde'}`);
  if (outlets > 0) parts.push(`${outlets} ${outlets > 1 ? 'prises' : 'prise'}`);
  // Une sonde retirée de l'installation garde son identifiant mais sort des familles
  // suivies : elle reste liée, et on le dit plutôt que de la compter à tort.
  if (untracked > 0) parts.push(`${untracked} hors suivi`);
  return parts.join(', ');
}

/** « 5 ingrédients · 1 sonde, 2 prises » — ce qu'une recette porte, en une ligne. */
export function describeRecipe(recipe: Recipe): string {
  const count = recipe.ingredients.length;
  const head = `${count} ${count > 1 ? 'ingrédients' : 'ingrédient'}`;
  if (recipe.devices.length === 0) return head;
  return `${head} · ${describeDevices(recipe.devices)}`;
}

/**
 * Recettes d'exemple, installées au **premier lancement** seulement : une
 * bibliothèque vide ne montre rien de ce qu'elle sait faire. Elles ne
 * reviennent pas si on les supprime — le stockage existe alors, et c'est lui
 * qui fait foi, même vide.
 */
export const SEED_RECIPES: readonly Recipe[] = [
  {
    id: 'seed-ipa',
    name: 'IPA maison · 20 L',
    kind: 'beer',
    ingredients: [
      { id: 'seed-ipa-1', name: 'Malt Pale Ale', quantity: 5, unit: 'kg' },
      { id: 'seed-ipa-2', name: 'Malt Crystal 60', quantity: 0.4, unit: 'kg' },
      { id: 'seed-ipa-3', name: 'Houblon Citra (amérisant)', quantity: 30, unit: 'g' },
      { id: 'seed-ipa-4', name: 'Houblon Citra (aromatique)', quantity: 60, unit: 'g' },
      { id: 'seed-ipa-5', name: 'Levure US-05', quantity: 11, unit: 'g' },
    ],
    /*
     * Un plan d'eau pour l'exemple : 20 L finis sur 5,4 kg de grain. Ce sont les
     * réglages par défaut — ceux d'une cuve BIAB de 25 L — et le formulaire les
     * corrige dès qu'on a mesuré la sienne.
     */
    water: {
      volumeL: 20,
      boilMinutes: 90,
      boilOffLPerH: 2.25,
      kettleLossL: 1,
      absorptionLPerKg: 0.5,
    },
    // Aucun appareil : leur identifiant dépend de l'installation Home Assistant,
    // un exemple ne peut pas en inventer.
    devices: [],
    archived: false,
  },
  {
    id: 'seed-koji',
    name: 'Koji de riz',
    kind: 'koji',
    ingredients: [
      { id: 'seed-koji-1', name: 'Riz rond cuit', quantity: 2, unit: 'kg' },
      { id: 'seed-koji-2', name: 'Spores de Aspergillus oryzae', quantity: 4, unit: 'g' },
    ],
    devices: [],
    archived: false,
  },
  {
    id: 'seed-miso',
    name: 'Miso de soja · 6 mois',
    kind: 'miso',
    ingredients: [
      { id: 'seed-miso-1', name: 'Soja jaune cuit', quantity: 1, unit: 'kg' },
      { id: 'seed-miso-2', name: 'Koji de riz', quantity: 1, unit: 'kg' },
      { id: 'seed-miso-3', name: 'Sel de mer', quantity: 0.4, unit: 'kg' },
      { id: 'seed-miso-4', name: 'Eau filtrée', quantity: 1.5, unit: 'L' },
    ],
    devices: [],
    archived: false,
  },
  {
    /**
     * Sauce soja : mêmes matières que le miso (koji, soja, sel) mais menée en
     * saumure, d'où un type à elle — voir `SAUCE_SOJA` dans `config/fermentations.ts`.
     * La saumure est à 18 % de sel : 450 g pour 2 L d'eau.
     */
    id: 'seed-sauce-soja',
    name: 'Sauce soja · 6 mois',
    kind: 'soy',
    ingredients: [
      { id: 'seed-sauce-soja-1', name: 'Soja jaune cuit', quantity: 1, unit: 'kg' },
      { id: 'seed-sauce-soja-2', name: 'Koji de blé torréfié', quantity: 1, unit: 'kg' },
      { id: 'seed-sauce-soja-3', name: 'Sel de mer', quantity: 0.45, unit: 'kg' },
      { id: 'seed-sauce-soja-4', name: 'Eau filtrée', quantity: 2, unit: 'L' },
    ],
    devices: [],
    archived: false,
  },
  {
    id: 'seed-garum',
    name: 'Garum de maquereau',
    kind: 'garum',
    ingredients: [
      { id: 'seed-garum-1', name: 'Maquereau entier', quantity: 2, unit: 'kg' },
      { id: 'seed-garum-2', name: 'Sel de mer', quantity: 0.5, unit: 'kg' },
      { id: 'seed-garum-3', name: 'Orge malté grillé', quantity: 5, unit: '%' },
    ],
    devices: [],
    archived: false,
  },
];

function seedCopy(): Recipe[] {
  return SEED_RECIPES.map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    ...(recipe.water === undefined ? {} : { water: { ...recipe.water } }),
    devices: recipe.devices.map((device) => ({ ...device })),
  }));
}

/**
 * Une mesure annexe relue : finie, positive, bornée, arrondie au centième. Tout le
 * reste — absente, texte, négative — vaut « non renseignée » plutôt qu'une valeur
 * inventée. Le champ est **facultatif** : les recettes d'avant la v5 n'en ont pas.
 */
function sanitizeMeasure(raw: unknown, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined;
  return Math.round(Math.min(raw, max) * 100) / 100;
}

/** Nom non vide, unité connue, poids fini et positif. Une ligne sinon `null`. */
function sanitizeIngredient(raw: unknown): RecipeIngredient | null {
  if (!isRecord(raw)) return null;
  const { id, name, quantity, unit } = raw;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) return null;
  if (!isUnit(unit)) return null;
  const ebc = sanitizeMeasure(raw.ebc, MAX_EBC);
  const aaPct = sanitizeMeasure(raw.aaPct, MAX_ALPHA_PCT);
  return {
    id: typeof id === 'string' && id !== '' ? id : createId('ing'),
    name: name.trim(),
    quantity: Math.min(quantity, MAX_QUANTITY),
    unit,
    // Une mesure absente ne s'écrit pas du tout : le stockage reste lisible à l'œil.
    ...(ebc === undefined ? {} : { ebc }),
    ...(aaPct === undefined ? {} : { aaPct }),
  };
}

/**
 * Un appareil lié : l'`entity_id` est la clé, le libellé n'est qu'un cache lisible.
 * Un libellé vide retombe sur l'identifiant — jamais de puce sans texte.
 */
function sanitizeDevice(raw: unknown): RecipeDevice | null {
  if (!isRecord(raw)) return null;
  const { entityId, label } = raw;
  if (typeof entityId !== 'string' || entityId.trim() === '') return null;
  const id = entityId.trim();
  return {
    entityId: id,
    label: typeof label === 'string' && label.trim() !== '' ? label.trim() : id,
  };
}

/**
 * Appareils relus : les entrées illisibles sont écartées et les doublons fondus,
 * l'ordre du choix est conservé. `devices` absent vaut liste vide ; `probes` est
 * l'ancien nom du champ, relu pour ne pas perdre les sondes déjà liées. Exporté :
 * une production recopie ses appareils avec la même règle.
 */
export function sanitizeDevices(raw: unknown): RecipeDevice[] {
  if (!Array.isArray(raw)) return [];
  const devices: RecipeDevice[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const clean = sanitizeDevice(entry);
    if (clean === null || seen.has(clean.entityId)) continue;
    seen.add(clean.entityId);
    devices.push(clean);
  }
  return devices;
}

/**
 * Un plan d'eau relu. Le **volume final est obligatoire** : sans lui il n'y a rien à
 * calculer, et la recette s'enregistre sans plan plutôt qu'avec un plan faux.
 *
 * Les quatre réglages de cuve retombent sur leur valeur par défaut quand ils manquent
 * ou sont illisibles — l'inverse du volume : un champ effacé à la main ne doit pas
 * décrire une cuve qui évapore 0,00 L/h.
 */
function sanitizeWater(raw: unknown): BrewWater | undefined {
  if (!isRecord(raw)) return undefined;
  const volumeL = sanitizeMeasure(raw.volumeL, MAX_WATER_LITRES);
  if (volumeL === undefined || volumeL <= 0) return undefined;
  return {
    volumeL,
    boilMinutes:
      sanitizeMeasure(raw.boilMinutes, MAX_BOIL_MINUTES) ?? DEFAULT_WATER.boilMinutes,
    boilOffLPerH:
      sanitizeMeasure(raw.boilOffLPerH, MAX_BOIL_OFF_L_PER_H) ?? DEFAULT_WATER.boilOffLPerH,
    kettleLossL:
      sanitizeMeasure(raw.kettleLossL, MAX_KETTLE_LOSS_L) ?? DEFAULT_WATER.kettleLossL,
    absorptionLPerKg:
      sanitizeMeasure(raw.absorptionLPerKg, MAX_ABSORPTION_L_PER_KG) ??
      DEFAULT_WATER.absorptionLPerKg,
  };
}

/** Ne garde que les recettes exploitables : le reste est ignoré, pas réparé. */
function sanitizeRecipe(entry: unknown): Recipe | null {
  if (!isRecord(entry)) return null;
  const { id, name, kind, ingredients, devices, probes, archived } = entry;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (!isKind(kind)) return null;
  const kept: RecipeIngredient[] = [];
  if (Array.isArray(ingredients)) {
    for (const ingredient of ingredients) {
      const clean = sanitizeIngredient(ingredient);
      if (clean !== null) kept.push(clean);
    }
  }
  const water = sanitizeWater(entry.water);
  return {
    id: typeof id === 'string' && id !== '' ? id : createId('recipe'),
    name: name.trim(),
    kind,
    ingredients: kept,
    // Un plan d'eau absent ne s'écrit pas du tout : la recette reste celle d'avant.
    ...(water === undefined ? {} : { water }),
    // `probes` : nom du champ jusqu'en v4, relu pour ne pas perdre l'existant.
    devices: sanitizeDevices(devices ?? probes),
    // Seul `true` archive : un champ absent ou douteux laisse la recette active.
    archived: archived === true,
  };
}

/**
 * Recettes stockées. Stockage vide ⇒ exemples du premier lancement ;
 * stockage illisible ⇒ exemples aussi, plutôt qu'une bibliothèque vide.
 */
export function readRecipes(): Recipe[] {
  return readStoredList(STORAGE_KEY, STORE_FIELD, sanitizeRecipe, seedCopy);
}

/** Écrit le magasin versionné. En cas de refus du stockage, la session continue. */
export function writeRecipes(recipes: readonly Recipe[]): void {
  writeStoredList(STORAGE_KEY, STORE_FIELD, STORE_VERSION, recipes);
}

/**
 * Bascule l'archivage d'une recette. Rend une nouvelle liste : `useRecipes` écrit
 * le résultat tel quel dans `localStorage`.
 */
export function withArchived(recipe: Recipe, archived: boolean): Recipe {
  return { ...recipe, archived };
}
