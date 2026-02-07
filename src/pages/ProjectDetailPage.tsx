import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Droplets, Droplet, Archive, Trash2 } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { VesselSVG } from '../components/vessels/VesselSVG'
import { KojiTraySVG } from '../components/vessels/KojiTraySVG'
import { MushroomBagSVG } from '../components/vessels/MushroomBagSVG'
import { TemperatureChart } from '../components/charts/TemperatureChart'
import { GravityChart } from '../components/charts/GravityChart'
import { HumidityChart } from '../components/charts/HumidityChart'
import { ProjectControls } from '../components/project/ProjectControls'

import { srmToColor } from '../simulation/constants'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { archiveProject, deleteProject } = useBrewingActions()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const project = state.projects.find(p => p.id === projectId)
  const fermenter = project?.fermenterId
    ? state.fermenters.find(f => f.id === project.fermenterId)
    : undefined

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-scada-text-muted">Projet introuvable</p>
          <button onClick={() => navigate('/')} className="scada-btn-neutral mt-3">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  const needsHumidity = project.projectType === 'koji' || project.projectType === 'mushroom'

  const daysSinceStart = project.fermentationStartedAt
    ? Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)
    : 0

  const progressPct = project.og !== project.fg
    ? Math.min(100, Math.max(0, ((project.og - project.currentGravity) / (project.og - project.fg)) * 100))
    : 0

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="space-y-2 sm:space-y-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="scada-btn-neutral p-2">
            <ArrowLeft size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{project.name}</h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px] text-scada-text-muted truncate">{project.recipeName} - {project.style}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${
                project.phase === 'fermenting'
                  ? 'bg-scada-accent/15 text-scada-accent border border-scada-accent/30'
                  : project.phase === 'complete'
                  ? 'bg-scada-text-muted/15 text-scada-text-muted border border-scada-text-muted/30'
                  : 'bg-scada-warning/15 text-scada-warning border border-scada-warning/30'
              }`}>
                {project.phase === 'fermenting' ? 'Fermentation' : project.phase === 'complete' ? 'Terminé' : project.phase}
              </span>
            </div>
          </div>

          {/* Archive / Delete — always visible */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { archiveProject(project.id); navigate('/archives') }}
              className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg text-scada-accent bg-scada-accent/10 border border-scada-accent/20 hover:bg-scada-accent/20 transition-colors"
              title="Archiver le projet"
            >
              <Archive size={12} />
              <span className="hidden sm:inline">Archiver</span>
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg text-scada-danger/70 hover:text-scada-danger hover:bg-scada-danger/10 transition-colors"
                title="Supprimer le projet"
              >
                <Trash2 size={12} />
              </button>
            ) : (
              <button
                onClick={() => { deleteProject(project.id); navigate('/') }}
                className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg text-white bg-scada-danger/80 hover:bg-scada-danger transition-colors"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Confirmer</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick stats — separate row on mobile */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pl-11 sm:pl-0">
          <div className="text-right shrink-0">
            <div className="text-[9px] text-scada-text-muted uppercase">Jour</div>
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-scada-text-secondary" />
              <span className="font-mono text-sm font-bold text-white">J{daysSinceStart}</span>
            </div>
          </div>
          {needsHumidity ? (
            <div className="text-right shrink-0">
              <div className="text-[9px] text-scada-text-muted uppercase">Humidité</div>
              <div className="flex items-center gap-1">
                <Droplet size={11} className="text-scada-cold" />
                <span className="font-mono text-sm font-bold text-white">{(project.currentHumidity ?? 0).toFixed(0)}%</span>
              </div>
            </div>
          ) : (
            <>
              <div className="text-right shrink-0">
                <div className="text-[9px] text-scada-text-muted uppercase">Densité</div>
                <div className="flex items-center gap-1">
                  <Droplets size={11} className="text-scada-cold" />
                  <span className="font-mono text-sm font-bold text-white">{project.currentGravity.toFixed(3)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] text-scada-text-muted uppercase">Atténuation</div>
                <span className="font-mono text-sm font-bold text-scada-accent">{progressPct.toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main content — 2x2 grid: rows are shared so left & right align */}
      {fermenter && (
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-2 sm:gap-3">
          {/* Row 1 Left: Vessel */}
          <div className="lg:col-span-4 lg:row-start-1">
            <div className="scada-card flex justify-center py-4 h-full">
              {project.projectType === 'koji' ? (
                <KojiTraySVG
                  name={fermenter.name}
                  temperature={fermenter.temperature}
                  humidity={fermenter.humidity}
                  heating={fermenter.relayOn}
                  humidityRelayOn={fermenter.humidityRelayOn}
                  width={180}
                  height={260}
                />
              ) : project.projectType === 'mushroom' ? (
                <MushroomBagSVG
                  name={fermenter.name}
                  temperature={fermenter.temperature}
                  humidity={fermenter.humidity}
                  heating={fermenter.relayOn}
                  humidityRelayOn={fermenter.humidityRelayOn}
                  width={180}
                  height={260}
                />
              ) : (
                <VesselSVG
                  name={fermenter.name}
                  temperature={fermenter.temperature}
                  targetTemp={fermenter.setpoint}
                  level={fermenter.level}
                  liquidColor={srmToColor(project.srm)}
                  heating={fermenter.relayOn}
                  bubbles={true}
                  width={180}
                  height={260}
                />
              )}
            </div>
          </div>

          {/* Row 1 Right: Temperature chart */}
          <div className="lg:col-span-8 lg:row-start-1">
            <TemperatureChart fermenterId={fermenter.id} className="h-full" />
          </div>

          {/* Row 2 Left: Controls */}
          <div className="lg:col-span-4 lg:row-start-2">
            <ProjectControls fermenterId={fermenter.id} />
          </div>

          {/* Row 2 Right: Humidity or Gravity chart */}
          <div className="lg:col-span-8 lg:row-start-2">
            {needsHumidity ? (
              <HumidityChart
                humidityHistory={project.humidityHistory ?? []}
                targetHumidity={project.targetHumidity ?? 85}
                className="h-full"
                projectId={project.id}
              />
            ) : (
              <GravityChart
                gravityHistory={project.gravityHistory}
                og={project.og}
                fg={project.fg}
                color={srmToColor(project.srm)}
                className="h-full"
                projectId={project.id}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
