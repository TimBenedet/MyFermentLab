import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { useBrewing } from '../context/BrewingContext'
import { RecipeList } from '../components/recipe/RecipeList'
import { RecipeForm } from '../components/recipe/RecipeForm'
import type { Recipe, ProjectType } from '../types/brewing'
import { generateId, BEER_TEMPLATES, KOJI_TEMPLATES, MUSHROOM_TEMPLATES, MEAD_TEMPLATES, srmToColor } from '../simulation/constants'

const ALL_TEMPLATES: Omit<Recipe, 'id'>[] = [
  ...BEER_TEMPLATES,
  ...MEAD_TEMPLATES,
  ...KOJI_TEMPLATES,
  ...MUSHROOM_TEMPLATES,
]

const TYPE_LABELS: Record<ProjectType, string> = {
  beer: 'Bière',
  mead: 'Hydromel',
  koji: 'Koji',
  mushroom: 'Champignons',
}

export function RecipesPage() {
  const { state } = useBrewing()
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')

  const selectedRecipe = selectedRecipeId
    ? state.recipes.find(r => r.id === selectedRecipeId) ?? null
    : null

  const isEditing = isCreating || selectedRecipe !== null

  const [templateRecipe, setTemplateRecipe] = useState<Recipe | null>(null)

  const handleNewBlank = () => {
    setShowTemplates(false)
    setTemplateRecipe(null)
    setSelectedRecipeId(null)
    setIsCreating(true)
  }

  const handlePickTemplate = (tpl: Omit<Recipe, 'id'>) => {
    const recipe: Recipe = {
      ...tpl,
      id: generateId('recipe-'),
      name: '',
      ingredients: tpl.ingredients.map(i => ({ ...i, id: generateId('ing-') })),
      steps: tpl.steps.map(s => ({ ...s, id: generateId('step-') })),
    }
    setShowTemplates(false)
    setTemplateRecipe(recipe)
    setSelectedRecipeId(null)
    setIsCreating(true)
  }

  const handleSelect = (recipe: Recipe) => {
    setIsCreating(false)
    setTemplateRecipe(null)
    setSelectedRecipeId(recipe.id)
  }

  const handleSaved = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id)
    setIsCreating(false)
    setTemplateRecipe(null)
  }

  const handleCancel = () => {
    setIsCreating(false)
    setSelectedRecipeId(null)
    setTemplateRecipe(null)
  }

  const emptyRecipe: Recipe = {
    id: generateId('recipe-'),
    projectType: 'beer',
    name: '',
    style: '',
    batchSize: 25,
    og: 1.050,
    fg: 1.010,
    abv: 5.2,
    ibu: 30,
    srm: 10,
    ingredients: [],
    steps: [],
  }

  // When editing, show the form full-width
  if (isEditing) {
    return (
      <div className="max-w-4xl mx-auto">
        <RecipeForm
          recipe={isCreating ? (templateRecipe ?? emptyRecipe) : selectedRecipe!}
          isNew={isCreating}
          onSaved={handleSaved}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // Template picker overlay
  if (showTemplates) {
    const filteredTemplates = typeFilter === 'all'
      ? ALL_TEMPLATES
      : ALL_TEMPLATES.filter(t => t.projectType === typeFilter)

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="scada-card">
          <div className="flex items-center justify-between mb-4">
            <span className="scada-label">Choisir un template</span>
            <button onClick={() => setShowTemplates(false)} className="scada-btn-neutral text-[10px]">
              Retour
            </button>
          </div>

          {/* Type filter tabs */}
          <div className="flex gap-1 mb-4">
            {(['all', 'beer', 'mead', 'koji', 'mushroom'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-[10px] rounded-lg font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-scada-accent/20 text-scada-accent border border-scada-accent/40'
                    : 'text-scada-text-muted hover:text-white border border-transparent'
                }`}
              >
                {t === 'all' ? 'Tous' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Blank recipe card */}
            <button
              onClick={handleNewBlank}
              className="p-4 rounded-lg border-2 border-dashed border-scada-border hover:border-scada-accent/40 transition-colors text-center group"
            >
              <Plus size={24} className="mx-auto mb-2 text-scada-text-muted group-hover:text-scada-accent transition-colors" />
              <div className="text-xs font-medium text-white">Recette vierge</div>
              <div className="text-[9px] text-scada-text-muted mt-0.5">Partir de zéro</div>
            </button>

            {/* Template cards */}
            {filteredTemplates.map((tpl, idx) => {
              const isHumidityType = tpl.projectType === 'koji' || tpl.projectType === 'mushroom'
              return (
                <button
                  key={idx}
                  onClick={() => handlePickTemplate(tpl)}
                  className="p-4 rounded-lg border border-scada-border bg-scada-bg hover:border-scada-accent/40 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-5 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: srmToColor(tpl.srm) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate group-hover:text-scada-accent transition-colors">
                          {tpl.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium shrink-0 ${
                          tpl.projectType === 'beer' ? 'bg-amber-500/15 text-amber-400' :
                          tpl.projectType === 'mead' ? 'bg-yellow-500/15 text-yellow-400' :
                          tpl.projectType === 'koji' ? 'bg-emerald-500/15 text-emerald-400' :
                          'bg-purple-500/15 text-purple-400'
                        }`}>
                          {TYPE_LABELS[tpl.projectType]}
                        </span>
                      </div>
                      <div className="text-[9px] text-scada-text-muted truncate">{tpl.style}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-scada-text-muted">
                    {isHumidityType ? (
                      <span>{tpl.batchSize} kg</span>
                    ) : (
                      <>
                        <span>OG {tpl.og.toFixed(3)}</span>
                        <span>·</span>
                        <span>{tpl.abv}%</span>
                        {tpl.ibu > 0 && (<><span>·</span><span>{tpl.ibu} IBU</span></>)}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-scada-text-muted mt-1">
                    <FileText size={9} />
                    <span>{tpl.ingredients.length} ingrédients · {tpl.steps.length} étapes</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Default: show the recipe list full-width
  return (
    <div className="max-w-4xl mx-auto">
      <div className="scada-card">
        <div className="flex items-center justify-between mb-4">
          <span className="scada-label">Mes recettes</span>
          <button onClick={() => setShowTemplates(true)} className="scada-btn-primary flex items-center gap-1.5">
            <Plus size={14} />
            Nouvelle recette
          </button>
        </div>
        <RecipeList
          recipes={state.recipes}
          selectedId={selectedRecipeId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}
