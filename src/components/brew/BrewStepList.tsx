import { Check, SkipForward, Clock, Thermometer, ChevronRight } from 'lucide-react'
import { useBrewingActions } from '../../context/BrewingContext'
import type { BrewStepState, RecipeStep } from '../../types/brewing'

interface Props {
  steps: BrewStepState[]
  recipeSteps: RecipeStep[]
  currentStepIndex: number
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function BrewStepList({ steps, recipeSteps, currentStepIndex }: Props) {
  const { advanceBrewStep, skipBrewStep } = useBrewingActions()

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const recipeStep = recipeSteps.find(s => s.id === step.stepId)
        if (!recipeStep) return null

        const isActive = idx === currentStepIndex && step.status === 'active'
        const isDone = step.status === 'completed'
        const isSkipped = step.status === 'skipped'
        const isPending = step.status === 'pending'

        const durationSec = recipeStep.durationMinutes ? recipeStep.durationMinutes * 60 : null
        const isOvertime = durationSec ? step.elapsedSeconds > durationSec : false
        const progressPct = durationSec ? Math.min(100, (step.elapsedSeconds / durationSec) * 100) : 0

        return (
          <div
            key={step.stepId}
            className={`scada-card transition-all ${
              isActive
                ? `border-scada-accent/40 ${isOvertime ? 'animate-pulse border-scada-warning/50' : ''}`
                : isDone ? 'opacity-60' : isSkipped ? 'opacity-40' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Step number / icon */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                isDone ? 'bg-scada-accent/20 text-scada-accent'
                  : isSkipped ? 'bg-scada-text-muted/20 text-scada-text-muted'
                  : isActive ? 'bg-scada-accent/20 text-scada-accent'
                  : 'bg-scada-bg-secondary text-scada-text-muted'
              }`}>
                {isDone ? <Check size={14} /> : isSkipped ? <SkipForward size={12} /> : idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isActive ? 'text-white' : isDone ? 'text-scada-text-secondary line-through' : isSkipped ? 'text-scada-text-muted line-through' : 'text-scada-text-secondary'}`}>
                    {recipeStep.description}
                  </span>
                  {recipeStep.targetTemp && (
                    <span className="flex items-center gap-0.5 text-[9px] text-scada-warning font-mono">
                      <Thermometer size={9} />
                      {recipeStep.targetTemp}°C
                    </span>
                  )}
                </div>

                {/* Timer */}
                {isActive && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <Clock size={11} className={isOvertime ? 'text-scada-warning' : 'text-scada-accent'} />
                      <span className={`font-mono text-sm font-bold ${isOvertime ? 'text-scada-warning' : 'text-white'}`}>
                        {formatTimer(step.elapsedSeconds)}
                      </span>
                      {durationSec && (
                        <span className="text-[9px] text-scada-text-muted font-mono">
                          / {formatTimer(durationSec)}
                        </span>
                      )}
                    </div>
                    {durationSec && (
                      <div className="h-1 bg-scada-bg rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full transition-all ${isOvertime ? 'bg-scada-warning' : 'bg-scada-accent'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Done timer */}
                {(isDone || isSkipped) && step.elapsedSeconds > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-scada-text-muted font-mono">
                    <Clock size={9} />
                    {formatTimer(step.elapsedSeconds)}
                  </div>
                )}
              </div>

              {/* Actions */}
              {isActive && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={skipBrewStep}
                    className="px-2 py-1.5 text-[9px] rounded text-scada-text-muted hover:text-white hover:bg-scada-card transition-colors"
                    title="Passer"
                  >
                    <SkipForward size={12} />
                  </button>
                  <button
                    onClick={advanceBrewStep}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-lg font-medium bg-scada-accent/20 text-scada-accent border border-scada-accent/30 hover:bg-scada-accent/30 transition-colors"
                  >
                    Suivant
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {isPending && (
                <div className="shrink-0">
                  <span className="text-[8px] text-scada-text-muted uppercase">En attente</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
