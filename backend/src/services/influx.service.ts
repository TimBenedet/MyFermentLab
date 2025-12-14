import { InfluxDB, Point } from '@influxdata/influxdb-client';

const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'my-super-secret-auth-token';
const INFLUX_ORG = process.env.INFLUX_ORG || 'fermentation';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'sensors';

export class InfluxService {
  private influxDB: InfluxDB;
  private writeApi;
  private queryApi;

  constructor() {
    this.influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    this.writeApi = this.influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns');
    this.queryApi = this.influxDB.getQueryApi(INFLUX_ORG);
  }

  async writeTemperature(projectId: string, temperature: number, timestamp?: number) {
    const point = new Point('temperature')
      .tag('project_id', projectId)
      .floatField('value', temperature);

    if (timestamp) {
      point.timestamp(timestamp * 1000000); // Convert ms to ns
    }

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }

  async writeDensity(projectId: string, density: number, timestamp?: number) {
    const point = new Point('density')
      .tag('project_id', projectId)
      .floatField('value', density);

    if (timestamp) {
      point.timestamp(timestamp * 1000000); // Convert ms to ns
    }

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }

  async writeHumidity(projectId: string, humidity: number, timestamp?: number) {
    const point = new Point('humidity')
      .tag('project_id', projectId)
      .floatField('value', humidity);

    if (timestamp) {
      point.timestamp(timestamp * 1000000); // Convert ms to ns
    }

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }

  async writeOutletState(projectId: string, state: boolean, source: 'manual' | 'automatic', temperature?: number, timestamp?: number) {
    const point = new Point('outlet_state')
      .tag('project_id', projectId)
      .tag('source', source)
      .booleanField('state', state);

    // Ajouter la température si fournie
    if (temperature !== undefined) {
      point.floatField('temperature', temperature);
    }

    if (timestamp) {
      point.timestamp(timestamp * 1000000); // Convert ms to ns
    }

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }

  async getTemperatureHistory(projectId: string, start: string = '-30d'): Promise<Array<{ timestamp: number; temperature: number }>> {
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start})
        |> filter(fn: (r) => r._measurement == "temperature")
        |> filter(fn: (r) => r.project_id == "${projectId}")
        |> filter(fn: (r) => r._field == "value")
        |> sort(columns: ["_time"])
    `;

    const result: Array<{ timestamp: number; temperature: number }> = [];

    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const obj = tableMeta.toObject(row);
          result.push({
            timestamp: new Date(obj._time).getTime(),
            temperature: obj._value
          });
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(result);
        }
      });
    });
  }

  async getDensityHistory(projectId: string, start: string = '-30d'): Promise<Array<{ timestamp: number; density: number }>> {
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start})
        |> filter(fn: (r) => r._measurement == "density")
        |> filter(fn: (r) => r.project_id == "${projectId}")
        |> filter(fn: (r) => r._field == "value")
        |> sort(columns: ["_time"])
    `;

    const result: Array<{ timestamp: number; density: number }> = [];

    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const obj = tableMeta.toObject(row);
          result.push({
            timestamp: new Date(obj._time).getTime(),
            density: obj._value
          });
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(result);
        }
      });
    });
  }

  async getHumidityHistory(projectId: string, start: string = '-30d'): Promise<Array<{ timestamp: number; humidity: number }>> {
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start})
        |> filter(fn: (r) => r._measurement == "humidity")
        |> filter(fn: (r) => r.project_id == "${projectId}")
        |> filter(fn: (r) => r._field == "value")
        |> sort(columns: ["_time"])
    `;

    const result: Array<{ timestamp: number; humidity: number }> = [];

    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const obj = tableMeta.toObject(row);
          result.push({
            timestamp: new Date(obj._time).getTime(),
            humidity: obj._value
          });
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(result);
        }
      });
    });
  }

  async getOutletHistory(projectId: string, start: string = '-30d'): Promise<Array<{ timestamp: number; state: boolean; source: string; temperature?: number }>> {
    // Requête pour récupérer les états et les températures avec pivot
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: ${start})
        |> filter(fn: (r) => r._measurement == "outlet_state")
        |> filter(fn: (r) => r.project_id == "${projectId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"])
    `;

    const result: Array<{ timestamp: number; state: boolean; source: string; temperature?: number }> = [];

    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const obj = tableMeta.toObject(row);
          const entry: { timestamp: number; state: boolean; source: string; temperature?: number } = {
            timestamp: new Date(obj._time).getTime(),
            state: obj.state,
            source: obj.source || 'unknown'
          };
          // Ajouter la température si présente
          if (obj.temperature !== undefined && obj.temperature !== null) {
            entry.temperature = obj.temperature;
          }
          result.push(entry);
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(result);
        }
      });
    });
  }

  async getLatestTemperature(projectId: string): Promise<number | null> {
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "temperature")
        |> filter(fn: (r) => r.project_id == "${projectId}")
        |> filter(fn: (r) => r._field == "value")
        |> last()
    `;

    return new Promise((resolve, reject) => {
      let latestValue: number | null = null;

      this.queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          const obj = tableMeta.toObject(row);
          latestValue = obj._value;
        },
        error: (error) => {
          console.error('InfluxDB query error:', error);
          reject(error);
        },
        complete: () => {
          resolve(latestValue);
        }
      });
    });
  }

  async close() {
    await this.writeApi.close();
  }

  // Génère des données simulées pour les projets de test
  async generateTestData(projectId: string, targetTemp: number = 18) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Générer des données de température toutes les 30 minutes sur 7 jours
    const tempPoints: Point[] = [];
    for (let t = sevenDaysAgo; t <= now; t += 30 * 60 * 1000) {
      // Température qui oscille autour de la cible avec du bruit
      const noise = (Math.random() - 0.5) * 2; // ±1°C de bruit
      const oscillation = Math.sin((t - sevenDaysAgo) / (12 * 60 * 60 * 1000) * Math.PI) * 0.5; // oscillation journalière
      const temp = targetTemp + noise + oscillation;

      const point = new Point('temperature')
        .tag('project_id', projectId)
        .floatField('value', Math.round(temp * 10) / 10)
        .timestamp(t * 1000000); // Convert ms to ns

      tempPoints.push(point);
    }

    // Générer des données de densité (fermentation sur 7 jours)
    // OG: 1.052 -> FG: 1.010 (décroissance exponentielle)
    const og = 1.052;
    const fg = 1.010;
    const densityPoints: Point[] = [];
    const densityMeasurements = [0, 1, 2, 3, 5, 7]; // Jours de mesure

    for (const day of densityMeasurements) {
      const t = sevenDaysAgo + day * 24 * 60 * 60 * 1000;
      // Décroissance exponentielle
      const progress = 1 - Math.exp(-day * 0.5);
      const density = og - (og - fg) * progress;

      const point = new Point('density')
        .tag('project_id', projectId)
        .floatField('value', Math.round(density * 1000) / 1000)
        .timestamp(t * 1000000);

      densityPoints.push(point);
    }

    // Écrire tous les points
    for (const point of [...tempPoints, ...densityPoints]) {
      this.writeApi.writePoint(point);
    }
    await this.writeApi.flush();

    console.log(`Generated test data for project ${projectId}: ${tempPoints.length} temperature points, ${densityPoints.length} density points`);
  }

  // Génère des données simulées pour les projets de champignons de test
  async generateMushroomTestData(projectId: string, targetTemp: number = 22, targetHumidity: number = 85) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Générer des données de température toutes les 30 minutes sur 7 jours
    const tempPoints: Point[] = [];
    for (let t = sevenDaysAgo; t <= now; t += 30 * 60 * 1000) {
      // Température qui oscille autour de la cible avec du bruit
      const noise = (Math.random() - 0.5) * 1.5; // ±0.75°C de bruit
      const oscillation = Math.sin((t - sevenDaysAgo) / (12 * 60 * 60 * 1000) * Math.PI) * 0.3;
      const temp = targetTemp + noise + oscillation;

      const point = new Point('temperature')
        .tag('project_id', projectId)
        .floatField('value', Math.round(temp * 10) / 10)
        .timestamp(t * 1000000);

      tempPoints.push(point);
    }

    // Générer des données d'humidité toutes les 30 minutes sur 7 jours
    const humidityPoints: Point[] = [];
    for (let t = sevenDaysAgo; t <= now; t += 30 * 60 * 1000) {
      // Humidité qui oscille autour de la cible avec du bruit
      const noise = (Math.random() - 0.5) * 8; // ±4% de bruit
      const oscillation = Math.sin((t - sevenDaysAgo) / (6 * 60 * 60 * 1000) * Math.PI) * 3; // oscillation plus rapide
      let humidity = targetHumidity + noise + oscillation;
      // Limiter entre 0 et 100
      humidity = Math.max(0, Math.min(100, humidity));

      const point = new Point('humidity')
        .tag('project_id', projectId)
        .floatField('value', Math.round(humidity * 10) / 10)
        .timestamp(t * 1000000);

      humidityPoints.push(point);
    }

    // Écrire tous les points
    for (const point of [...tempPoints, ...humidityPoints]) {
      this.writeApi.writePoint(point);
    }
    await this.writeApi.flush();

    console.log(`Generated mushroom test data for project ${projectId}: ${tempPoints.length} temperature points, ${humidityPoints.length} humidity points`);
  }
}

export const influxService = new InfluxService();
