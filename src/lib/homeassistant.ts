import { formatMeasure } from './format';

/**
 * Accès en lecture à l'API REST de Home Assistant.
 *
 * La base `/ha` est servie par un proxy du serveur de dev (voir `vite.config.ts`) :
 * le jeton d'accès est injecté côté Node et n'atteint jamais le navigateur.
 */

/** Entité telle que la renvoie `GET /api/states`. */
export interface HassEntity {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_changed: string;
}

const ENDPOINT = '/ha/api/states';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEntity(value: unknown): value is HassEntity {
  if (!isRecord(value)) return false;
  return (
    typeof value.entity_id === 'string' &&
    typeof value.state === 'string' &&
    isRecord(value.attributes) &&
    typeof value.last_changed === 'string'
  );
}

export async function fetchEntities(signal?: AbortSignal): Promise<readonly HassEntity[]> {
  const response = await fetch(ENDPOINT, { signal });
  if (!response.ok) {
    throw new Error(`Home Assistant a répondu ${response.status} ${response.statusText}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Réponse inattendue de Home Assistant : tableau d’entités attendu');
  }
  return payload.filter(isEntity);
}

/** Domaine d'une entité : la partie avant le point. */
export function domainOf(entityId: string): string {
  const index = entityId.indexOf('.');
  return index === -1 ? entityId : entityId.slice(0, index);
}

/** Nom convivial, à défaut l'identifiant brut. */
export function displayName(entity: HassEntity): string {
  const friendly = entity.attributes.friendly_name;
  return typeof friendly === 'string' && friendly.trim() !== '' ? friendly : entity.entity_id;
}

/** Ordre d'affichage : par nom, chiffres compris (« Sonde 2 » avant « Sonde 10 »). */
export function byDisplayName(left: HassEntity, right: HassEntity): number {
  return displayName(left).localeCompare(displayName(right), 'fr', { numeric: true });
}

/** Unité de mesure, si l'entité en déclare une. */
export function unitOf(entity: HassEntity): string | null {
  const unit = entity.attributes.unit_of_measurement;
  return typeof unit === 'string' && unit !== '' ? unit : null;
}

/** Un état numérique simple, sans notation exponentielle ni suffixe. */
const NUMERIC_STATE = /^-?\d+(?:\.\d+)?$/;

/**
 * Mesure d'une entité, ou `null` quand il n'y a rien à lire : « unavailable »,
 * « unknown », un état textuel. Un lot ne doit jamais afficher un chiffre inventé
 * à partir d'une sonde muette.
 */
export function numericState(entity: HassEntity): number | null {
  return NUMERIC_STATE.test(entity.state) ? Number(entity.state) : null;
}

function decimalsFor(state: string): 1 | 2 | 3 {
  const digits = (state.split('.')[1] ?? '').length;
  if (digits <= 1) return 1;
  if (digits === 2) return 2;
  return 3;
}

/** Domaine `switch` : seules ces entités savent s'allumer et s'éteindre. */
export function isControllableSwitch(entity: HassEntity): boolean {
  return domainOf(entity.entity_id) === 'switch';
}

/**
 * Appelle un service Home Assistant. C'est une **écriture réelle** : à ne déclencher
 * que depuis une action explicite de l'utilisateur.
 */
export async function callSwitchService(entityId: string, turnOn: boolean): Promise<void> {
  const service = turnOn ? 'turn_on' : 'turn_off';
  const response = await fetch(`/ha/api/services/switch/${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity_id: entityId }),
  });
  if (!response.ok) {
    throw new Error(
      `Home Assistant a refusé ${service} (${response.status} ${response.statusText})`,
    );
  }
}

/**
 * État d'une entité, remis au format fr-FR quand c'est une mesure numérique :
 * Home Assistant renvoie « 22.8 », l'interface affiche « 22,8 ».
 */
export function formatState(state: string): string {
  if (!NUMERIC_STATE.test(state)) return state;
  return formatMeasure(Number(state), decimalsFor(state));
}

/** Un appareil injoignable est un vrai défaut, pas une décoration : il passe en rouge. */
export function isUnreachable(entity: HassEntity): boolean {
  return entity.state === 'unavailable' || entity.state === 'unknown';
}

/** Icône associée à une famille d'objets suivis. */
export type MetricIconKind = 'temperature' | 'humidity' | 'power';

/** Famille d'objets suivie par le dashboard : libellé, motif sur `entity_id` et icône. */
export interface EntityFamily {
  readonly key: string;
  readonly label: string;
  readonly pattern: string;
  readonly icon: MetricIconKind;
  /**
   * Une sonde **mesure**, une prise **commande**. Seules les sondes peuvent être
   * liées à une recette : lier une prise à une recette n'aurait aucun sens.
   */
  readonly probe: boolean;
}

/**
 * Clé de la famille des sondes de température. Un lot lancé depuis la bibliothèque
 * suit cette famille en priorité : c'est elle qui porte la température affichée et
 * qui décide de l'asservissement des prises.
 */
export const TEMPERATURE_FAMILY_KEY = 'temperature';

/** Clé de la famille des prises : celles qu'un lot allume et éteint. */
export const OUTLETS_FAMILY_KEY = 'outlets';

/**
 * Sélection volontairement restreinte : seules les sondes et les prises qui servent
 * au suivi de fermentation. `*` est un joker sur `entity_id`.
 */
export const TRACKED_FAMILIES: readonly EntityFamily[] = [
  {
    key: TEMPERATURE_FAMILY_KEY,
    label: 'Sondes de température',
    pattern: 'sensor.sonde_sonoff_*_temperature',
    icon: 'temperature',
    probe: true,
  },
  {
    key: 'humidity',
    label: 'Humidité',
    pattern: 'sensor.humidity_*',
    icon: 'humidity',
    probe: true,
  },
  {
    key: OUTLETS_FAMILY_KEY,
    label: 'Prises',
    pattern: 'switch.smart_switch_25021462413795540601c4e7ae132658_outlet_*',
    icon: 'power',
    probe: false,
  },
];

/** Traduit un motif à joker en expression régulière ancrée. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`);
}

const FAMILY_MATCHERS: readonly { readonly family: EntityFamily; readonly matcher: RegExp }[] =
  TRACKED_FAMILIES.map((family) => ({ family, matcher: patternToRegExp(family.pattern) }));

/** Famille à laquelle appartient une entité, ou `null` si elle n'est pas suivie. */
export function trackedFamilyOf(entityId: string): EntityFamily | null {
  for (const entry of FAMILY_MATCHERS) {
    if (entry.matcher.test(entityId)) return entry.family;
  }
  return null;
}

/** Rôle d'un appareil lié : ce qui **mesure**, ou ce qui **commande**. */
export type DeviceRole = 'sensor' | 'outlet';

export const ROLE_LABELS: Readonly<Record<DeviceRole, string>> = {
  sensor: 'Sonde',
  outlet: 'Prise',
};

/** Rôle d'une entité suivie, ou `null` si elle n'appartient à aucune famille suivie. */
export function roleOf(entityId: string): DeviceRole | null {
  const family = trackedFamilyOf(entityId);
  if (family === null) return null;
  return family.probe ? 'sensor' : 'outlet';
}

/**
 * Une entité **liable à une recette** : un objet suivi, sonde ou prise. Une entité
 * hors des familles suivies n'a rien à y faire — elle ne serait ni lue ni commandée.
 */
export function isTrackedEntity(entity: HassEntity): boolean {
  return trackedFamilyOf(entity.entity_id) !== null;
}
