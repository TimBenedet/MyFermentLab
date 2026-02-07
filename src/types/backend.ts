export interface BackendDevice {
  id: number
  name: string
  type: 'sensor' | 'outlet'
  ip?: string
  entity_id?: string
}

export interface BackendProject {
  id: number
  name: string
  fermentation_type: string
  sensor_id: number | null
  outlet_id: number | null
  target_temperature: number
  current_temperature: number
  outlet_active: boolean
  control_mode: string
  archived: boolean
  brewing_session?: string | null
  recipe?: string | null
  humidity_sensor_id?: number | null
  target_humidity?: number | null
  current_humidity?: number | null
  mushroom_type?: string | null
}

export interface AuthResponse {
  token: string
  role: 'admin' | 'viewer'
}

export interface HistoryPoint {
  time: string
  value: number
}
