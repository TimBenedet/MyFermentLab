// Gaussian noise generator (Box-Muller transform)
export function gaussianNoise(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Exponential approach to target (thermal inertia model)
export function thermalApproach(
  current: number,
  target: number,
  rate: number,
  dt: number
): number {
  const tau = 1 / rate // time constant
  return target + (current - target) * Math.exp(-dt / tau)
}

// Newton's law of cooling
export function coolingCurve(
  current: number,
  ambient: number,
  coolingCoeff: number,
  dt: number
): number {
  return ambient + (current - ambient) * Math.exp(-coolingCoeff * dt)
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Add realistic sensor noise
export function addSensorNoise(value: number, amplitude: number = 0.15): number {
  return value + gaussianNoise(0, amplitude)
}

// Heating power to temperature rate
// Simulates electric element: more power = faster heating
export function heatingRate(power: number): number {
  // power is 0-100%, returns degrees/second rate factor
  return 0.01 + (power / 100) * 0.08 // 0.01 to 0.09 deg/s
}

// Active cooling rate (heat exchanger)
export function activeCoolingRate(power: number): number {
  return 0.05 + (power / 100) * 0.15
}
