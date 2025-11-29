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
}

export const influxService = new InfluxService();
