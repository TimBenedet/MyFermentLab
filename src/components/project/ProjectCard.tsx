import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Thermometer, Droplets, Droplet, Calendar, RefreshCw } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../../context/BrewingContext'
import { useConnection } from '../../context/ConnectionContext'
import { fetchBackendProject, fetchLiveTemperature } from '../../api/projects'
import { srmToColor } from '../../simulation/constants'
import { VesselSVG } from '../vessels/VesselSVG'
import { KojiTraySVG } from '../vessels/KojiTraySVG'
import { MushroomBagSVG } from '../vessels/MushroomBagSVG'
import type { BrewProject } from '../../types/brewing'

interface Props {
  project: BrewProject
}

export function ProjectCard({ project }: Props) {
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { syncLiveData } = useBrewingActions()
  const { mode } = useConnection()
  const [refreshing, setRefreshing] = useState(false)

  const isLive = mode === 'live' && !!project.backendProjectId

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!project.backendProjectId || !project.fermenterId || refreshing) return
    setRefreshing(true)
    try {
      // Sequential: live-temperature triggers backend control, then fetch updated state
      const live = await fetchLiveTemperature(project.backendProjectId)
      const bp = await fetchBackendProject(project.backendProjectId)
      syncLiveData(
        project.fermenterId,
        live.temperature,
        bp.outletActive,
        bp.currentHumidity ?? undefined,
      )
    } catch { /* ignore */ }
    finally { setRefreshing(false) }
  }

  const fermenter = project.fermenterId
    ? state.fermenters.find(f => f.id === project.fermenterId)
    : undefined

  const daysSinceStart = project.fermentationStartedAt
    ? Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)
    : 0

  const progressPct = project.og !== project.fg
    ? Math.min(100, Math.max(0, ((project.og - project.currentGravity) / (project.og - project.fg)) * 100))
    : 0

  const needsHumidity = project.projectType === 'koji' || project.projectType === 'mushroom'
  const beerColor = srmToColor(project.srm)

  return (
    <button
      onClick={() => navigate(`/project/${project.id}`)}
      className="scada-card text-left w-full hover:border-scada-accent/30 transition-all group cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: beerColor }}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate group-hover:text-scada-accent transition-colors">
              {project.name}
            </h3>
            <p className="text-[10px] text-scada-text-muted truncate">{project.style}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isLive && project.phase === 'fermenting' && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 rounded text-scada-text-muted hover:text-scada-accent transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
            project.phase === 'fermenting'
              ? 'bg-scada-accent/15 text-scada-accent'
              : 'bg-scada-text-muted/15 text-scada-text-muted'
          }`}>
            {project.phase === 'fermenting' ? 'Fermentation' : 'Terminé'}
          </span>
        </div>
      </div>

      {/* Vessel centered — type-specific visual */}
      {fermenter && (
        <div className="flex justify-center py-2 sm:py-3 mb-2 sm:mb-3">
          {project.projectType === 'koji' ? (
            <KojiTraySVG
              name={fermenter.name}
              temperature={fermenter.temperature}
              humidity={fermenter.humidity}
              heating={fermenter.relayOn}
              humidityRelayOn={fermenter.humidityRelayOn}
              width={140}
              height={200}
            />
          ) : project.projectType === 'mushroom' ? (
            <MushroomBagSVG
              name={fermenter.name}
              temperature={fermenter.temperature}
              humidity={fermenter.humidity}
              heating={fermenter.relayOn}
              humidityRelayOn={fermenter.humidityRelayOn}
              width={140}
              height={200}
            />
          ) : (
            <VesselSVG
              name={fermenter.name}
              temperature={fermenter.temperature}
              targetTemp={fermenter.setpoint}
              level={fermenter.level}
              liquidColor={beerColor}
              heating={fermenter.relayOn}
              bubbles={true}
              width={140}
              height={200}
            />
          )}
        </div>
      )}

      {/* Metrics row */}
      {fermenter && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
          <div className="bg-scada-bg-secondary rounded-lg p-1.5 sm:p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Thermometer size={12} className="text-scada-accent" />
              <span className="text-[9px] text-scada-text-muted">Temp.</span>
            </div>
            <span className="font-mono text-sm font-bold text-white">{fermenter.temperature.toFixed(1)}°C</span>
          </div>
          <div className="bg-scada-bg-secondary rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {needsHumidity ? (
                <><Droplet size={12} className="text-scada-cold" /><span className="text-[9px] text-scada-text-muted">Humidité</span></>
              ) : (
                <><Droplets size={12} className="text-scada-cold" /><span className="text-[9px] text-scada-text-muted">Densité</span></>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-white">
              {needsHumidity
                ? `${(project.currentHumidity ?? 0).toFixed(0)}%`
                : project.currentGravity.toFixed(3)
              }
            </span>
          </div>
          <div className="bg-scada-bg-secondary rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar size={12} className="text-scada-warning" />
              <span className="text-[9px] text-scada-text-muted">Jour</span>
            </div>
            <span className="font-mono text-sm font-bold text-white">J{daysSinceStart}</span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div>
        {needsHumidity ? (
          <>
            <div className="flex justify-between text-[9px] text-scada-text-muted mb-1">
              <span>Progression</span>
              <span>J{daysSinceStart}</span>
            </div>
            <div className="h-1.5 bg-scada-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-scada-cold"
                style={{ width: `${Math.min(100, (daysSinceStart / 7) * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-[9px] text-scada-text-muted mb-1">
              <span>Atténuation</span>
              <span>{progressPct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-scada-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: beerColor,
                }}
              />
            </div>
          </>
        )}
      </div>
    </button>
  )
}
