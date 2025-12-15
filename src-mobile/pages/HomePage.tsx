import { Project, FERMENTATION_TYPES } from '../../src/types';

interface HomePageProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onNavigateDevices: () => void;
  onRefresh: () => void;
}

export function HomePage({ projects, onSelectProject, onNavigateDevices, onRefresh }: HomePageProps) {
  const getStatusInfo = (project: Project) => {
    const diff = project.currentTemperature - project.targetTemperature;
    if (Math.abs(diff) <= 0.5) {
      return { text: 'Stable', class: 'status-stable', icon: '✓' };
    } else if (diff > 0) {
      return { text: 'Trop chaud', class: 'status-hot', icon: '↑' };
    } else {
      return { text: 'Trop froid', class: 'status-cold', icon: '↓' };
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      beer: '#F5A742',
      koji: '#4AC694',
      mushroom: '#8B4513',
      mead: '#E74856',
      kombucha: '#9D7EDB',
      cheese: '#E9B54D',
      sourdough: '#D4A574'
    };
    return colors[type] || '#888';
  };

  return (
    <div className="home-page">
      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">Projets actifs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{projects.filter(p => p.outletActive).length}</div>
          <div className="stat-label">Chauffages actifs</div>
        </div>
      </div>

      {/* Pull to refresh indicator */}
      <div className="section-header">
        <h2>Fermentations en cours</h2>
        <button className="refresh-btn" onClick={onRefresh}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Project Cards */}
      <div className="projects-list">
        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <p>Aucune fermentation en cours</p>
            <span>Créez un projet depuis l'interface web</span>
          </div>
        ) : (
          projects.map(project => {
            const config = FERMENTATION_TYPES[project.fermentationType];
            const status = getStatusInfo(project);
            const typeColor = getTypeColor(project.fermentationType);

            return (
              <div
                key={project.id}
                className="project-card"
                onClick={() => onSelectProject(project)}
                style={{ '--type-color': typeColor } as React.CSSProperties}
              >
                <div className="project-card-header">
                  <div className="project-icon">{config.icon}</div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <span className="project-type">{config.name}</span>
                  </div>
                  <div className={`project-status ${status.class}`}>
                    <span className="status-icon">{status.icon}</span>
                  </div>
                </div>

                <div className="project-card-body">
                  <div className="temp-display">
                    <div className="current-temp">
                      <span className="temp-value">{project.currentTemperature.toFixed(1)}</span>
                      <span className="temp-unit">°C</span>
                    </div>
                    <div className="temp-target">
                      <span className="target-label">Cible</span>
                      <span className="target-value">{project.targetTemperature}°C</span>
                    </div>
                  </div>

                  <div className="project-indicators">
                    <div className={`indicator ${project.outletActive ? 'active' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      <span>{project.outletActive ? 'Chauffe' : 'Arrêt'}</span>
                    </div>
                    <div className={`indicator ${project.controlMode === 'automatic' ? 'active' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                      <span>{project.controlMode === 'automatic' ? 'Auto' : 'Manuel'}</span>
                    </div>
                  </div>
                </div>

                <div className="project-card-footer">
                  <span className="view-details">Voir les détails →</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
