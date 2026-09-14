import { formatCompact } from './format';
import { isRecord, readStoredRecord, writeStoredRecord } from './storage';
import { MAX_ABSORPTION_L_PER_KG, MAX_BOIL_OFF_L_PER_H, MAX_KETTLE_LOSS_L } from './water';
import type { EquipmentProfile } from '../types';

/**
 * Matériel : la cuve, décrite une fois.
 *
 * Trois nombres suffisent à décrire une cuve — ce qu'elle évapore, ce qu'elle laisse
 * au fond, ce que le grain retient — et aucun ne dépend de la bière qu'on y brasse.
 * Ils sont donc rangés **ici** plutôt que recopiés dans chaque recette : corriger un
 * chiffre le corrige partout, et changer de cuve n'oblige pas à reprendre la
 * bibliothèque entière.
 *
 * Ce qui reste dans la recette est ce qui lui appartient : le **volume visé** et la
 * **durée d'ébullition**. Le reste se déduit de la cuve au moment du calcul — voir
 * `lib/water.ts`, qui ne connaît que des nombres et ne sait pas d'où ils viennent.
 */

const STORAGE_KEY = 'fermentation4.equipment';
const STORE_FIELD = 'equipment';
const STORE_VERSION = 1;

/**
 * La cuve de départ, telle qu'on la décrit avant de l'avoir mesurée : une cuve de
 * 25 L qui évapore 2,25 L/h, un litre laissé au fond, un sac qu'on presse. Le nom ne
 * promet rien — ces trois chiffres sont des points de départ, et les tests du
 * formulaire sont faits pour les corriger.
 */
export const DEFAULT_EQUIPMENT: EquipmentProfile = {
  id: 'default',
  name: 'Ma cuve',
  boilOffLPerH: 2.25,
  kettleLossL: 1,
  absorptionLPerKg: 0.5,
};

/** Un réglage relu : absent, illisible ou négatif ⇒ la valeur de repli. */
function readSetting(raw: unknown, fallback: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fallback;
  return Math.round(Math.min(raw, max) * 100) / 100;
}

/**
 * Une cuve relue : un nom non vide, trois nombres finis et bornés. Un réglage
 * illisible retombe sur sa valeur par défaut plutôt que de décrire une cuve qui
 * évaporerait `undefined` litre par heure — le calcul doit toujours pouvoir se faire.
 */
export function sanitizeEquipment(raw: unknown): EquipmentProfile | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : DEFAULT_EQUIPMENT.id,
    name: raw.name.trim(),
    boilOffLPerH: readSetting(
      raw.boilOffLPerH,
      DEFAULT_EQUIPMENT.boilOffLPerH,
      MAX_BOIL_OFF_L_PER_H,
    ),
    kettleLossL: readSetting(raw.kettleLossL, DEFAULT_EQUIPMENT.kettleLossL, MAX_KETTLE_LOSS_L),
    absorptionLPerKg: readSetting(
      raw.absorptionLPerKg,
      DEFAULT_EQUIPMENT.absorptionLPerKg,
      MAX_ABSORPTION_L_PER_KG,
    ),
  };
}

/** La cuve enregistrée, ou celle par défaut au premier lancement. */
export function readEquipment(): EquipmentProfile {
  return readStoredRecord(STORAGE_KEY, STORE_FIELD, sanitizeEquipment, () => ({
    ...DEFAULT_EQUIPMENT,
  }));
}

/** Enregistre la cuve. Une écriture refusée laisse la session continuer. */
export function writeEquipment(equipment: EquipmentProfile): void {
  writeStoredRecord(STORAGE_KEY, STORE_FIELD, STORE_VERSION, equipment);
}

/** « 2,25 L/h · 0,4 L au fond · 0,5 L/kg retenus » — la cuve en une ligne. */
export function describeEquipment(equipment: EquipmentProfile): string {
  return `${formatCompact(equipment.boilOffLPerH)} L/h · ${formatCompact(equipment.kettleLossL)} L au fond · ${formatCompact(equipment.absorptionLPerKg)} L/kg retenus`;
}
