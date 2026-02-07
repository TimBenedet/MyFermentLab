import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Thermometer, Power, Droplet } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { useConnection } from '../context/ConnectionContext'
import { fetchDevices } from '../api/devices'
import { createBackendProject } from '../api/projects'
import type { BackendDevice } from '../types/backend'
import type { Recipe, ProjectType } from '../types/brewing'
import { SelectField } from '../components/project/DeviceSelectModal'

const TYPE_LABELS: Record<ProjectType, string> = {
  beer: 'Biere',
  mead: 'Hydromel',
  koji: 'Koji',
  mushroom: 'Champignons',
}

export function CreateProjectPage() {
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { startFermentation, updateProject } = useBrewingActions()
  const { mode } = useConnection()
  const isLive = mode === 'live'

  // Form state
  const [recipeId, setRecipeId] = useState<string | ''>('')
  const [projectType, setProjectType] = useState<ProjectType>('beer')
  const [projectName, setProjectName] = useState('')
  const [targetTemp, setTargetTemp] = useState(19)

  // Device state (live mode only)
  const [devices, setDevices] = useState<BackendDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [sensorId, setSensorId] = useState<string | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)
  const [humiditySensorId, setHumiditySensorId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)

  const selectedRecipe = recipeId ? state.recipes.find(r => r.id === recipeId) : null
  const needsHumidity = projectType === 'koji' || projectType === 'mushroom'

  // Sync projectType from selected recipe
  useEffect(() => {
    if (selectedRecipe) {
      setProjectType(selectedRecipe.projectType)
      const temp = selectedRecipe.steps.find(s => s.targetTemp)?.targetTemp
      if (temp) setTargetTemp(temp)
    }
  }, [selectedRecipe])

  // Load devices in live mode
  useEffect(() => {
    if (!isLive) return
    setLoadingDevices(true)
    fetchDevices()
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoadingDevices(false))
  }, [isLive])

  const sensors = devices.filter(d => d.type === 'sensor')
  const humiditySensors = devices.filter(d => d.type === 'humidity_sensor')
  const outlets = devices.filter(d => d.type === 'outlet')

  // Build a minimal recipe for non-recipe projects (koji/mushroom)
  const getRecipe = (): Recipe => {
    if (selectedRecipe) return selectedRecipe
    return {
      id: `temp-${Date.now()}`,
      projectType,
      name: projectName || TYPE_LABELS[projectType],
      style: TYPE_LABELS[projectType],
      batchSize: projectType === 'koji' ? 2 : projectType === 'mushroom' ? 5 : 25,
      og: 1.000,
      fg: 1.000,
      abv: 0,
      ibu: 0,
      srm: 0,
      ingredients: [],
      steps: [{ id: 'step-1', description: 'Fermentation', day: 1, done: false, targetTemp }],
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const recipe = getRecipe()
      const name = projectName.trim() || `${recipe.name} - ${new Date().toLocaleDateString('fr-FR')}`

      // Create local project + fermenter
      startFermentation(recipe, name)

      // Find the just-created project (last one added)
      // We need to wait for state update, so we get it after dispatch
      // The project ID is predictable from createProject: generateId('proj-')
      // But we can't reliably get it here. Instead, we'll find it by name after a tick.
      if (isLive && sensorId) {
        try {
          const bp = await createBackendProject({
            name,
            fermentationType: projectType,
            sensorId,
            outletId,
            targetTemperature: targetTemp,
            humiditySensorId: needsHumidity ? humiditySensorId : null,
            targetHumidity: needsHumidity ? (projectType === 'koji' ? 85 : 90) : undefined,
          })
          // Find the project we just created (most recent with matching name)
          // We use setTimeout to let the state update propagate
          setTimeout(() => {
            const proj = state.projects.find(p => p.name === name && p.phase === 'fermenting')
            if (proj) {
              updateProject(proj.id, {
                backendProjectId: bp.id,
                sensorId,
                outletId,
                humiditySensorId: needsHumidity ? humiditySensorId : null,
              })
            }
          }, 100)
        } catch { /* backend failed, continue in sim mode */ }
      }

      navigate('/')
    } finally {
      setCreating(false)
    }
  }

  const canCreate = projectName.trim() || selectedRecipe

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="scada-btn-neutral p-2">
          <ArrowLeft size={14} />
        </button>
        <div>
          <h2 className="text-sm font-bold text-white">Nouveau projet</h2>
          <p className="text-[10px] text-scada-text-muted">Lancer une fermentation directement</p>
        </div>
      </div>

      {/* Recipe or type selection */}
      <div className="scada-card space-y-3">
        <div className="scada-label">Recette</div>

        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">
            Recette existante (optionnel)
          </label>
          <select
            value={recipeId}
            onChange={e => setRecipeId(e.target.value)}
            className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
          >
            <option value="">-- Sans recette --</option>
            {state.recipes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({TYPE_LABELS[r.projectType]}) - {r.style}
              </option>
            ))}
          </select>
        </div>

        {!selectedRecipe && (
          <div>
            <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">
              Type de projet
            </label>
            <div className="flex gap-1.5">
              {(['beer', 'mead', 'koji', 'mushroom'] as ProjectType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setProjectType(t)}
                  className={`flex-1 px-2 py-2 text-[10px] rounded-lg border font-medium transition-colors ${
                    projectType === t
                      ? 'bg-scada-accent/15 text-scada-accent border-scada-accent/40'
                      : 'border-scada-border text-scada-text-muted hover:text-white'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">
              Nom du projet
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder={selectedRecipe ? `${selectedRecipe.name} - ${new Date().toLocaleDateString('fr-FR')}` : 'Mon projet...'}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              autoFocus
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">
              Temperature cible (°C)
            </label>
            <input
              type="number"
              value={targetTemp}
              onChange={e => setTargetTemp(+e.target.value)}
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white font-mono focus:outline-none focus:border-scada-accent/50"
              step={0.5}
            />
          </div>
        </div>
      </div>

      {/* Device selection (live mode only) */}
      {isLive && (
        <div className="scada-card space-y-3">
          <div className="scada-label">Devices</div>
          {loadingDevices ? (
            <p className="text-sm text-scada-text-muted text-center py-4">Chargement des devices...</p>
          ) : (
            <div className="space-y-3">
              <SelectField
                icon={<Thermometer size={14} />}
                label="Sonde temperature"
                value={sensorId}
                onChange={setSensorId}
                options={sensors}
                color="scada-accent"
              />

              {needsHumidity && (
                <SelectField
                  icon={<Droplet size={14} />}
                  label="Sonde humidite"
                  value={humiditySensorId}
                  onChange={setHumiditySensorId}
                  options={humiditySensors}
                  color="scada-cold"
                />
              )}

              <SelectField
                icon={<Power size={14} />}
                label="Prise connectee"
                value={outletId}
                onChange={setOutletId}
                options={outlets}
                color="scada-warning"
              />
            </div>
          )}
        </div>
      )}

      {/* Create button */}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-scada-accent/20 text-scada-accent border border-scada-accent/40 rounded-lg text-sm font-medium hover:bg-scada-accent/30 transition-colors disabled:opacity-50"
        >
          <Play size={16} />
          {creating ? 'Creation...' : 'Lancer la fermentation'}
        </button>
        <button onClick={() => navigate('/')} className="scada-btn-neutral px-4 py-3">
          Annuler
        </button>
      </div>
    </div>
  )
}
