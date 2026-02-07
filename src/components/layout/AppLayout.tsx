import type { ReactNode } from 'react'
import { Header } from './Header'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-scada-bg flex flex-col">
      <Header />

      <main className="flex-1 p-3 sm:p-4 overflow-auto">
        {children}
      </main>
    </div>
  )
}
