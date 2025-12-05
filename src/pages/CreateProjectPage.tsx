import { useState, useEffect, useMemo } from 'react';
import {
  FermentationType,
  FERMENTATION_TYPES,
  BEER_STYLES,
  FERMENTERS,
  Device,
  BrewingRecipe,
  GrainIngredient,
  HopIngredient,
  YeastIngredient,
  WaterAddition,
  OtherIngredient,
  MashStep,
  FermentationStep,
  AdditionTiming,
  AdditionStep,
  ADDITION_TIMING_LABELS,
  ADDITION_STEP_LABELS,
  StepIngredientAddition
} from '../types';
import {
  calculateBrewingMetrics,
  createEmptyRecipe,
  createDefaultGrain,
  createDefaultHop,
  createDefaultYeast,
  generateId,
  getColorForEBC
} from '../utils/brewingCalculations';
import { IngredientAutocomplete } from '../components/IngredientAutocomplete';
import './CreateProjectPage.css';

interface CreateProjectPageProps {
  devices: Device[];
  usedDeviceIds: string[];
  onCreateProject: (data: {
    name: string;
    fermentationType: FermentationType;
    sensorId: string;
    outletId: string;
    targetTemperature: number;
    controlMode: 'manual' | 'automatic';
    recipe?: BrewingRecipe;
  }, startBrewing?: boolean) => void;
  onCancel: () => void;
  role: 'admin' | 'viewer' | null;
}

export function CreateProjectPage({ devices, usedDeviceIds, onCreateProject, onCancel, role }: CreateProjectPageProps) {
  const [name, setName] = useState('');
  const [fermentationType, setFermentationType] = useState<FermentationType>('beer');
  const [sensorId, setSensorId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [controlMode, setControlMode] = useState<'manual' | 'automatic'>('automatic');

  // État pour la recette (uniquement pour la bière)
  const [recipe, setRecipe] = useState<BrewingRecipe>(createEmptyRecipe);
  const [showRecipe, setShowRecipe] = useState(true);
  const [efficiency, setEfficiency] = useState(72);
  const [customFermenterVolume, setCustomFermenterVolume] = useState(30);

  // Sections ouvertes/fermées
  const [openSections, setOpenSections] = useState({
    equipment: true,
    grains: true,
    hops: false,
    yeasts: false,
    water: false,
    others: false,
    mash: false,
    boil: false,
    fermentation: false
  });

  // Redirect to home if viewer tries to access this page
  useEffect(() => {
    if (role === 'viewer') {
      onCancel();
    }
  }, [role, onCancel]);

  // Filtrer les devices non utilisés par d'autres projets actifs
  const sensors = devices.filter(d => d.type === 'sensor' && !usedDeviceIds.includes(d.id));
  const outlets = devices.filter(d => d.type === 'outlet' && !usedDeviceIds.includes(d.id));
  const config = FERMENTATION_TYPES[fermentationType];

  // Calculs de brassage
  const calculations = useMemo(() => {
    if (fermentationType !== 'beer' || !showRecipe) return null;
    return calculateBrewingMetrics(recipe, efficiency / 100);
  }, [recipe, efficiency, fermentationType, showRecipe]);

  const canSubmit = name.trim() && sensorId && outletId;

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Handlers pour les ingrédients
  const updateRecipe = (updates: Partial<BrewingRecipe>) => {
    setRecipe(prev => ({ ...prev, ...updates, updatedAt: Date.now() }));
  };

  const addGrain = () => {
    updateRecipe({ grains: [...recipe.grains, createDefaultGrain()] });
  };

  const updateGrain = (id: string, updates: Partial<GrainIngredient>) => {
    updateRecipe({
      grains: recipe.grains.map(g => g.id === id ? { ...g, ...updates } : g)
    });
  };

  const removeGrain = (id: string) => {
    updateRecipe({ grains: recipe.grains.filter(g => g.id !== id) });
  };

  const addHop = () => {
    updateRecipe({ hops: [...recipe.hops, createDefaultHop()] });
  };

  const updateHop = (id: string, updates: Partial<HopIngredient>) => {
    updateRecipe({
      hops: recipe.hops.map(h => h.id === id ? { ...h, ...updates } : h)
    });
  };

  const removeHop = (id: string) => {
    updateRecipe({ hops: recipe.hops.filter(h => h.id !== id) });
  };

  const addYeast = () => {
    updateRecipe({ yeasts: [...recipe.yeasts, createDefaultYeast()] });
  };

  const updateYeast = (id: string, updates: Partial<YeastIngredient>) => {
    updateRecipe({
      yeasts: recipe.yeasts.map(y => y.id === id ? { ...y, ...updates } : y)
    });
  };

  const removeYeast = (id: string) => {
    updateRecipe({ yeasts: recipe.yeasts.filter(y => y.id !== id) });
  };

  const addWater = () => {
    updateRecipe({
      waters: [...recipe.waters, { id: generateId(), type: 'water', name: '', quantity: 0 }]
    });
  };

  const updateWater = (id: string, updates: Partial<WaterAddition>) => {
    updateRecipe({
      waters: recipe.waters.map(w => w.id === id ? { ...w, ...updates } : w)
    });
  };

  const removeWater = (id: string) => {
    updateRecipe({ waters: recipe.waters.filter(w => w.id !== id) });
  };

  const addOther = () => {
    updateRecipe({
      others: [...recipe.others, { id: generateId(), type: 'other', name: '', quantity: 0, unit: 'g' }]
    });
  };

  const updateOther = (id: string, updates: Partial<OtherIngredient>) => {
    updateRecipe({
      others: recipe.others.map(o => o.id === id ? { ...o, ...updates } : o)
    });
  };

  const removeOther = (id: string) => {
    updateRecipe({ others: recipe.others.filter(o => o.id !== id) });
  };

  const addMashStep = () => {
    updateRecipe({
      mashSteps: [...recipe.mashSteps, { id: generateId(), name: '', temperature: 65, duration: 15 }]
    });
  };

  const updateMashStep = (id: string, updates: Partial<MashStep>) => {
    updateRecipe({
      mashSteps: recipe.mashSteps.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const removeMashStep = (id: string) => {
    updateRecipe({ mashSteps: recipe.mashSteps.filter(s => s.id !== id) });
  };

  const addFermentationStep = () => {
    updateRecipe({
      fermentationSteps: [...recipe.fermentationSteps, { id: generateId(), name: '', temperature: 20, duration: 7 }]
    });
  };

  const updateFermentationStep = (id: string, updates: Partial<FermentationStep>) => {
    updateRecipe({
      fermentationSteps: recipe.fermentationSteps.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const removeFermentationStep = (id: string) => {
    updateRecipe({ fermentationSteps: recipe.fermentationSteps.filter(s => s.id !== id) });
  };

  const handleFermenterChange = (fermenterId: string) => {
    const fermenter = FERMENTERS.find(f => f.id === fermenterId);
    if (fermenter) {
      updateRecipe({
        fermenterId,
        fermenterVolume: fermenter.id === 'custom' ? customFermenterVolume : fermenter.volume
      });
    }
  };

  const createProjectData = () => {
    // Déterminer la température cible
    let targetTemp = Math.round((config.minTemp + config.maxTemp) / 2);

    // Si c'est de la bière avec une recette, utiliser la température de fermentation
    if (fermentationType === 'beer' && showRecipe && recipe.fermentationSteps.length > 0) {
      targetTemp = recipe.fermentationSteps[0].temperature;
    }

    // Mettre à jour les valeurs calculées dans la recette
    const finalRecipe = fermentationType === 'beer' && showRecipe ? {
      ...recipe,
      name: name.trim(),
      originalGravity: calculations?.originalGravity,
      finalGravity: calculations?.finalGravity,
      estimatedABV: calculations?.abv,
      estimatedIBU: calculations?.ibu,
      estimatedColor: calculations?.colorEBC
    } : undefined;

    return {
      name: name.trim(),
      fermentationType,
      sensorId,
      outletId,
      targetTemperature: targetTemp,
      controlMode,
      recipe: finalRecipe
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onCreateProject(createProjectData(), false);
    }
  };

  const handleStartBrewing = () => {
    if (canSubmit) {
      onCreateProject(createProjectData(), true);
    }
  };

  return (
    <div className="create-project-page">
      <div className="page-header">
        <h1>Nouveau Projet</h1>
        <button className="btn-text" onClick={onCancel}>
          Retour
        </button>
      </div>

      <form className="create-form" onSubmit={handleSubmit}>
        {/* Informations de base */}
        <div className="form-section">
          <h2>Informations du projet</h2>

          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="project-name" className="form-label">
                Nom du projet
              </label>
              <input
                id="project-name"
                type="text"
                className="form-input"
                placeholder="Ex: Bière IPA Printemps 2025"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="fermentation-type" className="form-label">
                Type de fermentation
              </label>
              <select
                id="fermentation-type"
                className="form-select"
                value={fermentationType}
                onChange={(e) => setFermentationType(e.target.value as FermentationType)}
              >
                {Object.entries(FERMENTATION_TYPES).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fermentationType === 'beer' && (
            <div className="form-group">
              <label className="form-label">Style de bière</label>
              <select
                className="form-select"
                value={recipe.style || ''}
                onChange={(e) => updateRecipe({ style: e.target.value })}
              >
                <option value="">Sélectionner un style</option>
                {BEER_STYLES.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Configuration des appareils */}
        <div className="form-section">
          <h2>Configuration des appareils</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sensor" className="form-label">
                Sonde de température
              </label>
              {sensors.length === 0 ? (
                <div className="form-warning">
                  Aucune sonde disponible.
                </div>
              ) : (
                <select
                  id="sensor"
                  className="form-select"
                  value={sensorId}
                  onChange={(e) => setSensorId(e.target.value)}
                  required
                >
                  <option value="">Sélectionner une sonde</option>
                  {sensors.map(sensor => (
                    <option key={sensor.id} value={sensor.id}>
                      {sensor.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="outlet" className="form-label">
                Prise connectée
              </label>
              {outlets.length === 0 ? (
                <div className="form-warning">
                  Aucune prise disponible.
                </div>
              ) : (
                <select
                  id="outlet"
                  className="form-select"
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  required
                >
                  <option value="">Sélectionner une prise</option>
                  {outlets.map(outlet => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="control-mode" className="form-label">
                Mode de contrôle
              </label>
              <select
                id="control-mode"
                className="form-select"
                value={controlMode}
                onChange={(e) => setControlMode(e.target.value as 'manual' | 'automatic')}
              >
                <option value="automatic">Automatique</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Recette de brassage - uniquement pour la bière */}
        {fermentationType === 'beer' && (
          <>
            <div className="form-section recipe-toggle-section">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showRecipe}
                  onChange={(e) => setShowRecipe(e.target.checked)}
                />
                <span>Ajouter une recette de brassage</span>
              </label>
            </div>

            {showRecipe && (
              <>
                {/* Calculs en temps réel */}
                {calculations && (
                  <div className="calculations-summary">
                    <h3>Estimations</h3>
                    <div className="calc-grid">
                      <div className="calc-item">
                        <span className="calc-label">Volume final</span>
                        <span className="calc-value">{calculations.finalVolume} L</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Vol. post-ébullition</span>
                        <span className="calc-value">{calculations.postBoilVolume} L</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Vol. pré-ébullition</span>
                        <span className="calc-value">{calculations.preBoilVolume} L</span>
                      </div>
                      <div className="calc-item highlight">
                        <span className="calc-label">Eau totale nécessaire</span>
                        <span className="calc-value">{calculations.totalWaterNeeded} L</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Densité initiale</span>
                        <span className="calc-value">{calculations.originalGravity.toFixed(3)}</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Densité finale</span>
                        <span className="calc-value">{calculations.finalGravity.toFixed(3)}</span>
                      </div>
                      <div className="calc-item highlight">
                        <span className="calc-label">Alcool (ABV)</span>
                        <span className="calc-value">{calculations.abv.toFixed(1)} %</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Amertume</span>
                        <span className="calc-value">{calculations.ibu} IBU</span>
                      </div>
                      <div className="calc-item">
                        <span className="calc-label">Couleur</span>
                        <span className="calc-value">
                          <span
                            className="color-swatch"
                            style={{ backgroundColor: getColorForEBC(calculations.colorEBC) }}
                          />
                          {calculations.colorEBC} EBC
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Équipement */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.equipment ? 'open' : ''}`}
                    onClick={() => toggleSection('equipment')}
                  >
                    <span>Équipement & Volumes</span>
                    <span className="accordion-icon">{openSections.equipment ? '−' : '+'}</span>
                  </button>
                  {openSections.equipment && (
                    <div className="accordion-content">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Cuve de fermentation</label>
                          <select
                            className="form-select"
                            value={recipe.fermenterId || ''}
                            onChange={(e) => handleFermenterChange(e.target.value)}
                          >
                            <option value="">Sélectionner une cuve</option>
                            {FERMENTERS.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.name} {f.volume > 0 ? `(${f.volume}L)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {recipe.fermenterId === 'custom' && (
                          <div className="form-group">
                            <label className="form-label">Volume personnalisé (L)</label>
                            <input
                              type="number"
                              className="form-input"
                              value={customFermenterVolume}
                              onChange={(e) => {
                                setCustomFermenterVolume(Number(e.target.value));
                                updateRecipe({ fermenterVolume: Number(e.target.value) });
                              }}
                              min="1"
                              step="1"
                            />
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Volume visé (L)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={recipe.batchSize}
                            onChange={(e) => updateRecipe({ batchSize: Number(e.target.value) })}
                            min="1"
                            step="0.5"
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Efficacité (%)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={efficiency}
                            onChange={(e) => setEfficiency(Number(e.target.value))}
                            min="50"
                            max="95"
                            step="1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Eau */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.water ? 'open' : ''}`}
                    onClick={() => toggleSection('water')}
                  >
                    <span>Eau ({recipe.waters.reduce((s, w) => s + w.quantity, 0)} L)</span>
                    <span className="accordion-icon">{openSections.water ? '−' : '+'}</span>
                  </button>
                  {openSections.water && (
                    <div className="accordion-content">
                      {recipe.waters.map((water) => (
                        <div key={water.id} className="ingredient-row">
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Type (Empâtage, Rinçage...)"
                            value={water.name}
                            onChange={(e) => updateWater(water.id, { name: e.target.value })}
                          />
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="L"
                            value={water.quantity || ''}
                            onChange={(e) => updateWater(water.id, { quantity: Number(e.target.value) })}
                            min="0"
                            step="0.5"
                          />
                          <span className="unit">L</span>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="°C"
                            value={water.temperature || ''}
                            onChange={(e) => updateWater(water.id, { temperature: Number(e.target.value) })}
                            min="0"
                            max="100"
                          />
                          <span className="unit">°C</span>
                          <button
                            type="button"
                            className="btn-icon remove"
                            onClick={() => removeWater(water.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addWater}>
                        + Ajouter de l'eau
                      </button>
                    </div>
                  )}
                </div>

                {/* Malts */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.grains ? 'open' : ''}`}
                    onClick={() => toggleSection('grains')}
                  >
                    <span>Malts & Céréales ({recipe.grains.length})</span>
                    <span className="accordion-icon">{openSections.grains ? '−' : '+'}</span>
                  </button>
                  {openSections.grains && (
                    <div className="accordion-content">
                      {recipe.grains.map((grain) => (
                        <div key={grain.id} className="ingredient-row">
                          <IngredientAutocomplete
                            type="malt"
                            value={grain.name}
                            onChange={(name) => updateGrain(grain.id, { name })}
                            onSelect={(data) => updateGrain(grain.id, {
                              name: data.name,
                              color: data.color,
                              potential: data.potential
                            })}
                            placeholder="Nom du malt"
                          />
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="kg"
                            value={grain.quantity || ''}
                            onChange={(e) => updateGrain(grain.id, { quantity: Number(e.target.value) })}
                            min="0"
                            step="0.1"
                          />
                          <span className="unit">kg</span>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="EBC"
                            value={grain.color || ''}
                            onChange={(e) => updateGrain(grain.id, { color: Number(e.target.value) })}
                            min="0"
                          />
                          <span className="unit">EBC</span>
                          <button
                            type="button"
                            className="btn-icon remove"
                            onClick={() => removeGrain(grain.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addGrain}>
                        + Ajouter un malt
                      </button>
                    </div>
                  )}
                </div>

                {/* Houblons */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.hops ? 'open' : ''}`}
                    onClick={() => toggleSection('hops')}
                  >
                    <span>Houblons ({recipe.hops.length})</span>
                    <span className="accordion-icon">{openSections.hops ? '−' : '+'}</span>
                  </button>
                  {openSections.hops && (
                    <div className="accordion-content">
                      {recipe.hops.map((hop) => (
                        <div key={hop.id} className="ingredient-row hop-row">
                          <IngredientAutocomplete
                            type="hop"
                            value={hop.name}
                            onChange={(name) => updateHop(hop.id, { name })}
                            onSelect={(data) => updateHop(hop.id, {
                              name: data.name,
                              alphaAcid: data.alphaAcid || hop.alphaAcid
                            })}
                            placeholder="Nom du houblon"
                          />
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="g"
                            value={hop.quantity || ''}
                            onChange={(e) => updateHop(hop.id, { quantity: Number(e.target.value) })}
                            min="0"
                          />
                          <span className="unit">g</span>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="AA%"
                            value={hop.alphaAcid || ''}
                            onChange={(e) => updateHop(hop.id, { alphaAcid: Number(e.target.value) })}
                            min="0"
                            max="25"
                            step="0.1"
                          />
                          <span className="unit">%AA</span>
                          <select
                            className="form-select small"
                            value={hop.use}
                            onChange={(e) => updateHop(hop.id, { use: e.target.value as HopIngredient['use'] })}
                          >
                            <option value="boil">Ébullition</option>
                            <option value="first-wort">First Wort</option>
                            <option value="whirlpool">Whirlpool</option>
                            <option value="dry-hop">Dry Hop</option>
                          </select>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder={hop.use === 'dry-hop' ? 'jours' : 'min'}
                            value={hop.time || ''}
                            onChange={(e) => updateHop(hop.id, { time: Number(e.target.value) })}
                            min="0"
                          />
                          <span className="unit">{hop.use === 'dry-hop' ? 'j' : 'min'}</span>
                          <button
                            type="button"
                            className="btn-icon remove"
                            onClick={() => removeHop(hop.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addHop}>
                        + Ajouter un houblon
                      </button>
                    </div>
                  )}
                </div>

                {/* Levures */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.yeasts ? 'open' : ''}`}
                    onClick={() => toggleSection('yeasts')}
                  >
                    <span>Levures ({recipe.yeasts.length})</span>
                    <span className="accordion-icon">{openSections.yeasts ? '−' : '+'}</span>
                  </button>
                  {openSections.yeasts && (
                    <div className="accordion-content">
                      {recipe.yeasts.map((yeast) => (
                        <div key={yeast.id} className="ingredient-row yeast-row">
                          <IngredientAutocomplete
                            type="yeast"
                            value={yeast.name}
                            onChange={(name) => updateYeast(yeast.id, { name })}
                            onSelect={(data) => updateYeast(yeast.id, {
                              name: data.name,
                              attenuation: data.attenuation || yeast.attenuation,
                              tempMin: data.tempMin,
                              tempMax: data.tempMax,
                              form: data.form || yeast.form
                            })}
                            placeholder="Nom de la levure"
                          />
                          <select
                            className="form-select small"
                            value={yeast.form}
                            onChange={(e) => updateYeast(yeast.id, { form: e.target.value as YeastIngredient['form'] })}
                          >
                            <option value="dry">Sèche</option>
                            <option value="liquid">Liquide</option>
                            <option value="slurry">Slurry</option>
                          </select>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="Qté"
                            value={yeast.quantity || ''}
                            onChange={(e) => updateYeast(yeast.id, { quantity: Number(e.target.value) })}
                            min="0"
                            step="0.5"
                          />
                          <span className="unit">{yeast.form === 'dry' ? 'g' : 'pkt'}</span>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="Att%"
                            value={yeast.attenuation || ''}
                            onChange={(e) => updateYeast(yeast.id, { attenuation: Number(e.target.value) })}
                            min="50"
                            max="100"
                          />
                          <span className="unit">%att</span>
                          <button
                            type="button"
                            className="btn-icon remove"
                            onClick={() => removeYeast(yeast.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addYeast}>
                        + Ajouter une levure
                      </button>
                    </div>
                  )}
                </div>

                {/* Autres ingrédients */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.others ? 'open' : ''}`}
                    onClick={() => toggleSection('others')}
                  >
                    <span>Autres ingrédients ({recipe.others.length})</span>
                    <span className="accordion-icon">{openSections.others ? '−' : '+'}</span>
                  </button>
                  {openSections.others && (
                    <div className="accordion-content">
                      {recipe.others.map((other) => (
                        <div key={other.id} className="other-ingredient-card">
                          <div className="other-ingredient-row">
                            <input
                              type="text"
                              className="form-input flex-2"
                              placeholder="Nom de l'ingrédient"
                              value={other.name}
                              onChange={(e) => updateOther(other.id, { name: e.target.value })}
                            />
                            <input
                              type="number"
                              className="form-input small"
                              placeholder="Qté"
                              value={other.quantity || ''}
                              onChange={(e) => updateOther(other.id, { quantity: Number(e.target.value) })}
                              min="0"
                              step="0.1"
                            />
                            <select
                              className="form-select small"
                              value={other.unit}
                              onChange={(e) => updateOther(other.id, { unit: e.target.value })}
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="L">L</option>
                              <option value="pcs">pcs</option>
                            </select>
                            <button
                              type="button"
                              className="btn-icon remove"
                              onClick={() => removeOther(other.id)}
                            >
                              ×
                            </button>
                          </div>
                          <div className="other-ingredient-timing">
                            <div className="timing-minutes-wrapper">
                              <input
                                type="number"
                                className="form-input timing-minutes"
                                placeholder="min"
                                value={other.additionMinutes || ''}
                                onChange={(e) => updateOther(other.id, { additionMinutes: Number(e.target.value) || undefined })}
                                min="0"
                              />
                              <span className="unit">min</span>
                            </div>
                            <select
                              className="form-select timing-select"
                              value={other.additionTiming || ''}
                              onChange={(e) => updateOther(other.id, { additionTiming: e.target.value as AdditionTiming || undefined })}
                            >
                              <option value="">Quand</option>
                              {(Object.keys(ADDITION_TIMING_LABELS) as AdditionTiming[]).map(timing => (
                                <option key={timing} value={timing}>{ADDITION_TIMING_LABELS[timing]}</option>
                              ))}
                            </select>
                            <select
                              className="form-select timing-select"
                              value={other.additionStep || ''}
                              onChange={(e) => updateOther(other.id, { additionStep: e.target.value as AdditionStep || undefined })}
                            >
                              <option value="">Étape</option>
                              {(Object.keys(ADDITION_STEP_LABELS) as AdditionStep[]).map(step => (
                                <option key={step} value={step}>{ADDITION_STEP_LABELS[step]}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addOther}>
                        + Ajouter un ingrédient
                      </button>
                    </div>
                  )}
                </div>

                {/* Étapes d'empâtage */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.mash ? 'open' : ''}`}
                    onClick={() => toggleSection('mash')}
                  >
                    <span>Étapes d'empâtage ({recipe.mashSteps.length})</span>
                    <span className="accordion-icon">{openSections.mash ? '−' : '+'}</span>
                  </button>
                  {openSections.mash && (
                    <div className="accordion-content">
                      {recipe.mashSteps.map((step, index) => (
                        <div key={step.id} className="mash-step-card">
                          <div className="step-row">
                            <span className="step-number">{index + 1}</span>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Nom de l'étape"
                              value={step.name}
                              onChange={(e) => updateMashStep(step.id, { name: e.target.value })}
                            />
                            <input
                              type="number"
                              className="form-input small"
                              placeholder="°C"
                              value={step.temperature || ''}
                              onChange={(e) => updateMashStep(step.id, { temperature: Number(e.target.value) })}
                              min="0"
                              max="100"
                            />
                            <span className="unit">°C</span>
                            <input
                              type="number"
                              className="form-input small"
                              placeholder="min"
                              value={step.duration || ''}
                              onChange={(e) => updateMashStep(step.id, { duration: Number(e.target.value) })}
                              min="0"
                            />
                            <span className="unit">min</span>
                            <button
                              type="button"
                              className="btn-icon remove"
                              onClick={() => removeMashStep(step.id)}
                            >
                              ×
                            </button>
                          </div>

                          {/* Ajouts d'ingrédients pour cette étape */}
                          <div className="step-ingredient-additions">
                            <div className="step-additions-header">
                              <span className="additions-label">Ajouts d'ingrédients :</span>
                            </div>
                            {(step.ingredientAdditions || []).map((addition, addIdx) => {
                              const ingredient =
                                addition.ingredientType === 'grain'
                                  ? recipe.grains.find(g => g.id === addition.ingredientId)
                                  : recipe.others.find(o => o.id === addition.ingredientId);
                              return (
                                <div key={addIdx} className="step-addition-row">
                                  <input
                                    type="number"
                                    className="form-input timing-minutes"
                                    value={addition.minutes}
                                    onChange={(e) => {
                                      const newAdditions = [...(step.ingredientAdditions || [])];
                                      newAdditions[addIdx] = { ...newAdditions[addIdx], minutes: Number(e.target.value) };
                                      updateMashStep(step.id, { ingredientAdditions: newAdditions });
                                    }}
                                    min="0"
                                    max={step.duration}
                                  />
                                  <span className="unit">min</span>
                                  <span className="addition-ingredient-name">
                                    {addition.ingredientType === 'grain' ? '🌾' : '📦'} {ingredient?.name || 'Inconnu'}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-icon remove small"
                                    onClick={() => {
                                      const newAdditions = (step.ingredientAdditions || []).filter((_, i) => i !== addIdx);
                                      updateMashStep(step.id, { ingredientAdditions: newAdditions });
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                            <div className="add-ingredient-to-step">
                              <select
                                className="form-select add-ingredient-select"
                                value=""
                                onChange={(e) => {
                                  const [type, id] = e.target.value.split(':');
                                  if (type && id) {
                                    const newAddition: StepIngredientAddition = {
                                      ingredientId: id,
                                      ingredientType: type as 'grain' | 'other',
                                      minutes: 0
                                    };
                                    updateMashStep(step.id, {
                                      ingredientAdditions: [...(step.ingredientAdditions || []), newAddition]
                                    });
                                  }
                                }}
                              >
                                <option value="">+ Ajouter un ingrédient</option>
                                {recipe.grains.length > 0 && (
                                  <optgroup label="Malts & Céréales">
                                    {recipe.grains.map(g => (
                                      <option key={g.id} value={`grain:${g.id}`}>
                                        🌾 {g.name} ({g.quantity} kg)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {recipe.others.filter(o => o.additionStep === 'mash' || !o.additionStep).length > 0 && (
                                  <optgroup label="Autres ingrédients">
                                    {recipe.others
                                      .filter(o => o.additionStep === 'mash' || !o.additionStep)
                                      .map(o => (
                                        <option key={o.id} value={`other:${o.id}`}>
                                          📦 {o.name} ({o.quantity} {o.unit})
                                        </option>
                                      ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addMashStep}>
                        + Ajouter une étape
                      </button>
                    </div>
                  )}
                </div>

                {/* Ébullition */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.boil ? 'open' : ''}`}
                    onClick={() => toggleSection('boil')}
                  >
                    <span>Ébullition ({recipe.boilStep.duration} min)</span>
                    <span className="accordion-icon">{openSections.boil ? '−' : '+'}</span>
                  </button>
                  {openSections.boil && (
                    <div className="accordion-content">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Durée d'ébullition</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              className="form-input"
                              value={recipe.boilStep.duration}
                              onChange={(e) => updateRecipe({ boilStep: { ...recipe.boilStep, duration: Number(e.target.value) } })}
                              min="0"
                              step="5"
                            />
                            <span className="unit">minutes</span>
                          </div>
                        </div>
                      </div>

                      {/* Ajouts d'ingrédients pendant l'ébullition */}
                      <div className="step-ingredient-additions boil-additions">
                        <div className="step-additions-header">
                          <span className="additions-label">Ajouts d'ingrédients :</span>
                        </div>
                        {(recipe.boilStep.ingredientAdditions || []).map((addition, addIdx) => {
                          const ingredient =
                            addition.ingredientType === 'hop'
                              ? recipe.hops.find(h => h.id === addition.ingredientId)
                              : recipe.others.find(o => o.id === addition.ingredientId);
                          return (
                            <div key={addIdx} className="step-addition-row">
                              <input
                                type="number"
                                className="form-input timing-minutes"
                                value={addition.minutes}
                                onChange={(e) => {
                                  const newAdditions = [...(recipe.boilStep.ingredientAdditions || [])];
                                  newAdditions[addIdx] = { ...newAdditions[addIdx], minutes: Number(e.target.value) };
                                  updateRecipe({ boilStep: { ...recipe.boilStep, ingredientAdditions: newAdditions } });
                                }}
                                min="0"
                                max={recipe.boilStep.duration}
                              />
                              <span className="unit">min</span>
                              <span className="addition-ingredient-name">
                                {addition.ingredientType === 'hop' ? '🌿' : '📦'} {ingredient?.name || 'Inconnu'}
                              </span>
                              <button
                                type="button"
                                className="btn-icon remove small"
                                onClick={() => {
                                  const newAdditions = (recipe.boilStep.ingredientAdditions || []).filter((_, i) => i !== addIdx);
                                  updateRecipe({ boilStep: { ...recipe.boilStep, ingredientAdditions: newAdditions } });
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        <div className="add-ingredient-to-step">
                          <select
                            className="form-select add-ingredient-select"
                            value=""
                            onChange={(e) => {
                              const [type, id] = e.target.value.split(':');
                              if (type && id) {
                                const newAddition: StepIngredientAddition = {
                                  ingredientId: id,
                                  ingredientType: type as 'hop' | 'other',
                                  minutes: 0
                                };
                                updateRecipe({
                                  boilStep: {
                                    ...recipe.boilStep,
                                    ingredientAdditions: [...(recipe.boilStep.ingredientAdditions || []), newAddition]
                                  }
                                });
                              }
                            }}
                          >
                            <option value="">+ Ajouter un ingrédient</option>
                            {recipe.hops.filter(h => h.use === 'boil' || h.use === 'first-wort').length > 0 && (
                              <optgroup label="Houblons">
                                {recipe.hops
                                  .filter(h => h.use === 'boil' || h.use === 'first-wort')
                                  .map(h => (
                                    <option key={h.id} value={`hop:${h.id}`}>
                                      🌿 {h.name} ({h.quantity}g, {h.time}min)
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                            {recipe.others.filter(o => o.additionStep === 'boil' || !o.additionStep).length > 0 && (
                              <optgroup label="Autres ingrédients">
                                {recipe.others
                                  .filter(o => o.additionStep === 'boil' || !o.additionStep)
                                  .map(o => (
                                    <option key={o.id} value={`other:${o.id}`}>
                                      📦 {o.name} ({o.quantity} {o.unit})
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Notes sur l'ébullition..."
                          value={recipe.boilStep.notes || ''}
                          onChange={(e) => updateRecipe({ boilStep: { ...recipe.boilStep, notes: e.target.value } })}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Étapes de fermentation */}
                <div className="form-section accordion-section">
                  <button
                    type="button"
                    className={`accordion-header ${openSections.fermentation ? 'open' : ''}`}
                    onClick={() => toggleSection('fermentation')}
                  >
                    <span>Étapes de fermentation ({recipe.fermentationSteps.length})</span>
                    <span className="accordion-icon">{openSections.fermentation ? '−' : '+'}</span>
                  </button>
                  {openSections.fermentation && (
                    <div className="accordion-content">
                      {recipe.fermentationSteps.map((step, index) => (
                        <div key={step.id} className="step-row">
                          <span className="step-number">{index + 1}</span>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Nom de l'étape"
                            value={step.name}
                            onChange={(e) => updateFermentationStep(step.id, { name: e.target.value })}
                          />
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="°C"
                            value={step.temperature || ''}
                            onChange={(e) => updateFermentationStep(step.id, { temperature: Number(e.target.value) })}
                            min="0"
                            max="40"
                          />
                          <span className="unit">°C</span>
                          <input
                            type="number"
                            className="form-input small"
                            placeholder="jours"
                            value={step.duration || ''}
                            onChange={(e) => updateFermentationStep(step.id, { duration: Number(e.target.value) })}
                            min="0"
                          />
                          <span className="unit">jours</span>
                          <button
                            type="button"
                            className="btn-icon remove"
                            onClick={() => removeFermentationStep(step.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-add" onClick={addFermentationStep}>
                        + Ajouter une étape
                      </button>
                    </div>
                  )}
                </div>

                {/* Notes générales */}
                <div className="form-section">
                  <h2>Notes</h2>
                  <textarea
                    className="form-textarea"
                    placeholder="Notes sur la recette..."
                    value={recipe.notes || ''}
                    onChange={(e) => updateRecipe({ notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            )}
          </>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Enregistrer
          </button>
          {fermentationType === 'beer' && (
            <button
              type="button"
              className="btn-brewing"
              disabled={!canSubmit}
              onClick={handleStartBrewing}
            >
              Brasser maintenant
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
