import { Project } from '../types';
import {
  calculateOriginalGravity,
  calculateFinalGravity,
  calculateABV,
  calculateIBU,
  calculateColorEBC
} from './brewingCalculations';

export interface AssistantTip {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  message: string;
  category: 'recipe' | 'temperature' | 'humidity' | 'fermentation' | 'action';
}

// Conversion SG -> Plato
function sgToPlato(sg: number): number {
  return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg;
}

// Conversion EBC -> SRM
function ebcToSrm(ebc: number): number {
  return ebc / 1.97;
}

function getDaysSinceCreation(project: Project): number {
  return (Date.now() - project.createdAt) / (1000 * 60 * 60 * 24);
}

function getHoursSinceCreation(project: Project): number {
  return (Date.now() - project.createdAt) / (1000 * 60 * 60);
}

// ==========================================
// Regles pour la Biere
// ==========================================
function generateBeerTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const days = getDaysSinceCreation(project);
  const recipe = project.recipe;

  // Calculs de recette
  if (recipe && recipe.grains && recipe.grains.length > 0) {
    const og = calculateOriginalGravity(recipe);
    const fg = calculateFinalGravity(recipe);
    const abv = calculateABV(og, fg);
    const ibu = calculateIBU(recipe);
    const ebc = calculateColorEBC(recipe);
    const ogPlato = sgToPlato(og);
    const fgPlato = sgToPlato(fg);

    tips.push({
      id: 'beer-recipe-og',
      priority: 'medium',
      icon: '🧮',
      title: 'Densite initiale estimee',
      message: `OG : ${og.toFixed(3)} (${ogPlato.toFixed(1)}°P)`,
      category: 'recipe'
    });

    tips.push({
      id: 'beer-recipe-fg',
      priority: 'medium',
      icon: '🎯',
      title: 'Densite finale estimee',
      message: `FG : ${fg.toFixed(3)} (${fgPlato.toFixed(1)}°P) — ABV : ${abv.toFixed(1)}%`,
      category: 'recipe'
    });

    if (ibu > 0) {
      const ratio = ibu / ((og - 1) * 1000);
      let balance = 'equilibree';
      if (ratio < 0.5) balance = 'maltee';
      else if (ratio > 0.8) balance = 'amere';

      tips.push({
        id: 'beer-recipe-ibu',
        priority: 'low',
        icon: '🌿',
        title: 'Amertume',
        message: `IBU : ${ibu.toFixed(0)} — Biere ${balance} (BU/GU : ${ratio.toFixed(2)})`,
        category: 'recipe'
      });
    }

    if (ebc > 0) {
      const srm = ebcToSrm(ebc);
      let colorName = 'pale';
      if (ebc < 8) colorName = 'paille';
      else if (ebc < 15) colorName = 'doree';
      else if (ebc < 25) colorName = 'ambree';
      else if (ebc < 40) colorName = 'cuivree';
      else if (ebc < 60) colorName = 'brune';
      else colorName = 'noire';

      tips.push({
        id: 'beer-recipe-color',
        priority: 'low',
        icon: '🎨',
        title: 'Couleur',
        message: `${ebc.toFixed(0)} EBC / ${srm.toFixed(0)} SRM — Biere ${colorName}`,
        category: 'recipe'
      });
    }

    // Conseil levure
    const yeast = recipe.yeasts?.[0];
    if (yeast) {
      const tempMin = yeast.tempMin;
      const tempMax = yeast.tempMax;
      if (tempMin && tempMax) {
        const current = project.currentTemperature;
        if (current < tempMin) {
          tips.push({
            id: 'beer-yeast-cold',
            priority: 'high',
            icon: '🥶',
            title: 'Temperature trop basse pour la levure',
            message: `${yeast.name} travaille entre ${tempMin}-${tempMax}°C. Actuellement ${current.toFixed(1)}°C — la fermentation sera lente ou inactive.`,
            category: 'temperature'
          });
        } else if (current > tempMax) {
          tips.push({
            id: 'beer-yeast-hot',
            priority: 'high',
            icon: '🥵',
            title: 'Temperature trop haute pour la levure',
            message: `${yeast.name} travaille entre ${tempMin}-${tempMax}°C. Actuellement ${current.toFixed(1)}°C — risque de faux-gouts (esters, fusel).`,
            category: 'temperature'
          });
        } else {
          tips.push({
            id: 'beer-yeast-ok',
            priority: 'low',
            icon: '✅',
            title: 'Temperature ideale',
            message: `${yeast.name} : plage ${tempMin}-${tempMax}°C. Actuellement ${current.toFixed(1)}°C, parfait !`,
            category: 'temperature'
          });
        }
      }

      if (yeast.attenuation) {
        tips.push({
          id: 'beer-yeast-attenuation',
          priority: 'low',
          icon: '🍺',
          title: 'Attenuation levure',
          message: `${yeast.name} — Attenuation typique : ${yeast.attenuation}%. Forme : ${yeast.form || 'non precisee'}.`,
          category: 'recipe'
        });
      }
    }

    // Rappel dry-hop
    const dryHops = recipe.hops?.filter(h => h.use === 'dry-hop');
    if (dryHops && dryHops.length > 0) {
      const totalDryHop = dryHops.reduce((sum, h) => sum + h.quantity, 0);
      const dryHopNames = dryHops.map(h => h.name).join(', ');

      if (days >= 3 && days <= 7) {
        tips.push({
          id: 'beer-dryhop-reminder',
          priority: 'high',
          icon: '🌿',
          title: 'Dry-hop a prevoir',
          message: `${totalDryHop}g de dry-hop (${dryHopNames}). Jour ${Math.floor(days)} — c'est le bon moment pour ajouter le dry-hop !`,
          category: 'action'
        });
      } else if (days < 3) {
        tips.push({
          id: 'beer-dryhop-wait',
          priority: 'low',
          icon: '⏳',
          title: 'Dry-hop prevu',
          message: `${totalDryHop}g de ${dryHopNames} a ajouter vers J3-J5 de fermentation.`,
          category: 'action'
        });
      }
    }

    // Analyse densite
    if (project.densityHistory && project.densityHistory.length > 0) {
      const sorted = [...project.densityHistory].sort((a, b) => a.timestamp - b.timestamp);
      const firstDensity = sorted[0].density;
      const lastDensity = sorted[sorted.length - 1].density;
      const drop = firstDensity - lastDensity;
      const currentAbv = calculateABV(firstDensity, lastDensity);
      const currentPlato = sgToPlato(lastDensity);

      tips.push({
        id: 'beer-density-progress',
        priority: 'medium',
        icon: '📉',
        title: 'Progression densite',
        message: `${firstDensity.toFixed(3)} -> ${lastDensity.toFixed(3)} (${currentPlato.toFixed(1)}°P) — Chute de ${(drop * 1000).toFixed(0)} points. ABV actuel : ~${currentAbv.toFixed(1)}%`,
        category: 'fermentation'
      });

      // Verifier si fermentation terminee
      if (sorted.length >= 3) {
        const last3 = sorted.slice(-3);
        const isStable = Math.abs(last3[last3.length - 1].density - last3[0].density) < 0.002;
        if (isStable && days > 5) {
          tips.push({
            id: 'beer-density-stable',
            priority: 'high',
            icon: '🏁',
            title: 'Fermentation potentiellement terminee',
            message: `La densite est stable depuis ${last3.length} mesures (~${lastDensity.toFixed(3)}). Tu peux envisager la mise en bouteille !`,
            category: 'fermentation'
          });
        }
      }
    }
  }

  // Phase de fermentation
  if (days < 1) {
    tips.push({
      id: 'beer-phase-lag',
      priority: 'medium',
      icon: '🕐',
      title: 'Phase de latence',
      message: `Jour ${Math.floor(days)} — La levure s'adapte a son environnement. Pas d'activite visible, c'est normal.`,
      category: 'fermentation'
    });
  } else if (days < 4) {
    tips.push({
      id: 'beer-phase-active',
      priority: 'medium',
      icon: '💨',
      title: 'Fermentation active',
      message: `Jour ${Math.floor(days)} — Phase active ! Production de CO2, mousse (krausen). Ne pas ouvrir le fermenteur.`,
      category: 'fermentation'
    });
  } else if (days < 7) {
    tips.push({
      id: 'beer-phase-slowing',
      priority: 'low',
      icon: '📊',
      title: 'Fermentation ralentit',
      message: `Jour ${Math.floor(days)} — L'activite diminue. Prends une mesure de densite pour suivre l'avancement.`,
      category: 'fermentation'
    });
  } else if (days < 14) {
    tips.push({
      id: 'beer-phase-conditioning',
      priority: 'low',
      icon: '⏳',
      title: 'Phase de maturation',
      message: `Jour ${Math.floor(days)} — La levure nettoie les sous-produits (diacetyle, acetaldehyde). Patience !`,
      category: 'fermentation'
    });
  } else {
    tips.push({
      id: 'beer-phase-ready',
      priority: 'medium',
      icon: '✅',
      title: 'Fermentation avancee',
      message: `Jour ${Math.floor(days)} — Si la densite est stable depuis 3 jours, tu peux embouteiller.`,
      category: 'fermentation'
    });
  }

  return tips;
}

// ==========================================
// Regles pour le Koji
// ==========================================
function generateKojiTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const hours = getHoursSinceCreation(project);
  const temp = project.currentTemperature;
  const humidity = project.currentHumidity;

  // Phases du koji
  if (hours < 12) {
    tips.push({
      id: 'koji-phase-inoculation',
      priority: 'medium',
      icon: '🌱',
      title: 'Phase d\'inoculation',
      message: `Heure ${Math.floor(hours)} — Le koji a ete inocule. Maintiens 30-32°C et 80-90% d'humidite. Le mycelium va commencer a se developper.`,
      category: 'fermentation'
    });

    if (temp < 28) {
      tips.push({
        id: 'koji-temp-low-inoc',
        priority: 'high',
        icon: '🥶',
        title: 'Temperature trop basse',
        message: `${temp.toFixed(1)}°C — Vise 30-32°C pour l'inoculation. En dessous de 28°C, la croissance sera tres lente.`,
        category: 'temperature'
      });
    }
  } else if (hours < 24) {
    tips.push({
      id: 'koji-phase-incubation',
      priority: 'medium',
      icon: '🔬',
      title: 'Phase d\'incubation',
      message: `Heure ${Math.floor(hours)} — Le mycelium se developpe. Tu devrais voir des taches blanches apparaitre. Maintiens 30-32°C.`,
      category: 'fermentation'
    });

    if (temp > 38) {
      tips.push({
        id: 'koji-temp-high-incub',
        priority: 'high',
        icon: '🔥',
        title: 'Attention surchauffe !',
        message: `${temp.toFixed(1)}°C — Le koji genere sa propre chaleur ! Au-dessus de 40°C, les enzymes sont detruites. Aere ou remue le substrat.`,
        category: 'temperature'
      });
    }
  } else if (hours < 48) {
    tips.push({
      id: 'koji-phase-sporulation',
      priority: 'medium',
      icon: '🍚',
      title: 'Phase de sporulation',
      message: `Heure ${Math.floor(hours)} — Le koji est bien developpe. Baisse la temperature a 28-30°C pour ralentir et favoriser la production d'enzymes.`,
      category: 'fermentation'
    });

    if (temp > 35) {
      tips.push({
        id: 'koji-temp-high-spor',
        priority: 'high',
        icon: '⚠️',
        title: 'Temperature elevee',
        message: `${temp.toFixed(1)}°C — En phase de sporulation, vise 28-30°C. Trop chaud = sporulation verte (non souhaitee pour le koji blanc).`,
        category: 'temperature'
      });
    }
  } else {
    tips.push({
      id: 'koji-phase-done',
      priority: 'high',
      icon: '✅',
      title: 'Koji potentiellement pret',
      message: `Heure ${Math.floor(hours)} (${Math.floor(hours / 24)} jours) — Le koji devrait etre couvert de mycelium blanc. S'il est vert/jaune, il a trop sporule.`,
      category: 'fermentation'
    });
  }

  // Humidite
  if (humidity !== undefined && humidity !== null) {
    if (humidity < 75) {
      tips.push({
        id: 'koji-humidity-low',
        priority: 'high',
        icon: '💧',
        title: 'Humidite trop basse',
        message: `${humidity.toFixed(0)}% — Le koji a besoin de 80-90% d'humidite. Vaporise de l'eau ou ajoute un tissu humide.`,
        category: 'humidity'
      });
    } else if (humidity > 95) {
      tips.push({
        id: 'koji-humidity-high',
        priority: 'medium',
        icon: '💦',
        title: 'Humidite tres elevee',
        message: `${humidity.toFixed(0)}% — Au-dessus de 95%, risque de contamination bacterienne. Aere legerement.`,
        category: 'humidity'
      });
    } else if (humidity >= 80 && humidity <= 90) {
      tips.push({
        id: 'koji-humidity-ok',
        priority: 'low',
        icon: '✅',
        title: 'Humidite ideale',
        message: `${humidity.toFixed(0)}% — Dans la plage ideale (80-90%). Parfait !`,
        category: 'humidity'
      });
    }
  }

  return tips;
}

// ==========================================
// Regles pour les Champignons
// ==========================================
function generateMushroomTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const days = getDaysSinceCreation(project);
  const temp = project.currentTemperature;
  const humidity = project.currentHumidity;

  if (days < 14) {
    tips.push({
      id: 'mushroom-phase-colonization',
      priority: 'medium',
      icon: '🕸️',
      title: 'Phase de colonisation',
      message: `Jour ${Math.floor(days)} — Le mycelium colonise le substrat. Maintiens 22-25°C, humidite 85-95%. Evite d'ouvrir le sac/bac.`,
      category: 'fermentation'
    });

    if (temp > 28) {
      tips.push({
        id: 'mushroom-temp-high-col',
        priority: 'high',
        icon: '🔥',
        title: 'Trop chaud pour la colonisation',
        message: `${temp.toFixed(1)}°C — Vise 22-25°C. Trop chaud favorise les contaminations.`,
        category: 'temperature'
      });
    }
  } else {
    tips.push({
      id: 'mushroom-phase-fruiting',
      priority: 'medium',
      icon: '🍄',
      title: 'Phase de fructification',
      message: `Jour ${Math.floor(days)} — Si le substrat est entierement colonise, ouvre les trous d'aeration. Vise 18-22°C et 85-95% d'humidite. Assure un bon echange d'air frais (FAE).`,
      category: 'fermentation'
    });

    if (temp > 24) {
      tips.push({
        id: 'mushroom-temp-high-fruit',
        priority: 'medium',
        icon: '⚠️',
        title: 'Temperature elevee pour la fructification',
        message: `${temp.toFixed(1)}°C — Les champignons fructifient mieux a 18-22°C. Reduis la temperature si possible.`,
        category: 'temperature'
      });
    }
  }

  // Humidite
  if (humidity !== undefined && humidity !== null) {
    if (humidity < 80) {
      tips.push({
        id: 'mushroom-humidity-low',
        priority: 'high',
        icon: '💧',
        title: 'Humidite trop basse',
        message: `${humidity.toFixed(0)}% — Les champignons ont besoin de 85-95% d'humidite. Les primordia ne se formeront pas en dessous de 80%.`,
        category: 'humidity'
      });
    } else if (humidity >= 85 && humidity <= 95) {
      tips.push({
        id: 'mushroom-humidity-ok',
        priority: 'low',
        icon: '✅',
        title: 'Humidite ideale',
        message: `${humidity.toFixed(0)}% — Parfait pour les champignons (85-95%).`,
        category: 'humidity'
      });
    }
  }

  return tips;
}

// ==========================================
// Regles pour le Kombucha
// ==========================================
function generateKombuchaTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const days = getDaysSinceCreation(project);
  const temp = project.currentTemperature;

  if (days < 7) {
    tips.push({
      id: 'kombucha-phase-primary',
      priority: 'medium',
      icon: '🍵',
      title: 'Fermentation primaire',
      message: `Jour ${Math.floor(days)} — Le SCOBY transforme le sucre en acide. Temperature ideale : 24-28°C. Goute a partir de J5 pour trouver le bon equilibre sucre/acide.`,
      category: 'fermentation'
    });
  } else if (days < 14) {
    tips.push({
      id: 'kombucha-phase-tasting',
      priority: 'high',
      icon: '👅',
      title: 'Temps de gouter !',
      message: `Jour ${Math.floor(days)} — Goute ton kombucha ! S'il est assez acide, passe en F2 (2e fermentation en bouteille avec fruits/jus).`,
      category: 'action'
    });
  } else {
    tips.push({
      id: 'kombucha-phase-long',
      priority: 'medium',
      icon: '⏳',
      title: 'Fermentation longue',
      message: `Jour ${Math.floor(days)} — Le kombucha est probablement tres acide. Ideal pour le vinaigre de kombucha ou a couper avec du jus.`,
      category: 'fermentation'
    });
  }

  if (temp < 20) {
    tips.push({
      id: 'kombucha-temp-low',
      priority: 'high',
      icon: '🥶',
      title: 'Temperature basse',
      message: `${temp.toFixed(1)}°C — Le SCOBY ralentit beaucoup en dessous de 20°C. Idealement 24-28°C.`,
      category: 'temperature'
    });
  } else if (temp > 32) {
    tips.push({
      id: 'kombucha-temp-high',
      priority: 'high',
      icon: '🔥',
      title: 'Temperature trop elevee',
      message: `${temp.toFixed(1)}°C — Au-dessus de 32°C, le SCOBY peut etre endommage.`,
      category: 'temperature'
    });
  }

  return tips;
}

// ==========================================
// Regles pour l'Hydromel
// ==========================================
function generateMeadTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const days = getDaysSinceCreation(project);
  const temp = project.currentTemperature;

  if (days < 3) {
    tips.push({
      id: 'mead-phase-start',
      priority: 'medium',
      icon: '🍯',
      title: 'Debut de fermentation',
      message: `Jour ${Math.floor(days)} — La levure s'active. Pense a degaser quotidiennement (ouvrir brievement le couvercle) les 3-5 premiers jours.`,
      category: 'fermentation'
    });
  } else if (days < 14) {
    tips.push({
      id: 'mead-phase-active',
      priority: 'low',
      icon: '💨',
      title: 'Fermentation active',
      message: `Jour ${Math.floor(days)} — Continue le degazage quotidien. L'hydromel fermente plus lentement que la biere, c'est normal.`,
      category: 'fermentation'
    });
  } else if (days < 30) {
    tips.push({
      id: 'mead-phase-secondary',
      priority: 'low',
      icon: '⏳',
      title: 'Fermentation secondaire',
      message: `Jour ${Math.floor(days)} — La fermentation ralentit. Si tu veux ajouter des fruits, c'est le bon moment pour la F2.`,
      category: 'fermentation'
    });
  } else {
    tips.push({
      id: 'mead-phase-aging',
      priority: 'low',
      icon: '🏺',
      title: 'Vieillissement',
      message: `Jour ${Math.floor(days)} — L'hydromel s'ameliore avec le temps. Idealement 3-6 mois de maturation minimum.`,
      category: 'fermentation'
    });
  }

  if (temp < 15 || temp > 25) {
    tips.push({
      id: 'mead-temp-warning',
      priority: temp < 12 || temp > 28 ? 'high' : 'medium',
      icon: temp < 15 ? '🥶' : '🔥',
      title: temp < 15 ? 'Temperature basse' : 'Temperature elevee',
      message: `${temp.toFixed(1)}°C — Idealement 18-22°C pour l'hydromel. ${temp < 15 ? 'Fermentation tres lente.' : 'Risque de faux-gouts.'}`,
      category: 'temperature'
    });
  }

  return tips;
}

// ==========================================
// Regles pour le Fromage
// ==========================================
function generateCheeseTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const days = getDaysSinceCreation(project);
  const temp = project.currentTemperature;

  tips.push({
    id: 'cheese-phase',
    priority: 'low',
    icon: '🧀',
    title: 'Affinage',
    message: `Jour ${Math.floor(days)} — Temperature ideale d'affinage : 10-14°C selon le type de fromage. Humidite : 80-90%.`,
    category: 'fermentation'
  });

  if (temp > 18) {
    tips.push({
      id: 'cheese-temp-high',
      priority: 'high',
      icon: '🔥',
      title: 'Temperature trop elevee',
      message: `${temp.toFixed(1)}°C — L'affinage se fait idealement entre 10-14°C. Trop chaud peut causer des defauts de texture.`,
      category: 'temperature'
    });
  }

  return tips;
}

// ==========================================
// Regles pour le Levain
// ==========================================
function generateSourdoughTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  const hours = getHoursSinceCreation(project);
  const temp = project.currentTemperature;

  if (hours < 6) {
    tips.push({
      id: 'sourdough-phase-young',
      priority: 'medium',
      icon: '🍞',
      title: 'Levain jeune',
      message: `Heure ${Math.floor(hours)} — Le levain commence a fermenter. Pic d'activite entre 4-8h selon la temperature.`,
      category: 'fermentation'
    });
  } else if (hours < 12) {
    tips.push({
      id: 'sourdough-phase-peak',
      priority: 'high',
      icon: '🔝',
      title: 'Pic d\'activite',
      message: `Heure ${Math.floor(hours)} — Le levain devrait avoir double/triple de volume. C'est le moment ideal pour l'utiliser si tu panifies !`,
      category: 'fermentation'
    });
  } else {
    tips.push({
      id: 'sourdough-phase-over',
      priority: 'medium',
      icon: '📉',
      title: 'Levain passe le pic',
      message: `Heure ${Math.floor(hours)} — Le levain a probablement depasse son pic. Rafraichis-le (nourris-le) pour le relancer.`,
      category: 'fermentation'
    });
  }

  if (temp < 22) {
    tips.push({
      id: 'sourdough-temp-low',
      priority: 'medium',
      icon: '🥶',
      title: 'Temperature fraiche',
      message: `${temp.toFixed(1)}°C — A cette temperature, le levain sera plus lent mais developpera plus d'acidite (gout plus acide).`,
      category: 'temperature'
    });
  } else if (temp > 30) {
    tips.push({
      id: 'sourdough-temp-high',
      priority: 'medium',
      icon: '🔥',
      title: 'Temperature chaude',
      message: `${temp.toFixed(1)}°C — Fermentation rapide mais moins de saveur complexe. Idealement 24-28°C.`,
      category: 'temperature'
    });
  }

  return tips;
}

// ==========================================
// Regles generales (tous types)
// ==========================================
function generateGeneralTips(project: Project): AssistantTip[] {
  const tips: AssistantTip[] = [];
  if (project.currentTemperature == null || project.targetTemperature == null) return tips;
  const diff = project.currentTemperature - project.targetTemperature;

  // Ecart temperature
  if (Math.abs(diff) > 3) {
    tips.push({
      id: 'general-temp-far',
      priority: 'high',
      icon: diff > 0 ? '🔥' : '🥶',
      title: `Temperature ${diff > 0 ? 'trop haute' : 'trop basse'}`,
      message: `${project.currentTemperature.toFixed(1)}°C vs cible ${project.targetTemperature}°C (ecart de ${diff > 0 ? '+' : ''}${diff.toFixed(1)}°C)`,
      category: 'temperature'
    });
  } else if (Math.abs(diff) > 1) {
    tips.push({
      id: 'general-temp-drift',
      priority: 'medium',
      icon: '📊',
      title: 'Ecart de temperature',
      message: `${project.currentTemperature.toFixed(1)}°C vs cible ${project.targetTemperature}°C (${diff > 0 ? '+' : ''}${diff.toFixed(1)}°C)`,
      category: 'temperature'
    });
  }

  // Mode de controle
  if (project.controlMode === 'manual' && !project.outletActive) {
    tips.push({
      id: 'general-manual-off',
      priority: 'low',
      icon: '✋',
      title: 'Mode manuel',
      message: `Le chauffage est en mode manuel et desactive. Pense a passer en mode automatique pour un controle continu.`,
      category: 'action'
    });
  }

  return tips;
}

// ==========================================
// Fonction principale
// ==========================================
export function generateTips(project: Project): AssistantTip[] {
  let tips: AssistantTip[] = [];

  try {
  // Regles specifiques au type
  switch (project.fermentationType) {
    case 'beer':
      tips = generateBeerTips(project);
      break;
    case 'koji':
      tips = generateKojiTips(project);
      break;
    case 'mushroom':
      tips = generateMushroomTips(project);
      break;
    case 'kombucha':
      tips = generateKombuchaTips(project);
      break;
    case 'mead':
      tips = generateMeadTips(project);
      break;
    case 'cheese':
      tips = generateCheeseTips(project);
      break;
    case 'sourdough':
      tips = generateSourdoughTips(project);
      break;
  }

  // Regles generales
  tips = tips.concat(generateGeneralTips(project));

  // Tri par priorite
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  } catch (e) {
    console.error('Assistant: erreur lors de la generation des conseils', e);
  }

  return tips;
}
