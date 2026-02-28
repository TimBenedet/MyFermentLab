import { useState, useMemo } from 'react';
import { Project } from '../types';
import { generateTips, AssistantTip } from '../utils/assistantRules';
import './BrewingAssistant.css';

interface BrewingAssistantProps {
  project: Project;
}

export function BrewingAssistant({ project }: BrewingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tips = useMemo(() => generateTips(project), [project]);

  const highCount = tips.filter(t => t.priority === 'high').length;

  const getPriorityClass = (priority: AssistantTip['priority']) => {
    switch (priority) {
      case 'high': return 'tip-high';
      case 'medium': return 'tip-medium';
      case 'low': return 'tip-low';
    }
  };

  const getCategoryLabel = (category: AssistantTip['category']) => {
    switch (category) {
      case 'recipe': return 'Recette';
      case 'temperature': return 'Temperature';
      case 'humidity': return 'Humidite';
      case 'fermentation': return 'Fermentation';
      case 'action': return 'Action';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        className={`assistant-fab ${highCount > 0 ? 'has-alerts' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Assistant de fermentation"
      >
        <span className="assistant-fab-icon">🤖</span>
        {highCount > 0 && (
          <span className="assistant-badge">{highCount}</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="assistant-overlay" onClick={() => setIsOpen(false)}>
          <div className="assistant-panel" onClick={(e) => e.stopPropagation()}>
            <div className="assistant-header">
              <div className="assistant-header-left">
                <span className="assistant-header-icon">🤖</span>
                <span className="assistant-header-title">Assistant</span>
                <span className="assistant-tip-count">{tips.length} conseil{tips.length > 1 ? 's' : ''}</span>
              </div>
              <button className="assistant-close" onClick={() => setIsOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="assistant-tips">
              {tips.map(tip => (
                <div key={tip.id} className={`assistant-tip ${getPriorityClass(tip.priority)}`}>
                  <div className="tip-icon">{tip.icon}</div>
                  <div className="tip-content">
                    <div className="tip-header">
                      <span className="tip-title">{tip.title}</span>
                      <span className={`tip-category tip-cat-${tip.category}`}>{getCategoryLabel(tip.category)}</span>
                    </div>
                    <p className="tip-message">{tip.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
