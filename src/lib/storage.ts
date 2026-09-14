/**
 * Stockage local versionné.
 *
 * Recettes et productions se rangent de la même façon : une enveloppe
 * `{ version, <champ>: [...] }` dans `localStorage`. Ce fichier ne connaît ni les
 * recettes ni les productions — il ne fait que porter les deux règles communes :
 * **relire de façon défensive** (une entrée cassée est écartée une à une, elle ne
 * vide pas le magasin) et **ne jamais faire échouer une écriture refusée** (quota
 * dépassé, navigation privée) : l'application continue en mémoire.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Liste relue. `parse` renvoie `null` pour une entrée inexploitable ; elle est alors
 * ignorée. Un magasin absent ou illisible rend le repli (`fallback`), un magasin
 * présent mais vide rend une liste vide — la nuance compte : des recettes
 * d'exemple ne doivent pas ressusciter après qu'on les a supprimées.
 */
export function readStoredList<T>(
  key: string,
  field: string,
  parse: (entry: unknown) => T | null,
  fallback: () => T[],
): T[] {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback();
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return fallback();
    const list = parsed[field];
    if (!Array.isArray(list)) return [];
    const items: T[] = [];
    for (const entry of list) {
      const item = parse(entry);
      if (item !== null) items.push(item);
    }
    return items;
  } catch {
    return fallback();
  }
}

/** Enveloppe versionnée. Une écriture refusée laisse le magasin en mémoire. */
export function writeStoredList(
  key: string,
  field: string,
  version: number,
  items: readonly unknown[],
): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ version, [field]: items }));
  } catch {
    // Quota dépassé ou stockage refusé : la session continue.
  }
}
