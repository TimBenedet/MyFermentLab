import { useState } from 'react';
import { Project, Device, FermentationType, FERMENTATION_TYPES } from '../types';

// Icône engrenage SVG
const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

interface HomePageProps {
  projects: Project[];
  devices: Device[];
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onViewSummary: (projectId: string) => void;
  onViewBrewingJournal: (projectId: string) => void;
  onArchiveProject: (projectId: string) => void;
  onUnarchiveProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onStartBrewing: (projectId: string) => void;
  onUpdateProject: (projectId: string, data: { name?: string; fermentationType?: FermentationType; sensorId?: string; outletId?: string }) => Promise<void>;
  onManageDevices: () => void;
  onLabelGenerator: () => void;
  onViewStats: () => void;
  role: 'admin' | 'viewer' | null;
}

export function HomePage({
  projects,
  devices,
  onCreateProject,
  onSelectProject,
  onViewSummary,
  onViewBrewingJournal,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  onStartBrewing,
  onUpdateProject,
  onManageDevices,
  onLabelGenerator,
  onViewStats,
  role
}: HomePageProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editFermentationType, setEditFermentationType] = useState<FermentationType>('beer');
  const [editSensorId, setEditSensorId] = useState('');
  const [editOutletId, setEditOutletId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditFermentationType(project.fermentationType);
    setEditSensorId(project.sensorId);
    setEditOutletId(project.outletId);
    setError(null);
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setError(null);
  };

  const handleSaveProject = async () => {
    if (!editingProject) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdateProject(editingProject.id, {
        name: editName,
        fermentationType: editFermentationType,
        sensorId: editSensorId,
        outletId: editOutletId
      });
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

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

        {/* Bouton engrenage pour modifier le projet */}
        {role === 'admin' && !project.archived && (
          <button
            className="btn-settings-project"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(project);
            }}
            title="Paramètres du projet"
          >
            <GearIcon />
          </button>
        )}

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
            {/* Bouton Journal de brassage si session existe */}
            {project.brewingSession && (
              <button
                className="btn-brewing-journal"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewBrewingJournal(project.id);
                }}
                title="Voir le journal de brassage"
              >
                Journal de brassage
              </button>
            )}
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
              {/* Afficher le bouton Brasser si c'est une bière sans session de brassage */}
              {project.fermentationType === 'beer' && !project.brewingSession && (
                <button
                  className="btn-start-brewing"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartBrewing(project.id);
                  }}
                  title="Démarrer le brassage"
                >
                  🍺 Brasser
                </button>
              )}
              {/* Afficher "En cours de brassage" si session active */}
              {project.brewingSession && !project.brewingSession.completedAt && (
                <span className="status-indicator brewing">En brassage</span>
              )}
              {/* Sinon afficher le statut normal */}
              {(!project.brewingSession || project.brewingSession.completedAt) && (
                <>
                  <span className={`status-indicator ${project.outletActive ? 'active' : 'inactive'}`}>
                    {project.outletActive ? 'Chauffage actif' : 'Inactif'}
                  </span>
                  <span className="status-diff" style={{ color: Math.abs(diff) < 0.5 ? '#10B981' : config.color }}>
                    {Math.abs(diff) < 0.5 ? 'Stable' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}°C`}
                  </span>
                </>
              )}
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
          <button className="btn-secondary" onClick={onViewStats}>
            Statistiques
          </button>
          <button className="btn-secondary" onClick={onLabelGenerator}>
            Étiquettes
          </button>
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

      {/* Modal d'édition du projet */}
      {editingProject && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Paramètres du projet</h2>
            {error && (
              <div className="error-message">{error}</div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }}>
              <div className="form-group">
                <label className="form-label">Nom du projet</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type de fermentation</label>
                <select
                  className="form-select"
                  value={editFermentationType}
                  onChange={(e) => setEditFermentationType(e.target.value as FermentationType)}
                >
                  {Object.entries(FERMENTATION_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.icon} {value.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Sonde de température</label>
                <select
                  className="form-select"
                  value={editSensorId}
                  onChange={(e) => setEditSensorId(e.target.value)}
                  required
                >
                  {sensors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Prise connectée</label>
                <select
                  className="form-select"
                  value={editOutletId}
                  onChange={(e) => setEditOutletId(e.target.value)}
                  required
                >
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
