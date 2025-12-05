import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Project, BrewingSession, BrewingSessionStep, BrewingEvent, BrewingEventType, ADDITION_STEP_LABELS, StepIngredientAddition } from '../types';
import { generateId } from '../utils/brewingCalculations';
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

  // États pour les événements
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventType, setEventType] = useState<BrewingEventType>('note');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventTemperature, setEventTemperature] = useState<number | ''>('');
  const [eventDensity, setEventDensity] = useState<number | ''>('');
  const [eventPh, setEventPh] = useState<number | ''>('');
  const [eventVolume, setEventVolume] = useState<number | ''>('');

  // État pour le rapport
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Extraire les ajouts d'ingrédients de la recette
  const ingredientAdditions = useMemo(() => {
    const additions: IngredientAddition[] = [];
    const recipe = project.recipe;
    if (!recipe) return additions;

    // Helper pour obtenir un ingrédient par son ID et type
    const getIngredientInfo = (add: StepIngredientAddition) => {
      if (add.ingredientType === 'grain') {
        const grain = recipe.grains.find(g => g.id === add.ingredientId);
        if (grain) return { name: grain.name, quantity: grain.quantity, unit: 'kg', icon: '🌾' };
      } else if (add.ingredientType === 'hop') {
        const hop = recipe.hops.find(h => h.id === add.ingredientId);
        if (hop) return { name: hop.name, quantity: hop.quantity, unit: 'g', icon: '🌿' };
      } else if (add.ingredientType === 'other') {
        const other = recipe.others.find(o => o.id === add.ingredientId);
        if (other) return { name: other.name, quantity: other.quantity, unit: other.unit, icon: '📦' };
      }
      return null;
    };

    // Vérifier si des ingrédients ont été assignés aux étapes d'empâtage
    const hasMashAdditions = recipe.mashSteps.some(step =>
      step.ingredientAdditions && step.ingredientAdditions.length > 0
    );

    // Ajouts d'ingrédients assignés aux étapes d'empâtage
    if (hasMashAdditions) {
      recipe.mashSteps.forEach(step => {
        if (step.ingredientAdditions && step.ingredientAdditions.length > 0) {
          step.ingredientAdditions.forEach((add, idx) => {
            const info = getIngredientInfo(add);
            if (info) {
              additions.push({
                id: `mash-add-${step.id}-${idx}`,
                name: info.name,
                quantity: info.quantity,
                unit: info.unit,
                timing: add.minutes === 0 ? 'À 0 min' : `À ${add.minutes} min`,
                timeValue: add.minutes, // Tri par temps écoulé (croissant)
                stepId: 'empatage',
                type: add.ingredientType as 'grain' | 'hop' | 'other',
                icon: info.icon
              });
            }
          });
        }
      });
    } else {
      // Fallback: afficher tous les grains à l'empâtage si aucune assignation explicite
      recipe.grains.forEach(grain => {
        additions.push({
          id: `grain-${grain.id}`,
          name: grain.name,
          quantity: grain.quantity,
          unit: 'kg',
          timing: 'À 0 min',
          timeValue: 0,
          stepId: 'empatage',
          type: 'grain',
          icon: '🌾'
        });
      });
    }

    // Ajouts d'ingrédients assignés à l'ébullition
    // Note: add.minutes = temps écoulé depuis le début de l'ébullition
    if (recipe.boilStep.ingredientAdditions && recipe.boilStep.ingredientAdditions.length > 0) {
      recipe.boilStep.ingredientAdditions.forEach((add, idx) => {
        const info = getIngredientInfo(add);
        if (info) {
          additions.push({
            id: `boil-add-${idx}`,
            name: info.name,
            quantity: info.quantity,
            unit: info.unit,
            timing: add.minutes === 0 ? 'À 0 min' : `À ${add.minutes} min`,
            timeValue: add.minutes, // Tri par temps écoulé (croissant)
            stepId: 'ebullition',
            type: add.ingredientType as 'grain' | 'hop' | 'other',
            icon: info.icon
          });
        }
      });
    }

    // Houblons d'ébullition (boil) - fallback si pas d'additions assignées
    // hop.time = temps restant avant la fin (convention brassicole)
    // On convertit en temps écoulé: elapsedMin = boilDuration - hop.time
    const hasBoilAdditions = recipe.boilStep.ingredientAdditions && recipe.boilStep.ingredientAdditions.length > 0;
    if (!hasBoilAdditions) {
      recipe.hops
        .filter(hop => hop.use === 'boil')
        .forEach(hop => {
          const boilDuration = recipe.boilStep.duration;
          const elapsedMin = boilDuration - hop.time; // Conversion en temps écoulé
          let timing: string;
          if (elapsedMin <= 0) {
            timing = 'À 0 min';
          } else if (elapsedMin >= boilDuration) {
            timing = `À ${boilDuration} min`;
          } else {
            timing = `À ${elapsedMin} min`;
          }

          additions.push({
            id: `hop-boil-${hop.id}`,
            name: hop.name,
            quantity: hop.quantity,
            unit: 'g',
            timing,
            timeValue: elapsedMin, // Tri par temps écoulé (croissant)
            stepId: 'ebullition',
            type: 'hop',
            icon: '🌿'
          });
        });
    }

    // Houblons first wort (au moment de la filtration/avant ébullition)
    recipe.hops
      .filter(hop => hop.use === 'first-wort')
      .forEach(hop => {
        additions.push({
          id: `hop-fw-${hop.id}`,
          name: hop.name,
          quantity: hop.quantity,
          unit: 'g',
          timing: 'À 0 min',
          timeValue: 0,
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
          timing: 'À 0 min',
          timeValue: 0,
          stepId: 'whirlpool',
          type: 'hop',
          icon: '🌿'
        });
      });

    // Autres ingrédients selon leur moment d'ajout (ancien système pour rétrocompatibilité)
    // Ne pas les ajouter s'ils ont été assignés via le nouveau système
    const assignedOtherIds = new Set<string>();

    // Collecter les IDs déjà assignés
    recipe.mashSteps.forEach(step => {
      (step.ingredientAdditions || []).forEach(add => {
        if (add.ingredientType === 'other') assignedOtherIds.add(add.ingredientId);
      });
    });
    (recipe.boilStep.ingredientAdditions || []).forEach(add => {
      if (add.ingredientType === 'other') assignedOtherIds.add(add.ingredientId);
    });

    recipe.others
      .filter(other => !assignedOtherIds.has(other.id))
      .forEach(other => {
        let stepId = 'ebullition';
        let timing = '';
        let timeValue = 0;

        if (other.additionStep) {
          switch (other.additionStep) {
            case 'mash':
              stepId = 'empatage';
              break;
            case 'boil':
              stepId = 'ebullition';
              break;
            case 'fermentation':
              stepId = 'ensemencement';
              break;
            case 'packaging':
              stepId = 'transfert';
              break;
          }

          const stepLabel = ADDITION_STEP_LABELS[other.additionStep];

          if (other.additionTiming === 'during' && other.additionMinutes !== undefined) {
            timing = `À ${other.additionMinutes} min`;
            timeValue = other.additionMinutes;
          } else if (other.additionTiming === 'start') {
            timing = 'À 0 min';
            timeValue = 0;
          } else if (other.additionTiming === 'end') {
            timing = `Fin ${stepLabel.toLowerCase()}`;
            timeValue = 9999; // À la fin = après tout le reste
          } else {
            timing = 'À 0 min';
            timeValue = 0;
          }
        } else {
          timing = other.additionTime || 'Ébullition';
          const additionLower = (other.additionTime || '').toLowerCase();
          if (additionLower.includes('empâtage') || additionLower.includes('empatage')) {
            stepId = 'empatage';
          } else if (additionLower.includes('whirlpool')) {
            stepId = 'whirlpool';
          } else if (additionLower.includes('fermentation')) {
            stepId = 'ensemencement';
          }
          const minuteMatch = (other.additionTime || '').match(/(\d+)\s*min/i);
          if (minuteMatch) {
            timeValue = parseInt(minuteMatch[1], 10);
          }
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

    // Levures à l'ensemencement
    recipe.yeasts.forEach(yeast => {
      additions.push({
        id: `yeast-${yeast.id}`,
        name: yeast.name,
        quantity: yeast.quantity,
        unit: yeast.form === 'dry' ? 'g' : 'paquet(s)',
        timing: 'À 0 min',
        timeValue: 0,
        stepId: 'ensemencement',
        type: 'other',
        icon: '🧫'
      });
    });

    return additions;
  }, [project.recipe]);

  // Obtenir les ajouts pour une étape donnée (par ID ou par nom)
  const getAdditionsForStep = (stepId: string, stepName?: string): IngredientAddition[] => {
    // Normaliser le nom de l'étape pour le matching
    const normalizedName = (stepName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return ingredientAdditions
      .filter(a => {
        // Match exact par ID
        if (a.stepId === stepId) return true;

        // Match par nom normalisé si pas de match par ID
        if (normalizedName.includes('empatage') || normalizedName.includes('mash')) {
          return a.stepId === 'empatage';
        }
        if (normalizedName.includes('ebullition') || normalizedName.includes('boil')) {
          return a.stepId === 'ebullition';
        }
        if (normalizedName.includes('filtration') || normalizedName.includes('rincage')) {
          return a.stepId === 'filtration';
        }
        if (normalizedName.includes('whirlpool')) {
          return a.stepId === 'whirlpool';
        }
        if (normalizedName.includes('refroidissement') || normalizedName.includes('cool')) {
          return a.stepId === 'refroidissement';
        }
        if (normalizedName.includes('transfert')) {
          return a.stepId === 'transfert';
        }
        if (normalizedName.includes('ensemencement') || normalizedName.includes('levure') || normalizedName.includes('yeast')) {
          return a.stepId === 'ensemencement';
        }

        return false;
      })
      .sort((a, b) => a.timeValue - b.timeValue); // Tri croissant par temps écoulé (0 min en premier)
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

  // Basculer l'état de complétion d'un ajout d'ingrédient
  const toggleAdditionCompleted = (additionId: string) => {
    const currentCompleted = session.completedAdditions || [];
    const isCompleted = currentCompleted.includes(additionId);

    const newCompleted = isCompleted
      ? currentCompleted.filter(id => id !== additionId)
      : [...currentCompleted, additionId];

    saveSession({
      ...session,
      completedAdditions: newCompleted
    });
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

  // Ajouter un événement
  const addEvent = () => {
    if (!eventTitle.trim()) return;

    const currentStep = session.steps[session.currentStepIndex];
    const newEvent: BrewingEvent = {
      id: generateId(),
      timestamp: Date.now(),
      stepId: currentStep?.id,
      type: eventType,
      title: eventTitle.trim(),
      description: eventDescription.trim() || undefined,
      temperature: eventTemperature !== '' ? eventTemperature : undefined,
      density: eventDensity !== '' ? eventDensity : undefined,
      ph: eventPh !== '' ? eventPh : undefined,
      volume: eventVolume !== '' ? eventVolume : undefined,
    };

    const newSession = {
      ...session,
      events: [...(session.events || []), newEvent]
    };

    saveSession(newSession);

    // Réinitialiser le formulaire
    setEventTitle('');
    setEventDescription('');
    setEventTemperature('');
    setEventDensity('');
    setEventPh('');
    setEventVolume('');
    setShowAddEvent(false);
  };

  // Supprimer un événement
  const removeEvent = (eventId: string) => {
    const newSession = {
      ...session,
      events: (session.events || []).filter(e => e.id !== eventId)
    };
    saveSession(newSession);
  };

  // Formater la date
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtenir l'icône pour un type d'événement
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

  // Obtenir le label pour un type d'événement
  const getEventLabel = (type: BrewingEventType) => {
    switch (type) {
      case 'note': return 'Note';
      case 'measurement': return 'Mesure';
      case 'addition': return 'Ajout';
      case 'issue': return 'Problème';
      case 'photo': return 'Photo';
      default: return 'Événement';
    }
  };

  // Imprimer le rapport
  const printReport = () => {
    window.print();
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

      {/* Avertissement si pas de recette */}
      {!project.recipe && (
        <div className="no-recipe-warning">
          <span className="warning-icon">⚠️</span>
          <span>Aucune recette liée à ce projet. Les ingrédients ne seront pas affichés dans les étapes.</span>
        </div>
      )}

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
          const stepAdditions = getAdditionsForStep(step.id, step.name);

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
                      {stepAdditions.map(addition => {
                        const isCompleted = (session.completedAdditions || []).includes(addition.id);
                        return (
                          <div
                            key={addition.id}
                            className={`addition-item ${isCompleted ? 'completed' : ''}`}
                            onClick={() => toggleAdditionCompleted(addition.id)}
                          >
                            <span className={`addition-checkbox ${isCompleted ? 'checked' : ''}`}>
                              {isCompleted ? '✓' : ''}
                            </span>
                            <span className="addition-icon">{addition.icon}</span>
                            <span className="addition-timing">{addition.timing}</span>
                            <span className="addition-name">{addition.name}</span>
                            <span className="addition-quantity">{addition.quantity} {addition.unit}</span>
                          </div>
                        );
                      })}
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

      {/* Section des événements */}
      <div className="events-section">
        <div className="events-header">
          <h2>Journal de brassage</h2>
          <button className="btn-add-event" onClick={() => setShowAddEvent(true)}>
            + Ajouter une note
          </button>
        </div>

        {/* Formulaire d'ajout d'événement */}
        {showAddEvent && (
          <div className="add-event-form">
            <div className="event-type-selector">
              {(['note', 'measurement', 'addition', 'issue'] as BrewingEventType[]).map(type => (
                <button
                  key={type}
                  className={`event-type-btn ${eventType === type ? 'active' : ''}`}
                  onClick={() => setEventType(type)}
                >
                  {getEventIcon(type)} {getEventLabel(type)}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Titre de l'événement"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="form-input"
              autoFocus
            />

            <textarea
              placeholder="Description (optionnel)"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="form-textarea"
              rows={2}
            />

            {/* Champs de mesure */}
            {eventType === 'measurement' && (
              <div className="measurement-fields">
                <div className="measurement-field">
                  <label>Température</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={eventTemperature}
                      onChange={(e) => setEventTemperature(e.target.value ? Number(e.target.value) : '')}
                      className="form-input small"
                      step="0.1"
                    />
                    <span>°C</span>
                  </div>
                </div>
                <div className="measurement-field">
                  <label>Densité</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={eventDensity}
                      onChange={(e) => setEventDensity(e.target.value ? Number(e.target.value) : '')}
                      className="form-input small"
                      step="0.001"
                      placeholder="1.050"
                    />
                  </div>
                </div>
                <div className="measurement-field">
                  <label>pH</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={eventPh}
                      onChange={(e) => setEventPh(e.target.value ? Number(e.target.value) : '')}
                      className="form-input small"
                      step="0.1"
                      min="0"
                      max="14"
                    />
                  </div>
                </div>
                <div className="measurement-field">
                  <label>Volume</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={eventVolume}
                      onChange={(e) => setEventVolume(e.target.value ? Number(e.target.value) : '')}
                      className="form-input small"
                      step="0.5"
                    />
                    <span>L</span>
                  </div>
                </div>
              </div>
            )}

            <div className="add-event-actions">
              <button className="btn-primary" onClick={addEvent} disabled={!eventTitle.trim()}>
                Enregistrer
              </button>
              <button className="btn-secondary" onClick={() => setShowAddEvent(false)}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste des événements */}
        {(session.events || []).length > 0 && (
          <div className="events-list">
            {(session.events || [])
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(event => {
                const stepName = session.steps.find(s => s.id === event.stepId)?.name;
                return (
                  <div key={event.id} className={`event-item event-${event.type}`}>
                    <div className="event-icon">{getEventIcon(event.type)}</div>
                    <div className="event-content">
                      <div className="event-header">
                        <span className="event-title">{event.title}</span>
                        <span className="event-time">{formatDateTime(event.timestamp)}</span>
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
                    <button className="btn-icon remove" onClick={() => removeEvent(event.id)}>×</button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Bouton pour voir le rapport */}
      <div className="report-actions">
        <button className="btn-report" onClick={() => setShowReport(true)}>
          📄 Voir le rapport de brassage
        </button>
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

      {/* Modal du rapport de brassage */}
      {showReport && (
        <div className="report-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="report-modal" onClick={e => e.stopPropagation()}>
            <div className="report-modal-header">
              <h2>Rapport de brassage</h2>
              <div className="report-modal-actions">
                <button className="btn-print" onClick={printReport}>
                  🖨️ Imprimer
                </button>
                <button className="btn-close" onClick={() => setShowReport(false)}>×</button>
              </div>
            </div>

            <div className="report-content" ref={reportRef}>
              {/* En-tête du rapport */}
              <div className="report-header print-only">
                <h1>Rapport de Brassage</h1>
                <div className="report-meta">
                  <div className="report-meta-item">
                    <strong>Projet :</strong> {project.name}
                  </div>
                  <div className="report-meta-item">
                    <strong>Style :</strong> {project.recipe?.style || 'Non spécifié'}
                  </div>
                  <div className="report-meta-item">
                    <strong>Date de brassage :</strong> {formatDateTime(session.startedAt)}
                  </div>
                  {session.completedAt && (
                    <div className="report-meta-item">
                      <strong>Fin :</strong> {formatDateTime(session.completedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* Recette */}
              {project.recipe && (
                <div className="report-section">
                  <h3>Recette</h3>
                  <div className="report-recipe-grid">
                    <div className="report-recipe-item">
                      <span className="label">Volume visé</span>
                      <span className="value">{project.recipe.batchSize} L</span>
                    </div>
                    {project.recipe.originalGravity && (
                      <div className="report-recipe-item">
                        <span className="label">Densité initiale</span>
                        <span className="value">{project.recipe.originalGravity.toFixed(3)}</span>
                      </div>
                    )}
                    {project.recipe.estimatedABV && (
                      <div className="report-recipe-item">
                        <span className="label">ABV estimé</span>
                        <span className="value">{project.recipe.estimatedABV.toFixed(1)}%</span>
                      </div>
                    )}
                    {project.recipe.estimatedIBU && (
                      <div className="report-recipe-item">
                        <span className="label">IBU</span>
                        <span className="value">{project.recipe.estimatedIBU}</span>
                      </div>
                    )}
                  </div>

                  {/* Ingrédients */}
                  <h4>Malts</h4>
                  <ul className="report-ingredients-list">
                    {project.recipe.grains.map(g => (
                      <li key={g.id}>{g.quantity} kg - {g.name} {g.color ? `(${g.color} EBC)` : ''}</li>
                    ))}
                  </ul>

                  <h4>Houblons</h4>
                  <ul className="report-ingredients-list">
                    {project.recipe.hops.map(h => (
                      <li key={h.id}>{h.quantity}g - {h.name} ({h.alphaAcid}% AA) - {h.use} {h.time}{h.use === 'dry-hop' ? 'j' : 'min'}</li>
                    ))}
                  </ul>

                  <h4>Levures</h4>
                  <ul className="report-ingredients-list">
                    {project.recipe.yeasts.map(y => (
                      <li key={y.id}>{y.quantity}{y.form === 'dry' ? 'g' : ' pkt'} - {y.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Étapes du brassage */}
              <div className="report-section">
                <h3>Étapes du brassage</h3>
                <table className="report-steps-table">
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
                    {session.steps.map((step, index) => {
                      const progress = session.stepsProgress[index];
                      const realDuration = progress?.startedAt && progress?.completedAt
                        ? Math.round((progress.completedAt - progress.startedAt) / 60000)
                        : null;
                      return (
                        <tr key={step.id}>
                          <td>{index + 1}</td>
                          <td>{step.name}</td>
                          <td>{formatDuration(step.duration)}</td>
                          <td>{progress?.startedAt ? formatDateTime(progress.startedAt) : '-'}</td>
                          <td>{progress?.completedAt ? formatDateTime(progress.completedAt) : '-'}</td>
                          <td>{realDuration !== null ? formatDuration(realDuration) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Événements */}
              {(session.events || []).length > 0 && (
                <div className="report-section">
                  <h3>Journal des événements</h3>
                  <div className="report-events">
                    {(session.events || [])
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map(event => (
                        <div key={event.id} className="report-event">
                          <div className="report-event-time">{formatDateTime(event.timestamp)}</div>
                          <div className="report-event-content">
                            <strong>{getEventIcon(event.type)} {event.title}</strong>
                            {event.description && <p>{event.description}</p>}
                            {(event.temperature !== undefined || event.density !== undefined || event.ph !== undefined || event.volume !== undefined) && (
                              <div className="report-event-measures">
                                {event.temperature !== undefined && <span>Temp: {event.temperature}°C</span>}
                                {event.density !== undefined && <span>Densité: {event.density}</span>}
                                {event.ph !== undefined && <span>pH: {event.ph}</span>}
                                {event.volume !== undefined && <span>Volume: {event.volume}L</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {project.recipe?.notes && (
                <div className="report-section">
                  <h3>Notes de la recette</h3>
                  <p className="report-notes">{project.recipe.notes}</p>
                </div>
              )}

              {/* Pied de page */}
              <div className="report-footer print-only">
                <p>Généré par MyFermentLab - {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
