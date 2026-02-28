import type { BrewProject, Fermenter } from '../types/brewing'

export interface AssistantTip {
  id: string
  title: string
  message: string
  icon: string
  priority: 'high' | 'medium' | 'low'
  category: 'recipe' | 'temperature' | 'humidity' | 'fermentation' | 'action'
}

// === Beer tips ===
function generateBeerTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  const tips: AssistantTip[] = []
  const temp = fermenter?.temperature
  const setpoint = fermenter?.setpoint

  // Temperature deviation
  if (temp !== undefined && setpoint !== undefined) {
    const diff = Math.abs(temp - setpoint)
    if (diff > 3) {
      tips.push({
        id: 'beer-temp-critical',
        title: 'Ecart de temperature critique',
        message: `La temperature actuelle (${temp.toFixed(1)}°C) est a ${diff.toFixed(1)}°C de la cible (${setpoint.toFixed(1)}°C). Verifiez le systeme de chauffage.`,
        icon: '🚨',
        priority: 'high',
        category: 'temperature',
      })
    } else if (diff > 1.5) {
      tips.push({
        id: 'beer-temp-warning',
        title: 'Ecart de temperature',
        message: `Temperature a ${diff.toFixed(1)}°C de la cible. Surveillez l'evolution.`,
        icon: '⚠️',
        priority: 'medium',
        category: 'temperature',
      })
    } else if (diff < 0.5) {
      tips.push({
        id: 'beer-temp-ok',
        title: 'Temperature stable',
        message: `Temperature bien controlee a ${temp.toFixed(1)}°C (cible: ${setpoint.toFixed(1)}°C).`,
        icon: '✅',
        priority: 'low',
        category: 'temperature',
      })
    }
  }

  // Fermentation progress
  if (project.og > 0 && project.fg > 0) {
    const progressPct = project.og !== project.fg
      ? ((project.og - project.currentGravity) / (project.og - project.fg)) * 100
      : 0

    if (progressPct >= 95) {
      tips.push({
        id: 'beer-ferment-done',
        title: 'Fermentation quasi terminee',
        message: `Attenuation a ${progressPct.toFixed(0)}%. Prenez une mesure de densite pour confirmer la fin de fermentation.`,
        icon: '🎯',
        priority: 'medium',
        category: 'fermentation',
      })
    } else if (progressPct >= 70) {
      tips.push({
        id: 'beer-ferment-advanced',
        title: 'Fermentation avancee',
        message: `Attenuation a ${progressPct.toFixed(0)}%. La fermentation progresse bien.`,
        icon: '📊',
        priority: 'low',
        category: 'fermentation',
      })
    } else if (progressPct < 10 && project.fermentationStartedAt) {
      const daysSinceStart = Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)
      if (daysSinceStart > 2) {
        tips.push({
          id: 'beer-ferment-slow',
          title: 'Fermentation lente',
          message: `Attenuation a seulement ${progressPct.toFixed(0)}% apres ${daysSinceStart} jours. Verifiez la levure et la temperature.`,
          icon: '🐌',
          priority: 'high',
          category: 'fermentation',
        })
      }
    }
  }

  // Phase-based tips
  if (project.fermentationStartedAt) {
    const daysSinceStart = Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)

    if (daysSinceStart <= 1) {
      tips.push({
        id: 'beer-phase-lag',
        title: 'Phase de latence',
        message: 'La levure s\'adapte a son environnement. Evitez d\'ouvrir le fermenteur.',
        icon: '⏳',
        priority: 'low',
        category: 'fermentation',
      })
    } else if (daysSinceStart <= 4) {
      tips.push({
        id: 'beer-phase-active',
        title: 'Fermentation active',
        message: 'La fermentation primaire est en cours. Maintenez la temperature stable.',
        icon: '🫧',
        priority: 'low',
        category: 'fermentation',
      })
    } else if (daysSinceStart >= 14) {
      tips.push({
        id: 'beer-phase-long',
        title: 'Fermentation longue',
        message: `${daysSinceStart} jours de fermentation. Verifiez la densite pour savoir si vous pouvez embouteiller.`,
        icon: '📅',
        priority: 'medium',
        category: 'action',
      })
    }
  }

  // Gravity reading reminder
  if (project.gravityHistory.length === 0 && project.fermentationStartedAt) {
    const daysSinceStart = Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)
    if (daysSinceStart >= 3) {
      tips.push({
        id: 'beer-gravity-needed',
        title: 'Mesure de densite recommandee',
        message: 'Aucune mesure de densite enregistree. Prenez une mesure pour suivre l\'avancement.',
        icon: '📏',
        priority: 'medium',
        category: 'action',
      })
    }
  }

  // Recipe completeness
  if (project.ingredients.length === 0) {
    tips.push({
      id: 'beer-no-ingredients',
      title: 'Recette incomplete',
      message: 'Aucun ingredient renseigne. Ajoutez vos ingredients pour un suivi complet.',
      icon: '📝',
      priority: 'low',
      category: 'recipe',
    })
  }

  return tips
}

// === Koji tips ===
function generateKojiTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  const tips: AssistantTip[] = []
  const temp = fermenter?.temperature
  const humidity = fermenter?.humidity

  // Temperature for koji (typically 28-35°C)
  if (temp !== undefined) {
    if (temp > 42) {
      tips.push({
        id: 'koji-temp-critical-high',
        title: 'Temperature trop elevee !',
        message: `${temp.toFixed(1)}°C depasse le seuil critique pour le koji (42°C). Risque de mort du mycellium.`,
        icon: '🔥',
        priority: 'high',
        category: 'temperature',
      })
    } else if (temp > 38) {
      tips.push({
        id: 'koji-temp-high',
        title: 'Temperature elevee',
        message: `${temp.toFixed(1)}°C est au-dessus de la plage ideale. Aerer pour refroidir.`,
        icon: '⚠️',
        priority: 'medium',
        category: 'temperature',
      })
    } else if (temp < 25) {
      tips.push({
        id: 'koji-temp-low',
        title: 'Temperature basse',
        message: `${temp.toFixed(1)}°C est en dessous de la plage ideale pour le koji (28-35°C).`,
        icon: '❄️',
        priority: 'medium',
        category: 'temperature',
      })
    }
  }

  // Humidity for koji (75-85%)
  if (humidity !== undefined) {
    if (humidity < 70) {
      tips.push({
        id: 'koji-humidity-low',
        title: 'Humidite insuffisante',
        message: `Humidite a ${humidity.toFixed(0)}%. Le koji a besoin de 75-85% d'humidite relative.`,
        icon: '💧',
        priority: 'high',
        category: 'humidity',
      })
    } else if (humidity > 90) {
      tips.push({
        id: 'koji-humidity-high',
        title: 'Humidite trop elevee',
        message: `Humidite a ${humidity.toFixed(0)}%. Risque de contamination bacterienne.`,
        icon: '💦',
        priority: 'medium',
        category: 'humidity',
      })
    }
  }

  return tips
}

// === Mushroom tips ===
function generateMushroomTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  const tips: AssistantTip[] = []
  const temp = fermenter?.temperature
  const humidity = fermenter?.humidity

  // Temperature for mushroom (typically 18-24°C)
  if (temp !== undefined) {
    if (temp > 28) {
      tips.push({
        id: 'mushroom-temp-high',
        title: 'Temperature trop elevee',
        message: `${temp.toFixed(1)}°C est trop chaud pour la culture de champignons.`,
        icon: '🔥',
        priority: 'high',
        category: 'temperature',
      })
    } else if (temp < 15) {
      tips.push({
        id: 'mushroom-temp-low',
        title: 'Temperature basse',
        message: `${temp.toFixed(1)}°C ralentit la croissance mycellienne.`,
        icon: '❄️',
        priority: 'medium',
        category: 'temperature',
      })
    }
  }

  // Humidity for mushroom (85-95%)
  if (humidity !== undefined) {
    if (humidity < 80) {
      tips.push({
        id: 'mushroom-humidity-low',
        title: 'Humidite insuffisante',
        message: `Humidite a ${humidity.toFixed(0)}%. Les champignons ont besoin de 85-95%.`,
        icon: '💧',
        priority: 'high',
        category: 'humidity',
      })
    }
  }

  return tips
}

// === Mead tips ===
function generateMeadTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  const tips: AssistantTip[] = []
  const temp = fermenter?.temperature

  if (temp !== undefined) {
    if (temp > 24) {
      tips.push({
        id: 'mead-temp-high',
        title: 'Temperature elevee pour l\'hydromel',
        message: `${temp.toFixed(1)}°C peut produire des aromes indesirables. Idealement 15-20°C.`,
        icon: '⚠️',
        priority: 'medium',
        category: 'temperature',
      })
    }
  }

  // Mead fermentation is typically longer
  if (project.fermentationStartedAt) {
    const daysSinceStart = Math.floor((Date.now() - project.fermentationStartedAt) / 86400000)
    if (daysSinceStart >= 21 && daysSinceStart <= 30) {
      tips.push({
        id: 'mead-check-gravity',
        title: 'Verifiez la densite',
        message: 'L\'hydromel fermente lentement. Prenez une mesure pour verifier l\'avancement.',
        icon: '📏',
        priority: 'medium',
        category: 'action',
      })
    }
  }

  return tips
}

// === General tips ===
function generateGeneralTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  const tips: AssistantTip[] = []

  // Relay status
  if (fermenter?.relayOn) {
    tips.push({
      id: 'general-heating-on',
      title: 'Chauffage actif',
      message: 'Le tapis chauffant est actuellement allume.',
      icon: '🔌',
      priority: 'low',
      category: 'temperature',
    })
  }

  // Steps reminder
  const pendingSteps = project.steps.filter(s => !s.done)
  if (pendingSteps.length > 0) {
    const nextStep = pendingSteps[0]
    tips.push({
      id: 'general-next-step',
      title: 'Prochaine etape',
      message: `${nextStep.description} (Jour ${nextStep.day})`,
      icon: '📋',
      priority: 'low',
      category: 'action',
    })
  }

  return tips
}

// === Main function ===
export function generateTips(project: BrewProject, fermenter?: Fermenter): AssistantTip[] {
  let tips: AssistantTip[] = []

  try {
    switch (project.projectType) {
      case 'beer':
        tips = generateBeerTips(project, fermenter)
        break
      case 'koji':
        tips = generateKojiTips(project, fermenter)
        break
      case 'mushroom':
        tips = generateMushroomTips(project, fermenter)
        break
      case 'mead':
        tips = generateMeadTips(project, fermenter)
        break
    }

    tips = tips.concat(generateGeneralTips(project, fermenter))

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  } catch (e) {
    console.error('[Assistant] Error generating tips:', e)
  }

  return tips
}
