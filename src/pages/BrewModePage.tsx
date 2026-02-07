import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, X, ChefHat, CheckCircle2 } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { BrewStepList } from '../components/brew/BrewStepList'

export function BrewModePage() {
  const { recipeId } = useParams<{ recipeId: string }>()
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { startBrew, tickBrewTimer, completeBrew, cancelBrew } = useBrewingActions()

  const [projectName, setProjectName] = useState('')
  const [showNameDialog, setShowNameDialog] = useState(true)

  const recipe = state.recipes.find(r => r.id === recipeId)
  const activeBrew = state.activeBrew

  // Tick brew timer every second (real-time, independent of simulation speed)
  useEffect(() => {
    if (!activeBrew || !activeBrew.timerRunning) return
    const interval = setInterval(() => {
      tickBrewTimer(1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeBrew?.timerRunning, tickBrewTimer])

  if (!recipe) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-scada-text-muted">Recette introuvable</p>
          <button onClick={() => navigate('/recipes')} className="scada-btn-neutral mt-3">
            Retour aux recettes
          </button>
        </div>
      </div>
    )
  }

  // If activeBrew exists and matches this recipe, show brew mode
  const isBrewActive = activeBrew && activeBrew.recipeId === recipeId

  // Check if all steps are done
  const allDone = isBrewActive && activeBrew.steps.every(s => s.status === 'completed' || s.status === 'skipped')

  const handleStartBrew = () => {
    const name = projectName.trim() || `${recipe.name} - ${new Date().toLocaleDateString('fr-FR')}`
    startBrew(recipe.id, name)
    setShowNameDialog(false)
  }

  const handleCompleteBrew = () => {
    completeBrew()
    navigate('/')
  }

  const handleCancelBrew = () => {
    if (window.confirm('Annuler le brassage ? Le projet sera supprimé.')) {
      cancelBrew()
      navigate('/recipes')
    }
  }

  // Name dialog before starting
  if (!isBrewActive && showNameDialog) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="scada-card max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-scada-accent/15 flex items-center justify-center">
              <ChefHat size={20} className="text-scada-accent" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{recipe.name}</h2>
              <p className="text-[10px] text-scada-text-muted">{recipe.style}</p>
            </div>
          </div>

          <label className="block mb-1 text-[10px] text-scada-text-secondary uppercase tracking-wider">
            Nom du brassage
          </label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder={`${recipe.name} - ${new Date().toLocaleDateString('fr-FR')}`}
            className="w-full px-3 py-2 bg-scada-bg rounded-lg border border-scada-border text-sm text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50 mb-4"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleStartBrew()}
          />

          <div className="flex gap-2">
            <button onClick={handleStartBrew} className="scada-btn-primary flex-1 flex items-center justify-center gap-2">
              <Play size={14} />
              Commencer le brassage
            </button>
            <button onClick={() => navigate('/recipes')} className="scada-btn-neutral">
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isBrewActive) {
    navigate('/recipes')
    return null
  }

  // Get the brew-day steps from the recipe (day === 0)
  const brewDaySteps = recipe.steps.filter(s => s.day === 0)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="scada-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">{recipe.name}</h2>
            <p className="text-[10px] text-scada-text-muted">{recipe.style} - {state.projects.find(p => p.id === activeBrew.projectId)?.name}</p>
          </div>
          <button onClick={handleCancelBrew} className="scada-btn-danger flex items-center gap-1 text-[10px]">
            <X size={12} />
            Annuler
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[9px] text-scada-text-muted mb-1">
            <span>Progression</span>
            <span>
              {activeBrew.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length} / {activeBrew.steps.length}
            </span>
          </div>
          <div className="h-1.5 bg-scada-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-scada-accent rounded-full transition-all duration-500"
              style={{
                width: `${(activeBrew.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length / activeBrew.steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <BrewStepList
        steps={activeBrew.steps}
        recipeSteps={brewDaySteps}
        currentStepIndex={activeBrew.currentStepIndex}
      />

      {/* Complete button */}
      {allDone && (
        <div className="scada-card bg-scada-accent/5 border-scada-accent/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-scada-accent" />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Brassage terminé !</p>
              <p className="text-[10px] text-scada-text-secondary">Le moût va être transféré en fermenteur.</p>
            </div>
            <button onClick={handleCompleteBrew} className="scada-btn-primary flex items-center gap-2">
              <Play size={14} />
              Lancer la fermentation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
