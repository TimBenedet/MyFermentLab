import type { GravityDataPoint } from '../types/brewing'

export interface GravitySimConfig {
  og: number
  fg: number
  fermentationDays: number
}

/**
 * Simulate gravity at a given elapsed time using bi-phase exponential decay.
 * Phase 1 (days 0-3): rapid fermentation, ~65% attenuation
 * Phase 2 (days 3+): slow tail-end attenuation
 */
export function simulateGravity(
  config: GravitySimConfig,
  elapsedSeconds: number
): number {
  const daysFraction = elapsedSeconds / 86400
  const totalDrop = config.og - config.fg

  const k1 = 0.8   // fast rate
  const k2 = 0.15  // slow rate
  const crossoverDay = 3

  let drop: number
  if (daysFraction <= crossoverDay) {
    drop = totalDrop * 0.65 * (1 - Math.exp(-k1 * daysFraction))
  } else {
    const fastDrop = totalDrop * 0.65 * (1 - Math.exp(-k1 * crossoverDay))
    const remaining = totalDrop - fastDrop
    const slowElapsed = daysFraction - crossoverDay
    drop = fastDrop + remaining * (1 - Math.exp(-k2 * slowElapsed))
  }

  // Hydrometer precision noise ±0.001
  const noise = (Math.random() - 0.5) * 0.002

  return Math.max(config.fg, config.og - drop + noise)
}

/**
 * Create a gravity data point for recording in project history.
 */
export function createGravityDataPoint(
  config: GravitySimConfig,
  elapsedSeconds: number,
  temperature: number
): GravityDataPoint {
  return {
    time: elapsedSeconds,
    gravity: simulateGravity(config, elapsedSeconds),
    temperature,
  }
}
