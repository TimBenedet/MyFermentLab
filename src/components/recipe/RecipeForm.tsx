import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Play, Plus, Trash2, Wheat, Hop, FlaskConical, Droplets, Package } from 'lucide-react'
import { useBrewingActions } from '../../context/BrewingContext'
import { generateId, srmToColor } from '../../simulation/constants'
import type { Recipe, RecipeIngredient, RecipeStep, IngredientType, ProjectType } from '../../types/brewing'

const ingredientIcons: Record<IngredientType, typeof Wheat> = {
  grain: Wheat,
  houblon: Hop,
  levure: FlaskConical,
  eau: Droplets,
  autre: Package,
}

interface Props {
  recipe: Recipe
  isNew: boolean
  onSaved: (recipe: Recipe) => void
  onCancel: () => void
}

export function RecipeForm({ recipe, isNew, onSaved, onCancel }: Props) {
  const navigate = useNavigate()
  const { saveRecipe, updateRecipe } = useBrewingActions()
  const [form, setForm] = useState<Recipe>({ ...recipe, ingredients: recipe.ingredients.map(i => ({ ...i })), steps: recipe.steps.map(s => ({ ...s })) })

  const update = <K extends keyof Recipe>(key: K, value: Recipe[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    // Auto-calc ABV
    const abv = ((form.og - form.fg) * 131.25)
    const finalRecipe = { ...form, abv: Math.round(abv * 10) / 10 }
    if (isNew) {
      saveRecipe(finalRecipe)
    } else {
      updateRecipe(finalRecipe)
    }
    onSaved(finalRecipe)
  }

  const addIngredient = () => {
    update('ingredients', [...form.ingredients, {
      id: generateId('ing-'),
      name: '',
      type: 'grain' as IngredientType,
      quantity: 0,
      unit: 'kg',
      addAt: '',
    }])
  }

  const updateIngredient = (id: string, updates: Partial<RecipeIngredient>) => {
    update('ingredients', form.ingredients.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const removeIngredient = (id: string) => {
    update('ingredients', form.ingredients.filter(i => i.id !== id))
  }

  const addStep = () => {
    update('steps', [...form.steps, {
      id: generateId('step-'),
      description: '',
      day: 0,
      done: false,
      durationMinutes: undefined,
      targetTemp: undefined,
    }])
  }

  const updateStep = (id: string, updates: Partial<RecipeStep>) => {
    update('steps', form.steps.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const removeStep = (id: string) => {
    update('steps', form.steps.filter(s => s.id !== id))
  }

  return (
    <div className="scada-card space-y-4">
      <div className="flex items-center justify-between">
        <span className="scada-label">{isNew ? 'Nouvelle recette' : 'Modifier la recette'}</span>
        <div className="flex gap-2">
          <button onClick={onCancel} className="scada-btn-neutral text-[10px]">Annuler</button>
          <button onClick={handleSave} className="scada-btn-primary flex items-center gap-1 text-[10px]" disabled={!form.name.trim()}>
            <Save size={12} />
            Sauvegarder
          </button>
          {!isNew && (
            <button
              onClick={() => navigate(`/recipes/${form.id}/brew`)}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] rounded-lg font-medium bg-scada-accent/20 text-scada-accent border border-scada-accent/30 hover:bg-scada-accent/30 transition-colors"
            >
              <Play size={12} />
              Brasser
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Type de projet</label>
          <select
            value={form.projectType}
            onChange={e => update('projectType', e.target.value as ProjectType)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white focus:outline-none focus:border-scada-accent/50"
          >
            <option value="beer">Bière</option>
            <option value="mead">Hydromel</option>
            <option value="koji">Koji</option>
            <option value="mushroom">Champignons</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Nom</label>
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white focus:outline-none focus:border-scada-accent/50"
            placeholder="Amber Ale..."
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Style</label>
          <input
            type="text"
            value={form.style}
            onChange={e => update('style', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white focus:outline-none focus:border-scada-accent/50"
            placeholder="American Amber Ale..."
          />
        </div>

        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">Volume (L)</label>
          <input type="number" value={form.batchSize} onChange={e => update('batchSize', +e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
        </div>
        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">OG</label>
          <input type="number" step="0.001" value={form.og} onChange={e => update('og', +e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
        </div>
        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">FG</label>
          <input type="number" step="0.001" value={form.fg} onChange={e => update('fg', +e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
        </div>
        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">IBU</label>
          <input type="number" value={form.ibu} onChange={e => update('ibu', +e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
        </div>
        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">
            SRM <span className="inline-block w-2.5 h-2.5 rounded-full ml-1 align-middle" style={{ backgroundColor: srmToColor(form.srm) }} />
          </label>
          <input type="number" value={form.srm} onChange={e => update('srm', +e.target.value)}
            className="w-full px-2.5 py-1.5 bg-scada-bg rounded border border-scada-border text-xs text-white font-mono focus:outline-none focus:border-scada-accent/50" />
        </div>
        <div>
          <label className="block text-[9px] text-scada-text-muted uppercase tracking-wider mb-1">ABV (auto)</label>
          <div className="px-2.5 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-xs text-scada-text-secondary font-mono">
            {((form.og - form.fg) * 131.25).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium">Ingrédients</span>
          <button onClick={addIngredient} className="flex items-center gap-1 text-[9px] text-scada-accent hover:text-white transition-colors">
            <Plus size={10} /> Ajouter
          </button>
        </div>
        <div className="space-y-1.5">
          {form.ingredients.map(ing => {
            const Icon = ingredientIcons[ing.type]
            return (
              <div key={ing.id} className="flex items-center gap-2 p-2 bg-scada-bg rounded border border-scada-border">
                <Icon size={12} className="text-scada-text-secondary shrink-0" />
                <input
                  type="text"
                  value={ing.name}
                  onChange={e => updateIngredient(ing.id, { name: e.target.value })}
                  className="flex-1 min-w-0 px-1.5 py-0.5 bg-transparent text-xs text-white focus:outline-none"
                  placeholder="Nom..."
                />
                <select
                  value={ing.type}
                  onChange={e => updateIngredient(ing.id, { type: e.target.value as IngredientType })}
                  className="px-1.5 py-0.5 bg-scada-bg-secondary text-[9px] text-scada-text-secondary rounded border border-scada-border focus:outline-none"
                >
                  <option value="grain">Grain</option>
                  <option value="houblon">Houblon</option>
                  <option value="levure">Levure</option>
                  <option value="eau">Eau</option>
                  <option value="autre">Autre</option>
                </select>
                <input
                  type="number"
                  value={ing.quantity}
                  onChange={e => updateIngredient(ing.id, { quantity: +e.target.value })}
                  className="w-16 px-1.5 py-0.5 bg-scada-bg-secondary text-xs text-white font-mono rounded border border-scada-border text-right focus:outline-none"
                />
                <input
                  type="text"
                  value={ing.unit}
                  onChange={e => updateIngredient(ing.id, { unit: e.target.value })}
                  className="w-10 px-1 py-0.5 bg-scada-bg-secondary text-[9px] text-scada-text-secondary rounded border border-scada-border text-center focus:outline-none"
                />
                <input
                  type="text"
                  value={ing.addAt}
                  onChange={e => updateIngredient(ing.id, { addAt: e.target.value })}
                  className="w-28 px-1.5 py-0.5 bg-scada-bg-secondary text-[9px] text-scada-text-secondary rounded border border-scada-border focus:outline-none"
                  placeholder="Quand..."
                />
                <button onClick={() => removeIngredient(ing.id)} className="text-scada-danger/50 hover:text-scada-danger">
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium">Étapes</span>
          <button onClick={addStep} className="flex items-center gap-1 text-[9px] text-scada-accent hover:text-white transition-colors">
            <Plus size={10} /> Ajouter
          </button>
        </div>
        <div className="space-y-1.5">
          {form.steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 p-2 bg-scada-bg rounded border border-scada-border">
              <span className="text-[9px] text-scada-text-muted w-4 shrink-0 text-center">{idx + 1}</span>
              <input
                type="text"
                value={step.description}
                onChange={e => updateStep(step.id, { description: e.target.value })}
                className="flex-1 min-w-0 px-1.5 py-0.5 bg-transparent text-xs text-white focus:outline-none"
                placeholder="Description..."
              />
              <div className="flex items-center gap-1">
                <label className="text-[8px] text-scada-text-muted">Jour</label>
                <input
                  type="number"
                  value={step.day}
                  onChange={e => updateStep(step.id, { day: +e.target.value })}
                  className="w-10 px-1 py-0.5 bg-scada-bg-secondary text-[9px] text-white font-mono rounded border border-scada-border text-center focus:outline-none"
                  min={0}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[8px] text-scada-text-muted">Min</label>
                <input
                  type="number"
                  value={step.durationMinutes ?? ''}
                  onChange={e => updateStep(step.id, { durationMinutes: e.target.value ? +e.target.value : undefined })}
                  className="w-12 px-1 py-0.5 bg-scada-bg-secondary text-[9px] text-white font-mono rounded border border-scada-border text-center focus:outline-none"
                  placeholder="-"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[8px] text-scada-text-muted">°C</label>
                <input
                  type="number"
                  value={step.targetTemp ?? ''}
                  onChange={e => updateStep(step.id, { targetTemp: e.target.value ? +e.target.value : undefined })}
                  className="w-12 px-1 py-0.5 bg-scada-bg-secondary text-[9px] text-white font-mono rounded border border-scada-border text-center focus:outline-none"
                  placeholder="-"
                />
              </div>
              <button onClick={() => removeStep(step.id)} className="text-scada-danger/50 hover:text-scada-danger">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
