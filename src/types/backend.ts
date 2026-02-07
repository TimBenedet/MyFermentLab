export interface BackendDevice {
  id: string
  name: string
  type: 'sensor' | 'outlet' | 'humidity_sensor'
  ip?: string
  entityId?: string
}

export interface BackendProject {
  id: string
  name: string
  fermentationType: string
  sensorId: string | null
  outletId: string | null
  targetTemperature: number
  currentTemperature: number
  outletActive: boolean
  controlMode: string
  archived: boolean
  createdAt?: number
  humiditySensorId?: string | null
  targetHumidity?: number | null
  currentHumidity?: number | null
}

export interface AuthResponse {
  token: string
  role: 'admin' | 'viewer'
}

export interface HistoryPoint {
  time: string
  value: number
}
