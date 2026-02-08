import { useEffect, useRef, useMemo } from 'react'
import { useConnection } from '../context/ConnectionContext'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { fetchBackendProjects, fetchBackendProject, fetchLiveTemperature } from '../api/projects'

/** Imports active backend projects into local state on first live mode mount,
 *  then polls live-temperature every 5s for all active projects */
export function useLiveSync() {
  const { mode } = useConnection()
  const { state } = useBrewing()
  const { importBackendProjects, syncLiveData } = useBrewingActions()
  const hasSynced = useRef(false)

  // One-time import of backend projects
  useEffect(() => {
    if (mode !== 'live' || hasSynced.current) return
    hasSynced.current = true

    fetchBackendProjects()
      .then(projects => {
        const active = projects.filter(p => !p.archived)
        if (active.length > 0) importBackendProjects(active)
      })
      .catch(() => {})
  }, [mode, importBackendProjects])

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
          )
        } catch { /* ignore */ }
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [mode, liveProjectKeys, syncLiveData])
}
