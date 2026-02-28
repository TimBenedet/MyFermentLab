import { useState, useMemo } from 'react';
import { Project } from '../../src/types';
import { generateTips, AssistantTip } from '../../src/utils/assistantRules';

interface MobileBrewingAssistantProps {
  project: Project;
}

export function MobileBrewingAssistant({ project }: MobileBrewingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tips = useMemo(() => generateTips(project), [project]);

  const highCount = tips.filter(t => t.priority === 'high').length;

  const getPriorityClass = (priority: AssistantTip['priority']) => {
    switch (priority) {
      case 'high': return 'mtip-high';
      case 'medium': return 'mtip-medium';
      case 'low': return 'mtip-low';
    }
  };

  const getCategoryLabel = (category: AssistantTip['category']) => {
    switch (category) {
      case 'recipe': return 'Recette';
      case 'temperature': return 'Temp';
      case 'humidity': return 'Humid';
      case 'fermentation': return 'Ferment';
      case 'action': return 'Action';
    }
  };

  if (tips.length === 0) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        className={`mobile-assistant-fab ${highCount > 0 ? 'has-alerts' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <span className="mobile-assistant-fab-icon">🤖</span>
        {highCount > 0 && (
          <span className="mobile-assistant-badge">{highCount}</span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="mobile-assistant-overlay" onClick={() => setIsOpen(false)}>
          <div className="mobile-assistant-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-assistant-header">
              <div className="mobile-assistant-header-left">
                <span>🤖</span>
                <span className="mobile-assistant-title">Assistant</span>
                <span className="mobile-assistant-count">{tips.length}</span>
              </div>
              <button className="mobile-assistant-close" onClick={() => setIsOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="mobile-assistant-tips">
              {tips.map(tip => (
                <div key={tip.id} className={`mobile-assistant-tip ${getPriorityClass(tip.priority)}`}>
                  <div className="mtip-icon">{tip.icon}</div>
                  <div className="mtip-content">
                    <div className="mtip-header">
                      <span className="mtip-title">{tip.title}</span>
                      <span className={`mtip-category mtip-cat-${tip.category}`}>{getCategoryLabel(tip.category)}</span>
                    </div>
                    <p className="mtip-message">{tip.message}</p>
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
