import { useState, useEffect } from 'react';
import { Project, Device, FermentationType, FERMENTATION_TYPES } from '../types';
import './HomePage.css';

// Gear Icon SVG
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
  onRefreshProject: (projectId: string) => Promise<void>;
  onManageDevices: () => void;
  onLabelGenerator: () => void;
  onViewStats: () => void;
  role: 'admin' | 'viewer' | null;
}

// Sensor frozen detection - 10 minutes without temperature change
const SENSOR_FROZEN_THRESHOLD = 10 * 60 * 1000; // 10 minutes in ms

const isSensorFrozen = (project: Project): boolean => {
  if (project.archived) return false;
  if (!project.lastTemperatureUpdate) return false;

  const timeSinceLastChange = Date.now() - project.lastTemperatureUpdate;
  return timeSinceLastChange > SENSOR_FROZEN_THRESHOLD;
};

const getSensorFrozenDuration = (project: Project): string => {
  if (!project.lastTemperatureUpdate) return '';
  const minutes = Math.floor((Date.now() - project.lastTemperatureUpdate) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}min`;
};

// Mini Tank visualization for beer - Silo industriel style
const MiniTank = ({ level = 70 }: { level?: number }) => (
  <div className="mini-silo">
    <div className="mini-silo-roof">
      <div className="mini-silo-cap"></div>
    </div>
    <div className="mini-silo-body">
      <div className="mini-silo-rivets">
        <div className="mini-rivet"></div>
        <div className="mini-rivet"></div>
        <div className="mini-rivet"></div>
        <div className="mini-rivet"></div>
      </div>
      <div className="mini-silo-liquid" style={{ height: `${level}%` }}>
        <div className="mini-silo-bubbles">
          <div className="mini-silo-bubble"></div>
          <div className="mini-silo-bubble"></div>
          <div className="mini-silo-bubble"></div>
          <div className="mini-silo-bubble"></div>
          <div className="mini-silo-bubble"></div>
        </div>
      </div>
    </div>
    <div className="mini-silo-base"></div>
  </div>
);

// Mini Chamber visualization for koji
const MiniChamber = ({ growth = 50 }: { growth?: number }) => (
  <div className="mini-chamber">
    <div className="mini-substrate">
      <div className="mini-mycelium" style={{ height: `${growth}%` }}></div>
    </div>
  </div>
);

// Mini Tent visualization for mushroom
const MiniTent = () => (
  <div className="mini-tent">
    <div className="mini-tent-light"></div>
    <div className="mini-substrate-row">
      <div className="mini-substrate-block">
        <div className="mini-block-mushrooms">
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
        </div>
      </div>
      <div className="mini-substrate-block">
        <div className="mini-block-mushrooms">
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
        </div>
      </div>
      <div className="mini-substrate-block">
        <div className="mini-block-mushrooms">
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
          <div className="mini-mushroom"><div className="mini-mushroom-cap"></div><div className="mini-mushroom-stem"></div></div>
        </div>
      </div>
    </div>
  </div>
);

// Mini Wine visualization
const MiniWine = ({ level = 70 }: { level?: number }) => (
  <div className="mini-wine">
    <div className="mini-wine-neck"></div>
    <div className="mini-wine-body">
      <div className="mini-wine-liquid" style={{ height: `${level}%` }}></div>
    </div>
  </div>
);

// Mini Sourdough jar visualization for levain
const MiniSourdough = ({ level = 60 }: { level?: number }) => (
  <div className="mini-sourdough">
    <div className="mini-sourdough-lid"></div>
    <div className="mini-sourdough-jar">
      <div className="mini-sourdough-starter" style={{ height: `${level}%` }}>
        <div className="mini-sourdough-bubbles">
          <div className="mini-sourdough-bubble"></div>
          <div className="mini-sourdough-bubble"></div>
          <div className="mini-sourdough-bubble"></div>
          <div className="mini-sourdough-bubble"></div>
        </div>
        <div className="mini-sourdough-surface"></div>
      </div>
      <div className="mini-sourdough-marks">
        <div className="mini-sourdough-mark"></div>
        <div className="mini-sourdough-mark"></div>
        <div className="mini-sourdough-mark"></div>
      </div>
    </div>
  </div>
);

// Particles background component
const ParticlesBackground = () => {
  useEffect(() => {
    const container = document.getElementById('particles');
    if (!container || container.children.length > 0) return;

    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 25 + 's';
      particle.style.animationDuration = (20 + Math.random() * 10) + 's';
      container.appendChild(particle);
    }
  }, []);

  return <div className="particles" id="particles"></div>;
};

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
  onRefreshProject,
  role
}: HomePageProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'all'>('active');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editFermentationType, setEditFermentationType] = useState<FermentationType>('beer');
  const [refreshingProjectId, setRefreshingProjectId] = useState<string | null>(null);
  const [refreshToast, setRefreshToast] = useState<{ message: string; projectId: string } | null>(null);
  const [editSensorId, setEditSensorId] = useState('');
  const [editOutletId, setEditOutletId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = devices.filter(d => d.type === 'sensor');
  const outlets = devices.filter(d => d.type === 'outlet');

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const displayedProjects = activeTab === 'active'
    ? activeProjects
    : activeTab === 'archived'
      ? archivedProjects
      : projects;

  const handleRefreshProject = async (projectId: string) => {
    // Trouver le projet et son sensor pour afficher le toast
    const project = projects.find(p => p.id === projectId);
    const sensor = project ? devices.find(d => d.id === project.sensorId) : null;
    const entityId = sensor?.entityId || 'unknown';

    setRefreshingProjectId(projectId);
    setRefreshToast({ message: `Refresh ${entityId}`, projectId });

    try {
      await onRefreshProject(projectId);
    } finally {
      setRefreshingProjectId(null);
      // Cacher le toast après 2 secondes
      setTimeout(() => {
        setRefreshToast(prev => prev?.projectId === projectId ? null : prev);
      }, 2000);
    }
  };

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

  const getProjectStatus = (project: Project) => {
    if (project.archived) return { text: 'Archivé', type: 'archived' as const };
    if (project.brewingSession && !project.brewingSession.completedAt) return { text: 'En brassage', type: 'brewing' as const };

    const diff = project.targetTemperature - project.currentTemperature;
    if (Math.abs(diff) < 0.5) return { text: 'Stable', type: 'active' as const };
    if (project.outletActive) return { text: 'Chauffage', type: 'heating' as const };
    return { text: 'Inactif', type: 'inactive' as const };
  };

  const getProjectDuration = (project: Project) => {
    if (!project.createdAt) return null;
    const days = Math.floor((Date.now() - project.createdAt) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Jour 1';
    return `Jour ${days}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const getTypeClass = (type: FermentationType) => {
    switch (type) {
      case 'beer': return 'beer';
      case 'koji': return 'koji';
      case 'mushroom': return 'mushroom';
      case 'mead': return 'wine';
      case 'kombucha': return 'beer';
      case 'cheese': return 'koji';
      case 'sourdough': return 'sourdough';
      default: return 'beer';
    }
  };

  const renderMiniVisualization = (project: Project) => {
    switch (project.fermentationType) {
      case 'beer':
      case 'kombucha':
        return <MiniTank level={75} />;
      case 'koji':
      case 'cheese':
        return <MiniChamber growth={50} />;
      case 'mushroom':
        return <MiniTent />;
      case 'mead':
        return <MiniWine level={70} />;
      case 'sourdough':
        return <MiniSourdough level={65} />;
      default:
        return <MiniTank />;
    }
  };

  const renderProjectCard = (project: Project, index: number) => {
    const config = FERMENTATION_TYPES[project.fermentationType];
    const status = getProjectStatus(project);
    const duration = getProjectDuration(project);
    const typeClass = getTypeClass(project.fermentationType);
    const diff = project.targetTemperature - project.currentTemperature;

    return (
      <div
        key={project.id}
        className={`scada-project-card ${typeClass} ${project.archived ? 'archived' : ''} fade-in`}
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <div className="scada-project-header">
          <div className="scada-project-type-icon">{config.icon}</div>
          <div className="scada-project-header-right">
            {refreshToast?.projectId === project.id && (
              <div className="scada-refresh-toast">
                {refreshToast.message}
              </div>
            )}
            {!project.archived && (
              <button
                className={`scada-refresh-btn ${refreshingProjectId === project.id ? 'spinning' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleRefreshProject(project.id); }}
                disabled={refreshingProjectId === project.id}
                title="Rafraîchir la température"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            )}
            <div className={`scada-status-badge ${status.type}`}>
              <span className="status-led"></span>
              {status.text}
            </div>
          </div>
        </div>

        <div
          className="scada-project-body"
          onClick={() => !project.archived && onSelectProject(project.id)}
        >
          <h3 className="scada-project-name">{project.name}</h3>
          <p className="scada-project-subtitle">
            {config.name} {duration && `• ${duration}`}
          </p>

          <div className="scada-project-visual">
            {renderMiniVisualization(project)}
          </div>

          <div className="scada-project-metrics">
            <div className="scada-metric">
              <div className="scada-metric-value">{project.currentTemperature.toFixed(1)}°</div>
              <div className="scada-metric-label">Actuelle</div>
            </div>
            <div className="scada-metric">
              <div className="scada-metric-value">{project.targetTemperature}°</div>
              <div className="scada-metric-label">Cible</div>
            </div>
            <div className="scada-metric">
              <div className="scada-metric-value" style={{
                color: Math.abs(diff) < 0.5 ? 'var(--success)' : 'inherit'
              }}>
                {Math.abs(diff) < 0.5 ? '✓' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}°`}
              </div>
              <div className="scada-metric-label">Écart</div>
            </div>
          </div>

          {isSensorFrozen(project) && (
            <div className="scada-sensor-frozen-alert">
              <span className="frozen-icon">⚠️</span>
              <span className="frozen-text">Sonde figée depuis {getSensorFrozenDuration(project)}</span>
            </div>
          )}
        </div>

        <div className="scada-project-footer">
          <span className="scada-project-date">
            {project.archived && project.archivedAt
              ? `Archivé le ${formatDate(project.archivedAt)}`
              : project.createdAt
                ? `Démarré le ${formatDate(project.createdAt)}`
                : ''
            }
          </span>
          <div className="scada-project-actions">
            {/* View details / Brewing Journal */}
            {project.brewingSession && (
              <button
                className="scada-action-btn"
                title="Journal de brassage"
                onClick={(e) => { e.stopPropagation(); onViewBrewingJournal(project.id); }}
              >
                📋
              </button>
            )}

            {/* Start brewing for beer without session */}
            {project.fermentationType === 'beer' && !project.brewingSession && !project.archived && (
              <button
                className="scada-action-btn brewing"
                title="Démarrer le brassage"
                onClick={(e) => { e.stopPropagation(); onStartBrewing(project.id); }}
              >
                🍺
              </button>
            )}

            {/* Settings (admin only) */}
            {role === 'admin' && !project.archived && (
              <button
                className="scada-action-btn"
                title="Paramètres"
                onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
              >
                <GearIcon />
              </button>
            )}

            {/* Archive/Unarchive */}
            {project.archived ? (
              <>
                <button
                  className="scada-action-btn"
                  title="Voir récapitulatif"
                  onClick={(e) => { e.stopPropagation(); onViewSummary(project.id); }}
                >
                  📊
                </button>
                {role === 'admin' && (
                  <button
                    className="scada-action-btn"
                    title="Désarchiver"
                    onClick={(e) => { e.stopPropagation(); onUnarchiveProject(project.id); }}
                  >
                    ↩️
                  </button>
                )}
              </>
            ) : (
              <button
                className="scada-action-btn"
                title="Archiver"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Archiver le projet "${project.name}" ?\n\nCela libérera les capteurs et prises associés.`)) {
                    onArchiveProject(project.id);
                  }
                }}
              >
                📦
              </button>
            )}

            {/* Delete (always visible on hover) */}
            <button
              className="scada-action-btn delete"
              title="Supprimer"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Supprimer définitivement le projet "${project.name}" ?`)) {
                  onDeleteProject(project.id);
                }
              }}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="scada-home-page">
      <ParticlesBackground />

      {/* Section Header */}
      <div className="scada-section-header">
        <h2 className="scada-section-title">Mes Projets</h2>
        <div className="scada-section-tabs">
          <button
            className={`scada-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Actifs
            <span className="scada-tab-count">{activeProjects.length}</span>
          </button>
          <button
            className={`scada-tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            Archivés
            <span className="scada-tab-count">{archivedProjects.length}</span>
          </button>
          <button
            className={`scada-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Tous
            <span className="scada-tab-count">{projects.length}</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {displayedProjects.length === 0 ? (
        <div className="scada-empty-state">
          <div className="scada-empty-icon">
            {activeTab === 'archived' ? '📦' : '🧪'}
          </div>
          <h3 className="scada-empty-title">
            {activeTab === 'archived' ? 'Aucun projet archivé' : 'Aucun projet actif'}
          </h3>
          <p className="scada-empty-text">
            {activeTab === 'archived'
              ? 'Les projets archivés apparaîtront ici'
              : 'Créez votre premier projet de fermentation pour commencer'
            }
          </p>
          {activeTab !== 'archived' && role === 'admin' && (
            <button className="scada-btn primary" onClick={onCreateProject}>
              + Nouveau projet
            </button>
          )}
        </div>
      ) : (
        <div className="scada-projects-grid">
          {displayedProjects.map((project, index) => renderProjectCard(project, index))}
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <div className="scada-modal-overlay" onClick={closeEditModal}>
          <div className="scada-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Paramètres du projet</h2>
            {error && <div className="scada-error-message">{error}</div>}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }}>
              <div className="scada-form-group">
                <label className="scada-form-label">Nom du projet</label>
                <input
                  type="text"
                  className="scada-form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="scada-form-group">
                <label className="scada-form-label">Type de fermentation</label>
                <select
                  className="scada-form-select"
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

              <div className="scada-form-group">
                <label className="scada-form-label">Sonde de température</label>
                <select
                  className="scada-form-select"
                  value={editSensorId}
                  onChange={(e) => setEditSensorId(e.target.value)}
                  required
                >
                  {sensors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="scada-form-group">
                <label className="scada-form-label">Prise connectée</label>
                <select
                  className="scada-form-select"
                  value={editOutletId}
                  onChange={(e) => setEditOutletId(e.target.value)}
                  required
                >
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div className="scada-modal-actions">
                <button type="button" className="scada-btn secondary" onClick={closeEditModal} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="scada-btn primary" disabled={saving}>
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
