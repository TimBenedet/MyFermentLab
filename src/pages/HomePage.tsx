import { useState } from 'react';
import { Project, FERMENTATION_TYPES } from '../types';

interface HomePageProps {
  projects: Project[];
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onViewSummary: (projectId: string) => void;
  onArchiveProject: (projectId: string) => void;
  onUnarchiveProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onManageDevices: () => void;
  role: 'admin' | 'viewer' | null;
}

export function HomePage({
  projects,
  onCreateProject,
  onSelectProject,
  onViewSummary,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  onManageDevices,
  role
}: HomePageProps) {
  const [showArchived, setShowArchived] = useState(false);

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const displayedProjects = showArchived ? archivedProjects : activeProjects;

  const renderProject = (project: Project) => {
    const config = FERMENTATION_TYPES[project.fermentationType];
    const diff = project.targetTemperature - project.currentTemperature;

    return (
      <div key={project.id} className="project-card">
        <button
          className="btn-delete-project"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Supprimer définitivement le projet "${project.name}" ?`)) {
              onDeleteProject(project.id);
            }
          }}
          title="Supprimer le projet"
        >
          ×
        </button>

        <div
          className="project-card-content"
          onClick={() => !project.archived && onSelectProject(project.id)}
          style={{ cursor: project.archived ? 'default' : 'pointer' }}
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

          {!project.archived && (
            <div className="project-status">
              <span className={`status-indicator ${project.outletActive ? 'active' : 'inactive'}`}>
                {project.outletActive ? 'Chauffage actif' : 'Inactif'}
              </span>
              <span className="status-diff" style={{ color: Math.abs(diff) < 0.5 ? '#10B981' : config.color }}>
                {Math.abs(diff) < 0.5 ? 'Stable' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}°C`}
              </span>
              <button
                className="btn-archive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Archiver le projet "${project.name}" ?\n\nCela libérera les capteurs et prises associés.`)) {
                    onArchiveProject(project.id);
                  }
                }}
                title="Archiver le projet"
              >
                📦
              </button>
            </div>
          )}

          {project.archived && project.archivedAt && (
            <div className="project-status">
              <span className="status-indicator archived">
                Archivé le {new Date(project.archivedAt).toLocaleDateString()}
              </span>
              <div className="archived-actions">
                <button
                  className="btn-view-summary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewSummary(project.id);
                  }}
                  title="Voir le récapitulatif"
                >
                  📊 Récapitulatif
                </button>
                {role === 'admin' && (
                  <button
                    className="btn-archive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnarchiveProject(project.id);
                    }}
                    title="Désarchiver le projet"
                  >
                    ↩
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1>Mes Projets de Fermentation</h1>
          <p className="home-subtitle">
            {activeProjects.length} projet{activeProjects.length > 1 ? 's' : ''} actif{activeProjects.length > 1 ? 's' : ''}
            {archivedProjects.length > 0 && ` • ${archivedProjects.length} archivé${archivedProjects.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="home-actions">
          {role === 'admin' && (
            <>
              <button className="btn-secondary" onClick={onManageDevices}>
                Gérer les appareils
              </button>
              <button className="btn-primary" onClick={onCreateProject}>
                + Nouveau projet
              </button>
            </>
          )}
        </div>
      </div>

      <div className="projects-filter">
        <button
          className={`filter-btn ${!showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived(false)}
        >
          Projets actifs ({activeProjects.length})
        </button>
        <button
          className={`filter-btn ${showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived(true)}
        >
          Projets archivés ({archivedProjects.length})
        </button>
      </div>

      {displayedProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{showArchived ? '📦' : '🍺'}</div>
          <h2>{showArchived ? 'Aucun projet archivé' : 'Aucun projet actif'}</h2>
          <p>
            {showArchived
              ? 'Les projets archivés apparaîtront ici'
              : 'Créez votre premier projet de fermentation pour commencer'
            }
          </p>
          {!showArchived && role === 'admin' && (
            <button className="btn-primary" onClick={onCreateProject}>
              Créer un projet
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {displayedProjects.map(renderProject)}
        </div>
      )}
    </div>
  );
}
