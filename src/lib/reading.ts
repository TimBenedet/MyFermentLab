import { tracksGravity } from '../config/fermentations';
import { HISTORY_STEP_MS, HISTORY_WINDOW_MS } from '../simulation/engine';
import type { FermentReading, Sample, StatusLevel } from '../types';
import {
  ALARM_THRESHOLD,
  classify,
  HUMIDITY_ALARM_THRESHOLD,
  HUMIDITY_NOMINAL_BAND,
  NOMINAL_BAND,
} from './status';

/**
 * Durée minimale d'une fenêtre de tracé. Un lot qui vient d'être lancé n'a pas de
 * largeur à montrer : sans ce plancher, sa courbe serait un point unique collé au bord.
 */
export const MIN_WINDOW_MS = 15 * 60_000;

/**
 * Début de la fenêtre réellement traçable : les 24 h glissantes, ou l'âge de
 * l'historique s'il est plus court.
 *
 * Un lot lancé depuis 48 min n'a pas 24 h à montrer. Sans ce recadrage, sa courbe
 * occupait 3 % de la largeur, contre le bord droit : un trait d'un pixel, qu'on
 * prenait pour un graphe vide. Les ferments du tableau de bord, préchauffés sur 24 h,
 * ne changent pas d'un pixel.
 */
export function windowStartOf(history: readonly Sample[], windowEnd: number): number {
  const first = history.length === 0 ? windowEnd : history[0].t;
  return Math.max(windowEnd - HISTORY_WINDOW_MS, Math.min(first, windowEnd - MIN_WINDOW_MS));
}

/**
 * L'historique couvre-t-il les 24 h glissantes ? Sinon, la page doit dire l'âge réel
 * de la fenêtre plutôt que d'annoncer « 24 h » sur un lot de trois quarts d'heure.
 * La tolérance d'un pas d'archivage absorbe le glissement dû à la purge.
 */
export function coversFullWindow(history: readonly Sample[], windowEnd: number): boolean {
  const first = history[0]?.t;
  return first === undefined || windowEnd - first >= HISTORY_WINDOW_MS - HISTORY_STEP_MS;
}

export interface Assessment {
  readonly temperatureDelta: number;
  readonly temperatureStatus: StatusLevel;
  readonly humidityDelta: number | null;
  readonly humidityStatus: StatusLevel | null;
  readonly density: number | null;
  readonly attenuation: number | null;
}

const HUNDRED = 100;

/** Écarts, états et atténuation d'un ferment, à partir de sa lecture courante. */
export function assess(reading: FermentReading): Assessment {
  const { config, current } = reading;

  const temperatureDelta = current.temperature - config.setpoints.temperature;
  const temperatureStatus = classify(temperatureDelta, NOMINAL_BAND, ALARM_THRESHOLD);

  const humiditySetpoint = config.setpoints.humidity;
  const humidityDelta =
    humiditySetpoint === null || current.humidity === null ? null : current.humidity - humiditySetpoint;
  const humidityStatus =
    humidityDelta === null
      ? null
      : classify(humidityDelta, HUMIDITY_NOMINAL_BAND, HUMIDITY_ALARM_THRESHOLD);

  const gravity = config.gravity;
  // Le type décide : hors des types qui portent la densité, la mesure est ignorée.
  const density = tracksGravity(config.kind) ? current.density : null;
  const spread = gravity === null ? 0 : gravity.original - gravity.final;
  const attenuation =
    gravity === null || density === null || spread === 0
      ? null
      : ((gravity.original - density) / spread) * HUNDRED;

  return { temperatureDelta, temperatureStatus, humidityDelta, humidityStatus, density, attenuation };
}

const SEVERITY: Record<StatusLevel, number> = { ok: 0, warn: 1, alarm: 2 };

/**
 * État de synthèse d'un ferment : le plus sévère des canaux instrumentés.
 * L'humidité compte donc autant que la température sur le tableau de bord.
 */
export function worstStatus(assessment: Assessment): StatusLevel {
  const humidity = assessment.humidityStatus;
  if (humidity === null) return assessment.temperatureStatus;
  return SEVERITY[humidity] > SEVERITY[assessment.temperatureStatus]
    ? humidity
    : assessment.temperatureStatus;
}
