import { useState } from 'react'
import { Plus, Trash2, X, CheckSquare, Square } from 'lucide-react'
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="scada-label">Etapes</div>
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
      {sorted.length > 0 ? (
        <div className="space-y-1">
          {sorted.map(step => (
            <div key={step.id} className="flex items-center gap-2 p-2 bg-scada-bg rounded text-[10px]">
              <button
                type="button"
                onClick={() => !readOnly && toggleDone(step.id)}
                className={`shrink-0 ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${step.done ? 'text-scada-accent' : 'text-scada-text-muted'}`}
              >
                {step.done ? <CheckSquare size={14} /> : <Square size={14} />}
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
                <button type="button" onClick={() => handleRemove(step.id)} className="text-scada-text-muted hover:text-scada-danger transition-colors shrink-0">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <p className="text-[10px] text-scada-text-muted text-center py-3">Aucune etape</p>
        )
      )}

      {/* Add form */}
      {showAdd && (
        <div className="grid grid-cols-6 gap-1.5 p-2 bg-scada-bg rounded-lg">
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Description de l'etape"
            className="col-span-3 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.day}
            onChange={e => setForm({ ...form, day: e.target.value })}
            placeholder="Jour"
            min={0}
            className="col-span-1 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.durationMinutes}
            onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
            placeholder="Min"
            className="col-span-1 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <input
            type="number"
            value={form.targetTemp}
            onChange={e => setForm({ ...form, targetTemp: e.target.value })}
            placeholder="°C"
            step={0.5}
            className="col-span-1 px-2 py-1.5 bg-scada-bg-secondary rounded border border-scada-border text-[10px] text-white font-mono placeholder:text-scada-text-muted focus:outline-none focus:border-scada-accent/50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.description.trim()}
            className="col-span-5 flex items-center justify-center gap-1 px-2 py-1.5 bg-scada-accent/15 text-scada-accent border border-scada-accent/30 rounded text-[10px] font-medium hover:bg-scada-accent/25 transition-colors disabled:opacity-40"
          >
            <Plus size={10} />
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}
