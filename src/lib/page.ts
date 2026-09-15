import { isFermentKind } from './recipes';
import { isRecord } from './storage';
import type { BatchId, FermentKind } from '../types';

/**
 * La page qu'on regardait : la vue ouverte, l'élément qu'elle détaillait, et l'écran de
 * la bibliothèque.
 *
 * Recharger l'onglet — F5, ou le bouton du navigateur — ne doit rien refermer : ni la
 * cuve qu'on lisait, ni la recette qu'on venait d'ouvrir. La page est donc rangée dans
 * `localStorage`, comme le thème : ce n'est pas une **donnée** (recettes, lots, matériel),
 * c'est une préférence d'affichage, et une clé simple suffit — pas d'enveloppe versionnée.
 *
 * Un élément disparu entre-temps n'est pas un problème : `App` retombe déjà proprement sur
 * la vue d'ensemble quand l'identifiant ne correspond plus à rien, et `LibraryView` sur la
 * liste des recettes — la relecture n'a donc rien à valider de plus que la forme du
 * magasin.
 */

/** Les trois vues de la barre latérale. */
export type View = 'home' | 'library' | 'devices';

/**
 * Écran de la bibliothèque. Quatre écrans, jamais deux à la fois : `list` est le panneau
 * d'entrée, `new` la page de création, `view` / `edit` la page d'une recette — consultée
 * ou modifiée.
 *
 * Il voyage dans le magasin au même titre que la fiche d'un ferment : c'est le même
 * incident, une recette ouverte qui se referme au rechargement.
 */
export type LibraryScreen =
  | { readonly mode: 'list' }
  | { readonly mode: 'new' }
  | { readonly mode: 'view'; readonly id: string }
  | { readonly mode: 'edit'; readonly id: string };

/** Filtre du panneau : tous les types de ferment, un seul, ou les recettes archivées. */
export type LibraryFilter = FermentKind | 'all' | 'archived';

/** Ce qu'une page retient. `selectedId` est nul quand aucune fiche n'est ouverte. */
export interface PageState {
  readonly view: View;
  readonly selectedId: BatchId | null;
  readonly library: LibraryScreen;
  readonly libraryFilter: LibraryFilter;
}

const STORAGE_KEY = 'fermentation4.page';

/** L'écran que la bibliothèque montre tant qu'on ne lui demande rien d'autre. */
export const LIBRARY_LIST: LibraryScreen = { mode: 'list' };

/** Le filtre du premier lancement : tous les types. */
export const LIBRARY_ALL: LibraryFilter = 'all';

/** La page du premier lancement : l'accueil, rien d'ouvert, la bibliothèque sur sa liste. */
const HOME: PageState = {
  view: 'home',
  selectedId: null,
  library: LIBRARY_LIST,
  libraryFilter: LIBRARY_ALL,
};

function isView(value: unknown): value is View {
  return value === 'home' || value === 'library' || value === 'devices';
}

/**
 * Écran de la bibliothèque relu. `view` et `edit` tiennent leur identifiant du magasin :
 * sans lui, la liste — c'est déjà ce que fait `LibraryView` devant une recette disparue.
 */
function readLibrary(value: unknown): LibraryScreen {
  if (!isRecord(value)) return LIBRARY_LIST;
  const { mode } = value;
  if (mode === 'view' || mode === 'edit') {
    const { id } = value;
    return typeof id === 'string' && id !== '' ? { mode, id } : LIBRARY_LIST;
  }
  return mode === 'new' ? { mode: 'new' } : LIBRARY_LIST;
}

/** Garde de type plutôt que `Set.has` : `has()` ne rétrécit pas une union (voir `lib/recipes.ts`). */
function isLibraryFilter(value: unknown): value is LibraryFilter {
  return value === 'all' || value === 'archived' || isFermentKind(value);
}

/** Page relue. Jamais écrite ou illisible : l'accueil, comme au premier lancement. */
export function readStoredPage(): PageState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return HOME;
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed) || !isView(parsed.view)) return HOME;
    const { selectedId, libraryFilter } = parsed;
    return {
      view: parsed.view,
      selectedId: typeof selectedId === 'string' && selectedId !== '' ? selectedId : null,
      library: readLibrary(parsed.library),
      libraryFilter: isLibraryFilter(libraryFilter) ? libraryFilter : LIBRARY_ALL,
    };
  } catch {
    return HOME;
  }
}

/**
 * Écriture refusée (navigation privée, quota) : la session continue. La page n'est
 * alors plus mémorisée — c'est le seul effet, et il ne vaut pas une erreur à l'écran.
 */
export function writeStoredPage(page: PageState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(page));
  } catch {
    // Rien à faire : la vue en cours reste celle de la session.
  }
}
