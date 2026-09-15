import { isRecord } from './storage';
import type { BatchId } from '../types';

/**
 * La page qu'on regardait : la vue ouverte, et l'élément qu'elle détaillait.
 *
 * Recharger l'onglet — F5, ou le bouton du navigateur — ne doit pas ramener à l'accueil
 * alors qu'on lisait une cuve. La page est donc rangée dans `localStorage`, comme le
 * thème : ce n'est pas une **donnée** (recettes, lots, matériel), c'est une préférence
 * d'affichage, et une clé simple suffit — pas d'enveloppe versionnée.
 *
 * Un élément disparu entre-temps n'est pas un problème : `App` retombe déjà proprement
 * sur la vue d'ensemble quand l'identifiant ne correspond plus à rien, et la relecture
 * n'a donc rien à valider de plus que la forme du magasin.
 */

/** Les trois vues de la barre latérale. */
export type View = 'home' | 'library' | 'devices';

/** Ce qu'une page retient. `selectedId` est nul quand aucune fiche n'est ouverte. */
export interface PageState {
  readonly view: View;
  readonly selectedId: BatchId | null;
}

const STORAGE_KEY = 'fermentation4.page';

/** La page du premier lancement : l'accueil, rien d'ouvert. */
const HOME: PageState = { view: 'home', selectedId: null };

function isView(value: unknown): value is View {
  return value === 'home' || value === 'library' || value === 'devices';
}

/** Page relue. Jamais écrite ou illisible : l'accueil, comme au premier lancement. */
export function readStoredPage(): PageState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return HOME;
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed) || !isView(parsed.view)) return HOME;
    const { selectedId } = parsed;
    return {
      view: parsed.view,
      selectedId: typeof selectedId === 'string' && selectedId !== '' ? selectedId : null,
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
