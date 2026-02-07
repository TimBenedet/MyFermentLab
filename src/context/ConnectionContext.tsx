import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { verifyToken, getStoredToken, getStoredRole, logout as authLogout } from '../api/auth'

type Mode = 'simulation' | 'live'
type Role = 'admin' | 'viewer' | null

interface ConnectionState {
  mode: Mode
  role: Role
  backendAvailable: boolean
  loading: boolean
}

interface ConnectionActions {
  setMode: (mode: Mode) => void
  setRole: (role: Role) => void
  logout: () => void
  checkBackend: () => Promise<boolean>
}

const ConnectionContext = createContext<(ConnectionState & ConnectionActions) | null>(null)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    return getStoredToken() ? 'live' : 'simulation'
  })
  const [role, setRole] = useState<Role>(() => getStoredRole())
  const [backendAvailable, setBackendAvailable] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkBackend = useCallback(async () => {
    try {
      const ok = await verifyToken()
      setBackendAvailable(ok)
      if (!ok && mode === 'live') {
        // Token invalid but we had one — stay in live mode, user will see login
        setRole(null)
      }
      return ok
    } catch {
      setBackendAvailable(false)
      return false
    }
  }, [mode])

  const logout = useCallback(() => {
    authLogout()
    setRole(null)
    setMode('simulation')
    setBackendAvailable(false)
  }, [])

  // Check backend on mount
  useEffect(() => {
    const token = getStoredToken()
    if (token) {
      checkBackend().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [checkBackend])

  return (
    <ConnectionContext.Provider value={{ mode, role, backendAvailable, loading, setMode, setRole, logout, checkBackend }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider')
  return ctx
}
