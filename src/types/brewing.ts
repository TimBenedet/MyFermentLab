import type { BackendProject } from './backend'

// === Project Types ===
export type ProjectType = 'beer' | 'mead' | 'koji' | 'mushroom'

// === PID Controller ===
export interface PIDState {
  setpoint: number
  processValue: number
  output: number       // 0-100% (maps to relay duty cycle or on/off)
  mode: 'auto' | 'manual' | 'off'
  error: number
  integral: number
  derivative: number
}

// === Fermenter ===
export interface Fermenter {
  id: string
  name: string
  volume: number       // liters
  yeastStrain: string
  og: number
  fg: number
  startDate: number    // timestamp
  temperature: number  // current reading (°C)
  setpoint: number     // target temperature (°C)
  relayOn: boolean     // heating mat relay state
  pid: PIDState
  temperatureHistory: TempDataPoint[]
  level: number        // 0-100% fill level (visual)
  color: string        // wort/beer color hex
  // Humidity support (koji/mushroom only)
  humidity?: number              // current humidity %
  humiditySetpoint?: number      // target humidity %
  humidityRelayOn?: boolean      // humidifier relay state
  humidityPid?: PIDState         // separate PID for humidity
  humidityHistory?: HumidityDataPoint[]
}

export interface HumidityDataPoint {
  time: number         // elapsed seconds
  humidity: number     // % relative humidity
  setpoint: number
  relayOn: boolean
}

export interface TempDataPoint {
  time: number         // elapsed seconds
  temp: number
  setpoint: number
  relayOn: boolean
}

// === Recipe ===
export type IngredientType = 'grain' | 'houblon' | 'levure' | 'eau' | 'autre'

export interface RecipeIngredient {
  id: string
  name: string
  type: IngredientType
  quantity: number
  unit: string         // kg, g, L, pkt, etc.
  addAt: string        // description: "Empâtage", "Ébullition 60min", "Dry hop J5"
}

export interface RecipeStep {
  id: string
  description: string
  day: number          // jour de brassage/fermentation (0 = jour de brassage)
  done: boolean
  durationMinutes?: number   // durée timer pour étapes jour de brassage
  targetTemp?: number        // température cible pour cette étape
}

export interface Recipe {
  id: string           // unique identifier
  projectType: ProjectType
  name: string
  style: string
  batchSize: number    // liters (or kg for koji/mushroom)
  og: number
  fg: number
  abv: number
  ibu: number
  srm: number
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

// === Gravity ===
export interface GravityDataPoint {
  time: number         // elapsed seconds since fermentation start
  gravity: number      // specific gravity (e.g. 1.052)
  temperature: number  // temp at measurement time
}

export type ProjectPhase = 'fermenting' | 'conditioning' | 'complete'

export interface BrewProject {
  id: string
  name: string
  projectType: ProjectType
  recipeId: string
  recipeName: string
  phase: ProjectPhase
  createdAt: number

  // Backend link (live mode)
  backendProjectId?: string
  sensorId?: string | null
  outletId?: string | null
  humiditySensorId?: string | null

  // Fermentation phase
  fermenterId?: string
  fermentationStartedAt?: number

  // Gravity tracking (beer/mead)
  gravityHistory: GravityDataPoint[]
  currentGravity: number

  // Humidity tracking (koji/mushroom)
  humidityHistory?: HumidityDataPoint[]
  currentHumidity?: number
  targetHumidity?: number

  // Recipe snapshot
  og: number
  fg: number
  style: string
  batchSize: number
  srm: number
  abv: number

  // Recipe details
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
}

// === Archive ===
export interface ArchivedProject {
  id: string
  name: string
  projectType: ProjectType
  recipeId: string
  recipeName: string
  createdAt: number
  archivedAt: number

  // Recipe snapshot
  recipeSnapshot: Recipe
  style: string
  batchSize: number
  srm: number

  // Fermentation data
  fermentationStartedAt?: number
  totalFermentationDays: number
  temperatureHistory: TempDataPoint[]

  // Gravity data (beer/mead)
  gravityHistory: GravityDataPoint[]
  og: number
  fg: number
  finalGravity: number
  actualAbv: number

  // Humidity data (koji/mushroom)
  humidityHistory?: HumidityDataPoint[]
  finalHumidity?: number
}

// === Alarms ===
export interface Alarm {
  id: string
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
  message: string
  source: string       // fermenter id or 'system'
  acknowledged: boolean
  active: boolean
}

// === App State ===
export interface AppState {
  fermenters: Fermenter[]
  projects: BrewProject[]
  archivedProjects: ArchivedProject[]
  alarms: Alarm[]
}

// === Actions ===
export type AppAction =
  // Fermenter management
  | { type: 'REMOVE_FERMENTER'; id: string }
  | { type: 'RENAME_FERMENTER'; id: string; name: string }
  // Fermenter controls
  | { type: 'SET_SETPOINT'; fermenterId: string; value: number }
  | { type: 'SET_PID_MODE'; fermenterId: string; mode: 'auto' | 'manual' | 'off' }
  | { type: 'TOGGLE_RELAY'; fermenterId: string }
  // Project lifecycle
  | { type: 'CREATE_PROJECT'; project: BrewProject }
  | { type: 'UPDATE_PROJECT'; projectId: string; updates: Partial<BrewProject> }
  | { type: 'DELETE_PROJECT'; projectId: string }
  | { type: 'ARCHIVE_PROJECT'; projectId: string }
  // Gravity
  | { type: 'ADD_GRAVITY_READING'; projectId: string; gravity: number }
  // Humidity
  | { type: 'SET_HUMIDITY_SETPOINT'; fermenterId: string; value: number }
  | { type: 'SET_HUMIDITY_PID_MODE'; fermenterId: string; mode: 'auto' | 'manual' | 'off' }
  | { type: 'TOGGLE_HUMIDITY_RELAY'; fermenterId: string }
  | { type: 'ADD_HUMIDITY_READING'; projectId: string; humidity: number }
  // Fermentation
  | { type: 'START_FERMENTATION'; recipe: Recipe; projectName: string }
  // Live mode sync
  | { type: 'SYNC_LIVE_DATA'; fermenterId: string; temperature: number; relayOn: boolean; humidity?: number; humidityRelayOn?: boolean }
  | { type: 'IMPORT_BACKEND_PROJECTS'; backendProjects: BackendProject[] }
  // Alarms
  | { type: 'ACK_ALARM'; alarmId: string }
  | { type: 'ACK_ALL_ALARMS' }
