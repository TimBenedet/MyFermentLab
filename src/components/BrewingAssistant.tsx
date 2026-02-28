import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { generateTips, type AssistantTip } from '../utils/assistantRules'
import type { BrewProject, Fermenter } from '../types/brewing'

interface BrewingAssistantProps {
  project: BrewProject
  fermenter?: Fermenter
}

export function BrewingAssistant({ project, fermenter }: BrewingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tips = useMemo(() => generateTips(project, fermenter), [project, fermenter])

  const highCount = tips.filter(t => t.priority === 'high').length

  const getPriorityBorder = (priority: AssistantTip['priority']) => {
    switch (priority) {
      case 'high': return 'border-l-scada-danger'
      case 'medium': return 'border-l-scada-warning'
      case 'low': return 'border-l-scada-accent'
    }
  }

  const getCategoryStyle = (category: AssistantTip['category']) => {
    switch (category) {
      case 'recipe': return 'bg-scada-accent/15 text-scada-accent'
      case 'temperature': return 'bg-scada-warning/15 text-scada-warning'
      case 'humidity': return 'bg-scada-cold/15 text-scada-cold'
      case 'fermentation': return 'bg-scada-accent/15 text-scada-accent'
      case 'action': return 'bg-scada-danger/15 text-scada-danger'
    }
  }

  const getCategoryLabel = (category: AssistantTip['category']) => {
    switch (category) {
      case 'recipe': return 'Recette'
      case 'temperature': return 'Temp'
      case 'humidity': return 'Humid'
      case 'fermentation': return 'Ferment'
      case 'action': return 'Action'
    }
  }

  return createPortal(
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Assistant de fermentation"
        className="fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full bg-scada-card border border-scada-border flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 hover:border-scada-accent transition-all duration-200"
        style={{ boxShadow: highCount > 0 ? '0 0 16px rgba(255, 71, 87, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.5)' }}
      >
        <span className="text-2xl leading-none">🤖</span>
        {highCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-scada-danger text-white text-[11px] font-bold flex items-center justify-center px-1">
            {highCount}
          </span>
        )}
      </button>

      {/* Panel overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[10000] bg-black/50 flex items-end justify-end p-4 sm:p-6"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full sm:w-[400px] max-h-[70vh] bg-scada-bg-secondary border border-scada-border rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-scada-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <span className="text-sm font-semibold text-white">Assistant</span>
                <span className="text-xs text-scada-text-secondary bg-scada-card px-2 py-0.5 rounded-full">
                  {tips.length} conseil{tips.length > 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-scada-text-secondary hover:text-white hover:bg-scada-card transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tips list */}
            <div className="overflow-y-auto p-3 flex flex-col gap-2">
              {tips.length === 0 ? (
                <div className="text-center py-8 text-scada-text-muted text-xs">
                  Aucun conseil pour le moment
                </div>
              ) : (
                tips.map(tip => (
                  <div
                    key={tip.id}
                    className={`flex gap-3 p-3 rounded-xl bg-scada-card border border-scada-border border-l-[3px] ${getPriorityBorder(tip.priority)} hover:border-scada-border/80 transition-colors`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-white">{tip.title}</span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${getCategoryStyle(tip.category)}`}>
                          {getCategoryLabel(tip.category)}
                        </span>
                      </div>
                      <p className="text-xs text-scada-text-secondary leading-relaxed">{tip.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>,
    document.body
  )
}
