import { useMemo } from 'react';
import { Project, FERMENTATION_TYPES } from '../types';
import './StatsPage.css';

interface StatsPageProps {
  projects: Project[];
  onBack: () => void;
}

interface Stats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalVolume: number;
  projectsByType: Record<string, number>;
  projectsByStyle: Record<string, number>;
  avgFermentationDays: number;
  totalBrews: number;
}

function formatDuration(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return '1 jour';
  return `${days} jours`;
}

export function StatsPage({ projects, onBack }: StatsPageProps) {
  const stats = useMemo<Stats>(() => {
    const activeProjects = projects.filter(p => !p.archived);
    const archivedProjects = projects.filter(p => p.archived);

    // Projets par type
    const projectsByType: Record<string, number> = {};
    projects.forEach(p => {
      projectsByType[p.fermentationType] = (projectsByType[p.fermentationType] || 0) + 1;
    });

    // Projets par style de bière
    const projectsByStyle: Record<string, number> = {};
    projects
      .filter(p => p.fermentationType === 'beer' && p.recipe?.style)
      .forEach(p => {
        const style = p.recipe!.style!;
        projectsByStyle[style] = (projectsByStyle[style] || 0) + 1;
      });

    // Volume total brassé
    const totalVolume = projects
      .filter(p => p.fermentationType === 'beer' && p.recipe?.batchSize)
      .reduce((sum, p) => sum + (p.recipe?.batchSize || 0), 0);

    // Durée moyenne de fermentation
    const completedWithDates = archivedProjects.filter(p => p.archivedAt && p.createdAt);
    const avgFermentationMs = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, p) => sum + (p.archivedAt! - p.createdAt), 0) / completedWithDates.length
      : 0;
    const avgFermentationDays = Math.round(avgFermentationMs / (1000 * 60 * 60 * 24));

    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      archivedProjects: archivedProjects.length,
      totalVolume,
      projectsByType,
      projectsByStyle,
      avgFermentationDays,
      totalBrews: projects.filter(p => p.fermentationType === 'beer').length
    };
  }, [projects]);

  // Projets récents (derniers 5)
  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [projects]);

  return (
    <div className="stats-page">
      <div className="page-header">
        <h1>Statistiques</h1>
        <button className="btn-text" onClick={onBack}>
          Retour
        </button>
      </div>

      {/* Cartes principales */}
      <div className="stats-cards">
        <div className="stat-card primary">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalProjects}</div>
            <div className="stat-label">Projets au total</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-info">
            <div className="stat-value">{stats.activeProjects}</div>
            <div className="stat-label">En cours</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.archivedProjects}</div>
            <div className="stat-label">Terminés</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🍺</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalVolume} L</div>
            <div className="stat-label">Volume total brassé</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.avgFermentationDays} j</div>
            <div className="stat-label">Durée moy. fermentation</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {/* Répartition par type */}
        <div className="stats-section">
          <h2>Par type de fermentation</h2>
          <div className="type-list">
            {Object.entries(stats.projectsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const config = FERMENTATION_TYPES[type as keyof typeof FERMENTATION_TYPES];
                const percentage = Math.round((count / stats.totalProjects) * 100);
                return (
                  <div key={type} className="type-item">
                    <div className="type-info">
                      <span className="type-icon">{config?.icon || '🧪'}</span>
                      <span className="type-name">{config?.name || type}</span>
                    </div>
                    <div className="type-bar-container">
                      <div
                        className="type-bar"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: config?.color || '#888'
                        }}
                      />
                    </div>
                    <div className="type-count">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Styles de bière populaires */}
        {Object.keys(stats.projectsByStyle).length > 0 && (
          <div className="stats-section">
            <h2>Styles de bière populaires</h2>
            <div className="style-list">
              {Object.entries(stats.projectsByStyle)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([style, count]) => (
                  <div key={style} className="style-item">
                    <span className="style-name">{style}</span>
                    <span className="style-count">{count} brassin{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Projets récents */}
        <div className="stats-section">
          <h2>Projets récents</h2>
          <div className="recent-list">
            {recentProjects.map(project => {
              const config = FERMENTATION_TYPES[project.fermentationType];
              const age = Date.now() - project.createdAt;
              return (
                <div key={project.id} className="recent-item">
                  <span className="recent-icon">{config.icon}</span>
                  <div className="recent-info">
                    <div className="recent-name">{project.name}</div>
                    <div className="recent-meta">
                      {project.recipe?.style && <span>{project.recipe.style}</span>}
                      <span>{formatDuration(age)}</span>
                    </div>
                  </div>
                  <span className={`recent-status ${project.archived ? 'archived' : 'active'}`}>
                    {project.archived ? 'Terminé' : 'En cours'}
                  </span>
                </div>
              );
            })}
            {recentProjects.length === 0 && (
              <div className="empty-state">
                <p>Aucun projet créé</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
