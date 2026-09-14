import { KIND_LABELS } from '../config/fermentations';
import { describeRecipe, describeTotals, formatQuantityWithUnit, totalsOf } from '../lib/recipes';
import type { Recipe } from '../types';

/** Nombre d'ingrédients montrés sur la carte ; les autres sont comptés. */
const PREVIEW_ROWS = 3;

export interface RecipeCardProps {
  readonly recipe: Recipe;
  readonly onOpen: (id: string) => void;
}

/**
 * Carte de recette dans la bibliothèque. Même langage que `FermentationCard` :
 * titre, pastille de type, chevron, lignes de détail — sauf qu'ici les lignes
 * sont les premiers ingrédients et non des relevés.
 */
export function RecipeCard({ recipe, onOpen }: RecipeCardProps) {
  const ingredients = recipe.ingredients;
  const count = ingredients.length;
  const preview = ingredients.slice(0, PREVIEW_ROWS);
  const rest = count - preview.length;
  const totals = describeTotals(totalsOf(ingredients));

  const ariaLabel =
    `${recipe.name}, ${KIND_LABELS[recipe.kind]}, ${describeRecipe(recipe)}` +
    (totals === '' ? '' : `, total ${totals}`);

  return (
    <button
      type="button"
      onClick={() => onOpen(recipe.id)}
      aria-label={ariaLabel}
      className="group flex h-full min-h-0 flex-col gap-1.5 rounded-xl border border-anthracite-800 bg-anthracite-900 px-3.5 py-3 text-left transition-colors hover:border-accent-500/50 hover:bg-anthracite-850 focus-visible:border-accent-400 focus-visible:outline-none"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-semibold text-zinc-100">
          {recipe.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-anthracite-800 px-2 py-0.5 text-[10px] text-zinc-400">
            {KIND_LABELS[recipe.kind]}
          </span>
          <span
            aria-hidden="true"
            className="text-zinc-600 transition-colors group-hover:text-accent-400"
          >
            ›
          </span>
        </span>
      </span>

      <span className="text-[10px] text-zinc-500">
        {describeRecipe(recipe)}
      </span>

      <span className="flex flex-col">
        {preview.map((ingredient) => (
          <span
            key={ingredient.id}
            className="flex items-baseline justify-between gap-3 py-0.5"
          >
            <span className="min-w-0 truncate text-[11px] text-zinc-400">
              {ingredient.name}
            </span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-zinc-300">
              {formatQuantityWithUnit(ingredient.quantity, ingredient.unit)}
            </span>
          </span>
        ))}

        {rest > 0 ? (
          <span className="py-0.5 text-[11px] text-zinc-500">
            + {rest} {rest > 1 ? 'autres' : 'autre'}
          </span>
        ) : null}

        {count === 0 ? (
          <span className="py-0.5 text-[11px] text-zinc-500">aucun ingrédient</span>
        ) : null}
      </span>
    </button>
  );
}
