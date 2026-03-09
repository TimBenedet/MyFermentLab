import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Play, Thermometer, Power, Droplet, BookOpen } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { useConnection } from '../context/ConnectionContext'
import { fetchDevices } from '../api/devices'
import { createBackendProject } from '../api/projects'
import { createBackendRecipe } from '../api/recipes'
import { generateId, BEER_TEMPLATES, MEAD_TEMPLATES, KOJI_TEMPLATES, MUSHROOM_TEMPLATES } from '../simulation/constants'
import { IngredientEditor } from '../components/project/IngredientEditor'
import { StepEditor } from '../components/project/StepEditor'
import type { BackendDevice } from '../types/backend'
import type { Recipe, RecipeIngredient, RecipeStep, ProjectType } from '../types/brewing'
import { SelectField } from '../components/project/DeviceSelectModal'

const TYPE_LABELS: Record<ProjectType, string> = {
  beer: 'Biere',
  mead: 'Hydromel',
  koji: 'Koji',
  mushroom: 'Champignons',
}

function getTemplatesForType(type: ProjectType) {
  switch (type) {
    case 'beer': return BEER_TEMPLATES
    case 'mead': return MEAD_TEMPLATES
    case 'koji': return KOJI_TEMPLATES
    case 'mushroom': return MUSHROOM_TEMPLATES
  }
}

export function CreateProjectPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isRecipeMode = searchParams.get('mode') === 'recipe'
  const recipeId = searchParams.get('recipeId')
  const { state } = useBrewing()
  const { startFermentation, updateProject, addRecipe } = useBrewingActions()
  const { mode } = useConnection()
  const isLive = mode === 'live'

  // Form state
  const [projectType, setProjectType] = useState<ProjectType>('beer')
  const [projectName, setProjectName] = useState('')
  const [targetTemp, setTargetTemp] = useState(19)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  // Recipe scalars
  const [og, setOg] = useState(1.000)
  const [fg, setFg] = useState(1.000)
  const [abv, setAbv] = useState(0)
  const [ibu, setIbu] = useState(0)
  const [srm, setSrm] = useState(0)
  const [batchSize, setBatchSize] = useState(25)
  const [style, setStyle] = useState('')

  // Recipe details
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [steps, setSteps] = useState<RecipeStep[]>([
    { id: 'step-1', description: 'Fermentation', day: 1, done: false, targetTemp },
  ])

  // Device state (live mode only)
  const [devices, setDevices] = useState<BackendDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [sensorId, setSensorId] = useState<string | null>(null)
  const [outletId, setOutletId] = useState<string | null>(null)
  const [humiditySensorId, setHumiditySensorId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)

  const needsHumidity = projectType === 'koji' || projectType === 'mushroom'
  const isBeerLike = projectType === 'beer' || projectType === 'mead'

  // Reset template when project type changes
  useEffect(() => {
    setSelectedTemplate('')
    setBatchSize(projectType === 'koji' ? 2 : projectType === 'mushroom' ? 5 : 25)
    if (!isBeerLike) {
      setOg(1.000); setFg(1.000); setAbv(0); setIbu(0); setSrm(0)
    }
  }, [projectType, isBeerLike])

  // Load devices in live mode
  useEffect(() => {
    if (!isLive) return
    setLoadingDevices(true)
    fetchDevices()
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoadingDevices(false))
  }, [isLive])

  // Pre-fill from existing recipe
  useEffect(() => {
    if (!recipeId) return
    const recipe = state.recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setProjectType(recipe.projectType)
    setProjectName(recipe.name)
    setStyle(recipe.style)
    setBatchSize(recipe.batchSize)
    setOg(recipe.og); setFg(recipe.fg); setAbv(recipe.abv)
    setIbu(recipe.ibu); setSrm(recipe.srm)
    setIngredients(recipe.ingredients.map(i => ({ ...i, id: generateId('ing-') })))
    setSteps(recipe.steps.map(s => ({ ...s, id: generateId('step-') })))
    if (recipe.steps[0]?.targetTemp) setTargetTemp(recipe.steps[0].targetTemp)
  }, [recipeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = devices.filter(d => d.type === 'sensor')
  const humiditySensors = devices.filter(d => d.type === 'humidity_sensor')
  const outlets = devices.filter(d => d.type === 'outlet')

  const applyTemplate = (templateName: string) => {
    setSelectedTemplate(templateName)
    if (!templateName) return
    const templates = getTemplatesForType(projectType)
    const tpl = templates.find(t => t.name === templateName)
    if (!tpl) return

    if (!projectName) setProjectName(tpl.name)
    setStyle(tpl.style)
    setBatchSize(tpl.batchSize)
    setOg(tpl.og); setFg(tpl.fg); setAbv(tpl.abv)
    setIbu(tpl.ibu); setSrm(tpl.srm)
    setTargetTemp(tpl.steps[0]?.targetTemp ?? targetTemp)
    setIngredients(tpl.ingredients.map(i => ({ ...i, id: generateId('ing-') })))
    setSteps(tpl.steps.map(s => ({ ...s, id: generateId('step-') })))
  }

  const getRecipe = (): Recipe => ({
    id: `temp-${Date.now()}`,
    projectType,
    name: projectName || TYPE_LABELS[projectType],
    style: style || TYPE_LABELS[projectType],
    batchSize,
    og, fg, abv, ibu, srm,
    ingredients,
    steps,
  })

  const handleCreate = async () => {
    setCreating(true)
    try {
      const recipe = getRecipe()

      // Recipe-only mode: save recipe and return to library
      if (isRecipeMode) {
        recipe.id = generateId('recipe-')
        recipe.createdAt = Date.now()
        if (isLive) {
          try { await createBackendRecipe(recipe) } catch { /* continue in sim */ }
        }
        addRecipe(recipe)
        navigate('/recipes')
        return
      }

      // Normal fermentation launch
      const name = projectName.trim() || `${recipe.name} - ${new Date().toLocaleDateString('fr-FR')}`

      startFermentation(recipe, name)

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

  const canCreate = projectName.trim().length > 0
  const templates = getTemplatesForType(projectType)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(isRecipeMode ? '/recipes' : '/')} className="scada-btn-neutral p-2">
          <ArrowLeft size={14} />
        </button>
        <div>
          <h2 className="text-base font-bold text-white">
            {isRecipeMode ? 'Nouvelle recette' : recipeId ? 'Lancer depuis une recette' : 'Nouveau projet'}
          </h2>
          <p className="text-xs text-scada-text-muted">
            {isRecipeMode ? 'Sauvegarder dans la bibliotheque' : 'Lancer une fermentation'}
          </p>
        </div>
      </div>

      {/* Project type + name + template */}
      <div className="scada-card space-y-3">
        <div className="scada-label text-xs">Projet</div>

        <div>
          <label className="block text-[11px] text-scada-text-muted uppercase tracking-wider mb-1">
            Type de projet
          </label>
          <div className="flex gap-1.5">
            {(['beer', 'mead', 'koji', 'mushroom'] as ProjectType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setProjectType(t)}
                className={`flex-1 px-2 py-2 text-xs rounded-lg border font-medium transition-colors ${
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

        {/* Template selector */}
        <div>
          <label className="block text-[11px] text-scada-text-muted uppercase tracking-wider mb-1">
            Modele (optionnel)
          </label>
          <select
            value={selectedTemplate}
            onChange={e => applyTemplate(e.target.value)}
            className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
          >
            <option value="">-- Projet vide --</option>
            {templates.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] text-scada-text-muted uppercase tracking-wider mb-1">
              Nom du projet
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Mon projet..."
              className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
              autoFocus
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] text-scada-text-muted uppercase tracking-wider mb-1">
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

      {/* Recipe parameters */}
      <div className="scada-card space-y-3">
        <div className="scada-label text-xs">Parametres</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-scada-text-muted uppercase mb-1">Style</label>
            <input
              type="text"
              value={style}
              onChange={e => setStyle(e.target.value)}
              placeholder={TYPE_LABELS[projectType]}
              className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-scada-text-muted uppercase mb-1">Volume ({needsHumidity ? 'kg' : 'L'})</label>
            <input
              type="number"
              value={batchSize}
              onChange={e => setBatchSize(+e.target.value)}
              className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50"
              step={1}
            />
          </div>
          {isBeerLike && (
            <>
              <div>
                <label className="block text-[10px] text-scada-text-muted uppercase mb-1">OG</label>
                <input type="number" value={og} onChange={e => setOg(+e.target.value)} step={0.001} min={1}
                  className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
              </div>
              <div>
                <label className="block text-[10px] text-scada-text-muted uppercase mb-1">FG</label>
                <input type="number" value={fg} onChange={e => setFg(+e.target.value)} step={0.001} min={1}
                  className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
              </div>
              <div>
                <label className="block text-[10px] text-scada-text-muted uppercase mb-1">ABV %</label>
                <input type="number" value={abv} onChange={e => setAbv(+e.target.value)} step={0.1}
                  className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
              </div>
              <div>
                <label className="block text-[10px] text-scada-text-muted uppercase mb-1">IBU</label>
                <input type="number" value={ibu} onChange={e => setIbu(+e.target.value)} step={1}
                  className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
              </div>
              <div>
                <label className="block text-[10px] text-scada-text-muted uppercase mb-1">SRM</label>
                <input type="number" value={srm} onChange={e => setSrm(+e.target.value)} step={1}
                  className="w-full px-2.5 py-2 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div className="scada-card">
        <IngredientEditor
          ingredients={ingredients}
          onChange={setIngredients}
          projectType={projectType}
        />
      </div>

      {/* Steps */}
      <div className="scada-card">
        <StepEditor
          steps={steps}
          onChange={setSteps}
        />
      </div>

      {/* Device selection (live mode only, not in recipe mode) */}
      {isLive && !isRecipeMode && (
        <div className="scada-card space-y-3">
          <div className="scada-label text-xs">Devices</div>
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
          {isRecipeMode ? <BookOpen size={16} /> : <Play size={16} />}
          {creating ? 'Creation...' : isRecipeMode ? 'Sauvegarder la recette' : 'Lancer la fermentation'}
        </button>
        <button onClick={() => navigate(isRecipeMode ? '/recipes' : '/')} className="scada-btn-neutral px-4 py-3">
          Annuler
        </button>
      </div>
    </div>
  )
}
