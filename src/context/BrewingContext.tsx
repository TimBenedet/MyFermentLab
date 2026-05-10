import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'
import type { AppState, AppAction, BrewProject, Recipe, ArchivedProject, ProjectType } from '../types/brewing'
import type { BackendProject } from '../types/backend'
import { createFermenterForProject, createProject, generateId } from '../simulation/constants'

function createInitialState(): AppState {
  return {
    fermenters: [],
    projects: [],
    archivedProjects: [],
    alarms: [],
    recipes: [],
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // === Fermenter Management ===
    case 'REMOVE_FERMENTER':
      return { ...state, fermenters: state.fermenters.filter(f => f.id !== action.id) }

    case 'RENAME_FERMENTER':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.id ? { ...f, name: action.name } : f
        ),
      }

    // === Fermenter Controls ===
    case 'SET_SETPOINT':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId
            ? { ...f, setpoint: action.value, pid: { ...f.pid, setpoint: action.value } }
            : f
        ),
      }

    case 'SET_PID_MODE':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId
            ? { ...f, pid: { ...f.pid, mode: action.mode } }
            : f
        ),
      }

    case 'TOGGLE_RELAY':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId ? { ...f, relayOn: !f.relayOn } : f
        ),
      }

    // === Project Lifecycle ===
    case 'CREATE_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.projectId ? { ...p, ...action.updates } : p
        ),
      }

    case 'DELETE_PROJECT': {
      const delProject = state.projects.find(p => p.id === action.projectId)
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.projectId),
        fermenters: delProject?.fermenterId
          ? state.fermenters.filter(f => f.id !== delProject.fermenterId)
          : state.fermenters,
      }
    }

    case 'ARCHIVE_PROJECT': {
      const proj = state.projects.find(p => p.id === action.projectId)
      if (!proj) return state

      const fermenter = proj.fermenterId
        ? state.fermenters.find(f => f.id === proj.fermenterId)
        : undefined

      const fermentationDays = proj.fermentationStartedAt
        ? Math.floor((Date.now() - proj.fermentationStartedAt) / 86400000)
        : 0

      const lastGravity = proj.gravityHistory.length > 0
        ? proj.gravityHistory[proj.gravityHistory.length - 1].gravity
        : proj.currentGravity

      const archived: ArchivedProject = {
        id: proj.id,
        name: proj.name,
        projectType: proj.projectType,
        recipeId: proj.recipeId,
        recipeName: proj.recipeName,
        createdAt: proj.createdAt,
        archivedAt: Date.now(),
        recipeSnapshot: {
          id: proj.recipeId, projectType: proj.projectType, name: proj.recipeName, style: proj.style,
          batchSize: proj.batchSize, og: proj.og, fg: proj.fg,
          abv: proj.abv, ibu: 0, srm: proj.srm, ingredients: proj.ingredients, steps: proj.steps,
        },
        style: proj.style,
        batchSize: proj.batchSize,
        srm: proj.srm,
        fermentationStartedAt: proj.fermentationStartedAt,
        totalFermentationDays: fermentationDays,
        temperatureHistory: action.fullTempHistory ?? fermenter?.temperatureHistory ?? [],
        gravityHistory: action.fullGravityHistory ?? proj.gravityHistory,
        og: proj.og,
        fg: proj.fg,
        finalGravity: lastGravity,
        actualAbv: Math.round((proj.og - lastGravity) * 131.25 * 10) / 10,
        humidityHistory: proj.humidityHistory,
        finalHumidity: fermenter?.humidity,
      }

      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.projectId),
        archivedProjects: [...state.archivedProjects, archived],
        fermenters: proj.fermenterId
          ? state.fermenters.filter(f => f.id !== proj.fermenterId)
          : state.fermenters,
      }
    }

    // === Fermentation ===
    case 'START_FERMENTATION': {
      const project = createProject(action.recipe, action.projectName)
      project.phase = 'fermenting'
      project.fermentationStartedAt = Date.now()

      const fermenter = createFermenterForProject(action.recipe, action.projectName)
      project.fermenterId = fermenter.id

      return {
        ...state,
        projects: [...state.projects, project],
        fermenters: [...state.fermenters, fermenter],
      }
    }

    // === Live Mode Sync ===
    case 'SYNC_LIVE_DATA': {
      return {
        ...state,
        fermenters: state.fermenters.map(f => {
          if (f.id !== action.fermenterId) return f
          const updated = { ...f, temperature: action.temperature, relayOn: action.relayOn }
          if (action.humidity !== undefined) updated.humidity = action.humidity
          if (action.humidityRelayOn !== undefined) updated.humidityRelayOn = action.humidityRelayOn
          if (action.setpoint !== undefined) {
            updated.setpoint = action.setpoint
            if (updated.pid) updated.pid = { ...updated.pid, setpoint: action.setpoint }
          }
          if (action.humiditySetpoint !== undefined) {
            updated.humiditySetpoint = action.humiditySetpoint
            if (updated.humidityPid) updated.humidityPid = { ...updated.humidityPid, setpoint: action.humiditySetpoint }
          }
          if (action.activationThreshold !== undefined) {
            updated.activationThreshold = action.activationThreshold
          }
          // Append to history using real timestamp (seconds since epoch)
          const time = Date.now() / 1000
          // Deduplicate: skip if last point was less than 4s ago
          const lastPoint = f.temperatureHistory[f.temperatureHistory.length - 1]
          if (!lastPoint || time - lastPoint.time > 4) {
            updated.temperatureHistory = [...f.temperatureHistory, {
              time, temp: action.temperature, setpoint: f.setpoint, relayOn: action.relayOn,
            }].slice(-2000)
          }
          if (action.humidity !== undefined && f.humidityHistory) {
            const lastH = f.humidityHistory[f.humidityHistory.length - 1]
            if (!lastH || time - lastH.time > 4) {
              updated.humidityHistory = [...f.humidityHistory, {
                time, humidity: action.humidity, setpoint: f.humiditySetpoint ?? 85, relayOn: action.humidityRelayOn ?? false,
              }].slice(-2000)
            }
          }
          return updated
        }),
      }
    }

    // === Import backend projects (live mode) ===
    case 'IMPORT_BACKEND_PROJECTS': {
      const newProjects: BrewProject[] = []
      const newFermenters: typeof state.fermenters = []

      for (const bp of action.backendProjects) {
        if (state.projects.some(p => p.backendProjectId === bp.id)) continue

        const projectType = bp.fermentationType as ProjectType
        const needsHumidity = projectType === 'koji' || projectType === 'mushroom'

        const miniRecipe: Recipe = {
          id: generateId('recipe-'),
          projectType,
          name: bp.name,
          style: bp.fermentationType,
          batchSize: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 5 : 25,
          og: 1.000,
          fg: 1.000,
          abv: 0,
          ibu: 0,
          srm: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 0 : 10,
          ingredients: [],
          steps: [{ id: 'step-1', description: 'Fermentation', day: 1, done: false, targetTemp: bp.targetTemperature }],
        }

        const fermenter = createFermenterForProject(miniRecipe, bp.name)
        fermenter.setpoint = bp.targetTemperature
        fermenter.temperature = bp.currentTemperature
        fermenter.relayOn = bp.outletActive
        fermenter.activationThreshold = bp.activationThreshold ?? 0.2
        if (fermenter.pid) fermenter.pid.setpoint = bp.targetTemperature
        if (needsHumidity) {
          fermenter.humidity = bp.currentHumidity ?? undefined
          fermenter.humiditySetpoint = bp.targetHumidity ?? (projectType === 'koji' ? 85 : 90)
          if (fermenter.humidityPid) fermenter.humidityPid.setpoint = bp.targetHumidity ?? (projectType === 'koji' ? 85 : 90)
        }

        const project = createProject(miniRecipe, bp.name)
        project.phase = 'fermenting'
        project.fermentationStartedAt = bp.createdAt ?? Date.now()
        project.fermenterId = fermenter.id
        project.backendProjectId = bp.id
        project.sensorId = bp.sensorId
        project.outletId = bp.outletId
        project.humiditySensorId = bp.humiditySensorId ?? null
        if (needsHumidity) {
          project.targetHumidity = bp.targetHumidity ?? undefined
          project.currentHumidity = bp.currentHumidity ?? undefined
        }

        newProjects.push(project)
        newFermenters.push(fermenter)
      }

      if (newProjects.length === 0) return state

      return {
        ...state,
        projects: [...state.projects, ...newProjects],
        fermenters: [...state.fermenters, ...newFermenters],
      }
    }

    case 'IMPORT_BACKEND_ARCHIVES': {
      const existingIds = new Set(state.archivedProjects.map(a => a.id))
      const newArchives = action.archives.filter(a => !existingIds.has(a.id))
      if (newArchives.length === 0) return state
      return {
        ...state,
        archivedProjects: [...state.archivedProjects, ...newArchives],
      }
    }

    // === Humidity Controls ===
    case 'SET_HUMIDITY_SETPOINT':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId && f.humidityPid
            ? { ...f, humiditySetpoint: action.value, humidityPid: { ...f.humidityPid, setpoint: action.value } }
            : f
        ),
      }

    case 'SET_HUMIDITY_PID_MODE':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId && f.humidityPid
            ? { ...f, humidityPid: { ...f.humidityPid, mode: action.mode } }
            : f
        ),
      }

    case 'TOGGLE_HUMIDITY_RELAY':
      return {
        ...state,
        fermenters: state.fermenters.map(f =>
          f.id === action.fermenterId
            ? { ...f, humidityRelayOn: !f.humidityRelayOn }
            : f
        ),
      }

    case 'ADD_HUMIDITY_READING':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.projectId
            ? {
                ...p,
                currentHumidity: action.humidity,
                humidityHistory: [...(p.humidityHistory ?? []), {
                  time: Date.now() / 1000,
                  humidity: action.humidity,
                  setpoint: p.targetHumidity ?? 85,
                  relayOn: state.fermenters.find(f => f.id === p.fermenterId)?.humidityRelayOn ?? false,
                }],
              }
            : p
        ),
      }

    // === Gravity ===
    case 'ADD_GRAVITY_READING':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.projectId
            ? {
                ...p,
                currentGravity: action.gravity,
                gravityHistory: [...p.gravityHistory, {
                  time: action.timestamp ?? Date.now() / 1000,
                  gravity: action.gravity,
                  temperature: state.fermenters.find(f => f.id === p.fermenterId)?.temperature ?? 20,
                }],
              }
            : p
        ),
      }

    // === Recipes ===
    case 'ADD_RECIPE':
      return { ...state, recipes: [...state.recipes, action.recipe] }

    case 'UPDATE_RECIPE':
      return {
        ...state,
        recipes: state.recipes.map(r =>
          r.id === action.recipeId ? { ...r, ...action.updates } : r
        ),
      }

    case 'DELETE_RECIPE':
      return { ...state, recipes: state.recipes.filter(r => r.id !== action.recipeId) }

    case 'IMPORT_RECIPES': {
      const existingIds = new Set(state.recipes.map(r => r.id))
      const newRecipes = action.recipes.filter(r => !existingIds.has(r.id))
      if (newRecipes.length === 0) return state
      return { ...state, recipes: [...state.recipes, ...newRecipes] }
    }

    // === Alarms ===
    case 'ACK_ALARM':
      return {
        ...state,
        alarms: state.alarms.map(a =>
          a.id === action.alarmId ? { ...a, acknowledged: true } : a
        ),
      }

    case 'ACK_ALL_ALARMS':
      return { ...state, alarms: state.alarms.map(a => ({ ...a, acknowledged: true })) }

    default:
      return state
  }
}

interface ContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

const BrewingContext = createContext<ContextValue | null>(null)

export function BrewingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState)

  return (
    <BrewingContext.Provider value={{ state, dispatch }}>
      {children}
    </BrewingContext.Provider>
  )
}

export function useBrewing(): ContextValue {
  const ctx = useContext(BrewingContext)
  if (!ctx) throw new Error('useBrewing must be used within BrewingProvider')
  return ctx
}

export function useBrewingActions() {
  const { dispatch } = useBrewing()

  return {
    removeFermenter: useCallback((id: string) => dispatch({ type: 'REMOVE_FERMENTER', id }), [dispatch]),
    renameFermenter: useCallback((id: string, name: string) => dispatch({ type: 'RENAME_FERMENTER', id, name }), [dispatch]),
    setSetpoint: useCallback((fId: string, value: number) => dispatch({ type: 'SET_SETPOINT', fermenterId: fId, value }), [dispatch]),
    setPidMode: useCallback((fId: string, mode: 'auto' | 'manual' | 'off') => dispatch({ type: 'SET_PID_MODE', fermenterId: fId, mode }), [dispatch]),
    toggleRelay: useCallback((fId: string) => dispatch({ type: 'TOGGLE_RELAY', fermenterId: fId }), [dispatch]),
    // Project lifecycle
    createProjectAction: useCallback((project: BrewProject) => dispatch({ type: 'CREATE_PROJECT', project }), [dispatch]),
    updateProject: useCallback((id: string, updates: Partial<BrewProject>) => dispatch({ type: 'UPDATE_PROJECT', projectId: id, updates }), [dispatch]),
    deleteProject: useCallback((id: string) => dispatch({ type: 'DELETE_PROJECT', projectId: id }), [dispatch]),
    archiveProject: useCallback((id: string, fullTempHistory?: import('../types/brewing').TempDataPoint[], fullGravityHistory?: import('../types/brewing').GravityDataPoint[]) => dispatch({ type: 'ARCHIVE_PROJECT', projectId: id, fullTempHistory, fullGravityHistory }), [dispatch]),
    // Fermentation
    startFermentation: useCallback((recipe: Recipe, projectName: string) => dispatch({ type: 'START_FERMENTATION', recipe, projectName }), [dispatch]),
    // Gravity
    addGravityReading: useCallback((projectId: string, gravity: number, timestamp?: number) => dispatch({ type: 'ADD_GRAVITY_READING', projectId, gravity, timestamp }), [dispatch]),
    // Live mode
    syncLiveData: useCallback((fId: string, temperature: number, relayOn: boolean, humidity?: number, humidityRelayOn?: boolean, setpoint?: number, humiditySetpoint?: number, activationThreshold?: number) =>
      dispatch({ type: 'SYNC_LIVE_DATA', fermenterId: fId, temperature, relayOn, humidity, humidityRelayOn, setpoint, humiditySetpoint, activationThreshold }), [dispatch]),
    importBackendProjects: useCallback((backendProjects: BackendProject[]) =>
      dispatch({ type: 'IMPORT_BACKEND_PROJECTS', backendProjects }), [dispatch]),
    importBackendArchives: useCallback((archives: ArchivedProject[]) =>
      dispatch({ type: 'IMPORT_BACKEND_ARCHIVES', archives }), [dispatch]),
    // Humidity
    setHumiditySetpoint: useCallback((fId: string, value: number) => dispatch({ type: 'SET_HUMIDITY_SETPOINT', fermenterId: fId, value }), [dispatch]),
    setHumidityPidMode: useCallback((fId: string, mode: 'auto' | 'manual' | 'off') => dispatch({ type: 'SET_HUMIDITY_PID_MODE', fermenterId: fId, mode }), [dispatch]),
    toggleHumidityRelay: useCallback((fId: string) => dispatch({ type: 'TOGGLE_HUMIDITY_RELAY', fermenterId: fId }), [dispatch]),
    addHumidityReading: useCallback((projectId: string, humidity: number) => dispatch({ type: 'ADD_HUMIDITY_READING', projectId, humidity }), [dispatch]),
    // Recipes
    addRecipe: useCallback((recipe: Recipe) => dispatch({ type: 'ADD_RECIPE', recipe }), [dispatch]),
    updateRecipe: useCallback((id: string, updates: Partial<Recipe>) => dispatch({ type: 'UPDATE_RECIPE', recipeId: id, updates }), [dispatch]),
    deleteRecipe: useCallback((id: string) => dispatch({ type: 'DELETE_RECIPE', recipeId: id }), [dispatch]),
    importRecipes: useCallback((recipes: Recipe[]) => dispatch({ type: 'IMPORT_RECIPES', recipes }), [dispatch]),
    // Alarms
    ackAlarm: useCallback((alarmId: string) => dispatch({ type: 'ACK_ALARM', alarmId }), [dispatch]),
    ackAllAlarms: useCallback(() => dispatch({ type: 'ACK_ALL_ALARMS' }), [dispatch]),
  }
}
