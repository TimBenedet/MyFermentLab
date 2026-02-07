import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { generateId } from '../../simulation/constants'
import type { RecipeIngredient, IngredientType, ProjectType } from '../../types/brewing'

const TYPE_OPTIONS: { value: IngredientType; label: string }[] = [
  { value: 'grain', label: 'Grain' },
  { value: 'houblon', label: 'Houblon' },
  { value: 'levure', label: 'Levure' },
  { value: 'eau', label: 'Eau' },
  { value: 'autre', label: 'Autre' },
]

interface Props {
  ingredients: RecipeIngredient[]
  onChange: (ingredients: RecipeIngredient[]) => void
  projectType: ProjectType
  readOnly?: boolean
}

const emptyForm = { name: '', type: 'grain' as IngredientType, quantity: '', unit: 'kg', addAt: '' }

export function IngredientEditor({ ingredients, onChange, readOnly }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const handleAdd = () => {
    if (!form.name.trim() || !form.quantity) return
    const ing: RecipeIngredient = {
      id: generateId('ing-'),
      name: form.name.trim(),
      type: form.type,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      addAt: form.addAt.trim() || '-',
    }
    onChange([...ingredients, ing])
    setForm(emptyForm)
  }

  const handleRemove = (id: string) => {
    onChange(ingredients.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="scada-label">Ingredients</div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-[10px] text-scada-accent hover:text-scada-accent/80 transition-colors"
          >
            {showAdd ? <X size={12} /> : <Plus size={12} />}
            {showAdd ? 'Fermer' : 'Ajouter'}
          </button>
        )}
      </div>

      {/* List */}
      {ingredients.length > 0 ? (
        <div className="space-y-1">
          {ingredients.map(ing => (
            <div key={ing.id} className="flex items-center justify-between p-2 bg-scada-bg rounded text-[10px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white truncate">{ing.name}</span>
                <span className="text-scada-text-muted shrink-0">({TYPE_OPTIONS.find(t => t.value === ing.type)?.label ?? ing.type})</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-scada-text-secondary shrink-0">
                <span>{ing.quantity} {ing.unit}</span>
                <span className="text-scada-text-muted">· {ing.addAt}</span>
                {!readOnly && (
                  <button type="button" onClick={() => handleRemove(ing.id)} className="text-scada-text-muted hover:text-scada-danger transition-colors ml-1">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-[10px] text-scada-text-muted text-center py-3">Aucun ingredient</p>
        )
      )}

      {/* Add form */}
      {showAdd && (
        <div className="grid grid-cols-6 gap-1.5 p-2 bg-scada-bg rounded-lg">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Nom"
            className="col-span-2 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as IngredientType })}
            className="col-span-1 px-1 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="number"
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: e.target.value })}
            placeholder="Qté"
            step="0.1"
            className="col-span-1 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="text"
            value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })}
            placeholder="Unité"
            className="col-span-1 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="text"
            value={form.addAt}
            onChange={e => setForm({ ...form, addAt: e.target.value })}
            placeholder="Ajout"
            className="col-span-3 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.name.trim() || !form.quantity}
            className="col-span-3 flex items-center justify-center gap-1 px-2 py-1.5 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded text-[10px] font-medium hover:bg-scada-accent/25 transition-colors disabled:opacity-40"
          >
            <Plus size={10} />
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}
