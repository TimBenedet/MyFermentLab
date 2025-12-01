import { influxService } from './influx.service.js';

export interface ProjectStats {
  duration: {
    days: number;
    hours: number;
    minutes: number;
    totalMs: number;
  };
  temperature: {
    average: number;
    min: number;
    max: number;
    stdDeviation: number;
  };
  density?: {
    initial: number;
    final: number;
    abv: number;
  };
  heatingHours: number;
  dataPoints: number;
}

class StatsService {
  /**
   * Calcule les statistiques complètes d'un projet terminé
   */
  async calculateProjectStats(
    projectId: string,
    createdAt: number,
    completedAt: number,
    temperatureHistory: Array<{ timestamp: number; temperature: number }>,
    densityHistory?: Array<{ timestamp: number; density: number }>
  ): Promise<ProjectStats> {
    // Calculer la durée
    const durationMs = completedAt - createdAt;
    const durationMinutes = Math.floor(durationMs / 60000);
    const days = Math.floor(durationMinutes / 1440);
    const hours = Math.floor((durationMinutes % 1440) / 60);
    const minutes = durationMinutes % 60;

    // Calculer les stats de température
    const temperatures = temperatureHistory.map(t => t.temperature);
    const tempStats = this.calculateTemperatureStats(temperatures);

    // Calculer les stats de densité (si applicable)
    let densityStats: ProjectStats['density'] | undefined;
    if (densityHistory && densityHistory.length >= 2) {
      const sortedDensity = [...densityHistory].sort((a, b) => a.timestamp - b.timestamp);
      const initial = sortedDensity[0].density;
      const final = sortedDensity[sortedDensity.length - 1].density;
      const abv = this.calculateABV(initial, final);

      densityStats = { initial, final, abv };
    }

    // Estimer les heures de chauffage (simplifié)
    // TODO: Améliorer en récupérant l'historique réel du state de la prise depuis InfluxDB
    const heatingHours = await this.estimateHeatingHours(projectId, createdAt, completedAt);

    return {
      duration: {
        days,
        hours,
        minutes,
        totalMs: durationMs
      },
      temperature: tempStats,
      density: densityStats,
      heatingHours,
      dataPoints: temperatureHistory.length
    };
  }

  /**
   * Calcule les statistiques de température
   */
  private calculateTemperatureStats(temperatures: number[]): ProjectStats['temperature'] {
    if (temperatures.length === 0) {
      return { average: 0, min: 0, max: 0, stdDeviation: 0 };
    }

    const sum = temperatures.reduce((acc, t) => acc + t, 0);
    const average = sum / temperatures.length;
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);

    // Calculer l'écart-type
    const variance = temperatures.reduce((acc, t) => acc + Math.pow(t - average, 2), 0) / temperatures.length;
    const stdDeviation = Math.sqrt(variance);

    return {
      average: Math.round(average * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      stdDeviation: Math.round(stdDeviation * 10) / 10
    };
  }

  /**
   * Calcule l'ABV (Alcohol By Volume)
   */
  private calculateABV(og: number, fg: number): number {
    // Formule standard: ABV = (OG - FG) × 131.25
    const abv = (og - fg) * 131.25;
    return Math.round(abv * 100) / 100;
  }

  /**
   * Estime les heures de chauffage
   * TODO: Améliorer en récupérant l'historique réel du state de la prise
   */
  private async estimateHeatingHours(projectId: string, startTime: number, endTime: number): Promise<number> {
    // Pour l'instant, on retourne 0
    // À améliorer : récupérer l'historique des états ON/OFF de la prise depuis InfluxDB
    return 0;
  }

  /**
   * Formate une durée en texte lisible
   */
  formatDuration(stats: ProjectStats['duration']): string {
    const parts: string[] = [];

    if (stats.days > 0) {
      parts.push(`${stats.days}j`);
    }
    if (stats.hours > 0) {
      parts.push(`${stats.hours}h`);
    }
    if (stats.minutes > 0 || parts.length === 0) {
      parts.push(`${stats.minutes}min`);
    }

    return parts.join(' ');
  }
}

export const statsService = new StatsService();
