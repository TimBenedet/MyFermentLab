import type { Recipe, Fermenter, PIDState, BrewProject, HumidityDataPoint } from '../types/brewing'

// === PID Configuration ===
export const PID_CONFIG = {
  Kp: 8.0,
  Ki: 0.3,
  Kd: 2.0,
  outputMin: 0,
  outputMax: 100,
  integralMax: 40,
}

// Hysteresis band for relay control (°C)
export const HYSTERESIS = {
  on: -0.3,   // turn ON when temp < setpoint - 0.3
  off: 0.3,   // turn OFF when temp > setpoint + 0.3
}

// === Alarm Thresholds ===
export const ALARM_THRESHOLDS = {
  tempWarning: 1.5,
  tempCritical: 3.0,
}

// === Default PID state ===
export const DEFAULT_PID: PIDState = {
  setpoint: 19,
  processValue: 20,
  output: 0,
  mode: 'auto',
  error: 0,
  integral: 0,
  derivative: 0,
}

// === ID Generator ===
let idCounter = 0
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${++idCounter}`
}

// === Fermenter colors ===
export const FERMENTER_COLORS = [
  '#DD8800', '#CC7700', '#886600', '#FFD878', '#AA5500', '#663300',
]

let fermenterCounter = 0

export function createFermenter(name: string): Fermenter {
  fermenterCounter++
  const colorIdx = (fermenterCounter - 1) % FERMENTER_COLORS.length
  return {
    id: `F${fermenterCounter}`,
    name,
    volume: 25,
    yeastStrain: 'US-05',
    og: 1.052,
    fg: 1.012,
    startDate: Date.now(),
    temperature: 20 + (Math.random() - 0.5) * 2,
    setpoint: 19,
    relayOn: false,
    pid: { ...DEFAULT_PID },
    temperatureHistory: [],
    level: 75,
    color: FERMENTER_COLORS[colorIdx],
  }
}

export function createFermenterForProject(recipe: Recipe, projectName: string): Fermenter {
  fermenterCounter++
  const needsHumidity = recipe.projectType === 'koji' || recipe.projectType === 'mushroom'
  const humidityTarget = recipe.projectType === 'koji' ? 85 : 90

  return {
    id: `F${fermenterCounter}`,
    name: projectName,
    volume: recipe.batchSize,
    yeastStrain: recipe.ingredients.find(i => i.type === 'levure')?.name || 'US-05',
    og: recipe.og,
    fg: recipe.fg,
    startDate: Date.now(),
    temperature: 20 + (Math.random() - 0.5) * 2,
    setpoint: 19,
    relayOn: false,
    pid: { ...DEFAULT_PID },
    temperatureHistory: [],
    level: 75,
    color: srmToColor(recipe.srm),
    ...(needsHumidity && {
      humidity: 40 + Math.random() * 10,
      humiditySetpoint: humidityTarget,
      humidityRelayOn: false,
      humidityPid: { ...DEFAULT_PID, setpoint: humidityTarget },
      humidityHistory: [] as HumidityDataPoint[],
    }),
  }
}

export function resetFermenterCounter() {
  fermenterCounter = 0
}

// === Project Factory ===
export function createProject(recipe: Recipe, projectName: string): BrewProject {
  const needsHumidity = recipe.projectType === 'koji' || recipe.projectType === 'mushroom'

  return {
    id: generateId('proj-'),
    name: projectName,
    projectType: recipe.projectType,
    recipeId: recipe.id,
    recipeName: recipe.name,
    phase: 'fermenting',
    createdAt: Date.now(),
    gravityHistory: [],
    currentGravity: recipe.og,
    og: recipe.og,
    fg: recipe.fg,
    style: recipe.style,
    batchSize: recipe.batchSize,
    srm: recipe.srm,
    abv: recipe.abv,
    ingredients: recipe.ingredients.map(i => ({ ...i })),
    steps: recipe.steps.map(s => ({ ...s })),
    ...(needsHumidity && {
      humidityHistory: [],
      currentHumidity: 40,
      targetHumidity: recipe.projectType === 'koji' ? 85 : 90,
    }),
  }
}

// === Default Recipe ===
export const DEFAULT_RECIPE: Recipe = {
  id: 'recipe-default-amber',
  projectType: 'beer',
  name: 'Amber Ale du Plateau',
  style: 'American Amber Ale',
  batchSize: 25,
  og: 1.052,
  fg: 1.012,
  abv: 5.2,
  ibu: 35,
  srm: 14,
  ingredients: [
    { id: 'i1', name: 'Pale Malt 2-Row', type: 'grain', quantity: 4.5, unit: 'kg', addAt: 'Empâtage' },
    { id: 'i2', name: 'Munich Malt', type: 'grain', quantity: 0.5, unit: 'kg', addAt: 'Empâtage' },
    { id: 'i3', name: 'Crystal 60L', type: 'grain', quantity: 0.3, unit: 'kg', addAt: 'Empâtage' },
    { id: 'i4', name: 'Cascade', type: 'houblon', quantity: 30, unit: 'g', addAt: 'Ébullition 60 min' },
    { id: 'i5', name: 'Centennial', type: 'houblon', quantity: 20, unit: 'g', addAt: 'Ébullition 15 min' },
    { id: 'i6', name: 'Cascade', type: 'houblon', quantity: 15, unit: 'g', addAt: 'Dry hop J5' },
    { id: 'i7', name: 'Safale US-05', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
    { id: 'i8', name: 'Eau de source', type: 'eau', quantity: 30, unit: 'L', addAt: 'Empâtage + rinçage' },
  ],
  steps: [
    { id: 's1', description: 'Empâtage à 65°C pendant 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 65 },
    { id: 's2', description: 'Mash-out à 76°C pendant 10 min', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
    { id: 's3', description: 'Rinçage / Sparge à 76°C', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
    { id: 's4', description: 'Ébullition 60 min - ajout houblons amers', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
    { id: 's5', description: 'Ajout houblons aromatiques à 15 min', day: 0, done: false, durationMinutes: 15, targetTemp: 100 },
    { id: 's6', description: 'Refroidissement et transfert en fermenteur', day: 0, done: false, durationMinutes: 30 },
    { id: 's7', description: 'Ensemencement levure US-05', day: 0, done: false, durationMinutes: 5, targetTemp: 19 },
    { id: 's8', description: 'Fermentation primaire à 19°C', day: 1, done: false },
    { id: 's9', description: 'Dry hop Cascade 15g', day: 5, done: false },
    { id: 's10', description: 'Mesure de densité - vérifier FG', day: 10, done: false },
    { id: 's11', description: 'Cold crash à 4°C pendant 48h', day: 12, done: false },
    { id: 's12', description: 'Mise en bouteille / fût', day: 14, done: false },
  ],
}

// === Beer Templates ===
export const BEER_TEMPLATES: Omit<Recipe, 'id'>[] = [
  {
    projectType: 'beer',
    name: 'IPA Américaine',
    style: 'American IPA',
    batchSize: 20,
    og: 1.065,
    fg: 1.012,
    abv: 7.0,
    ibu: 60,
    srm: 8,
    ingredients: [
      { id: 't-i1', name: 'Pale Malt 2-Row', type: 'grain', quantity: 5.5, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i2', name: 'Munich Malt', type: 'grain', quantity: 0.4, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i3', name: 'Carapils', type: 'grain', quantity: 0.3, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i4', name: 'Citra', type: 'houblon', quantity: 30, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i5', name: 'Mosaic', type: 'houblon', quantity: 25, unit: 'g', addAt: 'Ébullition 15 min' },
      { id: 't-i6', name: 'Citra', type: 'houblon', quantity: 40, unit: 'g', addAt: 'Dry hop J5' },
      { id: 't-i7', name: 'Mosaic', type: 'houblon', quantity: 30, unit: 'g', addAt: 'Dry hop J5' },
      { id: 't-i8', name: 'Safale US-05', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i9', name: 'Eau de source', type: 'eau', quantity: 27, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s1', description: 'Empâtage à 66°C pendant 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 66 },
      { id: 't-s2', description: 'Mash-out à 76°C pendant 10 min', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s3', description: 'Rinçage / Sparge à 76°C', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s4', description: 'Ébullition 60 min - ajout houblons amers', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 't-s5', description: 'Ajout houblons aromatiques à 15 min', day: 0, done: false, durationMinutes: 15, targetTemp: 100 },
      { id: 't-s6', description: 'Refroidissement et transfert en fermenteur', day: 0, done: false, durationMinutes: 30 },
      { id: 't-s7', description: 'Ensemencement levure US-05', day: 0, done: false, durationMinutes: 5, targetTemp: 19 },
      { id: 't-s8', description: 'Fermentation primaire à 19°C', day: 1, done: false },
      { id: 't-s9', description: 'Dry hop Citra + Mosaic', day: 5, done: false },
      { id: 't-s10', description: 'Mesure de densité - vérifier FG', day: 10, done: false },
      { id: 't-s11', description: 'Cold crash à 2°C pendant 48h', day: 12, done: false },
      { id: 't-s12', description: 'Mise en bouteille / fût', day: 14, done: false },
    ],
  },
  {
    projectType: 'beer',
    name: 'Stout Irlandaise',
    style: 'Irish Dry Stout',
    batchSize: 20,
    og: 1.042,
    fg: 1.010,
    abv: 4.2,
    ibu: 35,
    srm: 35,
    ingredients: [
      { id: 't-i10', name: 'Pale Malt', type: 'grain', quantity: 3.2, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i11', name: 'Roasted Barley', type: 'grain', quantity: 0.5, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i12', name: 'Flaked Barley', type: 'grain', quantity: 0.4, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i13', name: 'Chocolate Malt', type: 'grain', quantity: 0.2, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i14', name: 'East Kent Goldings', type: 'houblon', quantity: 30, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i15', name: 'Fuggle', type: 'houblon', quantity: 15, unit: 'g', addAt: 'Ébullition 15 min' },
      { id: 't-i16', name: 'Safale S-04', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i17', name: 'Eau de source', type: 'eau', quantity: 25, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s13', description: 'Empâtage à 68°C pendant 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 68 },
      { id: 't-s14', description: 'Mash-out à 76°C pendant 10 min', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s15', description: 'Rinçage / Sparge à 76°C', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s16', description: 'Ébullition 60 min - ajout houblons', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 't-s17', description: 'Ajout Fuggle à 15 min', day: 0, done: false, durationMinutes: 15, targetTemp: 100 },
      { id: 't-s18', description: 'Refroidissement et transfert', day: 0, done: false, durationMinutes: 30 },
      { id: 't-s19', description: 'Ensemencement levure S-04', day: 0, done: false, durationMinutes: 5, targetTemp: 18 },
      { id: 't-s20', description: 'Fermentation primaire à 18°C', day: 1, done: false },
      { id: 't-s21', description: 'Mesure de densité', day: 8, done: false },
      { id: 't-s22', description: 'Mise en bouteille / fût', day: 12, done: false },
    ],
  },
  {
    projectType: 'beer',
    name: 'Wheat Beer Bavaroise',
    style: 'Hefeweizen',
    batchSize: 20,
    og: 1.048,
    fg: 1.010,
    abv: 5.0,
    ibu: 14,
    srm: 4,
    ingredients: [
      { id: 't-i18', name: 'Wheat Malt', type: 'grain', quantity: 2.5, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i19', name: 'Pilsner Malt', type: 'grain', quantity: 2.0, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i20', name: 'Hallertau Mittelfrueh', type: 'houblon', quantity: 20, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i21', name: 'WB-06 (Weizen)', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i22', name: 'Eau de source', type: 'eau', quantity: 25, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s23', description: 'Empâtage paliers : 52°C 15min, 63°C 30min, 72°C 20min', day: 0, done: false, durationMinutes: 65, targetTemp: 63 },
      { id: 't-s24', description: 'Mash-out à 76°C pendant 10 min', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s25', description: 'Rinçage / Sparge', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s26', description: 'Ébullition 60 min - ajout houblons', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 't-s27', description: 'Refroidissement et transfert', day: 0, done: false, durationMinutes: 30 },
      { id: 't-s28', description: 'Ensemencement levure WB-06 à 20°C', day: 0, done: false, durationMinutes: 5, targetTemp: 20 },
      { id: 't-s29', description: 'Fermentation primaire à 20°C', day: 1, done: false },
      { id: 't-s30', description: 'Mesure de densité', day: 7, done: false },
      { id: 't-s31', description: 'Mise en bouteille', day: 10, done: false },
    ],
  },
  {
    projectType: 'beer',
    name: 'Pilsner Tchèque',
    style: 'Czech Premium Pale Lager',
    batchSize: 20,
    og: 1.050,
    fg: 1.012,
    abv: 5.0,
    ibu: 35,
    srm: 4,
    ingredients: [
      { id: 't-i23', name: 'Pilsner Malt (Bohemian)', type: 'grain', quantity: 4.5, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i24', name: 'CaraPils', type: 'grain', quantity: 0.2, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i25', name: 'Saaz', type: 'houblon', quantity: 40, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i26', name: 'Saaz', type: 'houblon', quantity: 20, unit: 'g', addAt: 'Ébullition 15 min' },
      { id: 't-i27', name: 'Saflager W-34/70', type: 'levure', quantity: 2, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i28', name: 'Eau douce', type: 'eau', quantity: 27, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s32', description: 'Empâtage à 64°C pendant 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 64 },
      { id: 't-s33', description: 'Mash-out à 76°C pendant 10 min', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s34', description: 'Rinçage / Sparge', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s35', description: 'Ébullition 90 min - ajout Saaz amer', day: 0, done: false, durationMinutes: 90, targetTemp: 100 },
      { id: 't-s36', description: 'Ajout Saaz aromatique à 15 min', day: 0, done: false, durationMinutes: 15, targetTemp: 100 },
      { id: 't-s37', description: 'Refroidissement rapide à 10°C', day: 0, done: false, durationMinutes: 40 },
      { id: 't-s38', description: 'Ensemencement levure lager à 10°C', day: 0, done: false, durationMinutes: 5, targetTemp: 10 },
      { id: 't-s39', description: 'Fermentation primaire à 10°C', day: 1, done: false },
      { id: 't-s40', description: 'Diacetyl rest à 16°C pendant 48h', day: 10, done: false },
      { id: 't-s41', description: 'Lagering à 2°C pendant 4 semaines', day: 12, done: false },
      { id: 't-s42', description: 'Mise en bouteille / fût', day: 40, done: false },
    ],
  },
  {
    projectType: 'beer',
    name: 'Saison Belge',
    style: 'Belgian Saison',
    batchSize: 20,
    og: 1.055,
    fg: 1.005,
    abv: 6.5,
    ibu: 28,
    srm: 6,
    ingredients: [
      { id: 't-i29', name: 'Pilsner Malt', type: 'grain', quantity: 4.0, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i30', name: 'Wheat Malt', type: 'grain', quantity: 0.5, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i31', name: 'Sucre Candi Blond', type: 'autre', quantity: 0.3, unit: 'kg', addAt: 'Ébullition 10 min' },
      { id: 't-i32', name: 'Styrian Goldings', type: 'houblon', quantity: 25, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i33', name: 'Saaz', type: 'houblon', quantity: 15, unit: 'g', addAt: 'Ébullition 5 min' },
      { id: 't-i34', name: 'Belle Saison', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i35', name: 'Eau de source', type: 'eau', quantity: 26, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s43', description: 'Empâtage à 64°C pendant 75 min', day: 0, done: false, durationMinutes: 75, targetTemp: 64 },
      { id: 't-s44', description: 'Mash-out à 76°C', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s45', description: 'Rinçage / Sparge', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s46', description: 'Ébullition 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 't-s47', description: 'Ajout sucre candi + Saaz à 5 min', day: 0, done: false, durationMinutes: 5, targetTemp: 100 },
      { id: 't-s48', description: 'Refroidissement et transfert', day: 0, done: false, durationMinutes: 30 },
      { id: 't-s49', description: 'Ensemencement Belle Saison à 22°C', day: 0, done: false, durationMinutes: 5, targetTemp: 22 },
      { id: 't-s50', description: 'Fermentation libre montée à 28°C', day: 1, done: false },
      { id: 't-s51', description: 'Mesure de densité - attendre FG très basse', day: 14, done: false },
      { id: 't-s52', description: 'Mise en bouteille avec refermentation', day: 18, done: false },
    ],
  },
  {
    projectType: 'beer',
    name: 'Porter Robuste',
    style: 'Robust Porter',
    batchSize: 20,
    og: 1.056,
    fg: 1.014,
    abv: 5.5,
    ibu: 32,
    srm: 30,
    ingredients: [
      { id: 't-i36', name: 'Maris Otter', type: 'grain', quantity: 4.0, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i37', name: 'Chocolate Malt', type: 'grain', quantity: 0.35, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i38', name: 'Crystal 80L', type: 'grain', quantity: 0.3, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i39', name: 'Black Patent', type: 'grain', quantity: 0.1, unit: 'kg', addAt: 'Empâtage' },
      { id: 't-i40', name: 'Northern Brewer', type: 'houblon', quantity: 30, unit: 'g', addAt: 'Ébullition 60 min' },
      { id: 't-i41', name: 'Fuggle', type: 'houblon', quantity: 15, unit: 'g', addAt: 'Ébullition 15 min' },
      { id: 't-i42', name: 'Safale S-04', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 't-i43', name: 'Eau de source', type: 'eau', quantity: 26, unit: 'L', addAt: 'Empâtage + rinçage' },
    ],
    steps: [
      { id: 't-s53', description: 'Empâtage à 67°C pendant 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 67 },
      { id: 't-s54', description: 'Mash-out à 76°C', day: 0, done: false, durationMinutes: 10, targetTemp: 76 },
      { id: 't-s55', description: 'Rinçage / Sparge', day: 0, done: false, durationMinutes: 20, targetTemp: 76 },
      { id: 't-s56', description: 'Ébullition 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 't-s57', description: 'Ajout Fuggle aromatique', day: 0, done: false, durationMinutes: 15, targetTemp: 100 },
      { id: 't-s58', description: 'Refroidissement et transfert', day: 0, done: false, durationMinutes: 30 },
      { id: 't-s59', description: 'Ensemencement S-04 à 18°C', day: 0, done: false, durationMinutes: 5, targetTemp: 18 },
      { id: 't-s60', description: 'Fermentation primaire à 18°C', day: 1, done: false },
      { id: 't-s61', description: 'Mesure de densité', day: 10, done: false },
      { id: 't-s62', description: 'Mise en bouteille / fût', day: 14, done: false },
    ],
  },
]

// === Koji Templates ===
export const KOJI_TEMPLATES: Omit<Recipe, 'id'>[] = [
  {
    projectType: 'koji',
    name: 'Koji Riz Blanc',
    style: 'Shiro Koji',
    batchSize: 2,
    og: 0, fg: 0, abv: 0, ibu: 0, srm: 2,
    ingredients: [
      { id: 'k-i1', name: 'Riz blanc cuit à la vapeur', type: 'grain', quantity: 2, unit: 'kg', addAt: 'Base' },
      { id: 'k-i2', name: 'Aspergillus oryzae (koji-kin)', type: 'levure', quantity: 3, unit: 'g', addAt: 'Ensemencement' },
    ],
    steps: [
      { id: 'k-s1', description: 'Cuire le riz à la vapeur 45 min', day: 0, done: false, durationMinutes: 45, targetTemp: 100 },
      { id: 'k-s2', description: 'Refroidir le riz à 35°C', day: 0, done: false, durationMinutes: 30, targetTemp: 35 },
      { id: 'k-s3', description: 'Ensemencer avec le koji-kin', day: 0, done: false, durationMinutes: 5, targetTemp: 30 },
      { id: 'k-s4', description: 'Incubation à 30°C, 85% humidité', day: 1, done: false },
      { id: 'k-s5', description: 'Mélanger et aérer (24h)', day: 1, done: false },
      { id: 'k-s6', description: 'Poursuivre incubation 30°C', day: 2, done: false },
      { id: 'k-s7', description: 'Vérifier bloom blanc — Récolte', day: 3, done: false },
    ],
  },
  {
    projectType: 'koji',
    name: 'Koji Orge (Mugi)',
    style: 'Mugi Koji',
    batchSize: 2,
    og: 0, fg: 0, abv: 0, ibu: 0, srm: 8,
    ingredients: [
      { id: 'k-i3', name: 'Orge perlé cuit', type: 'grain', quantity: 2, unit: 'kg', addAt: 'Base' },
      { id: 'k-i4', name: 'Aspergillus oryzae', type: 'levure', quantity: 3, unit: 'g', addAt: 'Ensemencement' },
    ],
    steps: [
      { id: 'k-s8', description: 'Cuire l\'orge 60 min', day: 0, done: false, durationMinutes: 60, targetTemp: 100 },
      { id: 'k-s9', description: 'Refroidir à 32°C', day: 0, done: false, durationMinutes: 40, targetTemp: 32 },
      { id: 'k-s10', description: 'Ensemencer avec le koji-kin', day: 0, done: false, durationMinutes: 5, targetTemp: 30 },
      { id: 'k-s11', description: 'Incubation 28°C, 80% humidité', day: 1, done: false },
      { id: 'k-s12', description: 'Mélanger (24h)', day: 1, done: false },
      { id: 'k-s13', description: 'Poursuivre incubation', day: 2, done: false },
      { id: 'k-s14', description: 'Récolte du koji', day: 3, done: false },
    ],
  },
]

// === Mushroom Templates ===
export const MUSHROOM_TEMPLATES: Omit<Recipe, 'id'>[] = [
  {
    projectType: 'mushroom',
    name: 'Pleurotes (Oyster)',
    style: 'Pleurotus ostreatus',
    batchSize: 5,
    og: 0, fg: 0, abv: 0, ibu: 0, srm: 2,
    ingredients: [
      { id: 'm-i1', name: 'Paille pasteurisée', type: 'grain', quantity: 5, unit: 'kg', addAt: 'Substrat' },
      { id: 'm-i2', name: 'Grain spawn pleurote', type: 'levure', quantity: 500, unit: 'g', addAt: 'Ensemencement' },
    ],
    steps: [
      { id: 'm-s1', description: 'Pasteuriser la paille 90 min à 65°C', day: 0, done: false, durationMinutes: 90, targetTemp: 65 },
      { id: 'm-s2', description: 'Refroidir et égoutter', day: 0, done: false, durationMinutes: 120, targetTemp: 20 },
      { id: 'm-s3', description: 'Mélanger avec le spawn', day: 0, done: false, durationMinutes: 10 },
      { id: 'm-s4', description: 'Colonisation 22°C, 90% humidité', day: 1, done: false },
      { id: 'm-s5', description: 'Vérifier colonisation complète', day: 14, done: false },
      { id: 'm-s6', description: 'Fructification 16°C, 95% humidité', day: 15, done: false },
      { id: 'm-s7', description: 'Première récolte', day: 21, done: false },
    ],
  },
  {
    projectType: 'mushroom',
    name: 'Shiitake',
    style: 'Lentinula edodes',
    batchSize: 10,
    og: 0, fg: 0, abv: 0, ibu: 0, srm: 18,
    ingredients: [
      { id: 'm-i3', name: 'Sciure de chêne', type: 'grain', quantity: 8, unit: 'kg', addAt: 'Substrat' },
      { id: 'm-i4', name: 'Son de blé', type: 'grain', quantity: 2, unit: 'kg', addAt: 'Supplément' },
      { id: 'm-i5', name: 'Grain spawn shiitake', type: 'levure', quantity: 1, unit: 'kg', addAt: 'Ensemencement' },
    ],
    steps: [
      { id: 'm-s8', description: 'Stériliser substrat 2h à 121°C', day: 0, done: false, durationMinutes: 120, targetTemp: 121 },
      { id: 'm-s9', description: 'Refroidir en zone stérile', day: 0, done: false, durationMinutes: 180, targetTemp: 20 },
      { id: 'm-s10', description: 'Inoculer avec spawn', day: 0, done: false, durationMinutes: 15 },
      { id: 'm-s11', description: 'Incubation 22°C, 80% humidité', day: 1, done: false },
      { id: 'm-s12', description: 'Colonisation complète (~60j)', day: 60, done: false },
      { id: 'm-s13', description: 'Choc thermique 12°C pour initiation', day: 61, done: false, targetTemp: 12 },
      { id: 'm-s14', description: 'Fructification 18°C, 85% humidité', day: 62, done: false },
      { id: 'm-s15', description: 'Récolte', day: 75, done: false },
    ],
  },
]

// === Mead Templates ===
export const MEAD_TEMPLATES: Omit<Recipe, 'id'>[] = [
  {
    projectType: 'mead',
    name: 'Hydromel Traditionnel',
    style: 'Traditional Mead',
    batchSize: 20,
    og: 1.110, fg: 1.010, abv: 13.2, ibu: 0, srm: 4,
    ingredients: [
      { id: 'md-i1', name: 'Miel d\'acacia', type: 'autre', quantity: 6, unit: 'kg', addAt: 'Base' },
      { id: 'md-i2', name: 'Eau de source', type: 'eau', quantity: 18, unit: 'L', addAt: 'Dilution' },
      { id: 'md-i3', name: 'Levure 71B-1122', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 'md-i4', name: 'Nutriment levure (DAP)', type: 'autre', quantity: 3, unit: 'g', addAt: 'Nutrition J0-J3' },
    ],
    steps: [
      { id: 'md-s1', description: 'Dissoudre le miel dans l\'eau tiède', day: 0, done: false, durationMinutes: 30, targetTemp: 35 },
      { id: 'md-s2', description: 'Refroidir le moût à 20°C', day: 0, done: false, durationMinutes: 60, targetTemp: 20 },
      { id: 'md-s3', description: 'Mesurer OG et ajuster', day: 0, done: false, durationMinutes: 10 },
      { id: 'md-s4', description: 'Réhydrater et ensemencer la levure', day: 0, done: false, durationMinutes: 20, targetTemp: 18 },
      { id: 'md-s5', description: 'Fermentation primaire 18°C', day: 1, done: false },
      { id: 'md-s6', description: 'Ajouter nutriment (SNA)', day: 1, done: false },
      { id: 'md-s7', description: 'Ajouter nutriment', day: 2, done: false },
      { id: 'md-s8', description: 'Ajouter nutriment final', day: 3, done: false },
      { id: 'md-s9', description: 'Mesure de densité', day: 14, done: false },
      { id: 'md-s10', description: 'Soutirage / Clarification', day: 30, done: false },
    ],
  },
  {
    projectType: 'mead',
    name: 'Melomel Framboise',
    style: 'Fruit Mead (Melomel)',
    batchSize: 20,
    og: 1.095, fg: 1.008, abv: 11.5, ibu: 0, srm: 10,
    ingredients: [
      { id: 'md-i5', name: 'Miel de fleurs', type: 'autre', quantity: 4.5, unit: 'kg', addAt: 'Base' },
      { id: 'md-i6', name: 'Framboises fraîches', type: 'autre', quantity: 2, unit: 'kg', addAt: 'Secondaire J15' },
      { id: 'md-i7', name: 'Eau de source', type: 'eau', quantity: 18, unit: 'L', addAt: 'Dilution' },
      { id: 'md-i8', name: 'Levure D47', type: 'levure', quantity: 1, unit: 'pkt', addAt: 'Ensemencement' },
      { id: 'md-i9', name: 'Nutriment levure', type: 'autre', quantity: 3, unit: 'g', addAt: 'Nutrition' },
    ],
    steps: [
      { id: 'md-s11', description: 'Dissoudre miel dans eau', day: 0, done: false, durationMinutes: 30, targetTemp: 30 },
      { id: 'md-s12', description: 'Refroidir à 20°C', day: 0, done: false, durationMinutes: 60, targetTemp: 20 },
      { id: 'md-s13', description: 'Ensemencer levure D47', day: 0, done: false, durationMinutes: 15, targetTemp: 18 },
      { id: 'md-s14', description: 'Fermentation primaire 18°C', day: 1, done: false },
      { id: 'md-s15', description: 'Ajouter nutriments (SNA)', day: 1, done: false },
      { id: 'md-s16', description: 'Mesure densité', day: 14, done: false },
      { id: 'md-s17', description: 'Ajouter framboises écrasées', day: 15, done: false },
      { id: 'md-s18', description: 'Fermentation secondaire', day: 16, done: false },
      { id: 'md-s19', description: 'Soutirage et clarification', day: 30, done: false },
    ],
  },
]

// SRM to CSS color
export function srmToColor(srm: number): string {
  const colors: Record<number, string> = {
    2: '#FFE699', 4: '#FFD878', 6: '#FFC94D', 8: '#FFBB33',
    10: '#FFAA22', 12: '#EE9911', 14: '#DD8800', 16: '#CC7700',
    18: '#BB6600', 20: '#AA5500', 25: '#884400', 30: '#663300',
    35: '#553322', 40: '#442211',
  }
  const keys = Object.keys(colors).map(Number).sort((a, b) => a - b)
  for (const k of keys) {
    if (srm <= k) return colors[k]
  }
  return '#331100'
}
