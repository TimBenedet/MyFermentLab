import { isRecord, readStoredList, writeStoredList } from './storage';

/**
 * Journal des mesures **réelles** des sondes de température.
 *
 * Le moteur de simulation ne connaît que des courbes simulées ; ce journal-ci est
 * l'inverse : chaque lot suivi par une sonde Home Assistant y dépose la température
 * **mesurée**, point par point, pour que la courbe affichée soit celle de la cuve
 * réelle et non celle qu'invente le moteur.
 *
 * Aucun backend : comme les recettes et les productions, ce journal vit dans
 * `localStorage`. Il est relu de façon défensive — une entrée cassée est écartée,
 * elle ne vide pas le journal.
 */

const STORAGE_KEY = 'fermentation4.probeLog';
const STORE_FIELD = 'batches';
/** v1 : température seule, un point `{ t, temperature }` par relevé. */
const STORE_VERSION = 1;
/** Fenêtre conservée : au-delà de 24 h, le point sort du journal. */
const MAX_AGE_MS = 86_400_000;

/** Un relevé réel : l'instant et la température mesurée. */
export interface ProbeSample {
  readonly t: number;
  readonly temperature: number;
}

export interface ProbeLogEntry {
  readonly batchId: string;
  readonly samples: readonly ProbeSample[];
}

function sanitizeSample(raw: unknown): ProbeSample | null {
  if (!isRecord(raw)) return null;
  const { t, temperature } = raw;
  if (typeof t !== 'number' || !Number.isFinite(t)) return null;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature)) return null;
  return { t, temperature };
}

function sanitizeEntry(raw: unknown): ProbeLogEntry | null {
  if (!isRecord(raw)) return null;
  const { batchId, samples } = raw;
  if (typeof batchId !== 'string' || batchId === '') return null;
  if (!Array.isArray(samples)) return null;
  const kept: ProbeSample[] = [];
  for (const sample of samples) {
    const clean = sanitizeSample(sample);
    if (clean !== null) kept.push(clean);
  }
  return { batchId, samples: kept };
}

/** Journal relu, par identifiant de lot. Premier lancement : journal vide. */
export function readProbeLog(): Map<string, ProbeSample[]> {
  const entries = readStoredList(STORAGE_KEY, STORE_FIELD, sanitizeEntry, () => []);
  const log = new Map<string, ProbeSample[]>();
  for (const entry of entries) log.set(entry.batchId, [...entry.samples]);
  return log;
}

export function writeProbeLog(log: ReadonlyMap<string, readonly ProbeSample[]>): void {
  const entries: ProbeLogEntry[] = [];
  for (const [batchId, samples] of log) entries.push({ batchId, samples: [...samples] });
  writeStoredList(STORAGE_KEY, STORE_FIELD, STORE_VERSION, entries);
}

/** Relevés enregistrés d'un lot, dans l'ordre chronologique. */
export function samplesOf(
  log: ReadonlyMap<string, readonly ProbeSample[]>,
  batchId: string,
): readonly ProbeSample[] {
  return log.get(batchId) ?? [];
}

/** Coupe ce qui sort de la fenêtre de 24 h. */
function prune(samples: readonly ProbeSample[], now: number): ProbeSample[] {
  const cutoff = now - MAX_AGE_MS;
  let index = 0;
  while (index < samples.length && samples[index].t < cutoff) index += 1;
  return index === 0 ? [...samples] : samples.slice(index);
}

/**
 * Seuil sous lequel une variation n'est pas enregistrée : la sonde d'un Sonoff se
 * promène de quelques dixièmes, et un point par battement ferait danser la courbe.
 */
export const MIN_RECORD_DELTA = 0.2;

/**
 * Ajoute un relevé au journal **passé en paramètre** (une copie, côté appelant).
 * Un point qui s'écarte de moins de `MIN_RECORD_DELTA` du précédent n'apprend
 * rien : on ne l'écrit pas — le journal ne grossit que quand la température bouge
 * vraiment, et la courbe ne zigzague pas à chaque relevé bruité.
 */
export function appendProbeSample(
  log: Map<string, ProbeSample[]>,
  batchId: string,
  t: number,
  temperature: number,
): boolean {
  const current = log.get(batchId) ?? [];
  const last = current[current.length - 1];
  if (last !== undefined && Math.abs(temperature - last.temperature) < MIN_RECORD_DELTA) {
    return false;
  }
  // Arrondi au dixième : l'affichage n'a qu'une décimale, le journal non plus.
  const rounded = Math.round(temperature * 10) / 10;
  log.set(batchId, [...prune(current, t), { t, temperature: rounded }]);
  return true;
}

/** Retire le journal d'un lot arrêté. Rend `true` si le journal a changé. */
export function removeProbeLogEntry(
  log: Map<string, ProbeSample[]>,
  batchId: string,
): boolean {
  return log.delete(batchId);
}

/**
 * Retire les lots arrêtés et purge ce qui sort des 24 h. Rend `true` si le journal
 * a changé. `log` est une copie, l'appelant décide de l'écrire.
 */
export function pruneProbeLog(
  log: Map<string, ProbeSample[]>,
  activeIds: ReadonlySet<string>,
  now: number,
): boolean {
  let changed = false;
  for (const id of [...log.keys()]) {
    if (!activeIds.has(id)) {
      log.delete(id);
      changed = true;
    }
  }
  for (const [id, samples] of log) {
    const next = prune(samples, now);
    if (next.length !== samples.length) {
      log.set(id, next);
      changed = true;
    }
  }
  return changed;
}
