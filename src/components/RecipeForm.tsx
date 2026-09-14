import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { FERMENT_KINDS, KIND_LABELS } from '../config/fermentations';
import { FAMILY_LABELS } from '../config/ingredients';
import {
  defaultAlpha,
  defaultEbc,
  describeIngredient,
  familiesForKind,
  shortSpec,
  suggestIngredients,
  unitForFamily,
} from '../lib/catalog';
import {
  byDisplayName,
  displayName,
  isTrackedEntity,
  roleOf,
  ROLE_LABELS,
} from '../lib/homeassistant';
import type { HassEntity } from '../lib/homeassistant';
import {
  createId,
  describeDevices,
  describeTotals,
  emptyIngredient,
  formatQuantity,
  MAX_ALPHA_PCT,
  MAX_EBC,
  MAX_QUANTITY,
  RECIPE_UNITS,
  totalsOf,
} from '../lib/recipes';
import type { FermentKind, Recipe, RecipeDevice, RecipeIngredient, RecipeUnit } from '../types';
import type { CatalogIngredient, IngredientFamily } from '../types';
import { MetricIcon } from './MetricIcon';

/** Une ligne de saisie : le poids reste du texte tant qu'on le tape. */
interface IngredientDraft {
  readonly id: string;
  readonly name: string;
  readonly quantity: string;
  readonly unit: RecipeUnit;
  /** Mesures annexes, texte elles aussi : le champ accepte la virgule et se relit. */
  readonly ebc: string;
  readonly aaPct: string;
}

/** Un appareil proposé à la liaison : lié ou non, présent dans Home Assistant ou non. */
interface DeviceCandidate {
  readonly entityId: string;
  readonly label: string;
  readonly missing: boolean;
}

/** Identifiant du menu de suggestions : un seul est ouvert à la fois. */
const SUGGEST_LIST_ID = 'ingredient-suggestions';
const SUGGEST_GAP = 4;
const SUGGEST_MAX_HEIGHT = 208;
const SUGGEST_MIN_HEIGHT = 96;
/** En dessous de cette place, un menu tient mal : on le bascule au-dessus du champ. */
const SUGGEST_FLIP_BELOW = 150;

/**
 * Place du menu de suggestions, en pixels d'écran.
 *
 * Le menu s'ancre au champ de saisie mais se pose en **`fixed`** : la liste des
 * ingrédients défile (`overflow-y-auto`), et un menu en `absolute` y serait rogné dès
 * la troisième ligne. `fixed` sort de la zone qui défile — à condition de lui donner
 * des coordonnées, d'où cette mesure. Il s'ouvre vers le bas, ou vers le haut quand
 * il n'y a pas la place, et sa hauteur suit la place trouvée.
 */
interface SuggestAnchor {
  readonly rowId: string;
  readonly left: number;
  readonly width: number;
  /** L'un ou l'autre, jamais les deux : sous le champ, ou au-dessus. */
  readonly top: number | null;
  readonly bottom: number | null;
  readonly maxHeight: number;
}

function measureSuggest(rowId: string, input: HTMLInputElement): SuggestAnchor {
  const rect = input.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width + 96, 320), Math.max(window.innerWidth - rect.left - 12, 240));
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const flip = below < SUGGEST_FLIP_BELOW && above > below;
  return {
    rowId,
    left: Math.min(rect.left, Math.max(window.innerWidth - width - 12, 12)),
    width,
    top: flip ? null : rect.bottom + SUGGEST_GAP,
    bottom: flip ? window.innerHeight - rect.top + SUGGEST_GAP : null,
    maxHeight: Math.max(SUGGEST_MIN_HEIGHT, Math.min(SUGGEST_MAX_HEIGHT, flip ? above : below)),
  };
}

export interface RecipeFormProps {
  /** Recette à modifier, ou `null` pour une création. */
  readonly recipe: Recipe | null;
  /** Entités Home Assistant lues par la vue Devices : sondes et prises en sont extraites. */
  readonly entities: readonly HassEntity[];
  /** Message d'erreur de Home Assistant, ou `null` si la lecture s'est bien passée. */
  readonly entitiesError: string | null;
  readonly onSave: (recipe: Recipe) => void;
  readonly onClose: () => void;
}

/** « 1,5 » ou « 1.5 » → 1.5 ; `null` si la saisie n'est pas un nombre. */
function parseQuantity(draft: string): number | null {
  const normalized = draft.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDraft(ingredient: RecipeIngredient): IngredientDraft {
  return {
    id: ingredient.id,
    name: ingredient.name,
    quantity: formatQuantity(ingredient.quantity),
    unit: ingredient.unit,
    ebc: ingredient.ebc === undefined ? '' : formatQuantity(ingredient.ebc),
    aaPct: ingredient.aaPct === undefined ? '' : formatQuantity(ingredient.aaPct),
  };
}

function newDraft(): IngredientDraft {
  const base = emptyIngredient();
  return { id: base.id, name: '', quantity: '', unit: base.unit, ebc: '', aaPct: '' };
}

/**
 * La valeur d'un `<select>` est une chaîne quelconque : on la confronte à la liste
 * des unités plutôt que de la transtyper, sinon `RecipeUnit` ne serait plus qu'une
 * promesse.
 */
function asUnit(value: string): RecipeUnit | null {
  return RECIPE_UNITS.find((unit) => unit === value) ?? null;
}

const FIELD_CLASS =
  'h-[30px] shrink-0 rounded-lg border border-anthracite-700 bg-anthracite-950 px-2.5 text-[12px] text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-accent-500/60 focus:outline-none';

const BACK_BUTTON =
  'w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none';

const SECONDARY_BUTTON =
  'h-7 shrink-0 rounded-lg border border-anthracite-700 px-3 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none';

const PRIMARY_BUTTON =
  'h-7 shrink-0 rounded-lg border border-accent-500/50 bg-accent-500/15 px-3 text-[11px] font-medium text-accent-300 transition-colors hover:border-accent-400 hover:bg-accent-500/25 focus-visible:border-accent-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-anthracite-700 disabled:bg-transparent disabled:text-zinc-600';

/**
 * Ligne du menu déroulant — trois branches littérales (liée, libre, liée mais
 * introuvable), Tailwind doit les voir écrites. La ligne introuvable passe en ambre :
 * l'appareil n'est plus dans la liste, la liaison reste.
 */
const ROW_ON =
  'flex w-full items-center gap-2 bg-accent-500/10 px-3 py-1.5 text-left text-[11px] font-medium text-accent-300 transition-colors hover:bg-accent-500/15 focus-visible:bg-accent-500/15 focus-visible:outline-none';

const ROW_OFF =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-300 transition-colors hover:bg-anthracite-850 focus-visible:bg-anthracite-850 focus-visible:outline-none';

const ROW_MISSING =
  'flex w-full items-center gap-2 bg-amber-500/10 px-3 py-1.5 text-left text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/15 focus-visible:bg-amber-500/15 focus-visible:outline-none';

/**
 * Page du formulaire d'une recette — création et modification.
 *
 * Elle est montée avec une `key` (l'identifiant de la recette, ou « new ») : changer
 * de recette remonte tout, et le brouillon repart donc de zéro sans effet de
 * synchronisation. Rien n'est écrit avant « Enregistrer » : les lignes sans nom ou
 * sans poids valide sont écartées à l'enregistrement, pas corrigées.
 */
export function RecipeForm({
  recipe,
  entities,
  entitiesError,
  onSave,
  onClose,
}: RecipeFormProps) {
  const isNew = recipe === null;
  const [name, setName] = useState(recipe?.name ?? '');
  const [kind, setKind] = useState<FermentKind>(recipe?.kind ?? 'beer');
  const [ingredients, setIngredients] = useState<readonly IngredientDraft[]>(() =>
    recipe === null ? [newDraft()] : recipe.ingredients.map(toDraft),
  );
  const [linked, setLinked] = useState<readonly RecipeDevice[]>(() => recipe?.devices ?? []);

  /**
   * Appareils Home Assistant, triés par nom : les sondes qui mesurent **et** les
   * prises qui chauffent. Une recette peut en porter autant qu'elle veut — trois
   * sondes dans la cuve, deux tapis sur la même prise multiple, c'est son affaire.
   */
  const available = entities.filter(isTrackedEntity).sort(byDisplayName);
  const known = new Set(available.map((entity) => entity.entity_id));
  // Lié et absent de la liste (appareil retiré, renommé, Home Assistant muet) :
  // il reste affiché en ambre plutôt que de disparaître en silence.
  const candidates: readonly DeviceCandidate[] = [
    ...linked
      .filter((device) => !known.has(device.entityId))
      .map((device) => ({ entityId: device.entityId, label: device.label, missing: true })),
    ...available.map((entity) => ({
      entityId: entity.entity_id,
      label: displayName(entity),
      missing: false,
    })),
  ];

  /** Liste encore vide et aucune erreur : la lecture est en cours, pas terminée. */
  const reading = entities.length === 0 && entitiesError === null;

  const toggleDevice = (candidate: DeviceCandidate): void => {
    setLinked((current) =>
      current.some((device) => device.entityId === candidate.entityId)
        ? current.filter((device) => device.entityId !== candidate.entityId)
        : [...current, { entityId: candidate.entityId, label: candidate.label }],
    );
  };

  /*
   * Le menu se ferme de deux façons : clic à côté, et Échap. Échap doit s'arrêter ici
   * — `App` l'écoute sur `window` pour fermer la vue produit, et fermer le menu
   * fermerait aussi la page.
   */
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const closeIfOutside = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && pickerRef.current?.contains(target) === true) return;
      setPickerOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setPickerOpen(false);
    };
    // `pointerdown` suffit à un navigateur moderne ; `mousedown` couvre le reste.
    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('mousedown', closeIfOutside);
    // En capture : pendant la descente de l'événement, avant l'écoute de `App`.
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('mousedown', closeIfOutside);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [pickerOpen]);

  const patch = (id: string, change: Partial<Omit<IngredientDraft, 'id'>>): void => {
    setIngredients((current) =>
      current.map((row) => (row.id === id ? { ...row, ...change } : row)),
    );
  };

  const addRow = (): void => setIngredients((current) => [...current, newDraft()]);

  /**
   * Menu de suggestions d'ingrédients, ouvert sur une ligne précise. Le référentiel
   * dépend du type : un brassin se compose de malts, de houblons et d'une levure, un
   * hydromel d'une levure, un miso de rien du tout — son formulaire reste en texte
   * libre, ce qui vaut mieux qu'une liste qui ne lui parle pas.
   */
  const [suggest, setSuggest] = useState<SuggestAnchor | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLInputElement | null>(null);

  const families = familiesForKind(kind);
  /*
   * Deux colonnes de mesure, et seulement quand elles ont un sens : la couleur suit le
   * malt, les acides alpha suivent le houblon. Un hydromel, un koji ou un miso n'en
   * affichent aucune — leur formulaire reste celui d'hier.
   */
  const showsEbc = families.includes('malt');
  const showsAlpha = families.includes('hop');

  const openRow =
    suggest === null ? null : (ingredients.find((row) => row.id === suggest.rowId) ?? null);
  const suggestions = openRow === null ? [] : suggestIngredients(kind, openRow.name);

  /** Suggestions groupées par famille, dans l'ordre du référentiel. */
  const groups: { family: IngredientFamily; entries: CatalogIngredient[] }[] = [];
  for (const entry of suggestions) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.family === entry.family) last.entries.push(entry);
    else groups.push({ family: entry.family, entries: [entry] });
  }

  /*
   * Le menu se ferme par un clic à côté ou par Échap — un menu en `fixed` ne suit pas
   * son champ, donc il est **replacé** quand la liste des ingrédients défile ou que la
   * fenêtre change de taille. Échap s'arrête ici : `App` l'écoute sur `window` pour
   * fermer la vue produit, et fermer le menu fermerait aussi la page.
   */
  useEffect(() => {
    if (suggest === null) return undefined;
    const closeIfOutside = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      // Tout ce qui touche la liste des ingrédients est « dedans » : le menu y est
      // rendu, et un clic sur une suggestion doit aller jusqu'au bout.
      if (rowsRef.current?.contains(target) === true) return;
      setSuggest(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setSuggest(null);
    };
    const reposition = (): void => {
      const anchor = anchorRef.current;
      if (anchor === null) return;
      setSuggest((current) =>
        current === null ? null : measureSuggest(current.rowId, anchor),
      );
    };
    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('mousedown', closeIfOutside);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('mousedown', closeIfOutside);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [suggest]);

  /**
   * Choisir une suggestion remplit le nom — et l'unité, mais seulement sur une ligne
   * encore vide : un malt se pèse en kilos, un houblon en grammes, une ligne déjà
   * pesée garde l'unité qu'on lui a donnée. Le texte libre reste possible : le
   * référentiel propose, il n'enferme pas.
   *
   * Les mesures suivent : le **milieu de la fourchette publiée** part dans le champ
   * EBC (malt) ou AA (houblon), qui reste modifiable — la fiche de ton sac fait foi.
   */
  const pickIngredient = (row: IngredientDraft, entry: CatalogIngredient): void => {
    const ebc = showsEbc ? defaultEbc(entry) : null;
    const aaPct = showsAlpha ? defaultAlpha(entry) : null;
    patch(row.id, {
      name: entry.name,
      ...(ebc === null ? {} : { ebc: formatQuantity(ebc) }),
      ...(aaPct === null ? {} : { aaPct: formatQuantity(aaPct) }),
      ...(row.quantity.trim() === '' ? { unit: unitForFamily(entry.family) } : {}),
    });
    setSuggest(null);
  };

  const removeRow = (id: string): void => {
    setIngredients((current) => current.filter((row) => row.id !== id));
  };

  /**
   * Lignes exploitables : nom non vide **et** poids valide. Les autres sont
   * ignorées à l'enregistrement, et signalées en pied de page. Une mesure annexe
   * illisible ne fait pas tomber la ligne : elle n'est simplement pas enregistrée.
   */
  const kept: RecipeIngredient[] = [];
  let incomplete = false;
  let measuresIncomplete = false;
  for (const row of ingredients) {
    const label = row.name.trim();
    const quantity = parseQuantity(row.quantity);
    if (label === '' || quantity === null || quantity < 0) {
      incomplete = true;
      continue;
    }
    const ebc = parseQuantity(row.ebc);
    const aaPct = parseQuantity(row.aaPct);
    const ebcKept = ebc === null || ebc < 0 ? undefined : Math.min(ebc, MAX_EBC);
    const alphaKept =
      aaPct === null || aaPct < 0 ? undefined : Math.min(aaPct, MAX_ALPHA_PCT);
    if (row.ebc.trim() !== '' && ebcKept === undefined) measuresIncomplete = true;
    if (row.aaPct.trim() !== '' && alphaKept === undefined) measuresIncomplete = true;
    kept.push({
      id: row.id,
      name: label,
      quantity: Math.min(quantity, MAX_QUANTITY),
      unit: row.unit,
      ...(ebcKept === undefined ? {} : { ebc: ebcKept }),
      ...(alphaKept === undefined ? {} : { aaPct: alphaKept }),
    });
  }
  // `RecipeIngredient` porte déjà poids et unité : le total se calcule dessus.
  const totals = totalsOf(kept);

  /** Ce que le pied de page dit de la saisie, du plus urgent au plus anodin. */
  const feedback = incomplete
    ? 'Les lignes sans nom ou sans poids valide ne sont pas enregistrées.'
    : measuresIncomplete
      ? 'Les mesures non numériques (EBC, AA) ne sont pas enregistrées.'
      : totals.length > 0
        ? `Total ${describeTotals(totals)}`
        : `${kept.length} ${kept.length > 1 ? 'ingrédients' : 'ingrédient'}`;

  const trimmedName = name.trim();
  const canSave = trimmedName !== '';

  const save = (): void => {
    if (!canSave) return;
    onSave({
      id: recipe?.id ?? createId('recipe'),
      name: trimmedName,
      kind,
      ingredients: kept,
      // Le libellé suit l'appareil tant qu'il est là : un renommage côté Home
      // Assistant se répercute à l'enregistrement, un appareil disparu garde le sien.
      devices: linked.map((device) => {
        const entity = available.find((item) => item.entity_id === device.entityId);
        return entity === undefined
          ? device
          : { entityId: device.entityId, label: displayName(entity) };
      }),
      // Modifier une recette archivée ne la désarchive pas : c'est l'affaire du bouton.
      archived: recipe?.archived ?? false,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Sans `stopPropagation`, Échap remonte jusqu'au `window` où App écoute pour
    // fermer la vue produit : annuler la saisie fermerait aussi la page.
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
    if (event.key === 'Enter') {
      event.stopPropagation();
      save();
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-anthracite-800 pb-2.5">
        <button
          type="button"
          onClick={onClose}
          title="Revenir à la bibliothèque"
          className={BACK_BUTTON}
        >
          ← Bibliothèque
        </button>

        <h2 className="text-lg font-semibold text-zinc-100">
          {isNew ? 'Nouvelle recette' : 'Modifier la recette'}
        </h2>

        <p className="text-[11px] text-zinc-500">
          {isNew ? 'nom, type, sondes, ingrédients · le poids est libre' : recipe.name}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            title="Enregistrer la recette (Entrée)"
            className={PRIMARY_BUTTON}
          >
            {isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-3">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500">Nom</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Nom de la recette"
              title="Nom de la recette (Entrée enregistre, Échap ferme)"
              className={`${FIELD_CLASS} w-full`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-zinc-500">Type</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Type de ferment">
              {FERMENT_KINDS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setKind(candidate)}
                  aria-pressed={kind === candidate}
                  className={
                    kind === candidate
                      ? 'rounded-lg border border-accent-500/50 bg-accent-500/15 px-2.5 py-1.5 text-[11px] font-medium text-accent-300 transition-colors focus-visible:border-accent-400 focus-visible:outline-none'
                      : 'rounded-lg border border-anthracite-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none'
                  }
                >
                  {KIND_LABELS[candidate]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-1.5 border-t border-anthracite-800 pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] text-zinc-500">
              Sondes et prises liées · {linked.length}
            </span>
            <span className="text-[10px] text-zinc-600">
              {entitiesError !== null
                ? `Home Assistant injoignable · ${entitiesError}`
                : reading
                  ? 'lecture des appareils de la vue Devices…'
                  : `${available.length} appareils dans Devices`}
            </span>
          </div>

          {/* Un menu plutôt qu'une rangée de puces : l'installation en compte vite
              plus que la largeur du formulaire, et un menu ouvert ne prend pas de
              hauteur — il passe par-dessus les ingrédients. */}
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-controls="device-picker"
              title="Choisir les sondes et les prises liées"
              className={`${FIELD_CLASS} flex w-full items-center justify-between gap-2 text-left`}
            >
              <span
                className={`min-w-0 truncate ${linked.length === 0 ? 'text-zinc-500' : ''}`}
              >
                {linked.length === 0 ? 'Aucun appareil lié' : describeDevices(linked)}
              </span>
              <span
                aria-hidden="true"
                className={`shrink-0 text-[10px] text-zinc-500 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </button>

            {!pickerOpen ? null : (
              <div
                id="device-picker"
                role="group"
                aria-label="Appareils disponibles"
                className="absolute top-full left-0 z-20 mt-1 flex max-h-56 w-full flex-col overflow-y-auto rounded-xl border border-anthracite-700 bg-anthracite-900 py-1 shadow-xl shadow-black/30"
              >
                {candidates.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-zinc-600">
                    {reading
                      ? 'Chargement des appareils…'
                      : entitiesError !== null
                        ? 'Liste indisponible : les appareils déjà liés sont conservés.'
                        : 'Aucun appareil dans la vue Devices.'}
                  </p>
                ) : (
                  candidates.map((candidate) => {
                    const on = linked.some((device) => device.entityId === candidate.entityId);
                    const role = roleOf(candidate.entityId);
                    return (
                      <button
                        key={candidate.entityId}
                        type="button"
                        onClick={() => toggleDevice(candidate)}
                        aria-pressed={on}
                        aria-label={`${candidate.label}, ${role === null ? 'appareil' : ROLE_LABELS[role].toLowerCase()} — ${on ? 'délier' : 'lier'}`}
                        title={
                          candidate.missing
                            ? `${candidate.entityId} — introuvable dans Home Assistant`
                            : candidate.entityId
                        }
                        className={
                          on ? (candidate.missing ? ROW_MISSING : ROW_ON) : ROW_OFF
                        }
                      >
                        <span aria-hidden="true" className="w-3 shrink-0 text-center">
                          {on ? '✓' : '+'}
                        </span>
                        {role === 'outlet' ? (
                          <MetricIcon kind="power" className="h-3 w-3 shrink-0" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
                        <span className="shrink-0 text-[10px] text-zinc-600">
                          {role === null ? 'hors suivi' : ROLE_LABELS[role]}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-anthracite-800 pt-3">
          <span className="text-[10px] text-zinc-500">
            Ingrédients · {ingredients.length}
          </span>

          <div ref={rowsRef} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {ingredients.length === 0 ? (
              <p className="py-1 text-[11px] text-zinc-600">
                Aucun ingrédient : la recette s’enregistrera vide.
              </p>
            ) : null}

            {ingredients.map((row, index) => {
              const quantity = parseQuantity(row.quantity);
              const invalid = row.quantity.trim() !== '' && (quantity === null || quantity < 0);
              const ebc = parseQuantity(row.ebc);
              const aaPct = parseQuantity(row.aaPct);
              const ebcInvalid = row.ebc.trim() !== '' && (ebc === null || ebc < 0);
              const alphaInvalid = row.aaPct.trim() !== '' && (aaPct === null || aaPct < 0);
              const open = suggest !== null && suggest.rowId === row.id;
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(event) => {
                      patch(row.id, { name: event.target.value });
                      anchorRef.current = event.currentTarget;
                      setSuggest(measureSuggest(row.id, event.currentTarget));
                    }}
                    onFocus={(event) => {
                      anchorRef.current = event.currentTarget;
                      setSuggest(measureSuggest(row.id, event.currentTarget));
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Ingrédient"
                    aria-label={`Nom de l'ingrédient ${index + 1}`}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={families.length === 0 ? undefined : SUGGEST_LIST_ID}
                    aria-autocomplete="list"
                    className={`${FIELD_CLASS} min-w-0 flex-1`}
                  />

                  {/* Référentiel de brasserie : malts, houblons, levures. Le menu est
                      posé en `fixed` — dans la liste qui défile, il serait rogné. */}
                  {open && families.length > 0 ? (
                    <div
                      id={SUGGEST_LIST_ID}
                      role="group"
                      aria-label="Référentiel d’ingrédients"
                      style={{
                        left: suggest.left,
                        width: suggest.width,
                        maxHeight: suggest.maxHeight,
                        top: suggest.top ?? undefined,
                        bottom: suggest.bottom ?? undefined,
                      }}
                      className="fixed z-30 flex flex-col overflow-y-auto rounded-xl border border-anthracite-700 bg-anthracite-900 py-1 shadow-xl shadow-black/30"
                    >
                      {groups.length === 0 ? (
                        <p className="px-3 py-2 text-[11px] text-zinc-600">
                          Rien au référentiel pour « {openRow?.name ?? ''} » — le texte libre
                          reste possible.
                        </p>
                      ) : (
                        groups.map((group) => (
                          <div key={group.family} className="flex flex-col">
                            <p className="px-3 pt-1.5 pb-0.5 text-[10px] text-zinc-600">
                              {FAMILY_LABELS[group.family]}
                            </p>
                            {group.entries.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => pickIngredient(row, entry)}
                                title={`${entry.origin} · ${entry.role} · ${describeIngredient(entry)}`}
                                aria-label={`${entry.name} — ${entry.origin}, ${entry.role}, ${describeIngredient(entry)}`}
                                className="flex flex-col gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-anthracite-850 focus-visible:bg-anthracite-850 focus-visible:outline-none"
                              >
                                <span className="flex items-baseline gap-2">
                                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-200">
                                    {entry.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                                    {shortSpec(entry)}
                                  </span>
                                </span>
                                <span className="truncate text-[10px] text-zinc-500">
                                  {entry.origin} · {entry.role}
                                </span>
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {/* Deux mesures de lecture, pas de saisie obligatoire : elles
                      s'emplissent au choix d'un ingrédient du référentiel et se
                      corrigent à la main sur la fiche du lot reçu. */}
                  {showsEbc ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.ebc}
                        onChange={(event) => patch(row.id, { ebc: event.target.value })}
                        onKeyDown={onKeyDown}
                        placeholder="—"
                        aria-label={`Couleur EBC de l'ingrédient ${index + 1}`}
                        aria-invalid={ebcInvalid}
                        title="Couleur en EBC — proposée au choix d'un malt, modifiable"
                        className={`${FIELD_CLASS} w-16 text-right tabular-nums ${
                          ebcInvalid ? 'border-red-500/60 text-red-400' : ''
                        }`}
                      />
                      <span className="text-[10px] text-zinc-500">EBC</span>
                    </div>
                  ) : null}

                  {showsAlpha ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.aaPct}
                        onChange={(event) => patch(row.id, { aaPct: event.target.value })}
                        onKeyDown={onKeyDown}
                        placeholder="—"
                        aria-label={`Acides alpha de l'ingrédient ${index + 1}`}
                        aria-invalid={alphaInvalid}
                        title="Acides alpha en pourcentage — proposés au choix d'un houblon, modifiables"
                        className={`${FIELD_CLASS} w-14 text-right tabular-nums ${
                          alphaInvalid ? 'border-red-500/60 text-red-400' : ''
                        }`}
                      />
                      <span className="text-[10px] text-zinc-500">AA</span>
                    </div>
                  ) : null}

                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(event) => patch(row.id, { quantity: event.target.value })}
                    onKeyDown={onKeyDown}
                    placeholder="0"
                    aria-label={`Poids de l'ingrédient ${index + 1}`}
                    aria-invalid={invalid}
                    className={`${FIELD_CLASS} w-20 text-right tabular-nums ${
                      invalid ? 'border-red-500/60 text-red-400' : ''
                    }`}
                  />

                  <select
                    value={row.unit}
                    onChange={(event) => {
                      const unit = asUnit(event.target.value);
                      if (unit !== null) patch(row.id, { unit });
                    }}
                    aria-label={`Unité de l'ingrédient ${index + 1}`}
                    className={`${FIELD_CLASS} w-16 px-1.5 text-zinc-200`}
                  >
                    {RECIPE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Supprimer la ligne ${index + 1}`}
                    title="Supprimer la ligne"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] leading-none text-zinc-500 transition-colors hover:bg-anthracite-800 hover:text-zinc-100 focus-visible:bg-anthracite-800 focus-visible:text-zinc-100 focus-visible:outline-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="mt-0.5 w-fit rounded-lg px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-anthracite-800 hover:text-accent-300 focus-visible:bg-anthracite-800 focus-visible:text-accent-300 focus-visible:outline-none"
            >
              + Ajouter un ingrédient
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-anthracite-800 pt-2.5">
          <span className="text-[10px] text-zinc-500">
            {feedback}
          </span>
        </div>
      </div>
    </section>
  );
}
