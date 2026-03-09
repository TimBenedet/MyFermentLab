import { useState } from 'react'
import { Plus, Trash2, X, Check, CheckSquare, Square } from 'lucide-react'
import { generateId } from '../../simulation/constants'
import type { RecipeStep } from '../../types/brewing'

interface Props {
  steps: RecipeStep[]
  onChange: (steps: RecipeStep[]) => void
  readOnly?: boolean
}

const emptyForm = { description: '', day: '0', durationMinutes: '', targetTemp: '' }

export function StepEditor({ steps, onChange, readOnly }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const sorted = [...steps].sort((a, b) => a.day - b.day)

  const toggleDone = (id: string) => {
    onChange(steps.map(s => s.id === id ? { ...s, done: !s.done } : s))
  }

  const handleAdd = () => {
    if (!form.description.trim()) return
    const step: RecipeStep = {
      id: generateId('step-'),
      description: form.description.trim(),
      day: parseInt(form.day) || 0,
      done: false,
      ...(form.durationMinutes ? { durationMinutes: parseInt(form.durationMinutes) } : {}),
      ...(form.targetTemp ? { targetTemp: parseFloat(form.targetTemp) } : {}),
    }
    onChange([...steps, step])
    setForm(emptyForm)
  }

  const handleRemove = (id: string) => {
    onChange(steps.filter(s => s.id !== id))
  }

  const startEdit = (step: RecipeStep) => {
    if (readOnly) return
    setEditingId(step.id)
    setEditForm({
      description: step.description,
      day: String(step.day),
      durationMinutes: step.durationMinutes ? String(step.durationMinutes) : '',
      targetTemp: step.targetTemp ? String(step.targetTemp) : '',
    })
  }

  const confirmEdit = () => {
    if (!editingId || !editForm.description.trim()) return
    onChange(steps.map(s =>
      s.id === editingId
        ? {
            ...s,
            description: editForm.description.trim(),
            day: parseInt(editForm.day) || 0,
            durationMinutes: editForm.durationMinutes ? parseInt(editForm.durationMinutes) : undefined,
            targetTemp: editForm.targetTemp ? parseFloat(editForm.targetTemp) : undefined,
          }
        : s
    ))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="scada-label text-xs">Etapes</div>
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
      {sorted.length > 0 ? (
        <div className="space-y-1">
          {sorted.map(step => (
            editingId === step.id ? (
              /* Inline edit mode */
              <div key={step.id} className="grid grid-cols-6 gap-1.5 p-2.5 bg-scada-bg rounded-lg border border-scada-accent/30">
                <input
                  type="text"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="col-span-3 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                  autoFocus
                />
                <input
                  type="number"
                  value={editForm.day}
                  onChange={e => setEditForm({ ...editForm, day: e.target.value })}
                  placeholder="Jour"
                  min={0}
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <input
                  type="number"
                  value={editForm.durationMinutes}
                  onChange={e => setEditForm({ ...editForm, durationMinutes: e.target.value })}
                  placeholder="Min"
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <input
                  type="number"
                  value={editForm.targetTemp}
                  onChange={e => setEditForm({ ...editForm, targetTemp: e.target.value })}
                  placeholder="°C"
                  step={0.5}
                  className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
                />
                <div className="col-span-5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={confirmEdit}
                    disabled={!editForm.description.trim()}
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
                key={step.id}
                onClick={() => startEdit(step)}
                className={`flex items-center gap-2 p-2.5 bg-scada-bg rounded text-xs ${!readOnly ? 'cursor-pointer hover:bg-scada-bg-secondary transition-colors' : ''}`}
              >
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!readOnly) toggleDone(step.id) }}
                  className={`shrink-0 ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${step.done ? 'text-scada-accent' : 'text-scada-text-muted'}`}
                >
                  {step.done ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span className="text-scada-text-muted font-mono shrink-0">J{step.day}</span>
                <span className={`flex-1 ${step.done ? 'text-scada-text-muted line-through' : 'text-white'}`}>
                  {step.description}
                </span>
                {step.durationMinutes && (
                  <span className="text-scada-text-muted shrink-0">{step.durationMinutes}min</span>
                )}
                {step.targetTemp && (
                  <span className="text-scada-accent font-mono shrink-0">{step.targetTemp}°C</span>
                )}
                {!readOnly && (
                  <button type="button" onClick={e => { e.stopPropagation(); handleRemove(step.id) }} className="text-scada-text-muted hover:text-scada-danger transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-xs text-scada-text-muted text-center py-3">Aucune etape</p>
        )
      )}

      {/* Add form */}
      {showAdd && (
        <div className="grid grid-cols-6 gap-1.5 p-2.5 bg-scada-bg rounded-lg">
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Description de l'etape"
            className="col-span-3 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.day}
            onChange={e => setForm({ ...form, day: e.target.value })}
            placeholder="Jour"
            min={0}
            className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.durationMinutes}
            onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
            placeholder="Min"
            className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.targetTemp}
            onChange={e => setForm({ ...form, targetTemp: e.target.value })}
            placeholder="°C"
            step={0.5}
            className="col-span-1 px-2.5 py-2 bg-scada-bg-secondary rounded border border-scada-border text-xs text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.description.trim()}
            className="col-span-5 flex items-center justify-center gap-1 px-2 py-2 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded text-xs font-medium hover:bg-scada-accent/25 transition-colors disabled:opacity-40"
          >
            <Plus size={12} />
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}
