import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Droplets, Droplet, Archive, Trash2, Wifi, Cpu, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { useConnection } from '../context/ConnectionContext'
import { fetchBackendProject, fetchLiveTemperature, archiveBackendProject, deleteBackendProject } from '../api/projects'
import { VesselSVG } from '../components/vessels/VesselSVG'
import { KojiTraySVG } from '../components/vessels/KojiTraySVG'
import { MushroomBagSVG } from '../components/vessels/MushroomBagSVG'
import { TemperatureChart } from '../components/charts/TemperatureChart'
import { GravityChart } from '../components/charts/GravityChart'
import { HumidityChart } from '../components/charts/HumidityChart'
import { ProjectControls } from '../components/project/ProjectControls'
import { IngredientEditor } from '../components/project/IngredientEditor'
import { StepEditor } from '../components/project/StepEditor'
import { BrewingAssistant } from '../components/BrewingAssistant'

import { srmToColor } from '../simulation/constants'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { archiveProject, deleteProject, syncLiveData, updateProject } = useBrewingActions()
  const { mode } = useConnection()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [chartTab, setChartTab] = useState<'temp' | 'humidity'>('temp')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!project?.backendProjectId || !project.fermenterId || refreshing) return
    setRefreshing(true)
    try {
      const live = await fetchLiveTemperature(project.backendProjectId)
      const bp = await fetchBackendProject(project.backendProjectId)
      syncLiveData(
        project.fermenterId,
        live.temperature,
        bp.outletActive,
        bp.currentHumidity ?? undefined,
        undefined,
        bp.targetTemperature,
        bp.targetHumidity ?? undefined,
        bp.activationThreshold ?? 0.2,
      )
    } catch { /* ignore */ }
    finally { setRefreshing(false) }
  }

  const project = state.projects.find(p => p.id === projectId)
  const fermenter = project?.fermenterId
    ? state.fermenters.find(f => f.id === project.fermenterId)
    : undefined

  const isLive = mode === 'live' && !!project?.backendProjectId
  // Live data polling is handled globally by useLiveSync (5s interval)

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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white truncate">{project.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0 ${
                project.phase === 'fermenting'
                  ? 'bg-scada-accent/15 text-scada-accent border border-scada-accent/30'
                  : project.phase === 'complete'
                  ? 'bg-scada-text-muted/15 text-scada-text-muted border border-scada-text-muted/30'
                  : 'bg-scada-warning/15 text-scada-warning border border-scada-warning/30'
              }`}>
                {project.phase === 'fermenting' ? 'Fermentation' : project.phase === 'complete' ? 'Terminé' : project.phase}
              </span>
              {isLive ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-accent/10 text-scada-accent border border-scada-accent/20 shrink-0">
                  <Wifi size={9} /> LIVE
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-text-muted/10 text-scada-text-muted border border-scada-text-muted/20 shrink-0">
                  <Cpu size={9} /> SIM
                </span>
              )}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-card text-scada-text-secondary border border-scada-border shrink-0">
                <Calendar size={9} /> J{daysSinceStart}
              </span>
              {needsHumidity ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-cold/10 text-scada-cold border border-scada-cold/20 shrink-0">
                  <Droplet size={9} /> {(project.currentHumidity ?? 0).toFixed(0)}%
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-card text-scada-text-secondary border border-scada-border shrink-0">
                    <Droplets size={9} /> {project.currentGravity.toFixed(3)}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-accent/10 text-scada-accent border border-scada-accent/20 shrink-0">
                    {progressPct.toFixed(0)}%
                  </span>
                </>
              )}
            </div>
            <p className="text-[10px] text-scada-text-muted truncate mt-0.5">{project.recipeName} - {project.style}</p>
          </div>

          {/* Refresh / Archive / Delete */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isLive && project.phase === 'fermenting' && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-lg text-scada-text-muted hover:text-scada-accent transition-colors"
                title="Rafraîchir les données"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={async () => {
                if (project.backendProjectId) {
                  try { await archiveBackendProject(project.backendProjectId) }
                  catch (e) { console.error('Backend archive failed:', e) }
                }
                archiveProject(project.id)
                navigate('/archives')
              }}
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
                onClick={async () => {
                  if (project.backendProjectId) {
                    try { await deleteBackendProject(project.backendProjectId) }
                    catch (e) { console.error('Backend delete failed:', e) }
                  }
                  deleteProject(project.id)
                  navigate('/')
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-[9px] rounded-lg text-white bg-scada-danger/80 hover:bg-scada-danger transition-colors"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Confirmer</span>
              </button>
            )}
          </div>
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

          {/* Row 1 Right: Charts — tabbed on mobile for koji/mushroom */}
          {needsHumidity ? (
            <>
              {/* Mobile: single card with tabs */}
              <div className="lg:hidden lg:col-span-8">
                <div className="scada-card flex flex-col">
                  <div className="flex items-center gap-1 mb-3">
                    <button
                      onClick={() => setChartTab('temp')}
                      className={`px-3 py-1.5 text-[10px] rounded uppercase tracking-wider transition-colors ${
                        chartTab === 'temp'
                          ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                          : 'text-scada-text-muted hover:text-scada-text-secondary border border-transparent'
                      }`}
                    >
                      Température
                    </button>
                    <button
                      onClick={() => setChartTab('humidity')}
                      className={`px-3 py-1.5 text-[10px] rounded uppercase tracking-wider transition-colors ${
                        chartTab === 'humidity'
                          ? 'bg-scada-cold/20 text-scada-cold border border-scada-cold/40'
                          : 'text-scada-text-muted hover:text-scada-text-secondary border border-transparent'
                      }`}
                    >
                      Humidité
                    </button>
                  </div>
                  {chartTab === 'temp' ? (
                    <TemperatureChart fermenterId={fermenter.id} backendProjectId={project.backendProjectId} className="!p-0 !bg-transparent !border-0 !shadow-none h-[240px]" />
                  ) : (
                    <HumidityChart
                      humidityHistory={project.humidityHistory ?? []}
                      targetHumidity={project.targetHumidity ?? 85}
                      className="!p-0 !bg-transparent !border-0 !shadow-none h-[240px]"
                      projectId={project.id}
                      backendProjectId={project.backendProjectId}
                    />
                  )}
                </div>
              </div>
              {/* Desktop: separate cards in 2×2 grid */}
              <div className="hidden lg:block lg:col-span-8 lg:row-start-1">
                <TemperatureChart fermenterId={fermenter.id} backendProjectId={project.backendProjectId} className="h-full" />
              </div>
            </>
          ) : (
            <div className="lg:col-span-8 lg:row-start-1">
              <TemperatureChart fermenterId={fermenter.id} backendProjectId={project.backendProjectId} className="h-full" />
            </div>
          )}

          {/* Row 2 Left: Controls */}
          <div className="lg:col-span-4 lg:row-start-2">
            <ProjectControls fermenterId={fermenter.id} backendProjectId={project.backendProjectId} />
          </div>

          {/* Row 2 Right: Humidity or Gravity chart */}
          {needsHumidity ? (
            <div className="hidden lg:block lg:col-span-8 lg:row-start-2">
              <HumidityChart
                humidityHistory={project.humidityHistory ?? []}
                targetHumidity={project.targetHumidity ?? 85}
                className="h-full"
                projectId={project.id}
                backendProjectId={project.backendProjectId}
              />
            </div>
          ) : (
            <div className="lg:col-span-8 lg:row-start-2">
              <GravityChart
                gravityHistory={project.gravityHistory}
                og={project.og}
                fg={project.fg}
                color={srmToColor(project.srm)}
                className="h-full"
                projectId={project.id}
                backendProjectId={project.backendProjectId}
              />
            </div>
          )}
        </div>
      )}

      {/* Recipe section — collapsible */}
      <div className="scada-card">
        <button
          onClick={() => setRecipeOpen(!recipeOpen)}
          className="flex items-center gap-2 w-full text-left"
        >
          {recipeOpen ? <ChevronDown size={14} className="text-scada-text-muted" /> : <ChevronRight size={14} className="text-scada-text-muted" />}
          <span className="scada-label">Recette</span>
          <span className="text-[9px] text-scada-text-muted ml-auto">
            {project.ingredients.length} ing. · {project.steps.length} etapes
          </span>
        </button>

        {recipeOpen && (
          <div className="mt-3 space-y-4">
            {/* Recipe scalars */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div className="bg-scada-bg rounded-lg p-2 text-center">
                <div className="text-[8px] text-scada-text-muted uppercase">Style</div>
                <div className="text-[10px] text-white font-medium mt-0.5 truncate">{project.style}</div>
              </div>
              <div className="bg-scada-bg rounded-lg p-2 text-center">
                <div className="text-[8px] text-scada-text-muted uppercase">Volume</div>
                <div className="font-mono text-xs font-bold text-white mt-0.5">{project.batchSize}{needsHumidity ? 'kg' : 'L'}</div>
              </div>
              {!needsHumidity && (
                <>
                  <div className="bg-scada-bg rounded-lg p-2 text-center">
                    <div className="text-[8px] text-scada-text-muted uppercase">OG</div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">{project.og.toFixed(3)}</div>
                  </div>
                  <div className="bg-scada-bg rounded-lg p-2 text-center">
                    <div className="text-[8px] text-scada-text-muted uppercase">FG</div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">{project.fg.toFixed(3)}</div>
                  </div>
                  <div className="bg-scada-bg rounded-lg p-2 text-center">
                    <div className="text-[8px] text-scada-text-muted uppercase">ABV</div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">{project.abv}%</div>
                  </div>
                  <div className="bg-scada-bg rounded-lg p-2 text-center">
                    <div className="text-[8px] text-scada-text-muted uppercase">SRM</div>
                    <div className="font-mono text-xs font-bold text-white mt-0.5">{project.srm}</div>
                  </div>
                </>
              )}
            </div>

            <IngredientEditor
              ingredients={project.ingredients}
              onChange={(ingredients) => updateProject(project.id, { ingredients })}
              projectType={project.projectType}
            />

            <StepEditor
              steps={project.steps}
              onChange={(steps) => updateProject(project.id, { steps })}
            />
          </div>
        )}
      </div>

      {/* Brewing Assistant */}
      <BrewingAssistant project={project} fermenter={fermenter} />
    </div>
  )
}
