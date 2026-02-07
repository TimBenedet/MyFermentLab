import { useEffect, useRef } from 'react'
import { useConnection } from '../context/ConnectionContext'
import { useBrewingActions } from '../context/BrewingContext'
import { fetchBackendProjects } from '../api/projects'

/** Imports active backend projects into local state on first live mode mount */
export function useLiveSync() {
  const { mode } = useConnection()
  const { importBackendProjects } = useBrewingActions()
  const hasSynced = useRef(false)

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
}
