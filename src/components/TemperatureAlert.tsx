import { useMemo } from 'react';
import { Project, FERMENTATION_TYPES } from '../types';
import './TemperatureAlert.css';

interface TemperatureAlertProps {
  project: Project;
  onDismiss?: () => void;
}

type AlertLevel = 'ok' | 'warning' | 'danger';

interface AlertInfo {
  level: AlertLevel;
  title: string;
  message: string;
  icon: string;
}

export function TemperatureAlert({ project, onDismiss }: TemperatureAlertProps) {
  const alert = useMemo<AlertInfo | null>(() => {
    const config = FERMENTATION_TYPES[project.fermentationType];
    const current = project.currentTemperature;
    const target = project.targetTemperature;

    // Vérifier si on a des infos de levure avec plage de température
    const yeast = project.recipe?.yeasts?.[0];
    const yeastMin = yeast?.tempMin;
    const yeastMax = yeast?.tempMax;

    // Priorité 1: Température hors plage de la levure (si définie)
    if (yeastMin !== undefined && yeastMax !== undefined) {
      if (current < yeastMin - 2) {
        return {
          level: 'danger',
          title: 'Température critique',
          message: `La température (${current.toFixed(1)}°C) est bien en dessous de la plage de la levure (${yeastMin}-${yeastMax}°C). La fermentation peut être bloquée.`,
          icon: '❄️'
        };
      }
      if (current > yeastMax + 2) {
        return {
          level: 'danger',
          title: 'Température critique',
          message: `La température (${current.toFixed(1)}°C) est bien au-dessus de la plage de la levure (${yeastMin}-${yeastMax}°C). Risque de faux-goûts ou stress de la levure.`,
          icon: '🔥'
        };
      }
      if (current < yeastMin) {
        return {
          level: 'warning',
          title: 'Température basse',
          message: `La température (${current.toFixed(1)}°C) est en dessous de la plage optimale de la levure (${yeastMin}-${yeastMax}°C).`,
          icon: '⚠️'
        };
      }
      if (current > yeastMax) {
        return {
          level: 'warning',
          title: 'Température élevée',
          message: `La température (${current.toFixed(1)}°C) est au-dessus de la plage optimale de la levure (${yeastMin}-${yeastMax}°C).`,
          icon: '⚠️'
        };
      }
    }

    // Priorité 2: Écart important par rapport à la cible
    const diff = Math.abs(current - target);
    if (diff > 5) {
      return {
        level: 'danger',
        title: 'Écart de température important',
        message: `La température actuelle (${current.toFixed(1)}°C) est à ${diff.toFixed(1)}°C de la cible (${target}°C).`,
        icon: current > target ? '🔥' : '❄️'
      };
    }
    if (diff > 2) {
      return {
        level: 'warning',
        title: 'Température en dehors de la cible',
        message: `La température actuelle (${current.toFixed(1)}°C) s'éloigne de la cible (${target}°C).`,
        icon: '⚠️'
      };
    }

    // Priorité 3: Température hors plage du type de fermentation
    if (current < config.minTemp - 3 || current > config.maxTemp + 3) {
      return {
        level: 'danger',
        title: 'Température hors limites',
        message: `La température (${current.toFixed(1)}°C) est hors de la plage recommandée pour ${config.name} (${config.minTemp}-${config.maxTemp}°C).`,
        icon: current > config.maxTemp ? '🔥' : '❄️'
      };
    }

    return null;
  }, [project]);

  if (!alert) return null;

  return (
    <div className={`temperature-alert alert-${alert.level}`}>
      <div className="alert-icon">{alert.icon}</div>
      <div className="alert-content">
        <div className="alert-title">{alert.title}</div>
        <div className="alert-message">{alert.message}</div>
      </div>
      {onDismiss && (
        <button className="alert-dismiss" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}

// Hook pour vérifier les alertes sans afficher le composant
export function useTemperatureAlerts(project: Project | null): AlertInfo | null {
  return useMemo(() => {
    if (!project) return null;

    const current = project.currentTemperature;
    const target = project.targetTemperature;

    const yeast = project.recipe?.yeasts?.[0];
    const yeastMin = yeast?.tempMin;
    const yeastMax = yeast?.tempMax;

    if (yeastMin !== undefined && yeastMax !== undefined) {
      if (current < yeastMin - 2 || current > yeastMax + 2) {
        return {
          level: 'danger' as AlertLevel,
          title: 'Température critique',
          message: `Température hors plage de la levure`,
          icon: current > yeastMax ? '🔥' : '❄️'
        };
      }
      if (current < yeastMin || current > yeastMax) {
        return {
          level: 'warning' as AlertLevel,
          title: 'Température limite',
          message: `Proche des limites de la levure`,
          icon: '⚠️'
        };
      }
    }

    const diff = Math.abs(current - target);
    if (diff > 5) {
      return {
        level: 'danger' as AlertLevel,
        title: 'Écart important',
        message: `${diff.toFixed(1)}°C de la cible`,
        icon: current > target ? '🔥' : '❄️'
      };
    }
    if (diff > 2) {
      return {
        level: 'warning' as AlertLevel,
        title: 'Écart température',
        message: `${diff.toFixed(1)}°C de la cible`,
        icon: '⚠️'
      };
    }

    return null;
  }, [project]);
}
