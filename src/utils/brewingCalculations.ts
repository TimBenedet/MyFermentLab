import {
  GrainIngredient,
  HopIngredient,
  YeastIngredient,
  BrewingRecipe,
  BrewingCalculations
} from '../types';

// Constantes pour les calculs
const BOIL_OFF_RATE = 0.1; // 10% perte par heure d'ébullition
const LOSS_RATE = 0.04; // 4% de pertes (trub, transferts, etc.)
const GRAIN_ABSORPTION = 1.0; // 1L d'eau absorbé par kg de grain
const DEFAULT_EFFICIENCY = 0.72; // 72% d'efficacité par défaut
const DEFAULT_ATTENUATION = 0.75; // 75% d'atténuation par défaut

/**
 * Calcule le volume total d'eau saisi par l'utilisateur
 */
export function calculateTotalWaterInput(recipe: BrewingRecipe): number {
  return recipe.waters.reduce((sum, w) => sum + w.quantity, 0);
}

/**
 * Calcule le volume final en fermenteur
 * C'est le batchSize défini par l'utilisateur
 */
export function calculateFinalVolume(recipe: BrewingRecipe): number {
  return recipe.batchSize;
}

/**
 * Calcule le volume post-ébullition nécessaire (avant pertes)
 * Volume final / (1 - taux de perte)
 * Ex: 15L final avec 4% perte = 15 / 0.96 = 15.625L
 */
export function calculatePostBoilVolume(recipe: BrewingRecipe): number {
  const finalVolume = recipe.batchSize;
  return finalVolume / (1 - LOSS_RATE);
}

/**
 * Calcule le volume pré-ébullition nécessaire
 * Volume post-ébullition / (1 - (taux évaporation × heures))
 * Ex: 15.625L avec 1h d'ébullition à 10%/h = 15.625 / (1 - 0.1) = 17.36L
 */
export function calculatePreBoilVolume(recipe: BrewingRecipe): number {
  const postBoilVolume = calculatePostBoilVolume(recipe);
  const boilHours = recipe.boilStep.duration / 60;
  return postBoilVolume / (1 - (BOIL_OFF_RATE * boilHours));
}

/**
 * Calcule le volume d'eau total nécessaire
 * Volume pré-ébullition + (1L × kg de malt)
 * Ex: 17.36L + 4kg de malt = 21.36L
 */
export function calculateTotalWaterNeeded(recipe: BrewingRecipe): number {
  const preBoilVolume = calculatePreBoilVolume(recipe);
  const totalGrains = recipe.grains.reduce((sum, g) => sum + g.quantity, 0);
  const grainAbsorption = totalGrains * GRAIN_ABSORPTION;
  return preBoilVolume + grainAbsorption;
}

/**
 * Détermine le PPG (Points Per Pound per Gallon) selon le type de grain
 * Basé sur le nom du grain (détection par mots-clés)
 *
 * Sources: BrewUnited Grain Database, Brewer's Friend, Brew Dudes
 * PPG = Points que 1 livre de grain apporte à 1 gallon d'eau
 */
function getGrainPPG(grainName: string): number {
  const name = grainName.toLowerCase();

  // ============================================
  // SUCRES & EXTRAITS (rendement très élevé)
  // ============================================

  // Sucres purs (100% fermentescibles)
  if (name.includes('sucre') || name.includes('sugar') || name.includes('dextrose') ||
      name.includes('glucose') || name.includes('candi') || name.includes('candy')) {
    return 46;
  }

  // Miel / Honey
  if (name.includes('miel') || name.includes('honey')) {
    return 35;
  }

  // Sirop d'érable / Maple syrup
  if (name.includes('érable') || name.includes('maple')) {
    return 30;
  }

  // Mélasse / Molasses
  if (name.includes('mélasse') || name.includes('molasse') || name.includes('treacle')) {
    return 36;
  }

  // Extrait de malt sec (DME)
  if (name.includes('dme') || name.includes('extrait sec') || name.includes('dry extract') ||
      name.includes('dry malt')) {
    return 44;
  }

  // Extrait de malt liquide (LME)
  if (name.includes('lme') || name.includes('extrait liquide') || name.includes('liquid extract') ||
      name.includes('liquid malt') || name.includes('extrait') || name.includes('extract')) {
    return 37;
  }

  // ============================================
  // MALTS TORRÉFIÉS FONCÉS (faible rendement)
  // ============================================

  // Black Patent / Noir
  if (name.includes('black patent') || name.includes('patent')) {
    return 25;
  }

  // Roasted Barley / Orge torréfié
  if (name.includes('roasted barley') || name.includes('orge torréfié') || name.includes('roast barley')) {
    return 25;
  }

  // Carafa (Weyermann) - Special
  if (name.includes('carafa special') || name.includes('carafa iii') || name.includes('carafa 3')) {
    return 27;
  }

  if (name.includes('carafa')) {
    return 26;
  }

  // Black Malt / Malt noir générique
  if (name.includes('black') || name.includes('noir')) {
    return 25;
  }

  // Roasted / Torréfié générique
  if (name.includes('roast') || name.includes('torréfié')) {
    return 25;
  }

  // ============================================
  // MALTS CHOCOLAT & CAFÉ (rendement moyen-bas)
  // ============================================

  // Chocolate Malt / Chocolat
  if (name.includes('chocolat') || name.includes('chocolate')) {
    return 29;
  }

  // Coffee Malt / Café
  if (name.includes('coffee') || name.includes('café') || name.includes('cafe')) {
    return 29;
  }

  // Pale Chocolate
  if (name.includes('pale chocolate') || name.includes('chocolat pâle')) {
    return 31;
  }

  // ============================================
  // MALTS CARAMEL / CRYSTAL (rendement moyen)
  // ============================================

  // Special B (Belgique) - très foncé
  if (name.includes('special b') || name.includes('spécial b')) {
    return 31;
  }

  // Caramel/Crystal très foncé (120L+)
  if ((name.includes('crystal') || name.includes('caramel')) &&
      (name.includes('120') || name.includes('150') || name.includes('180'))) {
    return 33;
  }

  // Caramel/Crystal moyen (40-80L)
  if ((name.includes('crystal') || name.includes('caramel')) &&
      (name.includes('40') || name.includes('60') || name.includes('80'))) {
    return 34;
  }

  // Caramel/Crystal clair (10-30L)
  if ((name.includes('crystal') || name.includes('caramel')) &&
      (name.includes('10') || name.includes('15') || name.includes('20') || name.includes('30'))) {
    return 35;
  }

  // CaraPils / CaraFoam / Dextrin
  if (name.includes('carapils') || name.includes('carafoam') || name.includes('dextrin')) {
    return 33;
  }

  // CaraMunich / CaraVienna / CaraAroma
  if (name.includes('caramunich') || name.includes('caravienne') || name.includes('caravienna') ||
      name.includes('caraaroma') || name.includes('cara aroma')) {
    return 34;
  }

  // CaraRed / CaraRuby / CaraAmber
  if (name.includes('carared') || name.includes('cararuby') || name.includes('caraamber') ||
      name.includes('cara red') || name.includes('cara ruby') || name.includes('cara amber')) {
    return 34;
  }

  // Crystal / Caramel générique
  if (name.includes('crystal') || name.includes('caramel') || name.includes('cara')) {
    return 34;
  }

  // ============================================
  // MALTS SPÉCIAUX (rendement variable)
  // ============================================

  // Biscuit / Biscotte
  if (name.includes('biscuit') || name.includes('biscotte')) {
    return 35;
  }

  // Victory / Victoire
  if (name.includes('victory') || name.includes('victoire')) {
    return 34;
  }

  // Aromatic / Aromatique
  if (name.includes('aromatic') || name.includes('aromatique')) {
    return 36;
  }

  // Melanoidin / Mélanoidine
  if (name.includes('melanoidin') || name.includes('mélanoidine') || name.includes('melanoiden')) {
    return 36;
  }

  // Honey Malt / Malt miel
  if (name.includes('honey malt') || name.includes('malt miel') || name.includes('gambrinus honey')) {
    return 37;
  }

  // Brown Malt / Malt brun
  if (name.includes('brown') || name.includes('brun')) {
    return 32;
  }

  // Amber Malt / Malt ambré
  if (name.includes('amber') || name.includes('ambré')) {
    return 35;
  }

  // Acidulated Malt / Sauermalz
  if (name.includes('acidulated') || name.includes('acide') || name.includes('sauer')) {
    return 27;
  }

  // Smoked / Fumé (Rauch)
  if (name.includes('smoked') || name.includes('fumé') || name.includes('rauch')) {
    return 37;
  }

  // Peated / Tourbé
  if (name.includes('peated') || name.includes('tourbé') || name.includes('peat')) {
    return 34;
  }

  // ============================================
  // FLOCONS & ADJUNCTS (rendement variable)
  // ============================================

  // Flocons d'avoine / Flaked Oats
  if (name.includes('flocon') && (name.includes('avoine') || name.includes('oat'))) {
    return 32;
  }

  if (name.includes('flaked oat') || name.includes('oat flake') || name.includes('rolled oat')) {
    return 32;
  }

  // Avoine générique
  if (name.includes('avoine') || name.includes('oat')) {
    return 32;
  }

  // Flocons de blé / Flaked Wheat
  if ((name.includes('flocon') || name.includes('flaked')) && (name.includes('blé') || name.includes('wheat'))) {
    return 35;
  }

  // Flocons d'orge / Flaked Barley
  if ((name.includes('flocon') || name.includes('flaked')) && (name.includes('orge') || name.includes('barley'))) {
    return 32;
  }

  // Flocons de maïs / Flaked Corn (Maize)
  if ((name.includes('flocon') || name.includes('flaked')) && (name.includes('maïs') || name.includes('corn') || name.includes('maize'))) {
    return 37;
  }

  // Flocons de riz / Flaked Rice
  if ((name.includes('flocon') || name.includes('flaked')) && (name.includes('riz') || name.includes('rice'))) {
    return 32;
  }

  // Flocons de seigle / Flaked Rye
  if ((name.includes('flocon') || name.includes('flaked')) && (name.includes('seigle') || name.includes('rye'))) {
    return 36;
  }

  // Flocons génériques
  if (name.includes('flocon') || name.includes('flaked') || name.includes('flake')) {
    return 33;
  }

  // Maïs / Corn / Grits
  if (name.includes('maïs') || name.includes('corn') || name.includes('grits')) {
    return 37;
  }

  // Riz / Rice
  if (name.includes('riz') || name.includes('rice')) {
    return 32;
  }

  // ============================================
  // MALTS DE BLÉ (rendement élevé)
  // ============================================

  // Blé torréfié / Roasted Wheat
  if ((name.includes('blé') || name.includes('wheat')) && (name.includes('torréfié') || name.includes('roast'))) {
    return 25;
  }

  // Blé chocolat / Chocolate Wheat
  if ((name.includes('blé') || name.includes('wheat')) && (name.includes('chocolat') || name.includes('chocolate'))) {
    return 29;
  }

  // Blé / Wheat générique
  if (name.includes('wheat') || name.includes('blé') || name.includes('froment') || name.includes('weizen')) {
    return 38;
  }

  // ============================================
  // MALTS DE SEIGLE (rendement élevé)
  // ============================================

  // Seigle caramel / Caramel Rye
  if ((name.includes('seigle') || name.includes('rye')) && (name.includes('caramel') || name.includes('crystal'))) {
    return 33;
  }

  // Seigle chocolat / Chocolate Rye
  if ((name.includes('seigle') || name.includes('rye')) && (name.includes('chocolat') || name.includes('chocolate'))) {
    return 29;
  }

  // Seigle / Rye générique
  if (name.includes('seigle') || name.includes('rye') || name.includes('roggen')) {
    return 37;
  }

  // ============================================
  // MALTS DE BASE (rendement standard-élevé)
  // ============================================

  // Maris Otter (UK - premium)
  if (name.includes('maris otter') || name.includes('maris-otter')) {
    return 38;
  }

  // Golden Promise (UK - premium)
  if (name.includes('golden promise')) {
    return 37;
  }

  // Munich II / Munich Dark
  if (name.includes('munich ii') || name.includes('munich 2') || name.includes('munich dark') ||
      name.includes('munich foncé')) {
    return 35;
  }

  // Munich
  if (name.includes('munich') || name.includes('münch')) {
    return 37;
  }

  // Vienna / Vienne
  if (name.includes('vienna') || name.includes('vienne')) {
    return 36;
  }

  // Pilsner / Pils
  if (name.includes('pilsner') || name.includes('pils')) {
    return 37;
  }

  // Pale Ale
  if (name.includes('pale ale')) {
    return 37;
  }

  // 2-Row / Two Row
  if (name.includes('2-row') || name.includes('2 row') || name.includes('two row')) {
    return 36;
  }

  // 6-Row / Six Row
  if (name.includes('6-row') || name.includes('6 row') || name.includes('six row')) {
    return 35;
  }

  // Pale / Pâle générique
  if (name.includes('pale') || name.includes('pâle')) {
    return 37;
  }

  // ============================================
  // MALT DE BASE PAR DÉFAUT
  // ============================================

  // Si aucune correspondance, utiliser 37 PPG (malt de base standard)
  return 37;
}

/**
 * Calcule les points de gravité à partir des grains
 * Formule standard: OG = 1 + (PPG * kg * 2.205 * efficiency) / (volume_L * 0.264)
 * Simplifié: OG = 1 + (points_par_kg * kg * efficiency) / volume_L
 *
 * PPG typiques (Points Per Pound per Gallon):
 * - Malt de base (Pale, Pilsner): 36-38 PPG
 * - Malt Munich/Vienna: 35-37 PPG
 * - Malt Crystal/Caramel: 33-35 PPG
 * - Flocons d'avoine: 32-33 PPG
 * - Malt Chocolat: 28-30 PPG
 * - Malt Black/Roasted: 24-26 PPG
 * - Sucres/Extraits: 44-46 PPG
 *
 * Conversion PPG -> points métriques: PPG * 8.345 = points par kg par litre
 * Ex: 37 PPG * 8.345 = ~309 points/kg/L
 */
export function calculateOriginalGravity(
  recipe: BrewingRecipe,
  efficiency: number = DEFAULT_EFFICIENCY
): number {
  const finalVolume = calculateFinalVolume(recipe);
  if (finalVolume <= 0) return 1.0;

  // Points de gravité potentiels par kg (PPG * 8.345 pour conversion métrique)
  const totalPoints = recipe.grains.reduce((sum, grain) => {
    // Si potential est défini explicitement et valide (< 50 = PPG), l'utiliser
    // Sinon détecter le PPG selon le nom du grain
    const ppg = grain.potential && grain.potential > 0 && grain.potential < 50
      ? grain.potential
      : getGrainPPG(grain.name);
    const metricPoints = ppg * 8.345; // Conversion PPG -> points/kg/L
    return sum + (grain.quantity * metricPoints);
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
  const postBoilVolume = calculatePostBoilVolume(recipe);
  const preBoilVolume = calculatePreBoilVolume(recipe);
  const totalWaterNeeded = calculateTotalWaterNeeded(recipe);
  const originalGravity = calculateOriginalGravity(recipe, efficiency);
  const finalGravity = calculateFinalGravity(recipe, efficiency);
  const abv = calculateABV(originalGravity, finalGravity);
  const ibu = calculateIBU(recipe);
  const colorEBC = calculateColorEBC(recipe);

  return {
    finalVolume: Math.round(finalVolume * 10) / 10,
    postBoilVolume: Math.round(postBoilVolume * 100) / 100,
    preBoilVolume: Math.round(preBoilVolume * 100) / 100,
    totalWaterNeeded: Math.round(totalWaterNeeded * 100) / 100,
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
