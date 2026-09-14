import { useState } from 'react';
import { KIND_LABELS } from '../config/fermentations';
import { formatClock } from '../lib/format';
import { roleOf, ROLE_LABELS } from '../lib/homeassistant';
import {
  describeDevices,
  describeRecipe,
  describeTotals,
  formatQuantity,
  formatQuantityWithUnit,
  totalsOf,
} from '../lib/recipes';
import { computeWater, describeWater, formatLitres, grainMassKg, waterFootnote } from '../lib/water';
import type { Production, Recipe, RecipeDevice } from '../types';

/** Rôle d'un appareil lié, tel qu'il s'affiche en tête de ligne. */
function roleLabel(device: RecipeDevice): string {
  const role = roleOf(device.entityId);
  return role === null ? 'Hors suivi' : ROLE_LABELS[role];
}

export interface RecipeDetailProps {
  readonly recipe: Recipe;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onDelete: (id: string) => void;
  /** Lot en cours de cette recette, ou `null` si elle ne produit rien. */
  readonly production: Production | null;
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onToggleArchive: () => void;
}

const HEADER_BUTTON =
  'h-7 shrink-0 rounded-lg border border-anthracite-700 px-3 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none';

const PRIMARY_BUTTON =
  'h-7 shrink-0 rounded-lg border border-accent-500/50 bg-accent-500/15 px-3 text-[11px] font-medium text-accent-300 transition-colors hover:border-accent-400 hover:bg-accent-500/25 focus-visible:border-accent-400 focus-visible:outline-none';

const STOP_BUTTON =
  'h-7 shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-[11px] font-medium text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus-visible:border-red-400 focus-visible:outline-none';

/*
 * Quatre mises en page, littérales : une recette de bière porte les deux mesures, une
 * ancienne recette ou un miso aucune. Tailwind doit voir ces classes écrites.
 */
const LAYOUT_NAME_ONLY = 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4';
const LAYOUT_EBC = 'grid grid-cols-[minmax(0,1fr)_3.5rem_auto] items-baseline gap-x-4';
const LAYOUT_ALPHA = 'grid grid-cols-[minmax(0,1fr)_3rem_auto] items-baseline gap-x-4';
const LAYOUT_BOTH =
  'grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_auto] items-baseline gap-x-4';

/**
 * Page d'une recette : tout ce qu'elle contient, et rien qu'on ne puisse changer.
 * La modification se demande (« Modifier ») plutôt que de s'imposer : une recette
 * se consulte plus souvent qu'elle ne se réécrit.
 *
 * Elle porte aussi le **lancement en production** : la recette est ce qu'on écrit,
 * le lot est ce qui tourne. Arrêter n'archive pas, archiver n'arrête pas — un lot
 * tourne dans la cave, la recette est du papier.
 */
export function RecipeDetail({
  recipe,
  onBack,
  onEdit,
  onDelete,
  production,
  onStart,
  onStop,
  onToggleArchive,
}: RecipeDetailProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ingredients = recipe.ingredients;
  const count = ingredients.length;
  const devices = recipe.devices;
  const outlets = devices.filter((device) => roleOf(device.entityId) === 'outlet').length;
  const totals = totalsOf(ingredients);

  /*
   * Le plan d'eau se recalcule à l'affichage plutôt que d'être recopié dans la recette :
   * seuls les réglages sont stockés, le reste en découle. Une recette de miso n'en a
   * pas, une bière écrite avant la v6 non plus — la page reste alors celle d'hier.
   */
  const waterPlan =
    recipe.water === undefined ? null : computeWater(recipe.water, grainMassKg(ingredients));
  const waterLines = waterPlan === null ? [] : describeWater(waterPlan);

  /*
   * Les mesures ne s'affichent que si au moins une ligne en porte : une recette
   * écrite avant, ou sans mesure, garde exactement la table d'avant.
   */
  const showsEbc = ingredients.some((ingredient) => ingredient.ebc !== undefined);
  const showsAlpha = ingredients.some((ingredient) => ingredient.aaPct !== undefined);
  const layout = showsEbc
    ? showsAlpha
      ? LAYOUT_BOTH
      : LAYOUT_EBC
    : showsAlpha
      ? LAYOUT_ALPHA
      : LAYOUT_NAME_ONLY;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-anthracite-800 pb-2.5">
        <button
          type="button"
          onClick={onBack}
          title="Revenir à la bibliothèque"
          className="w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none"
        >
          ← Bibliothèque
        </button>

        <h2 className="text-lg font-semibold text-zinc-100">{recipe.name}</h2>

        <span className="shrink-0 rounded-full bg-anthracite-800 px-2 py-0.5 text-[10px] text-zinc-400">
          {KIND_LABELS[recipe.kind]}
        </span>

        <p className="text-[11px] text-zinc-500">
          {describeRecipe(recipe)}
        </p>

        {!recipe.archived ? null : (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
            Archivée
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onToggleArchive} className={HEADER_BUTTON}>
            {recipe.archived ? 'Désarchiver' : 'Archiver'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirmingDelete) onDelete(recipe.id);
              else setConfirmingDelete(true);
            }}
            className="h-7 shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-[11px] font-medium text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus-visible:border-red-400 focus-visible:outline-none"
          >
            {confirmingDelete ? 'Confirmer la suppression' : 'Supprimer'}
          </button>

          <button type="button" onClick={onEdit} className={PRIMARY_BUTTON}>
            Modifier
          </button>
        </div>
      </header>

      {/* Le bandeau dit l'état du lot et porte la seule action qui le concerne. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-2.5">
        {production === null ? (
          <>
            <span className="min-w-0 flex-1 text-[11px] text-zinc-500">
              {recipe.archived
                ? 'Recette archivée : elle ne se lance pas tant qu’elle n’est pas désarchivée.'
                : outlets === 0
                  ? 'Cette recette n’est pas en production. Un lot lancé se suit sur l’accueil, à côté des cinq ferments.'
                  : 'Cette recette n’est pas en production. La lancer crée un lot suivi sur l’accueil et met ses prises sous asservissement.'}
            </span>
            <button
              type="button"
              onClick={onStart}
              disabled={recipe.archived}
              title={
                recipe.archived
                  ? 'Désarchiver la recette pour la lancer'
                  : 'Créer un lot suivi sur l’écran d’accueil'
              }
              className={`${PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:border-anthracite-700 disabled:bg-transparent disabled:text-zinc-600`}
            >
              Lancer en production
            </button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-[11px] text-zinc-500">
              En production · lancée à {formatClock(production.startedAt)}
              {devices.length === 0 ? '' : ` · ${describeDevices(devices)}`}
              {outlets === 0
                ? ''
                : ' · prises asservies : elles chauffent sous la consigne, s’arrêtent à la consigne'}
            </span>
            <button type="button" onClick={onStop} className={STOP_BUTTON}>
              Arrêter la production
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
        <div className="rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-3">
          <div
            className={`${layout} border-b border-anthracite-800 pb-1.5`}
          >
            <span className="text-[10px] text-zinc-500">Ingrédient</span>
            {showsEbc ? (
              <span className="text-right text-[10px] text-zinc-500" title="Couleur du malt">
                EBC
              </span>
            ) : null}
            {showsAlpha ? (
              <span
                className="text-right text-[10px] text-zinc-500"
                title="Acides alpha du houblon, en pourcentage"
              >
                AA&#8239;%
              </span>
            ) : null}
            <span className="text-right text-[10px] text-zinc-500">Poids</span>
          </div>

          {count === 0 ? (
            <p className="py-2 text-[11px] text-zinc-500">
              Aucun ingrédient. « Modifier » en ajoute.
            </p>
          ) : (
            ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                className={`${layout} border-b border-anthracite-800 py-1.5 last:border-b-0`}
              >
                <span className="min-w-0 truncate text-[12px] text-zinc-100">
                  {ingredient.name}
                </span>
                {showsEbc ? (
                  <span className="text-right text-[11px] tabular-nums text-zinc-400">
                    {ingredient.ebc === undefined ? '' : formatQuantity(ingredient.ebc)}
                  </span>
                ) : null}
                {showsAlpha ? (
                  <span className="text-right text-[11px] tabular-nums text-zinc-400">
                    {ingredient.aaPct === undefined ? '' : formatQuantity(ingredient.aaPct)}
                  </span>
                ) : null}
                <span className="text-right text-[12px] font-medium tabular-nums text-zinc-300">
                  {formatQuantityWithUnit(ingredient.quantity, ingredient.unit)}
                </span>
              </div>
            ))
          )}

          {totals.length === 0 ? null : (
            <div className="flex items-baseline justify-between gap-4 border-t border-anthracite-800 pt-1.5">
              <span className="text-[10px] text-zinc-500">Total</span>
              <span className="text-[12px] font-medium tabular-nums text-zinc-100">
                {describeTotals(totals)}
              </span>
            </div>
          )}
        </div>

        {/* Le calcul d'eau n'existe que là où il y a du grain. Il n'est pas recopié dans
            la recette : seuls les réglages le sont, le reste s'en déduit. */}
        {waterPlan === null ? null : (
          <div className="mt-3 shrink-0 rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-anthracite-800 pb-1.5">
              <span className="text-[10px] text-zinc-500">Eau de brassage · BIAB</span>
              <span className="text-[10px] text-zinc-500">tout en une fois, sans rinçage</span>
            </div>

            <div className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-[12px] font-medium text-zinc-100">Eau à préparer</span>
              <span className="text-[15px] font-semibold tabular-nums text-accent-300">
                {formatLitres(waterPlan.totalL)}
              </span>
            </div>

            {waterLines.map((line) => (
              <div
                key={line.label}
                className="flex items-baseline justify-between gap-4 border-t border-anthracite-800 py-1.5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12px] text-zinc-100">{line.label}</span>
                  <span className="truncate text-[10px] text-zinc-500">{line.hint}</span>
                </span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-zinc-300">
                  {line.value}
                </span>
              </div>
            ))}

            <p className="border-t border-anthracite-800 pt-1.5 text-[10px] text-zinc-500">
              {waterFootnote(waterPlan)}
            </p>
          </div>
        )}

        {/* Les appareils viennent de la vue Devices : la recette n'en garde que la
            référence et un libellé lisible, recopié à la liaison. */}
        <div className="mt-3 shrink-0 rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-3">
          <div className="flex items-baseline justify-between gap-4 border-b border-anthracite-800 pb-1.5">
            <span className="text-[10px] text-zinc-500">
              Sondes et prises · {devices.length}
            </span>
            <span className="text-[10px] text-zinc-500">Entité Home Assistant</span>
          </div>

          {devices.length === 0 ? (
            <p className="py-2 text-[11px] text-zinc-500">
              Aucun appareil lié. « Modifier » en relie, parmi ceux de la vue Devices.
            </p>
          ) : (
            devices.map((device) => (
              <div
                key={device.entityId}
                className="flex items-baseline justify-between gap-4 border-b border-anthracite-800 py-1.5 last:border-b-0"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 rounded-full bg-anthracite-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {roleLabel(device)}
                  </span>
                  <span className="min-w-0 truncate text-[12px] text-zinc-100">
                    {device.label}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                  {device.entityId}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
