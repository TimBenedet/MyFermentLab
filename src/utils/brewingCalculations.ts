import {
  GrainIngredient,
  HopIngredient,
  YeastIngredient,
  BrewingRecipe,
  BrewingCalculations
} from '../types';

// Constantes pour les calculs
const BOIL_OFF_RATE = 0.1; // 10% perte par heure d'ébullition
const TRUB_LOSS = 2; // 2L de perte au trub
const GRAIN_ABSORPTION = 1.0; // 1L d'eau absorbé par kg de grain
const DEFAULT_EFFICIENCY = 0.72; // 72% d'efficacité par défaut
const DEFAULT_ATTENUATION = 0.75; // 75% d'atténuation par défaut

/**
 * Calcule le volume total d'eau nécessaire
 */
export function calculateTotalWater(recipe: BrewingRecipe): number {
  return recipe.waters.reduce((sum, w) => sum + w.quantity, 0);
}

/**
 * Calcule le volume pré-ébullition
 */
export function calculatePreBoilVolume(recipe: BrewingRecipe): number {
  const totalWater = calculateTotalWater(recipe);
  const totalGrains = recipe.grains.reduce((sum, g) => sum + g.quantity, 0);
  const grainAbsorption = totalGrains * GRAIN_ABSORPTION;
  return totalWater - grainAbsorption;
}

/**
 * Calcule le volume après ébullition
 */
export function calculatePostBoilVolume(recipe: BrewingRecipe): number {
  const preBoilVolume = calculatePreBoilVolume(recipe);
  const boilHours = recipe.boilStep.duration / 60;
  const boilOff = preBoilVolume * BOIL_OFF_RATE * boilHours;
  return preBoilVolume - boilOff;
}

/**
 * Calcule le volume final en fermenteur
 */
export function calculateFinalVolume(recipe: BrewingRecipe): number {
  const postBoilVolume = calculatePostBoilVolume(recipe);
  return Math.max(0, postBoilVolume - TRUB_LOSS);
}

/**
 * Calcule les points de gravité à partir des grains
 * Formule: OG = 1 + (points * efficiency / volume)
 */
export function calculateOriginalGravity(
  recipe: BrewingRecipe,
  efficiency: number = DEFAULT_EFFICIENCY
): number {
  const finalVolume = calculateFinalVolume(recipe);
  if (finalVolume <= 0) return 1.0;

  // Points de gravité potentiels par kg (moyenne ~37 points/kg/L pour malt de base)
  const totalPoints = recipe.grains.reduce((sum, grain) => {
    const potential = grain.potential || 37; // Points par kg pour 1L
    return sum + (grain.quantity * potential);
  }, 0);

  const gravityPoints = (totalPoints * efficiency) / finalVolume;
  return 1 + (gravityPoints / 1000);
}

/**
 * Calcule la densité finale estimée
 */
export function calculateFinalGravity(
  recipe: BrewingRecipe,
  efficiency: number = DEFAULT_EFFICIENCY
): number {
  const og = calculateOriginalGravity(recipe, efficiency);

  // Utiliser l'atténuation de la levure si disponible
  const yeast = recipe.yeasts[0];
  const attenuation = yeast?.attenuation
    ? yeast.attenuation / 100
    : DEFAULT_ATTENUATION;

  const ogPoints = (og - 1) * 1000;
  const fgPoints = ogPoints * (1 - attenuation);
  return 1 + (fgPoints / 1000);
}

/**
 * Calcule le taux d'alcool (ABV)
 * Formule simplifiée: ABV = (OG - FG) * 131.25
 */
export function calculateABV(og: number, fg: number): number {
  return Math.max(0, (og - fg) * 131.25);
}

/**
 * Calcule l'amertume en IBU (formule Tinseth)
 */
export function calculateIBU(recipe: BrewingRecipe): number {
  const finalVolume = calculateFinalVolume(recipe);
  const og = calculateOriginalGravity(recipe);
  if (finalVolume <= 0) return 0;

  const boilHops = recipe.hops.filter(h => h.use === 'boil' || h.use === 'first-wort');

  return boilHops.reduce((totalIBU, hop) => {
    // Formule Tinseth
    const bignessFactor = 1.65 * Math.pow(0.000125, og - 1);
    const boilTimeFactor = (1 - Math.exp(-0.04 * hop.time)) / 4.15;
    const utilization = bignessFactor * boilTimeFactor;

    const mglAlpha = (hop.alphaAcid / 100) * (hop.quantity * 1000); // mg d'acide alpha
    const ibu = (mglAlpha * utilization) / finalVolume;

    return totalIBU + ibu;
  }, 0);
}

/**
 * Calcule la couleur en EBC
 * Formule: EBC = 2.939 * MCU^0.6859
 * MCU = (grain_kg * grain_EBC) / volume_L
 */
export function calculateColorEBC(recipe: BrewingRecipe): number {
  const finalVolume = calculateFinalVolume(recipe);
  if (finalVolume <= 0) return 0;

  const mcu = recipe.grains.reduce((sum, grain) => {
    const grainColor = grain.color || 5; // EBC par défaut pour malt pâle
    return sum + (grain.quantity * grainColor);
  }, 0) / finalVolume;

  // Formule Morey adaptée pour EBC
  return Math.round(2.939 * Math.pow(mcu, 0.6859));
}

/**
 * Calcule toutes les métriques de brassage
 */
export function calculateBrewingMetrics(
  recipe: BrewingRecipe,
  efficiency: number = DEFAULT_EFFICIENCY
): BrewingCalculations {
  const finalVolume = calculateFinalVolume(recipe);
  const originalGravity = calculateOriginalGravity(recipe, efficiency);
  const finalGravity = calculateFinalGravity(recipe, efficiency);
  const abv = calculateABV(originalGravity, finalGravity);
  const ibu = calculateIBU(recipe);
  const colorEBC = calculateColorEBC(recipe);

  return {
    finalVolume: Math.round(finalVolume * 10) / 10,
    originalGravity: Math.round(originalGravity * 1000) / 1000,
    finalGravity: Math.round(finalGravity * 1000) / 1000,
    abv: Math.round(abv * 10) / 10,
    ibu: Math.round(ibu),
    colorEBC: Math.round(colorEBC),
    efficiency: efficiency * 100
  };
}

/**
 * Génère un ID unique
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Crée une recette vide avec valeurs par défaut
 */
export function createEmptyRecipe(): BrewingRecipe {
  return {
    id: generateId(),
    name: '',
    style: '',
    description: '',
    batchSize: 20,
    boilVolume: 25,
    fermenterVolume: 30,
    grains: [],
    hops: [],
    yeasts: [],
    waters: [
      { id: generateId(), type: 'water', name: 'Empâtage', quantity: 15, temperature: 68 },
      { id: generateId(), type: 'water', name: 'Rinçage', quantity: 12, temperature: 78 }
    ],
    others: [],
    mashSteps: [
      { id: generateId(), name: 'Saccharification', temperature: 67, duration: 60 }
    ],
    boilStep: { duration: 60 },
    fermentationSteps: [
      { id: generateId(), name: 'Fermentation primaire', temperature: 20, duration: 14 }
    ],
    createdAt: Date.now()
  };
}

/**
 * Crée un grain par défaut
 */
export function createDefaultGrain(): GrainIngredient {
  return {
    id: generateId(),
    type: 'grain',
    name: '',
    quantity: 0,
    color: 5,
    potential: 37
  };
}

/**
 * Crée un houblon par défaut
 */
export function createDefaultHop(): HopIngredient {
  return {
    id: generateId(),
    type: 'hop',
    name: '',
    quantity: 0,
    alphaAcid: 5,
    use: 'boil',
    time: 60
  };
}

/**
 * Crée une levure par défaut
 */
export function createDefaultYeast(): YeastIngredient {
  return {
    id: generateId(),
    type: 'yeast',
    name: '',
    quantity: 1,
    form: 'dry',
    attenuation: 75,
    tempMin: 18,
    tempMax: 24
  };
}

/**
 * Retourne la description du timing d'utilisation du houblon
 */
export function getHopUseLabel(use: string): string {
  const labels: Record<string, string> = {
    'boil': 'Ébullition',
    'dry-hop': 'Dry Hop',
    'whirlpool': 'Whirlpool',
    'first-wort': 'First Wort'
  };
  return labels[use] || use;
}

/**
 * Retourne la couleur approximative pour une valeur EBC
 */
export function getColorForEBC(ebc: number): string {
  if (ebc < 8) return '#F8F4B4';
  if (ebc < 12) return '#F6E664';
  if (ebc < 20) return '#E6B434';
  if (ebc < 30) return '#C47E15';
  if (ebc < 45) return '#8B4513';
  if (ebc < 75) return '#5D3A1A';
  return '#2D1A0E';
}
