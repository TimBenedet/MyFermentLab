import { useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import { srmToColor } from '../../simulation/constants'
import type { Recipe, ProjectType } from '../../types/brewing'

const TYPE_LABELS: Record<ProjectType, string> = {
  beer: 'Biere',
  mead: 'Hydromel',
  koji: 'Koji',
  mushroom: 'Champignons',
}

interface Props {
  recipe: Recipe
  onLaunch: (recipe: Recipe) => void
  onDelete: (recipe: Recipe) => void
}

export function RecipeCard({ recipe, onLaunch, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isBeerLike = recipe.projectType === 'beer' || recipe.projectType === 'mead'
  const needsHumidity = recipe.projectType === 'koji' || recipe.projectType === 'mushroom'

  return (
    <div className="scada-card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: srmToColor(recipe.srm) }}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{recipe.name}</h3>
            <p className="text-[10px] text-scada-text-muted truncate">{recipe.style}</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-scada-card border border-scada-border text-scada-text-secondary shrink-0">
          {TYPE_LABELS[recipe.projectType]}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-scada-bg rounded-lg p-2 text-center">
          <div className="text-[8px] text-scada-text-muted uppercase">Volume</div>
          <div className="font-mono text-xs font-bold text-white mt-0.5">
            {recipe.batchSize}{needsHumidity ? 'kg' : 'L'}
          </div>
        </div>
        {isBeerLike ? (
          <>
            <div className="bg-scada-bg rounded-lg p-2 text-center">
              <div className="text-[8px] text-scada-text-muted uppercase">OG/FG</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">
                {recipe.og.toFixed(3)}/{recipe.fg.toFixed(3)}
              </div>
            </div>
            <div className="bg-scada-bg rounded-lg p-2 text-center">
              <div className="text-[8px] text-scada-text-muted uppercase">ABV</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">{recipe.abv}%</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-scada-bg rounded-lg p-2 text-center">
              <div className="text-[8px] text-scada-text-muted uppercase">Ingredients</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">{recipe.ingredients.length}</div>
            </div>
            <div className="bg-scada-bg rounded-lg p-2 text-center">
              <div className="text-[8px] text-scada-text-muted uppercase">Etapes</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">{recipe.steps.length}</div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onLaunch(recipe)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded-lg text-[11px] font-medium hover:bg-scada-accent/25 transition-colors"
        >
          <Play size={12} />
          Lancer
        </button>
        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={() => onDelete(recipe)}
              className="px-3 py-2 bg-scada-danger/15 text-scada-danger border border-scada-danger/30 rounded-lg text-[11px] font-medium hover:bg-scada-danger/25 transition-colors"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="scada-btn-neutral px-3 py-2 text-[11px]"
            >
              Non
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-scada-text-muted hover:text-scada-danger transition-colors rounded-lg hover:bg-scada-danger/10"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
