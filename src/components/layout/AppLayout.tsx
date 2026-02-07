import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { useLiveSync } from '../../hooks/useLiveSync'

export function AppLayout() {
  useLiveSync()

  return (
    <div className="min-h-screen bg-scada-bg flex flex-col">
      <Header />

      <main className="flex-1 p-3 sm:p-4 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
