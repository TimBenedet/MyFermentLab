import { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, BrewingSession, BrewingSessionStep, HopIngredient, OtherIngredient } from '../types';
import './BrewingSessionPage.css';

// Type pour les ajouts d'ingrédients à afficher dans la timeline
interface IngredientAddition {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  timing: string; // "À 60 min", "À 15 min", "Début", etc.
  timeValue: number; // Valeur numérique pour le tri
  stepId: string; // ID de l'étape parente
  type: 'hop' | 'other' | 'grain';
  icon: string;
}

interface BrewingSessionPageProps {
  project: Project;
  onUpdateSession: (session: BrewingSession) => void;
  onFinishBrewing: () => void;
  onBack: () => void;
}

// Étapes par défaut pour le brassage de bière
const DEFAULT_BREWING_STEPS: BrewingSessionStep[] = [
  { id: 'chauffe', name: 'Chauffe de l\'eau', description: 'Chauffer l\'eau d\'empâtage', duration: 30 },
  { id: 'empatage', name: 'Empâtage', description: 'Mélange des grains avec l\'eau chaude', duration: 60, temperature: 67 },
  { id: 'filtration', name: 'Filtration & Rinçage', description: 'Séparation du moût et rinçage des drêches', duration: 45 },
  { id: 'ebullition', name: 'Ébullition', description: 'Ébullition du moût avec ajouts de houblons', duration: 60, temperature: 100 },
  { id: 'whirlpool', name: 'Whirlpool', description: 'Repos tourbillon pour clarifier', duration: 15 },
  { id: 'refroidissement', name: 'Refroidissement', description: 'Refroidir le moût à température de fermentation', duration: 20 },
  { id: 'transfert', name: 'Transfert', description: 'Transférer dans le fermenteur', duration: 15 },
  { id: 'ensemencement', name: 'Ensemencement', description: 'Ajout de la levure', duration: 5 },
];

export function BrewingSessionPage({ project, onUpdateSession, onFinishBrewing, onBack }: BrewingSessionPageProps) {
  const [session, setSession] = useState<BrewingSession>(() => {
    if (project.brewingSession) {
      return project.brewingSession;
    }
    // Créer une nouvelle session avec les étapes par défaut
    return {
      startedAt: Date.now(),
      currentStepIndex: 0,
      steps: DEFAULT_BREWING_STEPS,
      stepsProgress: DEFAULT_BREWING_STEPS.map(step => ({ stepId: step.id }))
    };
  });

  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(15);
  const [showAddStep, setShowAddStep] = useState(false);
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);

  // Extraire les ajouts d'ingrédients de la recette
  const ingredientAdditions = useMemo(() => {
    const additions: IngredientAddition[] = [];
    const recipe = project.recipe;
    if (!recipe) return additions;

    // Houblons d'ébullition (boil)
    recipe.hops
      .filter(hop => hop.use === 'boil')
      .forEach(hop => {
        additions.push({
          id: `hop-boil-${hop.id}`,
          name: hop.name,
          quantity: hop.quantity,
          unit: 'g',
          timing: hop.time === recipe.boilStep.duration ? 'Début' : `À ${hop.time} min`,
          timeValue: hop.time,
          stepId: 'ebullition',
          type: 'hop',
          icon: '🌿'
        });
      });

    // Houblons first wort (au moment de la filtration/avant ébullition)
    recipe.hops
      .filter(hop => hop.use === 'first-wort')
      .forEach(hop => {
        additions.push({
          id: `hop-fw-${hop.id}`,
          name: hop.name,
          quantity: hop.quantity,
          unit: 'g',
          timing: 'First Wort',
          timeValue: 999, // Avant l'ébullition
          stepId: 'filtration',
          type: 'hop',
          icon: '🌿'
        });
      });

    // Houblons whirlpool
    recipe.hops
      .filter(hop => hop.use === 'whirlpool')
      .forEach(hop => {
        additions.push({
          id: `hop-wp-${hop.id}`,
          name: hop.name,
          quantity: hop.quantity,
          unit: 'g',
          timing: 'Whirlpool',
          timeValue: 0,
          stepId: 'whirlpool',
          type: 'hop',
          icon: '🌿'
        });
      });

    // Autres ingrédients selon leur moment d'ajout
    recipe.others.forEach(other => {
      let stepId = 'ebullition';
      let timing = other.additionTime || 'Ébullition';
      let timeValue = 0;

      const additionLower = (other.additionTime || '').toLowerCase();
      if (additionLower.includes('empâtage') || additionLower.includes('empatage')) {
        stepId = 'empatage';
      } else if (additionLower.includes('whirlpool')) {
        stepId = 'whirlpool';
      } else if (additionLower.includes('fermentation')) {
        stepId = 'ensemencement';
      }

      additions.push({
        id: `other-${other.id}`,
        name: other.name,
        quantity: other.quantity,
        unit: other.unit,
        timing,
        timeValue,
        stepId,
        type: 'other',
        icon: '📦'
      });
    });

    return additions;
  }, [project.recipe]);

  // Obtenir les ajouts pour une étape donnée
  const getAdditionsForStep = (stepId: string): IngredientAddition[] => {
    return ingredientAdditions
      .filter(a => a.stepId === stepId)
      .sort((a, b) => b.timeValue - a.timeValue); // Du plus long au plus court
  };

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (activeTimer !== null) {
      interval = setInterval(() => {
        setTimerElapsed(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  // Sauvegarder la session quand elle change
  const saveSession = useCallback((newSession: BrewingSession) => {
    setSession(newSession);
    onUpdateSession(newSession);
  }, [onUpdateSession]);

  const startStep = (index: number) => {
    const newProgress = [...session.stepsProgress];
    newProgress[index] = { ...newProgress[index], startedAt: Date.now() };

    const newSession = {
      ...session,
      currentStepIndex: index,
      stepsProgress: newProgress
    };

    saveSession(newSession);
    setActiveTimer(index);
    setTimerElapsed(0);
  };

  const completeStep = (index: number) => {
    const newProgress = [...session.stepsProgress];
    newProgress[index] = { ...newProgress[index], completedAt: Date.now() };

    const newSession = {
      ...session,
      currentStepIndex: index + 1,
      stepsProgress: newProgress
    };

    saveSession(newSession);
    setActiveTimer(null);
    setTimerElapsed(0);
  };

  const addStep = () => {
    if (!newStepName.trim()) return;

    const newStep: BrewingSessionStep = {
      id: `custom-${Date.now()}`,
      name: newStepName,
      duration: newStepDuration
    };

    const newSession = {
      ...session,
      steps: [...session.steps, newStep],
      stepsProgress: [...session.stepsProgress, { stepId: newStep.id }]
    };

    saveSession(newSession);
    setNewStepName('');
    setNewStepDuration(15);
    setShowAddStep(false);
  };

  const removeStep = (index: number) => {
    const newSteps = session.steps.filter((_, i) => i !== index);
    const newProgress = session.stepsProgress.filter((_, i) => i !== index);

    saveSession({
      ...session,
      steps: newSteps,
      stepsProgress: newProgress,
      currentStepIndex: Math.min(session.currentStepIndex, newSteps.length - 1)
    });
  };

  const updateStepDuration = (index: number, duration: number) => {
    const newSteps = [...session.steps];
    newSteps[index] = { ...newSteps[index], duration };
    saveSession({ ...session, steps: newSteps });
    setEditingStep(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
    }
    return `${minutes} min`;
  };

  const getStepStatus = (index: number) => {
    const progress = session.stepsProgress[index];
    if (progress?.completedAt) return 'completed';
    if (progress?.startedAt) return 'in-progress';
    if (index === session.currentStepIndex) return 'current';
    return 'pending';
  };

  const getTotalDuration = () => {
    return session.steps.reduce((acc, step) => acc + step.duration, 0);
  };

  const getCompletedDuration = () => {
    return session.steps.reduce((acc, step, index) => {
      if (session.stepsProgress[index]?.completedAt) {
        return acc + step.duration;
      }
      return acc;
    }, 0);
  };

  const allStepsCompleted = session.stepsProgress.every(p => p.completedAt);

  return (
    <div className="brewing-session-page">
      <div className="page-header-compact">
        <button className="btn-text" onClick={onBack}>
          ← Retour
        </button>
        <h1>Brassage: {project.name}</h1>
        <span className="recipe-badge">{project.recipe?.style || 'Bière'}</span>
      </div>

      {/* Barre de progression */}
      <div className="brewing-progress-bar">
        <div className="progress-info">
          <span>Progression</span>
          <span>{formatDuration(getCompletedDuration())} / {formatDuration(getTotalDuration())}</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(getCompletedDuration() / getTotalDuration()) * 100}%` }}
          />
        </div>
      </div>

      {/* Timeline verticale */}
      <div className="brewing-timeline">
        {session.steps.map((step, index) => {
          const status = getStepStatus(index);
          const isActive = activeTimer === index;
          const progress = session.stepsProgress[index];
          const stepAdditions = getAdditionsForStep(step.id);

          return (
            <div key={step.id} className={`timeline-step ${status}`}>
              {/* Ligne de connexion vers le haut */}
              {index > 0 && (
                <div className="timeline-connector top">
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                </div>
              )}

              {/* Contenu de l'étape */}
              <div className="step-content">
                <div className="step-marker">
                  {status === 'completed' ? '✓' : index + 1}
                </div>

                <div className="step-info">
                  <div className="step-header">
                    <h3 className="step-name">{step.name}</h3>
                    {editingStep === step.id ? (
                      <div className="duration-edit">
                        <input
                          type="number"
                          value={step.duration}
                          onChange={(e) => {
                            const newSteps = [...session.steps];
                            newSteps[index] = { ...newSteps[index], duration: Number(e.target.value) };
                            setSession({ ...session, steps: newSteps });
                          }}
                          min="1"
                          className="duration-input"
                        />
                        <span>min</span>
                        <button
                          className="btn-icon save"
                          onClick={() => updateStepDuration(index, step.duration)}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span
                        className="step-duration"
                        onClick={() => !progress?.completedAt && setEditingStep(step.id)}
                      >
                        {formatDuration(step.duration)}
                        {step.temperature && ` • ${step.temperature}°C`}
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="step-description">{step.description}</p>
                  )}

                  {/* Mini-étapes d'ajout d'ingrédients */}
                  {stepAdditions.length > 0 && (
                    <div className="ingredient-additions">
                      <div className="additions-label">Ajouts pendant cette étape :</div>
                      {stepAdditions.map(addition => (
                        <div key={addition.id} className="addition-item">
                          <span className="addition-icon">{addition.icon}</span>
                          <span className="addition-timing">{addition.timing}</span>
                          <span className="addition-name">{addition.name}</span>
                          <span className="addition-quantity">{addition.quantity} {addition.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timer actif */}
                  {isActive && (
                    <div className="step-timer">
                      <span className="timer-display">{formatTime(timerElapsed)}</span>
                      <span className="timer-target">/ {formatDuration(step.duration)}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="step-actions">
                    {status === 'current' && !progress?.startedAt && (
                      <button className="btn-start" onClick={() => startStep(index)}>
                        Démarrer
                      </button>
                    )}
                    {status === 'in-progress' && (
                      <button className="btn-complete" onClick={() => completeStep(index)}>
                        Terminer l'étape
                      </button>
                    )}
                    {status === 'completed' && (
                      <span className="completed-badge">Terminé</span>
                    )}
                    {!progress?.startedAt && session.steps.length > 1 && (
                      <button
                        className="btn-icon remove"
                        onClick={() => removeStep(index)}
                        title="Supprimer l'étape"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Ligne de connexion vers le bas */}
              {index < session.steps.length - 1 && (
                <div className="timeline-connector bottom">
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                  <span className="connector-dot" />
                </div>
              )}
            </div>
          );
        })}

        {/* Ajouter une étape */}
        {showAddStep ? (
          <div className="add-step-form">
            <div className="timeline-connector top">
              <span className="connector-dot" />
              <span className="connector-dot" />
              <span className="connector-dot" />
            </div>
            <div className="step-content add-form">
              <div className="step-marker">+</div>
              <div className="step-info">
                <input
                  type="text"
                  placeholder="Nom de l'étape"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  className="form-input"
                  autoFocus
                />
                <div className="add-step-row">
                  <input
                    type="number"
                    value={newStepDuration}
                    onChange={(e) => setNewStepDuration(Number(e.target.value))}
                    min="1"
                    className="form-input small"
                  />
                  <span>min</span>
                  <button className="btn-primary" onClick={addStep}>
                    Ajouter
                  </button>
                  <button className="btn-secondary" onClick={() => setShowAddStep(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button className="btn-add-step" onClick={() => setShowAddStep(true)}>
            + Ajouter une étape
          </button>
        )}
      </div>

      {/* Bouton de fin de brassage */}
      {allStepsCompleted && (
        <div className="brewing-complete-section">
          <div className="complete-message">
            <span className="complete-icon">🎉</span>
            <h2>Brassage terminé !</h2>
            <p>Toutes les étapes sont complétées. Vous pouvez maintenant lancer le monitoring de la fermentation.</p>
          </div>
          <button className="btn-finish-brewing" onClick={onFinishBrewing}>
            Lancer le monitoring
          </button>
        </div>
      )}
    </div>
  );
}
