import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
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
  batchSize?: number
  boilHours?: number
  readOnly?: boolean
}

const emptyForm = { name: '', type: 'grain' as IngredientType, quantity: '', unit: 'kg', addAt: '' }

// Calcul BIAB sans rinçage
// Eau totale = (batchSize / 0.96) / (1 - 0.10 * boilHours) + totalGrainKg * 1
function calcWaterBIAB(batchSize: number, totalGrainKg: number, boilHours = 1): number {
  const postBoil = batchSize / 0.96
  const preBoil = postBoil / (1 - 0.10 * boilHours)
  const water = preBoil + totalGrainKg * 1.0
  return Math.round(water * 10) / 10
}

const WATER_ID_PREFIX = 'eau-auto-'

export function IngredientEditor({ ingredients, onChange, projectType, batchSize, boilHours = 1, readOnly }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const autoWaterRef = useRef<string | null>(null)

  // Recalcule l'eau automatique quand grains ou batchSize changent (bière uniquement)
  useEffect(() => {
    if (projectType !== 'beer' && projectType !== 'mead') return
    if (!batchSize) return

    const totalGrainKg = ingredients
      .filter(i => i.type === 'grain')
      .reduce((sum, i) => sum + i.quantity, 0)

    if (totalGrainKg === 0) {
      // Supprimer l'eau auto si plus de grain
      if (autoWaterRef.current) {
        onChange(ingredients.filter(i => i.id !== autoWaterRef.current))
        autoWaterRef.current = null
      }
      return
    }

    const waterQty = calcWaterBIAB(batchSize, totalGrainKg, boilHours)
    const existingAuto = ingredients.find(i => i.id === autoWaterRef.current)

    if (existingAuto) {
      // Mettre à jour la quantité
      onChange(ingredients.map(i =>
        i.id === autoWaterRef.current ? { ...i, quantity: waterQty } : i
      ))
    } else {
      // Créer l'ingrédient eau auto
      const id = generateId(WATER_ID_PREFIX)
      autoWaterRef.current = id
      const waterIng: RecipeIngredient = {
        id,
        name: 'Eau (BIAB)',
        type: 'eau',
        quantity: waterQty,
        unit: 'L',
        addAt: 'Empâtage',
      }
      onChange([...ingredients, waterIng])
    }
  }, [
    batchSize,
    boilHours,
    // Dépendance sur les grains seulement (évite boucle infinie)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ingredients.filter(i => i.type === 'grain').map(i => `${i.id}:${i.quantity}`).join(','),
    projectType,
  ])

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
    if (id === autoWaterRef.current) autoWaterRef.current = null
    onChange(ingredients.filter(i => i.id !== id))
  }

  const startEdit = (ing: RecipeIngredient) => {
    if (readOnly) return
    setEditingId(ing.id)
    setEditForm({
      name: ing.name,
      type: ing.type,
      quantity: String(ing.quantity),
      unit: ing.unit,
      addAt: ing.addAt === '-' ? '' : ing.addAt,
    })
  }

  const confirmEdit = () => {
    if (!editingId || !editForm.name.trim() || !editForm.quantity) return
    // Si on modifie l'eau auto manuellement, on détache du calcul auto
    if (editingId === autoWaterRef.current) autoWaterRef.current = null
    onChange(ingredients.map(ing =>
      ing.id === editingId
        ? {
            ...ing,
            name: editForm.name.trim(),
            type: editForm.type,
            quantity: parseFloat(editForm.quantity) || 0,
            unit: editForm.unit,
            addAt: editForm.addAt.trim() || '-',
          }
        : ing
    ))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const isAutoWater = (id: string) => id === autoWaterRef.current

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="scada-label text-xs">Ingredients</div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-xs text-scada-accent hover:text-scada-accent/80 transition-colors"
          >
            {showAdd ? <X size={14} /> : <Plus size={14} />}
            {showAdd ? 'Fermer' : 'Ajouter'}
          </button>
        )}
      </div>

      {/* List */}
      {ingredients.length > 0 ? (
        <div className="space-y-1">
          {ingredients.map(ing => (
            editingId === ing.id ? (
              /* Inline edit mode */
              <div key={ing.id} className="grid grid-cols-6 gap-1.5 p-2.5 bg-scada-bg rounded-lg border border-scada-accent/30">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="col-span-2 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                  autoFocus
                />
                <select
                  value={editForm.type}
                  onChange={e => setEditForm({ ...editForm, type: e.target.value as IngredientType })}
                  className="col-span-1 px-1.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                  step="0.1"
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <input
                  type="text"
                  value={editForm.unit}
                  onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <input
                  type="text"
                  value={editForm.addAt}
                  onChange={e => setEditForm({ ...editForm, addAt: e.target.value })}
                  placeholder="Ajout"
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <div className="col-span-5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={confirmEdit}
                    disabled={!editForm.name.trim() || !editForm.quantity}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded text-xs font-medium hover:bg-scada-accent/25 transition-colors disabled:opacity-40"
                  >
                    <Check size={12} />
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 border border-scada-border text-scada-text-muted rounded text-xs hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <div
                key={ing.id}
                onClick={() => startEdit(ing)}
                className={`flex items-center justify-between p-2.5 bg-scada-bg rounded text-xs ${!readOnly ? 'cursor-pointer hover:bg-scada-bg-secondary transition-colors' : ''} ${isAutoWater(ing.id) ? 'border-l-2 border-blue-400/50' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white truncate">{ing.name}</span>
                  <span className="text-scada-text-muted shrink-0">({TYPE_OPTIONS.find(t => t.value === ing.type)?.label ?? ing.type})</span>
                  {isAutoWater(ing.id) && (
                    <span className="text-[9px] text-blue-400 shrink-0">auto</span>
                  )}
                </div>
                <div className="flex items-center gap-2 font-mono text-scada-text-secondary shrink-0">
                  <span>{ing.quantity} {ing.unit}</span>
                  <span className="text-scada-text-muted">· {ing.addAt}</span>
                  {!readOnly && (
                    <button type="button" onClick={e => { e.stopPropagation(); handleRemove(ing.id) }} className="text-scada-text-muted hover:text-scada-danger transition-colors ml-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-xs text-scada-text-muted text-center py-3">Aucun ingredient</p>
        )
      )}

      {/* Add form */}
      {showAdd && (
        <div className="grid grid-cols-6 gap-1.5 p-2.5 bg-scada-bg rounded-lg">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Nom"
            className="col-span-2 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as IngredientType })}
            className="col-span-1 px-1.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white focus:outline-none focus:border-scada-accent/50 appearance-none"
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
            className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="text"
            value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })}
            placeholder="Unité"
            className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="text"
            value={form.addAt}
            onChange={e => setForm({ ...form, addAt: e.target.value })}
            placeholder="Ajout"
            className="col-span-3 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.name.trim() || !form.quantity}
            className="col-span-3 flex items-center justify-center gap-1 px-2 py-2 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded text-xs font-medium hover:bg-scada-accent/25 transition-colors disabled:opacity-40"
          >
            <Plus size={12} />
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}
