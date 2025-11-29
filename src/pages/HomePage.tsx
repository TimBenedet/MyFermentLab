import { Project, FERMENTATION_TYPES } from '../types';

interface HomePageProps {
  projects: Project[];
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onManageDevices: () => void;
}

export function HomePage({ projects, onCreateProject, onSelectProject, onDeleteProject, onManageDevices }: HomePageProps) {
  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1>Mes Projets de Fermentation</h1>
          <p className="home-subtitle">{projects.length} projet{projects.length > 1 ? 's' : ''} en cours</p>
        </div>
        <div className="home-actions">
          <button className="btn-secondary" onClick={onManageDevices}>
            Gérer les appareils
          </button>
          <button className="btn-primary" onClick={onCreateProject}>
            + Nouveau projet
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>Aucun projet</h2>
          <p>Créez votre premier projet de fermentation pour commencer</p>
          <button className="btn-primary" onClick={onCreateProject}>
            Créer un projet
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => {
            const config = FERMENTATION_TYPES[project.fermentationType];
            const diff = project.targetTemperature - project.currentTemperature;

            return (
              <div
                key={project.id}
                className="project-card"
              >
                <div
                  className="project-card-content"
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="project-header">
                    <div className="project-icon" style={{ color: config.color }}>
                      {config.icon}
                    </div>
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <span className="project-type">{config.name}</span>
                    </div>
                  </div>

                <div className="project-stats">
                  <div className="stat-item">
                    <span className="stat-label">Actuelle</span>
                    <span className="stat-value" style={{ color: config.color }}>
                      {project.currentTemperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Cible</span>
                    <span className="stat-value">
                      {project.targetTemperature}°C
                    </span>
                  </div>
                </div>

                  <div className="project-status">
                    <span className={`status-indicator ${project.outletActive ? 'active' : 'inactive'}`}>
                      {project.outletActive ? 'Chauffage actif' : 'Inactif'}
                    </span>
                    <span className="status-diff" style={{ color: Math.abs(diff) < 0.5 ? '#10B981' : config.color }}>
                      {Math.abs(diff) < 0.5 ? 'Stable' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}°C`}
                    </span>
                  </div>
                </div>
                <button
                  className="btn-delete-project"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le projet "${project.name}" ?`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                  title="Supprimer le projet"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
