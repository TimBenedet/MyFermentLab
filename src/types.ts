export type FermentationType = 'beer' | 'koji' | 'kombucha' | 'wine' | 'cheese';

export interface TemperatureReading {
  timestamp: number;
  temperature: number;
}

export interface DensityReading {
  timestamp: number;
  density: number; // Densité en g/L
}

// ========================================
// Types pour le journal de brassage
// ========================================

export type BrewingLogCategory =
  | 'brewing'      // Jour de brassage
  | 'fermentation' // Fermentation
  | 'measurement'  // Mesure (densité, pH, etc.)
  | 'addition'     // Ajout d'ingrédient (dry-hop, sucre, etc.)
  | 'transfer'     // Transfert
  | 'packaging'    // Mise en bouteille/fût
  | 'tasting'      // Dégustation
  | 'other';       // Autre

export interface BrewingLogEntry {
  id: string;
  timestamp: number;
  category: BrewingLogCategory;
  title: string;
  notes?: string;
  // Mesures optionnelles
  temperature?: number;
  density?: number;
  ph?: number;
  // Photo (URL ou base64)
  photo?: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'outlet';
  ip?: string;
  entityId?: string; // Home Assistant entity ID
}

// ========================================
// Types pour les recettes de brassage
// ========================================

export type IngredientType = 'grain' | 'hop' | 'yeast' | 'water' | 'sugar' | 'other';
export type HopUse = 'boil' | 'dry-hop' | 'whirlpool' | 'first-wort';
export type YeastForm = 'liquid' | 'dry' | 'slurry';

export interface GrainIngredient {
  id: string;
  type: 'grain';
  name: string;
  quantity: number; // en kg
  color?: number; // EBC
  potential?: number; // Points de densité potentiels par kg/L
  notes?: string;
}

export interface HopIngredient {
  id: string;
  type: 'hop';
  name: string;
  quantity: number; // en g
  alphaAcid: number; // % alpha acide
  use: HopUse;
  time: number; // minutes d'ébullition ou jours de dry-hop
  notes?: string;
}

export interface YeastIngredient {
  id: string;
  type: 'yeast';
  name: string;
  quantity: number; // en g ou paquets
  form: YeastForm;
  attenuation?: number; // % d'atténuation
  tempMin?: number;
  tempMax?: number;
  notes?: string;
}

export interface WaterAddition {
  id: string;
  type: 'water';
  name: string; // "Empâtage", "Rinçage", etc.
  quantity: number; // en L
  temperature?: number; // température cible
  notes?: string;
}

// Timing pour les ajouts d'ingrédients
export type AdditionTiming = 'start' | 'during' | 'end';
export type AdditionStep = 'mash' | 'boil' | 'fermentation' | 'packaging';

export interface OtherIngredient {
  id: string;
  type: 'sugar' | 'other';
  name: string;
  quantity: number;
  unit: string; // 'g', 'ml', 'kg', 'L', 'pcs'
  // Nouveau système structuré
  additionTiming?: AdditionTiming; // 'start', 'during', 'end'
  additionStep?: AdditionStep; // 'mash', 'boil', 'fermentation', 'packaging'
  additionMinutes?: number; // Minutes après le début (pour 'during')
  // Ancien champ gardé pour compatibilité
  additionTime?: string;
  notes?: string;
}

// Labels pour les menus déroulants
export const ADDITION_TIMING_LABELS: Record<AdditionTiming, string> = {
  start: 'Au début',
  during: 'Pendant',
  end: 'À la fin'
};

export const ADDITION_STEP_LABELS: Record<AdditionStep, string> = {
  mash: 'Empâtage',
  boil: 'Ébullition',
  fermentation: 'Fermentation',
  packaging: 'Mise en bouteille'
};

export type RecipeIngredient = GrainIngredient | HopIngredient | YeastIngredient | WaterAddition | OtherIngredient;

// Ajout d'ingrédient assigné à une étape
export interface StepIngredientAddition {
  ingredientId: string;
  ingredientType: 'grain' | 'hop' | 'other';
  minutes: number; // Minutes après le début de l'étape
}

export interface MashStep {
  id: string;
  name: string; // "Empâtage", "Saccharification", etc.
  temperature: number;
  duration: number; // en minutes
  notes?: string;
  ingredientAdditions?: StepIngredientAddition[]; // Ingrédients à ajouter pendant cette étape
}

export interface BoilStep {
  duration: number; // en minutes
  notes?: string;
  ingredientAdditions?: StepIngredientAddition[]; // Ingrédients à ajouter pendant l'ébullition
}

export interface FermentationStep {
  id: string;
  name: string; // "Fermentation primaire", "Garde", etc.
  temperature: number;
  duration: number; // en jours
  notes?: string;
}

export interface BrewingRecipe {
  id: string;
  name: string;
  style?: string; // "IPA", "Stout", "Pale Ale", etc.
  description?: string;

  // Équipement
  batchSize: number; // Volume final visé en L
  boilVolume?: number; // Volume pré-ébullition en L
  fermenterId?: string; // ID de la cuve utilisée
  fermenterVolume?: number; // Volume de la cuve en L

  // Ingrédients
  grains: GrainIngredient[];
  hops: HopIngredient[];
  yeasts: YeastIngredient[];
  waters: WaterAddition[];
  others: OtherIngredient[];

  // Étapes du brassage
  mashSteps: MashStep[];
  boilStep: BoilStep;
  fermentationSteps: FermentationStep[];

  // Valeurs calculées / cibles
  originalGravity?: number; // Densité initiale (ex: 1.050)
  finalGravity?: number; // Densité finale (ex: 1.010)
  estimatedABV?: number; // % alcool estimé
  estimatedIBU?: number; // Amertume estimée
  estimatedColor?: number; // Couleur EBC estimée

  // Métadonnées
  createdAt: number;
  updatedAt?: number;
  notes?: string;
}

// Calculateurs de brassage
export interface BrewingCalculations {
  // Volume final en fermenteur (batchSize)
  finalVolume: number;
  // Volume après ébullition (avant pertes)
  postBoilVolume: number;
  // Volume avant ébullition
  preBoilVolume: number;
  // Volume d'eau total nécessaire
  totalWaterNeeded: number;
  // Densité initiale estimée (OG)
  originalGravity: number;
  // Densité finale estimée (FG)
  finalGravity: number;
  // % Alcool estimé
  abv: number;
  // Amertume en IBU
  ibu: number;
  // Couleur en EBC
  colorEBC: number;
  // Efficacité requise
  efficiency: number;
}

// État d'une étape de brassage en cours
export interface BrewingStepProgress {
  stepId: string;
  startedAt?: number;
  completedAt?: number;
  notes?: string;
}

// Événement pendant le brassage (note, mesure, ajout, etc.)
export type BrewingEventType = 'note' | 'measurement' | 'addition' | 'issue' | 'photo';

export interface BrewingEvent {
  id: string;
  timestamp: number;
  stepId?: string; // Étape associée (optionnel)
  type: BrewingEventType;
  title: string;
  description?: string;
  // Mesures optionnelles
  temperature?: number;
  density?: number;
  ph?: number;
  volume?: number;
  // Photo (base64 ou URL)
  photo?: string;
}

// Session de brassage
export interface BrewingSession {
  startedAt: number;
  completedAt?: number;
  currentStepIndex: number;
  steps: BrewingSessionStep[];
  stepsProgress: BrewingStepProgress[];
  events?: BrewingEvent[]; // Événements enregistrés pendant le brassage
  completedAdditions?: string[]; // IDs des ajouts d'ingrédients validés
}

// Étape personnalisable pour la session de brassage
export interface BrewingSessionStep {
  id: string;
  name: string;
  description?: string;
  duration: number; // en minutes
  temperature?: number;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  fermentationType: FermentationType;
  sensorId: string;
  outletId: string;
  targetTemperature: number;
  currentTemperature: number;
  outletActive: boolean;
  controlMode: 'manual' | 'automatic'; // Mode de contrôle
  archived: boolean;
  history: TemperatureReading[];
  densityHistory?: DensityReading[];
  showDensity?: boolean;
  createdAt: number;
  archivedAt?: number;

  // Lien avec la recette
  recipe?: BrewingRecipe;

  // Journal de brassage
  brewingLog?: BrewingLogEntry[];

  // Session de brassage (jour de brassage)
  brewingSession?: BrewingSession;
}

export const FERMENTATION_TYPES = {
  beer: { name: 'Bière', icon: '🍺', color: '#F5A742', minTemp: 15, maxTemp: 30 },
  koji: { name: 'Koji', icon: '🍚', color: '#4AC694', minTemp: 25, maxTemp: 35 },
  kombucha: { name: 'Kombucha', icon: '🍵', color: '#9D7EDB', minTemp: 20, maxTemp: 30 },
  wine: { name: 'Vin', icon: '🍷', color: '#E74856', minTemp: 18, maxTemp: 28 },
  cheese: { name: 'Fromage', icon: '🧀', color: '#E9B54D', minTemp: 10, maxTemp: 25 }
} as const;

// Styles de bière courants
export const BEER_STYLES = [
  '🧪 Test bière (recette auto)',
  'Pale Ale', 'IPA', 'Double IPA', 'Session IPA',
  'Stout', 'Porter', 'Imperial Stout',
  'Wheat Beer', 'Witbier', 'Hefeweizen',
  'Pilsner', 'Lager', 'Helles',
  'Belgian Blonde', 'Belgian Tripel', 'Belgian Dubbel', 'Saison',
  'Amber Ale', 'Red Ale', 'Brown Ale',
  'Sour', 'Gose', 'Berliner Weisse',
  'Barleywine', 'Scottish Ale',
  'Autre'
] as const;

// Recette de test pour validation rapide
export const TEST_BEER_RECIPE: Omit<BrewingRecipe, 'id' | 'createdAt'> = {
  name: 'Test Pale Ale',
  style: '🧪 Test bière (recette auto)',
  description: 'Recette de test pour validation rapide du système',
  batchSize: 20,
  boilVolume: 25,
  fermenterVolume: 30,
  grains: [
    {
      id: 'test-grain-1',
      type: 'grain',
      name: 'Malt Pale',
      quantity: 4.5,
      color: 6,
      potential: 37
    },
    {
      id: 'test-grain-2',
      type: 'grain',
      name: 'Malt Munich',
      quantity: 0.5,
      color: 15,
      potential: 35
    }
  ],
  hops: [
    {
      id: 'test-hop-1',
      type: 'hop',
      name: 'Cascade',
      quantity: 30,
      alphaAcid: 5.75,
      use: 'boil',
      time: 60
    },
    {
      id: 'test-hop-2',
      type: 'hop',
      name: 'Centennial',
      quantity: 20,
      alphaAcid: 10,
      use: 'boil',
      time: 15
    },
    {
      id: 'test-hop-3',
      type: 'hop',
      name: 'Citra',
      quantity: 40,
      alphaAcid: 12,
      use: 'dry-hop',
      time: 5
    }
  ],
  yeasts: [
    {
      id: 'test-yeast-1',
      type: 'yeast',
      name: 'US-05',
      quantity: 11,
      form: 'dry',
      attenuation: 81,
      tempMin: 15,
      tempMax: 24
    }
  ],
  waters: [
    {
      id: 'test-water-1',
      type: 'water',
      name: 'Empâtage',
      quantity: 15,
      temperature: 68
    },
    {
      id: 'test-water-2',
      type: 'water',
      name: 'Rinçage',
      quantity: 12,
      temperature: 78
    }
  ],
  others: [
    {
      id: 'test-other-1',
      type: 'other',
      name: 'Whirlfloc',
      quantity: 1,
      unit: 'pcs',
      additionStep: 'boil',
      additionTiming: 'during',
      additionMinutes: 50
    }
  ],
  mashSteps: [
    {
      id: 'test-mash-1',
      name: 'Empâtage',
      temperature: 67,
      duration: 60,
      ingredientAdditions: [
        { ingredientId: 'test-grain-1', ingredientType: 'grain', minutes: 0 },
        { ingredientId: 'test-grain-2', ingredientType: 'grain', minutes: 0 }
      ]
    },
    {
      id: 'test-mash-2',
      name: 'Mash-out',
      temperature: 78,
      duration: 10
    }
  ],
  boilStep: {
    duration: 60,
    ingredientAdditions: [
      { ingredientId: 'test-hop-1', ingredientType: 'hop', minutes: 0 },
      { ingredientId: 'test-hop-2', ingredientType: 'hop', minutes: 45 },
      { ingredientId: 'test-other-1', ingredientType: 'other', minutes: 50 }
    ],
    notes: 'Refroidir rapidement après ébullition'
  },
  fermentationSteps: [
    {
      id: 'test-ferm-1',
      name: 'Fermentation primaire',
      temperature: 18,
      duration: 7
    },
    {
      id: 'test-ferm-2',
      name: 'Dry-hop',
      temperature: 18,
      duration: 5
    },
    {
      id: 'test-ferm-3',
      name: 'Cold crash',
      temperature: 2,
      duration: 3
    }
  ],
  originalGravity: 1.052,
  finalGravity: 1.010,
  estimatedABV: 5.5,
  estimatedIBU: 45,
  estimatedColor: 12,
  notes: 'Recette de test - Pale Ale américaine classique'
};

// Cuves prédéfinies
export const FERMENTERS = [
  { id: 'bucket-20', name: 'Seau 20L', volume: 20 },
  { id: 'bucket-30', name: 'Seau 30L', volume: 30 },
  { id: 'fermzilla-27', name: 'FermZilla 27L', volume: 27 },
  { id: 'fermzilla-35', name: 'FermZilla 35L', volume: 35 },
  { id: 'ss-brewtech-14', name: 'SS Brewtech 14 gal', volume: 53 },
  { id: 'conical-30', name: 'Conique inox 30L', volume: 30 },
  { id: 'conical-60', name: 'Conique inox 60L', volume: 60 },
  { id: 'custom', name: 'Personnalisé', volume: 0 }
] as const;
