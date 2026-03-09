import { useEffect, useRef, useMemo } from 'react'
import { useConnection } from '../context/ConnectionContext'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { fetchBackendProjects, fetchBackendProject, fetchLiveTemperature } from '../api/projects'
import { fetchRecipes } from '../api/recipes'
import type { ArchivedProject, ProjectType } from '../types/brewing'

/** Imports active backend projects into local state on first live mode mount,
 *  then polls live-temperature every 5s for all active projects */
export function useLiveSync() {
  const { mode } = useConnection()
  const { state } = useBrewing()
  const { importBackendProjects, importBackendArchives, syncLiveData, importRecipes } = useBrewingActions()
  const hasSynced = useRef(false)

  // One-time import of backend projects (active + archived)
  useEffect(() => {
    if (mode !== 'live' || hasSynced.current) return
    hasSynced.current = true

    fetchBackendProjects()
      .then(async (projects) => {
        const active = projects.filter(p => !p.archived)
        if (active.length > 0) importBackendProjects(active)

        // Import archived projects with their history
        const archived = projects.filter(p => p.archived)
        if (archived.length === 0) return

        const archives: ArchivedProject[] = []
        for (const bp of archived) {
          try {
            const full = await fetchBackendProject(bp.id)
            const projectType = bp.fermentationType as ProjectType
            const history = (full as any).history ?? []
            const humidityHistory = (full as any).humidityHistory ?? []
            const fermentationDays = bp.createdAt
              ? Math.floor((Date.now() - bp.createdAt) / 86400000)
              : 0
            archives.push({
              id: bp.id,
              name: bp.name,
              projectType,
              recipeId: bp.id,
              recipeName: bp.name,
              createdAt: bp.createdAt ?? Date.now(),
              archivedAt: (full as any).archivedAt ?? Date.now(),
              recipeSnapshot: {
                id: bp.id, projectType, name: bp.name, style: bp.fermentationType,
                batchSize: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 5 : 25,
                og: 1, fg: 1, abv: 0, ibu: 0,
                srm: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 0 : 10,
                ingredients: [], steps: [],
              },
              style: bp.fermentationType,
              batchSize: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 5 : 25,
              srm: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 0 : 10,
              fermentationStartedAt: bp.createdAt,
              totalFermentationDays: fermentationDays,
              temperatureHistory: history.map((h: any) => ({
                time: h.timestamp / 1000,
                temp: h.temperature,
                setpoint: bp.targetTemperature,
                relayOn: false,
              })),
              gravityHistory: [],
              og: 1, fg: 1,
              finalGravity: 1,
              actualAbv: 0,
              humidityHistory: humidityHistory.length > 0 ? humidityHistory.map((h: any) => ({
                time: h.timestamp / 1000,
                humidity: h.humidity,
                setpoint: bp.targetHumidity ?? 85,
                relayOn: false,
              })) : undefined,
              finalHumidity: humidityHistory.length > 0
                ? humidityHistory[humidityHistory.length - 1].humidity
                : undefined,
            })
          } catch { /* skip */ }
        }
        if (archives.length > 0) importBackendArchives(archives)

        // Import recipes
        try {
          const recipes = await fetchRecipes()
          if (recipes.length > 0) importRecipes(recipes)
        } catch { /* ignore */ }
      })
      .catch(() => {})
  }, [mode, importBackendProjects, importBackendArchives, importRecipes])

  // Stable list of live project IDs — only changes when projects are added/removed
  const liveProjectKeys = useMemo(() => {
    return state.projects
      .filter(p => p.backendProjectId && p.fermenterId && p.phase === 'fermenting')
      .map(p => `${p.backendProjectId}:${p.fermenterId}`)
      .join(',')
  }, [state.projects])

  // Ref to always access latest project list without re-triggering the effect
  const projectsRef = useRef(state.projects)
  projectsRef.current = state.projects

  // Global polling — updates all live projects every 5s
  useEffect(() => {
    if (mode !== 'live' || !liveProjectKeys) return

    let active = true
    const poll = async () => {
      const liveProjects = projectsRef.current.filter(
        p => p.backendProjectId && p.fermenterId && p.phase === 'fermenting'
      )
      for (const project of liveProjects) {
        if (!active) return
        try {
          const live = await fetchLiveTemperature(project.backendProjectId!)
          if (!active) return
          const bp = await fetchBackendProject(project.backendProjectId!)
          if (!active) return
          syncLiveData(
            project.fermenterId!,
            live.temperature,
            bp.outletActive,
            bp.currentHumidity ?? undefined,
            undefined, // humidityRelayOn
            bp.targetTemperature,
            bp.targetHumidity ?? undefined,
            bp.activationThreshold ?? 0.2,
          )
        } catch { /* ignore */ }
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => { active = false; clearInterval(interval) }
  }, [mode, liveProjectKeys, syncLiveData])
}
