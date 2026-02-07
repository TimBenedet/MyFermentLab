import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react'
import type { AppState, AppAction, BrewProject, Recipe, ArchivedProject, ProjectType } from '../types/brewing'
import type { BackendProject } from '../types/backend'
import { DEFAULT_RECIPE, createFermenter, createFermenterForProject, createProject, resetFermenterCounter, generateId } from '../simulation/constants'
import { simulateFermenter, evaluateAlarms } from '../simulation/fermenterSim'
import { simulateGravity } from '../simulation/gravitySim'

function createInitialState(): AppState {
  resetFermenterCounter()
  return {
    fermenters: [],
    recipes: [
      {
        ...DEFAULT_RECIPE,
        ingredients: DEFAULT_RECIPE.ingredients.map(i => ({ ...i })),
        steps: DEFAULT_RECIPE.steps.map(s => ({ ...s })),
      },
    ],
    projects: [],
    archivedProjects: [],
    alarms: [],
    isRunning: false,
    speed: 1,
    totalElapsedSeconds: 0,
    ambientTemp: 20,
    activeBrew: undefined,
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'TICK': {
      if (!state.isRunning || state.fermenters.length === 0) return state

      const effectiveDt = action.dt * state.speed
      const totalElapsed = state.totalElapsedSeconds + effectiveDt

      const fermenters = state.fermenters.map(f =>
        simulateFermenter(f, state.ambientTemp, effectiveDt, totalElapsed)
      )

      // Auto-record gravity for fermenting projects
      let projects = state.projects
      for (const proj of projects) {
        if (proj.phase === 'fermenting' && proj.fermenterId && proj.fermentationStartedAt) {
          const fermElapsed = totalElapsed - (proj.fermentationStartedAt - state.totalElapsedSeconds + totalElapsed - effectiveDt)
          // Use project-relative elapsed time based on gravity history
          const projElapsedSeconds = proj.gravityHistory.length > 0
            ? proj.gravityHistory[proj.gravityHistory.length - 1].time + effectiveDt
            : effectiveDt

          const lastGravity = proj.gravityHistory[proj.gravityHistory.length - 1]
          if (!lastGravity || projElapsedSeconds - lastGravity.time > 300) {
            const fermenter = fermenters.find(f => f.id === proj.fermenterId)
            const gravity = simulateGravity(
              { og: proj.og, fg: proj.fg, fermentationDays: 14 },
              projElapsedSeconds
            )
            projects = projects.map(p =>
              p.id === proj.id
                ? {
                    ...p,
                    currentGravity: gravity,
                    gravityHistory: [...p.gravityHistory, {
                      time: projElapsedSeconds,
                      gravity,
                      temperature: fermenter?.temperature ?? 20,
                    }].slice(-1000), // cap at 1000 points
                  }
                : p
            )
          }
        }
      }

      // Auto-record humidity for koji/mushroom fermenting projects
      for (const proj of projects) {
        if (
          proj.phase === 'fermenting' &&
          proj.fermenterId &&
          (proj.projectType === 'koji' || proj.projectType === 'mushroom')
        ) {
          const fermenter = fermenters.find(f => f.id === proj.fermenterId)
          if (fermenter?.humidity !== undefined) {
            const hHistory = proj.humidityHistory ?? []
            const lastH = hHistory[hHistory.length - 1]
            const projElapsed = hHistory.length > 0
              ? hHistory[hHistory.length - 1].time + effectiveDt
              : effectiveDt
            if (!lastH || projElapsed - lastH.time > 300) {
              projects = projects.map(p =>
                p.id === proj.id
                  ? {
                      ...p,
                      currentHumidity: fermenter.humidity,
                      humidityHistory: [...hHistory, {
                        time: projElapsed,
                        humidity: fermenter.humidity!,
                        setpoint: fermenter.humiditySetpoint ?? 85,
                        relayOn: fermenter.humidityRelayOn ?? false,
                      }].slice(-1000),
                    }
                  : p
              )
            }
          }
        }
      }

      const newState: AppState = { ...state, fermenters, projects, totalElapsedSeconds: totalElapsed }
      return { ...newState, alarms: evaluateAlarms(newState) }
    }

    case 'START':
      return { ...state, isRunning: true }

    case 'STOP':
      return { ...state, isRunning: false }

    case 'RESET':
      return createInitialState()

    case 'SET_SPEED':
      return { ...state, speed: action.speed }

    // === Fermenter Management ===
    case 'ADD_FERMENTER':
      return { ...state, fermenters: [...state.fermenters, createFermenter(action.name)] }

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

    // === Recipe Library ===
    case 'SAVE_RECIPE':
      return { ...state, recipes: [...state.recipes, action.recipe] }

    case 'DELETE_RECIPE':
      return { ...state, recipes: state.recipes.filter(r => r.id !== action.recipeId) }

    case 'UPDATE_RECIPE':
      return {
        ...state,
        recipes: state.recipes.map(r => r.id === action.recipe.id ? action.recipe : r),
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
        // Also remove the associated fermenter
        fermenters: delProject?.fermenterId
          ? state.fermenters.filter(f => f.id !== delProject.fermenterId)
          : state.fermenters,
      }
    }

    case 'ARCHIVE_PROJECT': {
      const proj = state.projects.find(p => p.id === action.projectId)
      if (!proj) return state

      const recipe = state.recipes.find(r => r.id === proj.recipeId)
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
        recipeSnapshot: recipe ?? {
          id: proj.recipeId, projectType: proj.projectType, name: proj.recipeName, style: proj.style,
          batchSize: proj.batchSize, og: proj.og, fg: proj.fg,
          abv: proj.abv, ibu: 0, srm: proj.srm, ingredients: [], steps: [],
        },
        style: proj.style,
        batchSize: proj.batchSize,
        srm: proj.srm,
        brewStartedAt: proj.brewStartedAt,
        brewCompletedAt: proj.brewCompletedAt,
        brewSteps: proj.brewSteps,
        fermentationStartedAt: proj.fermentationStartedAt,
        totalFermentationDays: fermentationDays,
        temperatureHistory: fermenter?.temperatureHistory ?? [],
        gravityHistory: proj.gravityHistory,
        og: proj.og,
        fg: proj.fg,
        finalGravity: lastGravity,
        actualAbv: Math.round((proj.og - lastGravity) * 131.25 * 10) / 10,
        // Humidity data (koji/mushroom)
        humidityHistory: proj.humidityHistory,
        finalHumidity: fermenter?.humidity,
      }

      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.projectId),
        archivedProjects: [...state.archivedProjects, archived],
        // Remove the associated fermenter
        fermenters: proj.fermenterId
          ? state.fermenters.filter(f => f.id !== proj.fermenterId)
          : state.fermenters,
      }
    }

    // === Brew Mode ===
    case 'START_BREW': {
      const recipe = state.recipes.find(r => r.id === action.recipeId)
      if (!recipe) return state
      const project = createProject(recipe, action.projectName)
      const brewSteps = project.brewSteps.map((s, i) => ({
        ...s,
        status: i === 0 ? 'active' as const : 'pending' as const,
        startedAt: i === 0 ? Date.now() : undefined,
      }))
      return {
        ...state,
        projects: [...state.projects, project],
        activeBrew: {
          recipeId: recipe.id,
          projectId: project.id,
          currentStepIndex: 0,
          steps: brewSteps,
          timerRunning: true,
        },
      }
    }

    case 'TICK_BREW_TIMER': {
      if (!state.activeBrew || !state.activeBrew.timerRunning) return state
      const brew = state.activeBrew
      const steps = brew.steps.map((s, i) =>
        i === brew.currentStepIndex && s.status === 'active'
          ? { ...s, elapsedSeconds: s.elapsedSeconds + action.dt }
          : s
      )
      return { ...state, activeBrew: { ...brew, steps } }
    }

    case 'ADVANCE_BREW_STEP': {
      if (!state.activeBrew) return state
      const brew = state.activeBrew
      const nextIndex = brew.currentStepIndex + 1
      const isLastStep = nextIndex >= brew.steps.length
      const steps = brew.steps.map((s, i) => {
        if (i === brew.currentStepIndex) return { ...s, status: 'completed' as const }
        if (i === nextIndex) return { ...s, status: 'active' as const, startedAt: Date.now() }
        return s
      })
      return {
        ...state,
        activeBrew: {
          ...brew,
          steps,
          currentStepIndex: isLastStep ? brew.currentStepIndex : nextIndex,
        },
      }
    }

    case 'SKIP_BREW_STEP': {
      if (!state.activeBrew) return state
      const brew = state.activeBrew
      const nextIndex = brew.currentStepIndex + 1
      const isLastStep = nextIndex >= brew.steps.length
      const steps = brew.steps.map((s, i) => {
        if (i === brew.currentStepIndex) return { ...s, status: 'skipped' as const }
        if (i === nextIndex) return { ...s, status: 'active' as const, startedAt: Date.now() }
        return s
      })
      return {
        ...state,
        activeBrew: {
          ...brew,
          steps,
          currentStepIndex: isLastStep ? brew.currentStepIndex : nextIndex,
        },
      }
    }

    case 'COMPLETE_BREW': {
      if (!state.activeBrew) return state
      const brew = state.activeBrew
      const recipe = state.recipes.find(r => r.id === brew.recipeId)
      if (!recipe) return state

      const project = state.projects.find(p => p.id === brew.projectId)
      if (!project) return state

      const newFermenter = createFermenterForProject(recipe, project.name)

      return {
        ...state,
        fermenters: [...state.fermenters, newFermenter],
        projects: state.projects.map(p =>
          p.id === brew.projectId
            ? {
                ...p,
                phase: 'fermenting' as const,
                fermenterId: newFermenter.id,
                fermentationStartedAt: Date.now(),
                brewCompletedAt: Date.now(),
                brewSteps: brew.steps.map(s => ({
                  ...s,
                  status: s.status === 'active' ? 'completed' as const : s.status,
                })),
              }
            : p
        ),
        activeBrew: undefined,
        isRunning: true,
      }
    }

    case 'CANCEL_BREW': {
      if (!state.activeBrew) return state
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== state.activeBrew!.projectId),
        activeBrew: undefined,
      }
    }

    // === Direct fermentation (skip brew mode) ===
    case 'START_FERMENTATION': {
      const project = createProject(action.recipe, action.projectName)
      project.phase = 'fermenting'
      project.fermentationStartedAt = Date.now()
      project.brewCompletedAt = Date.now()

      const fermenter = createFermenterForProject(action.recipe, action.projectName)
      project.fermenterId = fermenter.id

      return {
        ...state,
        projects: [...state.projects, project],
        fermenters: [...state.fermenters, fermenter],
        isRunning: true,
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
          // Append to history
          const time = state.totalElapsedSeconds
          updated.temperatureHistory = [...f.temperatureHistory, {
            time, temp: action.temperature, setpoint: f.setpoint, relayOn: action.relayOn,
          }].slice(-500)
          if (action.humidity !== undefined && f.humidityHistory) {
            updated.humidityHistory = [...f.humidityHistory, {
              time, humidity: action.humidity, setpoint: f.humiditySetpoint ?? 85, relayOn: action.humidityRelayOn ?? false,
            }].slice(-500)
          }
          return updated
        }),
        totalElapsedSeconds: state.totalElapsedSeconds + 10, // 10s poll interval
      }
    }

    // === Import backend projects (live mode) ===
    case 'IMPORT_BACKEND_PROJECTS': {
      const newProjects: BrewProject[] = []
      const newFermenters: typeof state.fermenters = []

      for (const bp of action.backendProjects) {
        // Skip if already imported
        if (state.projects.some(p => p.backendProjectId === bp.id)) continue

        const projectType = bp.fermentationType as ProjectType
        const needsHumidity = projectType === 'koji' || projectType === 'mushroom'

        // Build minimal recipe for fermenter creation
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

        // Create fermenter with live data
        const fermenter = createFermenterForProject(miniRecipe, bp.name)
        fermenter.setpoint = bp.targetTemperature
        fermenter.temperature = bp.currentTemperature
        fermenter.relayOn = bp.outletActive
        if (fermenter.pid) fermenter.pid.setpoint = bp.targetTemperature
        if (needsHumidity) {
          fermenter.humidity = bp.currentHumidity ?? undefined
          fermenter.humiditySetpoint = bp.targetHumidity ?? (projectType === 'koji' ? 85 : 90)
          if (fermenter.humidityPid) fermenter.humidityPid.setpoint = bp.targetHumidity ?? (projectType === 'koji' ? 85 : 90)
        }

        // Create project linked to backend
        const project = createProject(miniRecipe, bp.name)
        project.phase = 'fermenting'
        project.fermentationStartedAt = bp.createdAt ?? Date.now()
        project.brewCompletedAt = bp.createdAt ?? Date.now()
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
        isRunning: true,
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
                  time: state.totalElapsedSeconds,
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
                  time: state.totalElapsedSeconds,
                  gravity: action.gravity,
                  temperature: state.fermenters.find(f => f.id === p.fermenterId)?.temperature ?? 20,
                }],
              }
            : p
        ),
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

  useEffect(() => {
    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK', dt: 1 })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

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
    start: useCallback(() => dispatch({ type: 'START' }), [dispatch]),
    stop: useCallback(() => dispatch({ type: 'STOP' }), [dispatch]),
    reset: useCallback(() => dispatch({ type: 'RESET' }), [dispatch]),
    setSpeed: useCallback((speed: number) => dispatch({ type: 'SET_SPEED', speed }), [dispatch]),
    addFermenter: useCallback((name: string) => dispatch({ type: 'ADD_FERMENTER', name }), [dispatch]),
    removeFermenter: useCallback((id: string) => dispatch({ type: 'REMOVE_FERMENTER', id }), [dispatch]),
    renameFermenter: useCallback((id: string, name: string) => dispatch({ type: 'RENAME_FERMENTER', id, name }), [dispatch]),
    setSetpoint: useCallback((fId: string, value: number) => dispatch({ type: 'SET_SETPOINT', fermenterId: fId, value }), [dispatch]),
    setPidMode: useCallback((fId: string, mode: 'auto' | 'manual' | 'off') => dispatch({ type: 'SET_PID_MODE', fermenterId: fId, mode }), [dispatch]),
    toggleRelay: useCallback((fId: string) => dispatch({ type: 'TOGGLE_RELAY', fermenterId: fId }), [dispatch]),
    // Recipe library
    saveRecipe: useCallback((recipe: Recipe) => dispatch({ type: 'SAVE_RECIPE', recipe }), [dispatch]),
    deleteRecipe: useCallback((id: string) => dispatch({ type: 'DELETE_RECIPE', recipeId: id }), [dispatch]),
    updateRecipe: useCallback((recipe: Recipe) => dispatch({ type: 'UPDATE_RECIPE', recipe }), [dispatch]),
    // Project lifecycle
    createProjectAction: useCallback((project: BrewProject) => dispatch({ type: 'CREATE_PROJECT', project }), [dispatch]),
    updateProject: useCallback((id: string, updates: Partial<BrewProject>) => dispatch({ type: 'UPDATE_PROJECT', projectId: id, updates }), [dispatch]),
    deleteProject: useCallback((id: string) => dispatch({ type: 'DELETE_PROJECT', projectId: id }), [dispatch]),
    archiveProject: useCallback((id: string) => dispatch({ type: 'ARCHIVE_PROJECT', projectId: id }), [dispatch]),
    // Brew mode
    startBrew: useCallback((recipeId: string, projectName: string) => dispatch({ type: 'START_BREW', recipeId, projectName }), [dispatch]),
    advanceBrewStep: useCallback(() => dispatch({ type: 'ADVANCE_BREW_STEP' }), [dispatch]),
    skipBrewStep: useCallback(() => dispatch({ type: 'SKIP_BREW_STEP' }), [dispatch]),
    tickBrewTimer: useCallback((dt: number) => dispatch({ type: 'TICK_BREW_TIMER', dt }), [dispatch]),
    completeBrew: useCallback(() => dispatch({ type: 'COMPLETE_BREW' }), [dispatch]),
    cancelBrew: useCallback(() => dispatch({ type: 'CANCEL_BREW' }), [dispatch]),
    // Direct fermentation
    startFermentation: useCallback((recipe: Recipe, projectName: string) => dispatch({ type: 'START_FERMENTATION', recipe, projectName }), [dispatch]),
    // Gravity
    addGravityReading: useCallback((projectId: string, gravity: number) => dispatch({ type: 'ADD_GRAVITY_READING', projectId, gravity }), [dispatch]),
    // Live mode
    syncLiveData: useCallback((fId: string, temperature: number, relayOn: boolean, humidity?: number, humidityRelayOn?: boolean) =>
      dispatch({ type: 'SYNC_LIVE_DATA', fermenterId: fId, temperature, relayOn, humidity, humidityRelayOn }), [dispatch]),
    importBackendProjects: useCallback((backendProjects: BackendProject[]) =>
      dispatch({ type: 'IMPORT_BACKEND_PROJECTS', backendProjects }), [dispatch]),
    // Humidity
    setHumiditySetpoint: useCallback((fId: string, value: number) => dispatch({ type: 'SET_HUMIDITY_SETPOINT', fermenterId: fId, value }), [dispatch]),
    setHumidityPidMode: useCallback((fId: string, mode: 'auto' | 'manual' | 'off') => dispatch({ type: 'SET_HUMIDITY_PID_MODE', fermenterId: fId, mode }), [dispatch]),
    toggleHumidityRelay: useCallback((fId: string) => dispatch({ type: 'TOGGLE_HUMIDITY_RELAY', fermenterId: fId }), [dispatch]),
    addHumidityReading: useCallback((projectId: string, humidity: number) => dispatch({ type: 'ADD_HUMIDITY_READING', projectId, humidity }), [dispatch]),
    // Alarms
    ackAlarm: useCallback((alarmId: string) => dispatch({ type: 'ACK_ALARM', alarmId }), [dispatch]),
    ackAllAlarms: useCallback(() => dispatch({ type: 'ACK_ALL_ALARMS' }), [dispatch]),
  }
}
