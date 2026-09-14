import type { FermentConfig, FermentId, FermentKind } from '../types';

/**
 * Source unique de vérité des ferments.
 * Aucun autre module ne redéclare de valeurs de consigne, de graine ou de contenant.
 */
export const FERMENTATION_BY_ID: Record<FermentId, FermentConfig> = {
  ipa: {
    id: 'ipa',
    kind: 'beer',
    name: 'Bière IPA',
    context: 'Cuve 1 · fermentation principale',
    setpoints: { temperature: 19.5, humidity: null },
    dynamics: {
      temperature: { noise: 0.0028, cycleAmplitude: 0.15, burstScale: 1.7 },
      humidity: null,
    },
    gravity: { original: 1.06, final: 1.012, elapsedHours: 62 },
    vessel: { kind: 'tank', label: 'Cuve 1 · 250 L', liquid: '#d9942a' },
    seed: 0x1a2b3c,
  },
  hydromel: {
    id: 'hydromel',
    kind: 'mead',
    name: 'Hydromel',
    context: 'Cuve 2 · fermentation lente',
    setpoints: { temperature: 18, humidity: null },
    dynamics: {
      temperature: { noise: 0.0032, cycleAmplitude: 0.17, burstScale: 2 },
      humidity: null,
    },
    gravity: { original: 1.108, final: 1.004, elapsedHours: 90 },
    vessel: { kind: 'tank', label: 'Cuve 2 · 60 L', liquid: '#e6c65c' },
    seed: 0x2b3c4d,
  },
  koji: {
    id: 'koji',
    kind: 'koji',
    name: 'Koji',
    context: 'Étuve · culture de surface',
    setpoints: { temperature: 30, humidity: 75 },
    dynamics: {
      temperature: { noise: 0.0036, cycleAmplitude: 0.19, burstScale: 2.4 },
      humidity: { noise: 0.05, cycleAmplitude: 2.6, burstScale: 9 },
    },
    gravity: null,
    vessel: {
      kind: 'koji',
      label: 'Étuve · bac de 40 L',
      substrate: '#e9dfc4',
      spore: '#c9d29b',
    },
    seed: 0x3c4d5e,
  },
  miso: {
    id: 'miso',
    kind: 'miso',
    name: 'Miso',
    context: 'Cellier · pot de 30 kg',
    setpoints: { temperature: 30, humidity: 72 },
    dynamics: {
      temperature: { noise: 0.0035, cycleAmplitude: 0.22, burstScale: 2.2 },
      humidity: { noise: 0.05, cycleAmplitude: 2.4, burstScale: 8 },
    },
    gravity: null,
    vessel: {
      kind: 'crock',
      label: 'Pot 3 · pâte de soja',
      contents: 'pâte de soja',
      paste: ['#7d4a22', '#a9713c', '#c98f4a'],
    },
    seed: 0x5e6f70,
  },
  garum: {
    id: 'garum',
    kind: 'garum',
    name: 'Garum',
    context: 'Amphores · saumure de poisson',
    setpoints: { temperature: 26, humidity: 62 },
    dynamics: {
      temperature: { noise: 0.0034, cycleAmplitude: 0.24, burstScale: 2.3 },
      humidity: { noise: 0.055, cycleAmplitude: 2.8, burstScale: 9 },
    },
    gravity: null,
    vessel: { kind: 'tank', label: 'Cuve 4 · 120 L', liquid: '#8a6a3a' },
    seed: 0x6f7081,
  },
};

/** Ordre d'affichage : ipa, hydromel, koji, miso, garum. */
export const FERMENTATIONS: readonly FermentConfig[] = Object.values(FERMENTATION_BY_ID);

/**
 * Ferment de référence du type **sauce soja**, tenu **hors** de `FERMENTATIONS` :
 * l'accueil montre ses cinq ferments, une recette n'a pas à y ajouter une sixième
 * fiche. Il existe parce qu'un lot lancé a besoin d'un profil de suivi — consignes,
 * dynamique, contenant — et que la sauce soja a les mêmes matières que le miso :
 * koji, soja, sel, menées en saumure dans une jarre de cellier, sans densité.
 */
const SAUCE_SOJA: FermentConfig = {
  // Identifiant de configuration : jamais celui d'un lot, qui est réidentifié.
  id: 'reference-sauce-soja',
  kind: 'soy',
  name: 'Sauce soja',
  context: 'Cellier · jarre de moût',
  setpoints: { temperature: 28, humidity: 68 },
  dynamics: {
    temperature: { noise: 0.0035, cycleAmplitude: 0.22, burstScale: 2.2 },
    humidity: { noise: 0.05, cycleAmplitude: 2.4, burstScale: 8 },
  },
  gravity: null,
  // Le moût est plus sombre que la pâte à miso : mêmes tons, descendus d'un cran.
  vessel: {
    kind: 'crock',
    label: 'Jarre · moût de soja',
    contents: 'moût de soja',
    paste: ['#4a2711', '#7d4a22', '#a9713c'],
  },
  seed: 0x7a8b9c,
};

/**
 * Ferment de **référence** d'un type : consignes, dynamique, gravité et contenant.
 * C'est lui qui habille une production lancée depuis la bibliothèque, dont la
 * recette ne porte, elle, que des ingrédients. `Record<FermentKind, …>` : ajouter un
 * type sans lui donner de référence ne compile pas.
 */
export const FERMENTATION_BY_KIND: Readonly<Record<FermentKind, FermentConfig>> = {
  beer: FERMENTATION_BY_ID.ipa,
  mead: FERMENTATION_BY_ID.hydromel,
  koji: FERMENTATION_BY_ID.koji,
  miso: FERMENTATION_BY_ID.miso,
  soy: SAUCE_SOJA,
  garum: FERMENTATION_BY_ID.garum,
};

/**
 * Politique de suivi densimétrique, portée par le **type** et non par un ferment.
 * Ajouter une bière ou un hydromel n'exige donc aucune modification des composants.
 */
const GRAVITY_KINDS: Readonly<Record<FermentKind, boolean>> = {
  beer: true,
  mead: true,
  koji: false,
  miso: false,
  soy: false,
  garum: false,
};

/**
 * Le type fait autorité : `kind` dit **si** la densité se suit, `gravity` dit **quoi**
 * suivre (OG, FG, durée) et n'est renseigné que pour les types qui la suivent.
 */
export function tracksGravity(kind: FermentKind): boolean {
  return GRAVITY_KINDS[kind];
}

/**
 * Types proposés, dans l'ordre d'affichage (sélecteur de recette, fiches). Les deux
 * ferments de graines — miso et sauce soja — se suivent : ils se cherchent ensemble.
 */
export const FERMENT_KINDS: readonly FermentKind[] = [
  'beer',
  'mead',
  'koji',
  'miso',
  'soy',
  'garum',
];

/**
 * Libellés des types. La bibliothèque les affiche tels quels : « Bière », « Miso »…
 * `Record<FermentKind, string>` et non un objet libre : ajouter un type sans lui
 * donner de libellé ne compile pas.
 */
export const KIND_LABELS: Readonly<Record<FermentKind, string>> = {
  beer: 'Bière',
  mead: 'Hydromel',
  koji: 'Koji',
  miso: 'Miso',
  soy: 'Sauce soja',
  garum: 'Garum',
};
