import type { Fermenter, Alarm, AppState } from '../types/brewing'
import { PID_CONFIG, HYSTERESIS, ALARM_THRESHOLDS } from './constants'
import { thermalApproach, addSensorNoise, clamp } from './temperatureProfiles'

let alarmCounter = 0

// === PID Controller ===
function runPID(
  pid: Fermenter['pid'],
  processValue: number,
  dt: number
): Fermenter['pid'] {
  const error = pid.setpoint - processValue
  const integral = clamp(
    pid.integral + PID_CONFIG.Ki * error * dt,
    -PID_CONFIG.integralMax,
    PID_CONFIG.integralMax
  )
  const derivative = PID_CONFIG.Kd * (error - pid.error) / Math.max(dt, 0.01)
  const output = clamp(
    PID_CONFIG.Kp * error + integral + derivative,
    PID_CONFIG.outputMin,
    PID_CONFIG.outputMax
  )

  return {
    ...pid,
    processValue,
    error,
    integral,
    derivative,
    output: pid.mode === 'off' ? 0 : output,
  }
}

// === Relay Hysteresis Logic ===
function shouldRelayBeOn(
  currentTemp: number,
  setpoint: number,
  currentlyOn: boolean,
  pidMode: 'auto' | 'manual' | 'off'
): boolean {
  if (pidMode === 'off') return false
  if (pidMode === 'manual') return currentlyOn

  // Auto mode: hysteresis band
  if (currentlyOn) {
    return currentTemp < setpoint + HYSTERESIS.off
  } else {
    return currentTemp < setpoint + HYSTERESIS.on
  }
}

// === Single Fermenter Simulation Tick ===
export function simulateFermenter(
  fermenter: Fermenter,
  ambientTemp: number,
  dt: number,
  totalElapsed: number
): Fermenter {
  let temp = fermenter.temperature

  // Heating mat effect when relay is ON
  if (fermenter.relayOn) {
    temp += 0.008 * dt // ~0.5°C per minute
  }

  // Natural cooling/warming toward ambient
  temp = thermalApproach(temp, ambientTemp, 0.003, dt)

  // Yeast exotherm: small oscillating heat
  const elapsed = totalElapsed * 0.01
  const exotherm = 0.15 * Math.sin(elapsed * 0.3) + 0.1
  temp += exotherm * 0.001 * dt

  // Sensor noise
  temp = addSensorNoise(temp, 0.08)
  temp = clamp(temp, -5, 50)

  // Run PID
  const newPid = runPID(
    { ...fermenter.pid, setpoint: fermenter.setpoint },
    temp,
    dt
  )

  // Determine relay state (auto mode uses hysteresis)
  const relayOn = shouldRelayBeOn(temp, fermenter.setpoint, fermenter.relayOn, fermenter.pid.mode)

  // Update history (every ~3 sim seconds)
  const history = [...fermenter.temperatureHistory]
  const lastPoint = history[history.length - 1]
  if (!lastPoint || totalElapsed - lastPoint.time > 3) {
    history.push({
      time: totalElapsed,
      temp,
      setpoint: fermenter.setpoint,
      relayOn,
    })
    if (history.length > 500) history.splice(0, history.length - 500)
  }

  // === Humidity simulation (koji / mushroom only) ===
  let humidity = fermenter.humidity
  let humidityRelayOn = fermenter.humidityRelayOn ?? false
  let humidityPid = fermenter.humidityPid
  let humidityHistory = fermenter.humidityHistory ? [...fermenter.humidityHistory] : undefined

  if (humidity !== undefined && humidityPid && humidityHistory) {
    // Humidifier ON → raise humidity
    if (humidityRelayOn) {
      humidity += 0.05 * dt // ~3%/min
    }

    // Natural drying toward ~50% ambient humidity
    humidity = thermalApproach(humidity, 50, 0.002, dt)

    // Small noise
    humidity = addSensorNoise(humidity, 0.3)
    humidity = clamp(humidity, 10, 100)

    // Run PID for humidity
    humidityPid = runPID(
      { ...humidityPid, setpoint: fermenter.humiditySetpoint ?? 85 },
      humidity,
      dt
    )

    // Hysteresis for humidifier relay (±2%)
    const hSetpoint = fermenter.humiditySetpoint ?? 85
    if (humidityPid.mode === 'off') {
      humidityRelayOn = false
    } else if (humidityPid.mode === 'manual') {
      // keep current
    } else {
      // Auto: hysteresis band ±2%
      if (humidityRelayOn) {
        humidityRelayOn = humidity < hSetpoint + 2
      } else {
        humidityRelayOn = humidity < hSetpoint - 2
      }
    }

    // Update humidity history (every ~3 sim seconds)
    const lastHPoint = humidityHistory[humidityHistory.length - 1]
    if (!lastHPoint || totalElapsed - lastHPoint.time > 3) {
      humidityHistory.push({
        time: totalElapsed,
        humidity,
        setpoint: hSetpoint,
        relayOn: humidityRelayOn,
      })
      if (humidityHistory.length > 500) humidityHistory.splice(0, humidityHistory.length - 500)
    }
  }

  return {
    ...fermenter,
    temperature: temp,
    relayOn,
    pid: newPid,
    temperatureHistory: history,
    // Humidity fields (only if active)
    ...(humidity !== undefined && {
      humidity,
      humidityRelayOn,
      humidityPid,
      humidityHistory,
    }),
  }
}

// === Evaluate Alarms for all fermenters ===
export function evaluateAlarms(state: AppState): Alarm[] {
  const alarms = [...state.alarms]
  const now = Date.now()

  for (const fermenter of state.fermenters) {
    const deviation = Math.abs(fermenter.temperature - fermenter.setpoint)
    const alarmKey = `temp_${fermenter.id}`
    const existing = alarms.find(a => a.source === alarmKey && a.active)

    if (deviation > ALARM_THRESHOLDS.tempCritical && !existing) {
      alarms.push({
        id: `alarm_${++alarmCounter}`,
        timestamp: now,
        severity: 'critical',
        message: `${fermenter.name}: ${fermenter.temperature.toFixed(1)}°C (cible: ${fermenter.setpoint}°C)`,
        source: alarmKey,
        acknowledged: false,
        active: true,
      })
    } else if (deviation > ALARM_THRESHOLDS.tempWarning && deviation <= ALARM_THRESHOLDS.tempCritical && !existing) {
      alarms.push({
        id: `alarm_${++alarmCounter}`,
        timestamp: now,
        severity: 'warning',
        message: `${fermenter.name}: ${fermenter.temperature.toFixed(1)}°C (cible: ${fermenter.setpoint}°C)`,
        source: alarmKey,
        acknowledged: false,
        active: true,
      })
    } else if (deviation <= ALARM_THRESHOLDS.tempWarning && existing) {
      existing.active = false
    }

    // Humidity alarms (koji/mushroom)
    if (fermenter.humidity !== undefined && fermenter.humiditySetpoint !== undefined) {
      const hDeviation = Math.abs(fermenter.humidity - fermenter.humiditySetpoint)
      const hAlarmKey = `humidity_${fermenter.id}`
      const hExisting = alarms.find(a => a.source === hAlarmKey && a.active)

      if (hDeviation > 10 && !hExisting) {
        alarms.push({
          id: `alarm_${++alarmCounter}`,
          timestamp: now,
          severity: hDeviation > 15 ? 'critical' : 'warning',
          message: `${fermenter.name}: ${fermenter.humidity.toFixed(0)}% HR (cible: ${fermenter.humiditySetpoint}%)`,
          source: hAlarmKey,
          acknowledged: false,
          active: true,
        })
      } else if (hDeviation <= 8 && hExisting) {
        hExisting.active = false
      }
    }
  }

  return alarms.slice(-50)
}
