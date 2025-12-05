import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiService, ProjectStatsResponse } from '../services/api.service';
import { FERMENTATION_TYPES, BrewingEventType, BrewingRecipe } from '../types';
import './SummaryPage.css';

interface SummaryPageProps {
  projectId: string;
  onBack: () => void;
}

export function SummaryPage({ projectId, onBack }: SummaryPageProps) {
  const [data, setData] = useState<ProjectStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [projectId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const statsData = await apiService.getProjectStats(projectId);
      setData(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Impossible de charger les statistiques du projet');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="summary-page"><div className="loading">Chargement des statistiques...</div></div>;
  }

  if (error || !data) {
    return (
      <div className="summary-page">
        <div className="error">{error || 'Erreur inconnue'}</div>
        <button className="btn-primary" onClick={onBack}>← Retour</button>
      </div>
    );
  }

  const { project, stats, temperatureHistory, densityHistory } = data;
  const fermentType = FERMENTATION_TYPES[project.fermentationType];

  // Formater les données pour le graphique
  const chartData = temperatureHistory.map(point => ({
    time: new Date(point.timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    timestamp: point.timestamp,
    temperature: Math.round(point.temperature * 10) / 10
  }));

  const densityChartData = densityHistory.map(point => ({
    time: new Date(point.timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }),
    timestamp: point.timestamp,
    density: point.density
  }));

  const formatDuration = () => {
    const parts: string[] = [];
    if (stats.duration.days > 0) parts.push(`${stats.duration.days}j`);
    if (stats.duration.hours > 0) parts.push(`${stats.duration.hours}h`);
    if (stats.duration.minutes > 0) parts.push(`${stats.duration.minutes}min`);
    return parts.join(' ') || '0min';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBrewingDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
    }
    return `${minutes} min`;
  };

  // Helpers pour le journal de brassage
  const getEventIcon = (type: BrewingEventType) => {
    switch (type) {
      case 'note': return '📝';
      case 'measurement': return '📊';
      case 'addition': return '➕';
      case 'issue': return '⚠️';
      case 'photo': return '📷';
      default: return '📌';
    }
  };

  const brewingSession = project.brewingSession;
  const recipe = project.recipe as BrewingRecipe | undefined;

  // Helper pour afficher l'utilisation du houblon
  const getHopUseLabel = (use: string) => {
    switch (use) {
      case 'boil': return 'ébullition';
      case 'dry-hop': return 'dry-hop';
      case 'whirlpool': return 'whirlpool';
      case 'first-wort': return 'first wort';
      default: return use;
    }
  };

  return (
    <div className="summary-page">
      <div className="summary-header">
        <button className="btn-back" onClick={onBack}>← Retour aux projets</button>
        <h1>
          <span className="project-icon">{fermentType.icon}</span>
          Récapitulatif - {project.name}
        </h1>
        <span className="completed-badge">{project.archived ? 'Terminé' : 'En cours'}</span>
      </div>

      {/* Informations générales */}
      <section className="summary-section">
        <h2>ℹ️ Informations générales</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Type</span>
            <span className="info-value">{fermentType.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Début</span>
            <span className="info-value">{formatDate(project.createdAt)}</span>
          </div>
          {project.archivedAt && (
            <div className="info-item">
              <span className="info-label">Fin</span>
              <span className="info-value">{formatDate(project.archivedAt)}</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">Durée</span>
            <span className="info-value">{formatDuration()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Température cible</span>
            <span className="info-value">{project.targetTemperature}°C</span>
          </div>
          <div className="info-item">
            <span className="info-label">Mode de contrôle</span>
            <span className="info-value">
              {project.controlMode === 'automatic' ? 'Automatique' : 'Manuel'}
            </span>
          </div>
        </div>
      </section>

      {/* Recette (si disponible) */}
      {recipe && (
        <section className="summary-section recipe-section">
          <h2>📋 Recette</h2>

          {recipe.style && (
            <div className="recipe-style">
              <strong>Style :</strong> {recipe.style}
            </div>
          )}

          <div className="recipe-targets">
            <div className="recipe-target-item">
              <span className="target-label">Volume</span>
              <span className="target-value">{recipe.batchSize}L</span>
            </div>
            {recipe.originalGravity && (
              <div className="recipe-target-item">
                <span className="target-label">OG visée</span>
                <span className="target-value">{recipe.originalGravity.toFixed(3)}</span>
              </div>
            )}
            {recipe.finalGravity && (
              <div className="recipe-target-item">
                <span className="target-label">FG visée</span>
                <span className="target-value">{recipe.finalGravity.toFixed(3)}</span>
              </div>
            )}
            {recipe.estimatedABV && (
              <div className="recipe-target-item">
                <span className="target-label">ABV estimé</span>
                <span className="target-value">{recipe.estimatedABV}%</span>
              </div>
            )}
            {recipe.estimatedIBU && (
              <div className="recipe-target-item">
                <span className="target-label">IBU</span>
                <span className="target-value">{recipe.estimatedIBU}</span>
              </div>
            )}
          </div>

          {/* Malts */}
          {recipe.grains && recipe.grains.length > 0 && (
            <div className="recipe-ingredient-group">
              <h3>🌾 Malts</h3>
              <ul className="ingredient-list">
                {recipe.grains.map(grain => (
                  <li key={grain.id}>
                    <span className="ingredient-qty">{grain.quantity} kg</span>
                    <span className="ingredient-name">{grain.name}</span>
                    {grain.color && <span className="ingredient-detail">({grain.color} EBC)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Houblons */}
          {recipe.hops && recipe.hops.length > 0 && (
            <div className="recipe-ingredient-group">
              <h3>🌿 Houblons</h3>
              <ul className="ingredient-list">
                {recipe.hops.map(hop => (
                  <li key={hop.id}>
                    <span className="ingredient-qty">{hop.quantity}g</span>
                    <span className="ingredient-name">{hop.name}</span>
                    <span className="ingredient-detail">
                      ({hop.alphaAcid}% AA) - {getHopUseLabel(hop.use)} {hop.use === 'dry-hop' ? `${hop.time}j` : `${hop.time}min`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Levures */}
          {recipe.yeasts && recipe.yeasts.length > 0 && (
            <div className="recipe-ingredient-group">
              <h3>🧫 Levures</h3>
              <ul className="ingredient-list">
                {recipe.yeasts.map(yeast => (
                  <li key={yeast.id}>
                    <span className="ingredient-qty">{yeast.quantity}g</span>
                    <span className="ingredient-name">{yeast.name}</span>
                    {yeast.attenuation && <span className="ingredient-detail">({yeast.attenuation}% atténuation)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Autres ingrédients */}
          {recipe.others && recipe.others.length > 0 && (
            <div className="recipe-ingredient-group">
              <h3>📦 Autres</h3>
              <ul className="ingredient-list">
                {recipe.others.map(other => (
                  <li key={other.id}>
                    <span className="ingredient-qty">{other.quantity} {other.unit}</span>
                    <span className="ingredient-name">{other.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.notes && (
            <div className="recipe-notes">
              <strong>Notes :</strong> {recipe.notes}
            </div>
          )}
        </section>
      )}

      {/* Statistiques de température */}
      <section className="summary-section">
        <h2>📈 Statistiques de température</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Moyenne</span>
            <span className="stat-value">{stats.temperature.average}°C</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Minimum</span>
            <span className="stat-value">{stats.temperature.min}°C</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Maximum</span>
            <span className="stat-value">{stats.temperature.max}°C</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Écart-type</span>
            <span className="stat-value">±{stats.temperature.stdDeviation}°C</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Points de données</span>
            <span className="stat-value">{stats.dataPoints}</span>
          </div>
        </div>
      </section>

      {/* Graphique de température */}
      <section className="summary-section">
        <h2>🌡️ Évolution de la température</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" />
              <XAxis
                dataKey="time"
                stroke="#8e9196"
                tick={{ fill: '#8e9196', fontSize: 12 }}
                tickFormatter={(value, index) => {
                  // Afficher seulement quelques labels pour éviter le chevauchement
                  const totalPoints = chartData.length;
                  const maxLabels = 8;
                  const step = Math.ceil(totalPoints / maxLabels);
                  return index % step === 0 ? value.split(' ')[0] : '';
                }}
              />
              <YAxis
                stroke="#8e9196"
                tick={{ fill: '#8e9196' }}
                label={{ value: 'Température (°C)', angle: -90, position: 'insideLeft', fill: '#8e9196' }}
                domain={[
                  Math.floor(stats.temperature.min - 1),
                  Math.ceil(stats.temperature.max + 1)
                ]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d23',
                  border: '1px solid #2a2e35',
                  borderRadius: '8px',
                  color: '#e8e9ea'
                }}
                formatter={(value: number) => [`${value}°C`, 'Température']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={fermentType.color}
                strokeWidth={2}
                dot={false}
                name="Température"
              />
              <Line
                type="monotone"
                dataKey={() => project.targetTemperature}
                stroke="#8e9196"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name="Cible"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Évolution de la densité (si applicable) */}
      {stats.density && densityHistory.length > 0 && (
        <>
          <section className="summary-section">
            <h2>💧 Densité et fermentation</h2>
            <div className="density-summary">
              <div className="density-card">
                <span className="density-label">Densité initiale (OG)</span>
                <span className="density-value">{stats.density.initial.toFixed(3)}</span>
              </div>
              <div className="density-arrow">→</div>
              <div className="density-card">
                <span className="density-label">Densité finale (FG)</span>
                <span className="density-value">{stats.density.final.toFixed(3)}</span>
              </div>
              <div className="density-arrow">=</div>
              <div className="density-card abv-card">
                <span className="density-label">ABV</span>
                <span className="density-value">{stats.density.abv.toFixed(2)}%</span>
              </div>
            </div>

            <div className="density-history">
              <h3>Historique des mesures</h3>
              <table className="density-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Densité</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {densityHistory.map((point, index) => (
                    <tr key={point.timestamp}>
                      <td>{formatDate(point.timestamp)}</td>
                      <td>{point.density.toFixed(3)}</td>
                      <td>
                        {index === 0 && 'Densité initiale'}
                        {index === densityHistory.length - 1 && index !== 0 && 'Densité finale'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Graphique de densité */}
          <section className="summary-section">
            <h2>📉 Évolution de la densité</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={densityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2e35" />
                  <XAxis
                    dataKey="time"
                    stroke="#8e9196"
                    tick={{ fill: '#8e9196' }}
                  />
                  <YAxis
                    stroke="#8e9196"
                    tick={{ fill: '#8e9196' }}
                    label={{ value: 'Densité (SG)', angle: -90, position: 'insideLeft', fill: '#8e9196' }}
                    domain={[
                      Math.floor((stats.density.final - 0.005) * 1000) / 1000,
                      Math.ceil((stats.density.initial + 0.005) * 1000) / 1000
                    ]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1d23',
                      border: '1px solid #2a2e35',
                      borderRadius: '8px',
                      color: '#e8e9ea'
                    }}
                    formatter={(value: number) => [value.toFixed(3), 'Densité']}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="density"
                    stroke="#4AC694"
                    strokeWidth={2}
                    dot={{ fill: '#4AC694', r: 5 }}
                    name="Densité"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}

      {/* Journal de brassage */}
      {brewingSession && (
        <section className="summary-section brewing-journal-section">
          <h2>🍺 Journal de brassage</h2>

          {/* Informations générales du brassage */}
          <div className="brewing-info">
            <div className="info-item">
              <span className="info-label">Début du brassage</span>
              <span className="info-value">{formatDate(brewingSession.startedAt)}</span>
            </div>
            {brewingSession.completedAt && (
              <div className="info-item">
                <span className="info-label">Fin du brassage</span>
                <span className="info-value">{formatDate(brewingSession.completedAt)}</span>
              </div>
            )}
          </div>

          {/* Étapes du brassage */}
          <div className="brewing-steps-summary">
            <h3>Étapes réalisées</h3>
            <table className="brewing-steps-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Étape</th>
                  <th>Durée prévue</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Durée réelle</th>
                </tr>
              </thead>
              <tbody>
                {brewingSession.steps.map((step, index) => {
                  const progress = brewingSession.stepsProgress[index];
                  const realDuration = progress?.startedAt && progress?.completedAt
                    ? Math.round((progress.completedAt - progress.startedAt) / 60000)
                    : null;
                  return (
                    <tr key={step.id} className={progress?.completedAt ? 'completed' : ''}>
                      <td>{index + 1}</td>
                      <td>{step.name}</td>
                      <td>{formatBrewingDuration(step.duration)}</td>
                      <td>{progress?.startedAt ? formatDate(progress.startedAt) : '-'}</td>
                      <td>{progress?.completedAt ? formatDate(progress.completedAt) : '-'}</td>
                      <td>{realDuration !== null ? formatBrewingDuration(realDuration) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Événements du brassage */}
          {brewingSession.events && brewingSession.events.length > 0 && (
            <div className="brewing-events-summary">
              <h3>Événements enregistrés</h3>
              <div className="events-list">
                {brewingSession.events
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map(event => {
                    const stepName = brewingSession.steps.find(s => s.id === event.stepId)?.name;
                    return (
                      <div key={event.id} className={`event-item event-${event.type}`}>
                        <div className="event-icon">{getEventIcon(event.type)}</div>
                        <div className="event-content">
                          <div className="event-header">
                            <span className="event-title">{event.title}</span>
                            <span className="event-time">{formatDate(event.timestamp)}</span>
                          </div>
                          {stepName && <span className="event-step">Pendant : {stepName}</span>}
                          {event.description && <p className="event-description">{event.description}</p>}
                          {(event.temperature !== undefined || event.density !== undefined || event.ph !== undefined || event.volume !== undefined) && (
                            <div className="event-measurements">
                              {event.temperature !== undefined && <span>🌡️ {event.temperature}°C</span>}
                              {event.density !== undefined && <span>📏 {event.density}</span>}
                              {event.ph !== undefined && <span>🧪 pH {event.ph}</span>}
                              {event.volume !== undefined && <span>🫗 {event.volume}L</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Actions */}
      <section className="summary-actions">
        <button className="btn-secondary" onClick={onBack}>
          ← Retour aux projets
        </button>
        {/* TODO: Ajouter export PDF/CSV */}
        {/* <button className="btn-primary">📥 Exporter PDF</button>
        <button className="btn-primary">📊 Exporter CSV</button> */}
      </section>
    </div>
  );
}
