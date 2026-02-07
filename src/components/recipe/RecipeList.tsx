import { useNavigate } from 'react-router-dom'
import { Play, Trash2 } from 'lucide-react'
import { useBrewingActions } from '../../context/BrewingContext'
import { srmToColor } from '../../simulation/constants'
import type { Recipe } from '../../types/brewing'

interface Props {
  recipes: Recipe[]
  selectedId: string | null
  onSelect: (recipe: Recipe) => void
}

export function RecipeList({ recipes, selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const { deleteRecipe } = useBrewingActions()

  if (recipes.length === 0) {
    return (
      <div className="text-center text-[10px] text-scada-text-muted py-8">
        Aucune recette
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {recipes.map(recipe => (
        <div
          key={recipe.id}
          onClick={() => onSelect(recipe)}
          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
            selectedId === recipe.id
              ? 'border-scada-accent/40 bg-scada-accent/5'
              : 'border-scada-border hover:border-scada-accent/20 bg-scada-bg'
          }`}
        >
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: srmToColor(recipe.srm) }}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{recipe.name}</div>
                <div className="text-[9px] text-scada-text-muted">{recipe.style}</div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-3 text-[9px] font-mono text-scada-text-secondary">
            <span>OG {recipe.og.toFixed(3)}</span>
            <span>IBU {recipe.ibu}</span>
            <span>{recipe.batchSize}L</span>
            <span>{recipe.abv}%</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/recipes/${recipe.id}/brew`)
              }}
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded text-scada-accent bg-scada-accent/10 hover:bg-scada-accent/20 transition-colors"
            >
              <Play size={10} />
              Brasser
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`Supprimer "${recipe.name}" ?`)) {
                  deleteRecipe(recipe.id)
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-[9px] rounded text-scada-danger/60 hover:text-scada-danger hover:bg-scada-danger/10 transition-colors ml-auto"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
