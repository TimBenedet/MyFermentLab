import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FermentLogo } from '../components/layout/FermentLogo'
import { useBrewing } from '../context/BrewingContext'
import { ProjectCard } from '../components/project/ProjectCard'

export function HomePage() {
  const { state } = useBrewing()

  const fermenting = state.projects.filter(p => p.phase === 'fermenting')
  const completed = state.projects.filter(p => p.phase === 'complete' || p.phase === 'conditioning')
  const brewing = state.projects.filter(p => p.phase === 'brewing')

  if (state.projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-45px)] -mt-16 gap-4">
        <div className="pointer-events-none fixed left-0 right-0 bottom-0 top-[45px] flex items-center justify-center overflow-hidden z-0">
          <FermentLogo size={560} className="text-white opacity-[0.02] max-w-[90vw]" full />
        </div>
        <h2 className="text-lg font-bold text-white">Aucun projet en cours</h2>
        <p className="text-sm text-scada-text-secondary text-center max-w-md">
          Créez une recette et lancez un brassage pour commencer à suivre vos fermentations.
        </p>
        <Link
          to="/recipes"
          className="scada-btn-primary flex items-center gap-2 mt-2"
        >
          <Plus size={14} />
          Créer une recette
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Watermark */}
      <div className="pointer-events-none fixed left-0 right-0 bottom-0 top-[45px] flex items-center justify-center overflow-hidden z-0">
        <FermentLogo size={560} className="text-white opacity-[0.02] max-w-[90vw]" full />
      </div>

      {/* Active brewing */}
      {brewing.length > 0 && (
        <section>
          <h2 className="scada-label mb-3 text-scada-warning">
            Brassage en cours ({brewing.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {brewing.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Fermenting */}
      {fermenting.length > 0 && (
        <section>
          <h2 className="scada-label mb-3">
            En fermentation ({fermenting.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {fermenting.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="scada-label mb-3 text-scada-text-muted">
            Terminés ({completed.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {completed.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
