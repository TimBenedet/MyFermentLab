import { FERMENTATION_BY_KIND } from '../config/fermentations';
import type { HeatCommand, HeatLot } from './control';
import { SETPOINT_MAX, SETPOINT_MIN } from './control';
import { formatClock, formatElapsed } from './format';
import {
  displayName,
  numericState,
  OUTLETS_FAMILY_KEY,
  TEMPERATURE_FAMILY_KEY,
  trackedFamilyOf,
} from './homeassistant';
import type { HassEntity } from './homeassistant';
import { samplesOf } from './probeLog';
import type { ProbeSample } from './probeLog';
import { hashSeed } from './random';
import { createId, isFermentKind, sanitizeDevices } from './recipes';
import { isRecord, readStoredList, writeStoredList } from './storage';
import type {
  FermentConfig,
  FermentReading,
  Production,
  Recipe,
  RecipeDevice,
  Sample,
} from '../types';

/**
 * Productions : le pont entre la bibliothèque, le moteur de simulation et les sondes
 * réelles.
 *
 * Une recette ne porte pas de consigne — elle porte des ingrédients. Un lot lancé
 * hérite donc du **ferment de référence de son type** (`FERMENTATION_BY_KIND`) :
 * même consigne, même dynamique, même contenant. Ce qui lui est propre, c'est sa
 * graine — deux lots du même type ne tracent pas la même courbe — et sa gravité,
 * qui repart de l'origine puisque le lot démarre maintenant.
 *
 * La **température**, elle, ne se simule que faute de mieux : si la recette a lié une
 * sonde de température et que Home Assistant la donne, c'est sa mesure qui s'affiche
 * (voir `liveReading`) et qui pilote les prises liées (voir `lib/control.ts`). Le
 * reste du relevé — humidité, densité — reste simulé.
 */

const STORAGE_KEY = 'fermentation4.productions';
const STORE_FIELD = 'productions';
/** v2 : `devices` remplace `probes` — un lot peut commander des prises. */
const STORE_VERSION = 2;

/** Configuration de simulation d'un lot : la référence de son type, réidentifiée. */
export function configForProduction(production: Production): FermentConfig {
  const reference = FERMENTATION_BY_KIND[production.kind];
  return {
    id: production.id,
    kind: production.kind,
    name: production.recipeName,
    context: `Production · lancée à ${formatClock(production.startedAt)}`,
    // La consigne suit d'abord la recette ; sans consigne de recette, celle du type.
    setpoints: {
      ...reference.setpoints,
      temperature: production.setpoint ?? reference.setpoints.temperature,
    },
    dynamics: reference.dynamics,
    // `elapsedHours` de la référence décrit la cuve du tableau de bord, déjà lancée :
    // un lot qui démarre repart de la densité d'origine.
    gravity: reference.gravity === null ? null : { ...reference.gravity, elapsedHours: 0 },
    vessel: reference.vessel,
    seed: hashSeed(production.id),
  };
}

/** Un lot lancé depuis une recette : nom, type et appareils sont recopiés à l'instant T. */
export function createProduction(recipe: Recipe, startedAt: number): Production {
  return {
    id: createId('batch'),
    recipeId: recipe.id,
    recipeName: recipe.name,
    kind: recipe.kind,
    startedAt,
    setpoint: recipe.setpoint ?? null,
    devices: recipe.devices.map((device) => ({ ...device })),
  };
}

/**
 * Le lot en cours d'une recette, ou `null`. Une recette ne produit qu'un lot à la
 * fois : « lancer » sur une recette déjà en production se lirait comme un doublon.
 */
export function productionOf(
  productions: readonly Production[],
  recipeId: string,
): Production | null {
  return productions.find((production) => production.recipeId === recipeId) ?? null;
}

function sanitizeProduction(raw: unknown): Production | null {
  if (!isRecord(raw)) return null;
  const { id, recipeId, recipeName, kind, startedAt, devices, probes, setpoint } = raw;
  if (typeof recipeName !== 'string' || recipeName.trim() === '') return null;
  if (!isFermentKind(kind)) return null;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null;
  const keptSetpoint =
    typeof setpoint === 'number' &&
    Number.isFinite(setpoint) &&
    setpoint >= SETPOINT_MIN
      ? Math.min(setpoint, SETPOINT_MAX)
      : null;
  return {
    id: typeof id === 'string' && id !== '' ? id : createId('batch'),
    recipeId: typeof recipeId === 'string' ? recipeId : '',
    recipeName: recipeName.trim(),
    kind,
    startedAt,
    setpoint: keptSetpoint,
    // `probes` : nom du champ jusqu'en v2 du magasin de productions.
    devices: sanitizeDevices(devices ?? probes),
  };
}

/** Lots en production. Sans stockage (premier lancement), il n'y en a aucun. */
export function readProductions(): Production[] {
  return readStoredList(STORAGE_KEY, STORE_FIELD, sanitizeProduction, () => []);
}

export function writeProductions(productions: readonly Production[]): void {
  writeStoredList(STORAGE_KEY, STORE_FIELD, STORE_VERSION, productions);
}

/**
 * Sonde de température d'un lot : la **première** liée, dans l'ordre du choix de la
 * recette. C'est elle qui porte la température affichée **et** qui décide de
 * l'asservissement — une seule mesure fait autorité. Les autres sondes du lot sont
 * liées mais aucun canal ne les exploite encore.
 */
export function temperatureProbeOf(production: Production): RecipeDevice | null {
  return (
    production.devices.find(
      (device) => trackedFamilyOf(device.entityId)?.key === TEMPERATURE_FAMILY_KEY,
    ) ?? null
  );
}

/** Prises d'un lot : celles qu'il allume et éteint, dans l'ordre du choix. */
export function outletsOf(production: Production): RecipeDevice[] {
  return production.devices.filter(
    (device) => trackedFamilyOf(device.entityId)?.key === OUTLETS_FAMILY_KEY,
  );
}

/** Entité correspondant à un appareil, ou `null` si Home Assistant ne le connaît plus. */
function entityOf(entities: readonly HassEntity[], entityId: string): HassEntity | null {
  return entities.find((candidate) => candidate.entity_id === entityId) ?? null;
}

/**
 * Mesure de la sonde de température d'un lot, ou `null` quand elle ne répond pas.
 * C'est **la** valeur de commande : jamais la température simulée, qui n'existe que
 * pour l'affichage faute de mieux.
 */
export function probeTemperatureOf(
  production: Production,
  entities: readonly HassEntity[],
): number | null {
  const probe = temperatureProbeOf(production);
  if (probe === null) return null;
  const entity = entityOf(entities, probe.entityId);
  return entity === null ? null : numericState(entity);
}

/**
 * Ce que l'asservissement commande, dit en trois mots.
 * Le diagnostic de la sonde est déjà porté par la partie « sonde » de la ligne : ici
 * on ne dit que le **geste** — chauffer, laisser au repos, ou couper faute de mesure.
 */
function describeHeat(outlets: number, temperature: number | null, command: HeatCommand): string {
  const plural = outlets > 1 ? 'prises' : 'prise';
  if (temperature === null) return `${outlets} ${plural} coupée${outlets > 1 ? 's' : ''}`;
  return command === 'heat' ? `chauffe ${outlets} ${plural}` : `${outlets} ${plural} au repos`;
}

/**
 * Fusionne les mesures réelles de la sonde sur la grille simulée : la température
 * vient du journal réel, l'humidité et la densité — que la sonde ne mesure pas —
 * sont reprises du point simulé le plus proche dans le temps. Les deux chronologies
 * ne se touchent pas (archivage de 30 s d'un côté, ticks de 2 s de l'autre), d'où ce
 * plus proche voisin à deux curseurs, linéaire.
 */
function mergeRealHistory(simulated: readonly Sample[], log: readonly ProbeSample[]): Sample[] {
  if (simulated.length === 0) {
    return log.map((real) => ({
      t: real.t,
      temperature: real.temperature,
      humidity: null,
      density: null,
    }));
  }
  const result: Sample[] = [];
  let cursor = 0;
  for (const real of log) {
    while (
      cursor + 1 < simulated.length &&
      Math.abs(simulated[cursor + 1].t - real.t) <= Math.abs(simulated[cursor].t - real.t)
    ) {
      cursor += 1;
    }
    const nearest = simulated[cursor];
    result.push({
      t: real.t,
      temperature: real.temperature,
      humidity: nearest.humidity,
      density: nearest.density,
    });
  }
  return result;
}

/**
 * Relevé d'un lot tel qu'il doit s'afficher : la température de la sonde liée quand
 * elle répond, la température simulée sinon. Le contexte dit **toujours** d'où vient
 * le chiffre, et ce que l'asservissement commande — une mesure réelle, une mesure
 * simulée et une chaufferie ne doivent pas se ressembler.
 *
 * L'historique suit la sonde : quand un journal réel existe (`probeLog`), la courbe
 * de température est celle des mesures enregistrées, plus la valeur courante — la
 * simulation ne fournit alors que l'humidité et la densité, par plus proche voisin.
 */
export function liveReading(
  reading: FermentReading,
  production: Production,
  entities: readonly HassEntity[],
  now: number,
  heat: HeatLot | null = null,
  probeLog: ReadonlyMap<string, readonly ProbeSample[]> = new Map(),
): FermentReading {
  const age = `Production · depuis ${formatElapsed(now - production.startedAt)}`;
  const probe = temperatureProbeOf(production);
  const entity = probe === null ? null : entityOf(entities, probe.entityId);
  const value = entity === null ? null : numericState(entity);
  // Le libellé stocké date du lancement : la sonde a pu être renommée depuis.
  const label = entity === null ? (probe?.label ?? '') : displayName(entity);

  const parts = [age];
  if (probe !== null) parts.push(value === null ? `sonde ${label} muette` : `sonde ${label}`);
  if (heat !== null) parts.push(describeHeat(heat.outlets, value, heat.command));
  // Une sonde muette fait tomber la température sur la simulation : on le dit, même
  // sans chaufferie à piloter.
  if (probe !== null && value === null && heat === null) parts.push('température simulée');

  const config: FermentConfig = { ...reading.config, context: parts.join(' · ') };
  if (value === null) return { ...reading, config };

  const current: Sample = { ...reading.current, temperature: value };
  const log = samplesOf(probeLog, production.id);
  const base = log.length === 0 ? reading.history : mergeRealHistory(reading.history, log);
  // La mesure courante est le dernier point de la courbe : on la soude à l'archive au
  // lieu d'empiler un doublon au même instant.
  const last = base[base.length - 1];
  const history =
    last !== undefined && last.t === current.t
      ? [...base.slice(0, -1), current]
      : [...base, current];

  return { config, current, history };
}
