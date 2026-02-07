import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Wifi, WifiOff, Home, BookOpen, Archive, Menu, X } from 'lucide-react'
import { FermentLogo } from './FermentLogo'
import { useBrewing } from '../../context/BrewingContext'

export function Header() {
  const { state } = useBrewing()
  const [clock, setClock] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-scada-accent/15 text-scada-accent border border-scada-accent/30'
        : 'text-scada-text-secondary hover:text-white hover:bg-scada-card'
    }`

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-scada-accent/15 text-scada-accent border border-scada-accent/30'
        : 'text-scada-text-secondary hover:text-white hover:bg-scada-card'
    }`

  return (
    <>
      <header className="relative flex items-center justify-between px-3 sm:px-4 py-2.5 bg-scada-bg-secondary border-b border-scada-border">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <FermentLogo size={32} className="text-scada-accent" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wider">BrewSCADA</h1>
            <p className="text-[9px] text-scada-text-muted uppercase tracking-widest hidden sm:block">Fermentation Monitor</p>
          </div>
        </div>

        {/* Center: Navigation — desktop only */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2">
          <NavLink to="/" className={navLinkClass} end>
            <Home size={14} />
            Accueil
          </NavLink>
          <NavLink to="/recipes" className={navLinkClass}>
            <BookOpen size={14} />
            Recettes
          </NavLink>
          <NavLink to="/archives" className={navLinkClass}>
            <Archive size={14} />
            Archives
          </NavLink>
        </nav>

        {/* Right: Status + Clock + Mobile menu button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {state.fermenters.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-scada-accent/10 text-scada-accent border border-scada-accent/20">
              <span className="w-1.5 h-1.5 rounded-full bg-scada-accent" />
              {state.fermenters.length} cuve{state.fermenters.length > 1 ? 's' : ''}
            </div>
          )}

          {state.speed > 1 && (
            <span className="text-[10px] font-mono text-scada-accent px-1.5 py-0.5 rounded bg-scada-accent/10 border border-scada-accent/20">
              {state.speed}x
            </span>
          )}

          <div className="flex items-center gap-1">
            {state.isRunning ? (
              <Wifi size={12} className="text-scada-accent" />
            ) : (
              <WifiOff size={12} className="text-scada-text-muted" />
            )}
            <span className={`text-[9px] ${state.isRunning ? 'text-scada-accent' : 'text-scada-text-muted'}`}>
              {state.isRunning ? 'LIVE' : 'IDLE'}
            </span>
          </div>

          <span className="font-mono text-xs text-scada-text-secondary tabular-nums hidden sm:inline">
            {clock.toLocaleTimeString('fr-FR')}
          </span>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 -mr-1 text-scada-text-secondary hover:text-white transition-colors"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <div className="md:hidden bg-scada-bg-secondary border-b border-scada-border px-3 py-2 space-y-1">
          <NavLink to="/" className={mobileNavLinkClass} end onClick={() => setMenuOpen(false)}>
            <Home size={16} />
            Accueil
          </NavLink>
          <NavLink to="/recipes" className={mobileNavLinkClass} onClick={() => setMenuOpen(false)}>
            <BookOpen size={16} />
            Recettes
          </NavLink>
          <NavLink to="/archives" className={mobileNavLinkClass} onClick={() => setMenuOpen(false)}>
            <Archive size={16} />
            Archives
          </NavLink>
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-scada-text-muted">
            <span className="font-mono">{clock.toLocaleTimeString('fr-FR')}</span>
            {state.fermenters.length > 0 && (
              <span>{state.fermenters.length} cuve{state.fermenters.length > 1 ? 's' : ''} active{state.fermenters.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
