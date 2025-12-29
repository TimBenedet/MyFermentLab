/**
 * Calculs de profil d'eau pour le brassage
 *
 * Ce module contient :
 * - Les profils d'eau cibles par style de bière
 * - Les contributions des sels de brassage
 * - Le calcul des corrections à apporter
 */

import { WaterProfile, SaltAddition, WaterProfileStyle } from '../types';

// =============================================================================
// PROFILS D'EAU CIBLES PAR STYLE
// =============================================================================

export interface WaterStyleProfile extends WaterProfile {
  description: string;
  ratioSO4Cl: number;
}

export const WATER_STYLE_PROFILES: Record<WaterProfileStyle, WaterStyleProfile> = {
  pilsner: {
    name: 'Pilsner (Plzen)',
    description: 'Eau très douce, bières légères et maltées',
    calcium: 10,
    magnesium: 3,
    sodium: 3,
    chloride: 5,
    sulfate: 5,
    bicarbonate: 25,
    ratioSO4Cl: 1.0
  },
  ipa: {
    name: 'IPA/Pale Ale (Burton)',
    description: 'Eau sulfatée, accentue l\'amertume du houblon',
    calcium: 275,
    magnesium: 40,
    sodium: 25,
    chloride: 35,
    sulfate: 450,
    bicarbonate: 260,
    ratioSO4Cl: 12.9
  },
  stout: {
    name: 'Stout/Porter (Dublin)',
    description: 'Eau alcaline, rondeur maltée',
    calcium: 120,
    magnesium: 4,
    sodium: 12,
    chloride: 19,
    sulfate: 54,
    bicarbonate: 319,
    ratioSO4Cl: 2.8
  },
  lager: {
    name: 'Lager (Munich)',
    description: 'Eau modérément minéralisée',
    calcium: 77,
    magnesium: 18,
    sodium: 2,
    chloride: 2,
    sulfate: 10,
    bicarbonate: 295,
    ratioSO4Cl: 5.0
  },
  amber: {
    name: 'Amber/Brown (London)',
    description: 'Eau équilibrée, polyvalente',
    calcium: 90,
    magnesium: 5,
    sodium: 15,
    chloride: 20,
    sulfate: 40,
    bicarbonate: 125,
    ratioSO4Cl: 2.0
  },
  belgian: {
    name: 'Belgian (Bruxelles)',
    description: 'Eau légèrement minéralisée',
    calcium: 45,
    magnesium: 8,
    sodium: 15,
    chloride: 20,
    sulfate: 50,
    bicarbonate: 100,
    ratioSO4Cl: 2.5
  },
  balanced: {
    name: 'Balanced (Polyvalent)',
    description: 'Profil équilibré pour tous styles',
    calcium: 80,
    magnesium: 15,
    sodium: 25,
    chloride: 60,
    sulfate: 80,
    bicarbonate: 100,
    ratioSO4Cl: 1.3
  }
};

// Labels pour l'affichage
export const WATER_STYLE_LABELS: Record<WaterProfileStyle, string> = {
  pilsner: 'Pilsner (eau douce)',
  ipa: 'IPA/Pale Ale (houblonnée)',
  stout: 'Stout/Porter (ronde)',
  lager: 'Lager (Munich)',
  amber: 'Amber/Brown (London)',
  belgian: 'Belgian (Bruxelles)',
  balanced: 'Balanced (polyvalent)'
};

// =============================================================================
// SELS DE BRASSAGE ET LEUR CONTRIBUTION
// =============================================================================

/**
 * Contribution de chaque sel en mg/L pour 1g/L ajouté
 * Source: Palmer's How to Brew, Bru'n Water
 */
interface SaltContribution {
  name: string;
  nameFr: string;
  formula: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  chloride: number;
  sulfate: number;
  bicarbonate: number;
}

const SALT_CONTRIBUTIONS: Record<string, SaltContribution> = {
  gypsum: {
    name: 'Gypsum',
    nameFr: 'Gypse',
    formula: 'CaSO4·2H2O',
    calcium: 61.5,
    magnesium: 0,
    sodium: 0,
    chloride: 0,
    sulfate: 147.4,
    bicarbonate: 0
  },
  calciumChloride: {
    name: 'Calcium Chloride',
    nameFr: 'Chlorure de calcium',
    formula: 'CaCl2·2H2O',
    calcium: 72,
    magnesium: 0,
    sodium: 0,
    chloride: 127,
    sulfate: 0,
    bicarbonate: 0
  },
  epsom: {
    name: 'Epsom Salt',
    nameFr: 'Sel d\'Epsom',
    formula: 'MgSO4·7H2O',
    calcium: 0,
    magnesium: 26,
    sodium: 0,
    chloride: 0,
    sulfate: 103,
    bicarbonate: 0
  },
  tableSalt: {
    name: 'Table Salt',
    nameFr: 'Sel de table',
    formula: 'NaCl',
    calcium: 0,
    magnesium: 0,
    sodium: 103,
    chloride: 160,
    sulfate: 0,
    bicarbonate: 0
  },
  bakingSoda: {
    name: 'Baking Soda',
    nameFr: 'Bicarbonate de soude',
    formula: 'NaHCO3',
    calcium: 0,
    magnesium: 0,
    sodium: 75,
    chloride: 0,
    sulfate: 0,
    bicarbonate: 191
  },
  chalk: {
    name: 'Chalk',
    nameFr: 'Craie (Cite calcaire)',
    formula: 'CaCO3',
    calcium: 106,
    magnesium: 0,
    sodium: 0,
    chloride: 0,
    sulfate: 0,
    bicarbonate: 158
  }
};

// =============================================================================
// FONCTIONS DE CALCUL
// =============================================================================

/**
 * Calcule le ratio SO4/Cl d'un profil d'eau
 */
export function calculateSO4ClRatio(profile: WaterProfile): number | null {
  if (profile.chloride <= 0) return null;
  return Math.round((profile.sulfate / profile.chloride) * 100) / 100;
}

/**
 * Retourne une description du caractère de l'eau basée sur le ratio SO4/Cl
 */
export function getRatioDescription(ratio: number | null): string {
  if (ratio === null) return 'Non calculable';
  if (ratio < 0.5) return 'Orientée MALT (douce, ronde)';
  if (ratio < 1.0) return 'Légèrement maltée';
  if (ratio < 2.0) return 'Équilibrée';
  if (ratio < 4.0) return 'Légèrement houblonnée';
  return 'Orientée HOUBLON (sèche, amère)';
}

/**
 * Calcule les corrections de sels à apporter pour atteindre un profil cible
 *
 * Algorithme simplifié :
 * 1. Calcule les deltas pour chaque ion
 * 2. Priorise les ajustements selon les sels disponibles
 * 3. Évite les valeurs négatives (nécessiterait une dilution)
 *
 * @param source - Profil d'eau source (ville)
 * @param target - Profil d'eau cible (style)
 * @param volumeL - Volume total d'eau en litres
 * @returns Liste des sels à ajouter avec quantités
 */
export function calculateSaltAdditions(
  source: WaterProfile,
  target: WaterProfile,
  volumeL: number
): SaltAddition[] {
  const additions: SaltAddition[] = [];

  // Calculer les deltas (cible - source)
  let deltaCa = target.calcium - source.calcium;
  let deltaMg = target.magnesium - source.magnesium;
  let deltaNa = target.sodium - source.sodium;
  let deltaCl = target.chloride - source.chloride;
  let deltaSO4 = target.sulfate - source.sulfate;
  let deltaHCO3 = target.bicarbonate - source.bicarbonate;

  // Ignorer les deltas négatifs (nécessiteraient une dilution avec eau RO)
  deltaCa = Math.max(0, deltaCa);
  deltaMg = Math.max(0, deltaMg);
  deltaNa = Math.max(0, deltaNa);
  deltaCl = Math.max(0, deltaCl);
  deltaSO4 = Math.max(0, deltaSO4);
  deltaHCO3 = Math.max(0, deltaHCO3);

  // 1. Gypse pour SO4 (prioritaire pour les bières houblonnées)
  if (deltaSO4 > 0) {
    const gypsumContrib = SALT_CONTRIBUTIONS.gypsum;
    const gypsumNeeded = deltaSO4 / gypsumContrib.sulfate; // g/L

    if (gypsumNeeded > 0.05) { // Seuil minimum
      const totalGypsum = gypsumNeeded * volumeL;
      additions.push({
        name: `${gypsumContrib.nameFr} (${gypsumContrib.formula})`,
        amount: Math.round(totalGypsum * 10) / 10,
        perLiter: Math.round(gypsumNeeded * 100) / 100
      });

      // Déduire la contribution en Ca
      deltaCa -= gypsumNeeded * gypsumContrib.calcium;
    }
  }

  // 2. Chlorure de calcium pour Cl (et Ca restant)
  if (deltaCl > 0 || deltaCa > 0) {
    const cacl2Contrib = SALT_CONTRIBUTIONS.calciumChloride;
    // Priorité au Cl
    const cacl2NeededForCl = deltaCl > 0 ? deltaCl / cacl2Contrib.chloride : 0;
    const cacl2NeededForCa = deltaCa > 0 ? deltaCa / cacl2Contrib.calcium : 0;
    const cacl2Needed = Math.max(cacl2NeededForCl, cacl2NeededForCa * 0.5); // Limiter pour Ca

    if (cacl2Needed > 0.05) {
      const totalCaCl2 = cacl2Needed * volumeL;
      additions.push({
        name: `${cacl2Contrib.nameFr} (${cacl2Contrib.formula})`,
        amount: Math.round(totalCaCl2 * 10) / 10,
        perLiter: Math.round(cacl2Needed * 100) / 100
      });

      deltaCl -= cacl2Needed * cacl2Contrib.chloride;
      deltaCa -= cacl2Needed * cacl2Contrib.calcium;
    }
  }

  // 3. Sel d'Epsom pour Mg
  if (deltaMg > 0) {
    const epsomContrib = SALT_CONTRIBUTIONS.epsom;
    const epsomNeeded = deltaMg / epsomContrib.magnesium;

    if (epsomNeeded > 0.05) {
      const totalEpsom = epsomNeeded * volumeL;
      additions.push({
        name: `${epsomContrib.nameFr} (${epsomContrib.formula})`,
        amount: Math.round(totalEpsom * 10) / 10,
        perLiter: Math.round(epsomNeeded * 100) / 100
      });
    }
  }

  // 4. Sel de table pour Na/Cl restant (avec parcimonie)
  if (deltaNa > 10 || deltaCl > 20) {
    const saltContrib = SALT_CONTRIBUTIONS.tableSalt;
    const saltNeededForNa = deltaNa > 0 ? deltaNa / saltContrib.sodium : 0;
    const saltNeededForCl = deltaCl > 0 ? deltaCl / saltContrib.chloride : 0;
    const saltNeeded = Math.min(Math.max(saltNeededForNa, saltNeededForCl), 0.5); // Max 0.5 g/L

    if (saltNeeded > 0.05) {
      const totalSalt = saltNeeded * volumeL;
      additions.push({
        name: `${saltContrib.nameFr} (${saltContrib.formula})`,
        amount: Math.round(totalSalt * 10) / 10,
        perLiter: Math.round(saltNeeded * 100) / 100
      });
    }
  }

  // 5. Bicarbonate de soude pour HCO3 (rare, surtout pour stouts)
  if (deltaHCO3 > 50) {
    const bakingContrib = SALT_CONTRIBUTIONS.bakingSoda;
    const bakingNeeded = Math.min(deltaHCO3 / bakingContrib.bicarbonate, 1.0); // Max 1 g/L

    if (bakingNeeded > 0.1) {
      const totalBaking = bakingNeeded * volumeL;
      additions.push({
        name: `${bakingContrib.nameFr} (${bakingContrib.formula})`,
        amount: Math.round(totalBaking * 10) / 10,
        perLiter: Math.round(bakingNeeded * 100) / 100
      });
    }
  }

  return additions;
}

/**
 * Vérifie si une dilution avec eau RO est recommandée
 */
export function needsDilution(source: WaterProfile, target: WaterProfile): boolean {
  // Vérifie si l'eau source est significativement plus minéralisée que la cible
  const overCa = source.calcium > target.calcium * 1.5;
  const overSO4 = source.sulfate > target.sulfate * 1.5;
  const overCl = source.chloride > target.chloride * 1.5;
  const overHCO3 = source.bicarbonate > target.bicarbonate * 1.5;

  return overCa || overSO4 || overCl || overHCO3;
}

/**
 * Crée un profil d'eau vide
 */
export function createEmptyWaterProfile(): WaterProfile {
  return {
    name: '',
    calcium: 0,
    magnesium: 0,
    sodium: 0,
    chloride: 0,
    sulfate: 0,
    bicarbonate: 0
  };
}
