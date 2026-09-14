import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FERMENT_KINDS, KIND_LABELS } from '../config/fermentations';
import { useHomeAssistantEntities } from '../hooks/useHomeAssistantEntities';
import type { ProductionStore } from '../hooks/useProductions';
import { useRecipes } from '../hooks/useRecipes';
import { productionOf } from '../lib/production';
import type { FermentKind, Recipe } from '../types';
import { RecipeCard } from './RecipeCard';
import { RecipeDetail } from './RecipeDetail';
import { RecipeForm } from './RecipeForm';

/**
 * Écran courant de la bibliothèque. Trois écrans, jamais deux à la fois :
 * `list` est le panneau d'entrée, `new` la page de création, `view` / `edit`
 * la page d'une recette — consultée ou modifiée.
 */
type Screen =
  | { readonly mode: 'list' }
  | { readonly mode: 'new' }
  | { readonly mode: 'view'; readonly id: string }
  | { readonly mode: 'edit'; readonly id: string };

/** Filtre du panneau : tous les types, un seul, ou les recettes archivées. */
type KindFilter = FermentKind | 'all' | 'archived';

/**
 * Tous les types sont proposés, dans l'ordre de `FERMENT_KINDS`, `Toutes` en tête et
 * `Archivée` en queue. Masquer un type vide ferait sauter la rangée de filtres dès
 * qu'on supprime la dernière recette d'un type ; mieux vaut un compte à zéro, qui se
 * voit. La rangée passe à la ligne toute seule quand les types s'ajoutent.
 */
const FILTERS: readonly { readonly value: KindFilter; readonly label: string }[] = [
  { value: 'all', label: 'Toutes' },
  ...FERMENT_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] })),
  { value: 'archived', label: 'Archivée' },
];

/** Libellé d'un filtre : les jetons sont la seule source, on ne le redéduit pas. */
function labelOf(value: KindFilter): string {
  return FILTERS.find((entry) => entry.value === value)?.label ?? 'Toutes';
}

interface EmptyPanelProps {
  readonly title: string;
  readonly hint: string;
  readonly children: ReactNode;
}

/** Panneau d'état vide : même cadre, même centrage — seul le propos change. */
function EmptyPanel({ title, hint, children }: EmptyPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-anthracite-800 bg-anthracite-900 px-4 py-6 text-center">
      <p className="text-[13px] text-zinc-300">{title}</p>
      <p className="max-w-md text-[11px] text-zinc-500">{hint}</p>
      {children}
    </div>
  );
}

const NEW_BUTTON =
  'shrink-0 rounded-lg border border-accent-500/50 bg-accent-500/15 px-3 py-1.5 text-[11px] font-medium text-accent-300 transition-colors hover:border-accent-400 hover:bg-accent-500/25 focus-visible:border-accent-400 focus-visible:outline-none';

const SECONDARY_BUTTON =
  'shrink-0 rounded-lg border border-anthracite-700 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none';

/** Jetons de filtre : deux branches littérales, Tailwind doit les voir écrites. */
const FILTER_ACTIVE =
  'flex items-center rounded-lg border border-accent-500/50 bg-accent-500/15 px-2.5 py-1.5 text-[11px] font-medium text-accent-300 transition-colors focus-visible:border-accent-400 focus-visible:outline-none';

const FILTER_IDLE =
  'flex items-center rounded-lg border border-anthracite-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none';

export interface LibraryViewProps {
  /**
   * Magasin des lots en production. Il vit dans `App` et non ici : c'est `App` qui
   * alimente le moteur de simulation. Deux `useProductions()` côte à côte
   * donneraient deux états — lancer un lot depuis la bibliothèque ne le montrerait
   * jamais sur l'accueil.
   */
  readonly productionStore: ProductionStore;
}

/**
 * Bibliothèque de recettes.
 *
 * Cliquer sur l'onglet ouvre le panneau des recettes ; « Nouvelle recette » ouvre
 * la page de création ; cliquer une carte ouvre la recette en détail, d'où on la
 * modifie, on la lance en production ou on l'archive. La bibliothèque ne s'affiche
 * donc jamais à moitié : chaque écran occupe la place, comme la vue produit.
 */
export function LibraryView({ productionStore }: LibraryViewProps) {
  const { recipes, save, remove } = useRecipes();
  const { productions, start, stop, stopRecipe } = productionStore;
  const [screen, setScreen] = useState<Screen>({ mode: 'list' });
  const [filter, setFilter] = useState<KindFilter>('all');

  /*
   * Les sondes qu'une recette peut lier viennent de Home Assistant : la liste n'est
   * lue que pendant qu'un formulaire est ouvert — le panneau des recettes n'en a pas
   * besoin. `App` lit la même liste pour la vue Devices, mais les deux vues sont
   * exclusives : un seul appel est en vol à la fois.
   */
  const formOpen = screen.mode === 'new' || screen.mode === 'edit';
  const { entities, error: entitiesError } = useHomeAssistantEntities(formOpen);

  const active = useMemo(() => recipes.filter((recipe) => !recipe.archived), [recipes]);
  const archived = useMemo(() => recipes.filter((recipe) => recipe.archived), [recipes]);

  // Somme indexée par type : le littéral est exhaustif, ajouter un type sans lui
  // donner de compteur ne compile pas.
  const counts = useMemo(() => {
    const tally: Record<FermentKind, number> = {
      beer: 0,
      mead: 0,
      koji: 0,
      miso: 0,
      soy: 0,
      garum: 0,
    };
    for (const recipe of active) tally[recipe.kind] += 1;
    return tally;
  }, [active]);

  /** Nombre porté par un jeton : trois sources, une seule réponse. */
  const countOf = useCallback(
    (value: KindFilter): number =>
      value === 'all' ? active.length : value === 'archived' ? archived.length : counts[value],
    [active.length, archived.length, counts],
  );

  // L'archivage range, il ne supprime pas : les recettes archivées n'apparaissent
  // que sous leur propre jeton, jamais mêlées aux actives.
  const visible = useMemo(() => {
    if (filter === 'archived') return archived;
    return filter === 'all' ? active : active.filter((recipe) => recipe.kind === filter);
  }, [active, archived, filter]);

  const showList = useCallback(() => setScreen({ mode: 'list' }), []);
  const showNew = useCallback(() => setScreen({ mode: 'new' }), []);
  const openRecipe = useCallback((id: string) => setScreen({ mode: 'view', id }), []);
  const editRecipe = useCallback((id: string) => setScreen({ mode: 'edit', id }), []);

  const handleSave = useCallback(
    (recipe: Recipe) => {
      save(recipe);
      // Après enregistrement on revient au détail, sur la version enregistrée :
      // le brouillon n'a plus de raison d'être.
      setScreen({ mode: 'view', id: recipe.id });
    },
    [save],
  );

  const handleDelete = useCallback(
    (id: string) => {
      remove(id);
      // Un lot sans recette n'aurait plus rien à montrer : supprimer la recette
      // arrête d'office la production correspondante.
      stopRecipe(id);
      setScreen({ mode: 'list' });
    },
    [remove, stopRecipe],
  );

  /** Archive ou désarchive la recette ouverte, sans quitter sa page. */
  const handleToggleArchive = useCallback(
    (recipe: Recipe) => {
      save({ ...recipe, archived: !recipe.archived });
    },
    [save],
  );

  if (screen.mode === 'new') {
    // La `key` remonte le formulaire : un brouillon neuf, jamais hérité du précédent.
    return (
      <RecipeForm
        key="new"
        recipe={null}
        entities={entities}
        entitiesError={entitiesError}
        onSave={handleSave}
        onClose={showList}
      />
    );
  }

  if (screen.mode === 'view' || screen.mode === 'edit') {
    const opened = recipes.find((recipe) => recipe.id === screen.id) ?? null;
    // Recette disparue (supprimée ailleurs, stockage modifié) : on retombe sur la liste.
    if (opened !== null) {
      return screen.mode === 'edit' ? (
        <RecipeForm
          key={opened.id}
          recipe={opened}
          entities={entities}
          entitiesError={entitiesError}
          onSave={handleSave}
          onClose={showList}
        />
      ) : (
        <RecipeDetail
          recipe={opened}
          onBack={showList}
          onEdit={() => editRecipe(opened.id)}
          onDelete={handleDelete}
          production={productionOf(productions, opened.id)}
          onStart={() => start(opened)}
          onStop={() => {
            const running = productionOf(productions, opened.id);
            if (running !== null) stop(running.id);
          }}
          onToggleArchive={() => handleToggleArchive(opened)}
        />
      );
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-100">Bibliothèque</h2>
          <p className="text-[11px] text-zinc-500">
            {active.length} {active.length > 1 ? 'recettes' : 'recette'} · sondes et prises
            Home Assistant au choix, ingrédients libres · conservées dans le navigateur
            {archived.length === 0
              ? ''
              : ` · ${archived.length} archivée${archived.length > 1 ? 's' : ''}`}
          </p>
        </div>

        <button type="button" onClick={showNew} className={NEW_BUTTON}>
          Nouvelle recette
        </button>
      </div>

      {recipes.length === 0 ? (
        <EmptyPanel
          title="Aucune recette pour l’instant"
          hint="Une recette, c’est un nom, un type de ferment, les sondes et les prises Home Assistant à lui lier et autant d’ingrédients que tu veux, chacun avec le poids et l’unité de ton choix."
        >
          <button type="button" onClick={showNew} className={NEW_BUTTON}>
            Nouvelle recette
          </button>
        </EmptyPanel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrer par type de ferment">
            {FILTERS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => setFilter(entry.value)}
                aria-pressed={filter === entry.value}
                className={filter === entry.value ? FILTER_ACTIVE : FILTER_IDLE}
              >
                {entry.label}
                <span className="ml-1.5 rounded-full bg-anthracite-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
                  {countOf(entry.value)}
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyPanel
              title={filter === 'archived' ? 'Aucune recette archivée' : 'Aucune recette de ce type'}
              hint={`Le filtre « ${labelOf(filter)} » ne retient rien pour l’instant. Les autres recettes sont toujours là.`}
            >
              <button type="button" onClick={() => setFilter('all')} className={SECONDARY_BUTTON}>
                {filter === 'archived' ? 'Revenir aux recettes actives' : 'Voir toutes les recettes'}
              </button>
            </EmptyPanel>
          ) : (
            /* Mêmes colonnes que les cartes de ferments de l'accueil (`xl:grid-cols-5`),
               et `content-start` : sans lui, la rangée unique s'étire à toute la hauteur
               disponible et les cartes deviennent des rectangles de 700 px de haut. */
            <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {visible.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onOpen={openRecipe} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
