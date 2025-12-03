import { useState } from 'react';
import { BrewingLogEntry, BrewingLogCategory } from '../types';
import './BrewingLog.css';

interface BrewingLogProps {
  entries: BrewingLogEntry[];
  onAddEntry: (entry: Omit<BrewingLogEntry, 'id'>) => void;
  onDeleteEntry: (id: string) => void;
  readOnly?: boolean;
}

const CATEGORIES: { value: BrewingLogCategory; label: string; icon: string }[] = [
  { value: 'brewing', label: 'Brassage', icon: '🍺' },
  { value: 'fermentation', label: 'Fermentation', icon: '🧪' },
  { value: 'measurement', label: 'Mesure', icon: '📊' },
  { value: 'addition', label: 'Ajout', icon: '➕' },
  { value: 'transfer', label: 'Transfert', icon: '🔄' },
  { value: 'packaging', label: 'Embouteillage', icon: '🍾' },
  { value: 'tasting', label: 'Dégustation', icon: '👅' },
  { value: 'other', label: 'Autre', icon: '📝' },
];

function getCategoryInfo(category: BrewingLogCategory) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaines`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export function BrewingLog({ entries, onAddEntry, onDeleteEntry, readOnly = false }: BrewingLogProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [category, setCategory] = useState<BrewingLogCategory>('fermentation');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [temperature, setTemperature] = useState<string>('');
  const [density, setDensity] = useState<string>('');
  const [ph, setPh] = useState<string>('');

  // Trier les entrées par date (plus récent en premier)
  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const entry: Omit<BrewingLogEntry, 'id'> = {
      timestamp: Date.now(),
      category,
      title: title.trim(),
      notes: notes.trim() || undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      density: density ? parseFloat(density) : undefined,
      ph: ph ? parseFloat(ph) : undefined,
    };

    onAddEntry(entry);

    // Reset form
    setTitle('');
    setNotes('');
    setTemperature('');
    setDensity('');
    setPh('');
    setIsFormOpen(false);
  };

  const showMeasurements = category === 'measurement' || category === 'fermentation';

  return (
    <div className="brewing-log">
      <div className="brewing-log-header">
        <h3>Journal de brassage</h3>
        {!readOnly && (
          <button
            className="btn-add-entry"
            onClick={() => setIsFormOpen(!isFormOpen)}
          >
            {isFormOpen ? '✕' : '+ Ajouter'}
          </button>
        )}
      </div>

      {/* Formulaire d'ajout */}
      {isFormOpen && !readOnly && (
        <form className="log-entry-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Catégorie</label>
              <div className="category-selector">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`category-btn ${category === cat.value ? 'active' : ''}`}
                    onClick={() => setCategory(cat.value)}
                    title={cat.label}
                  >
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Titre *</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Début de fermentation, Dry-hop, Mise en bouteille..."
              required
            />
          </div>

          {showMeasurements && (
            <div className="form-row measurements">
              <div className="form-group">
                <label>Température (°C)</label>
                <input
                  type="number"
                  className="form-input"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="20.5"
                  step="0.1"
                />
              </div>
              <div className="form-group">
                <label>Densité</label>
                <input
                  type="number"
                  className="form-input"
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                  placeholder="1.050"
                  step="0.001"
                />
              </div>
              <div className="form-group">
                <label>pH</label>
                <input
                  type="number"
                  className="form-input"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  placeholder="5.4"
                  step="0.1"
                  min="0"
                  max="14"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Notes</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations, remarques..."
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Ajouter l'entrée
            </button>
          </div>
        </form>
      )}

      {/* Liste des entrées */}
      <div className="log-entries">
        {sortedEntries.length === 0 ? (
          <div className="empty-log">
            <span className="empty-icon">📝</span>
            <p>Aucune entrée dans le journal</p>
            {!readOnly && <p className="hint">Ajoutez votre première note de brassage</p>}
          </div>
        ) : (
          sortedEntries.map(entry => {
            const catInfo = getCategoryInfo(entry.category);
            return (
              <div key={entry.id} className="log-entry">
                <div className="entry-header">
                  <span className="entry-category" title={catInfo.label}>
                    {catInfo.icon}
                  </span>
                  <div className="entry-info">
                    <h4 className="entry-title">{entry.title}</h4>
                    <span className="entry-date" title={formatDate(entry.timestamp)}>
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      className="btn-delete-entry"
                      onClick={() => onDeleteEntry(entry.id)}
                      title="Supprimer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Mesures */}
                {(entry.temperature !== undefined || entry.density !== undefined || entry.ph !== undefined) && (
                  <div className="entry-measurements">
                    {entry.temperature !== undefined && (
                      <span className="measurement">
                        <span className="measurement-icon">🌡️</span>
                        {entry.temperature}°C
                      </span>
                    )}
                    {entry.density !== undefined && (
                      <span className="measurement">
                        <span className="measurement-icon">📊</span>
                        {entry.density.toFixed(3)}
                      </span>
                    )}
                    {entry.ph !== undefined && (
                      <span className="measurement">
                        <span className="measurement-icon">🧪</span>
                        pH {entry.ph}
                      </span>
                    )}
                  </div>
                )}

                {/* Notes */}
                {entry.notes && (
                  <p className="entry-notes">{entry.notes}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
