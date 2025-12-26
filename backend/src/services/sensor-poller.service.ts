import { databaseService } from './database.service.js';
import { influxService } from './influx.service.js';

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000'); // 30s par défaut

interface HomeAssistantState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

class SensorPollerService {
  private interval: NodeJS.Timeout | null = null;

  async start() {
    console.log('[SensorPoller] Starting sensor polling service...');
    console.log(`[SensorPoller] Poll interval: ${POLL_INTERVAL}ms`);
    console.log(`[SensorPoller] Home Assistant URL: ${HOME_ASSISTANT_URL}`);

    // Premier poll immédiatement
    await this.pollSensors();

    // Puis continuer à intervalle régulier
    this.interval = setInterval(async () => {
      await this.pollSensors();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[SensorPoller] Stopped');
    }
  }

  private async pollSensors() {
    try {
      const projects = databaseService.getAllProjects();
      console.log(`[SensorPoller] Polling ${projects.length} projects...`);

      for (const project of projects) {
        const device = databaseService.getDevice(project.sensorId);
        console.log(`[SensorPoller] Project: ${project.name}, sensorId: ${project.sensorId}, device: ${JSON.stringify(device)}`);
        if (!device || !device.entityId) {
          console.warn(`[SensorPoller] No sensor found for project ${project.name} - device: ${device ? 'exists but no entityId' : 'not found'}`);
          continue;
        }

        try {
          const temperature = await this.getSensorTemperature(device.entityId);
          if (temperature !== null) {
            console.log(`[SensorPoller] ${project.name}: ${temperature}°C`);

            // Enregistrer dans InfluxDB
            await influxService.writeTemperature(project.id, temperature);

            // Mettre à jour la température actuelle dans SQLite
            databaseService.updateProjectTemperature(project.id, temperature);

            // Gérer le contrôle automatique de la prise (seulement si mode automatique)
            if (project.controlMode === 'automatic') {
              await this.manageOutlet(project.id, temperature, project.targetTemperature, project.outletId);
            }
          }

          // Poll humidity sensor if configured
          if (project.humiditySensorId) {
            const humidityDevice = databaseService.getDevice(project.humiditySensorId);
            if (humidityDevice && humidityDevice.entityId) {
              const humidity = await this.getSensorValue(humidityDevice.entityId);
              if (humidity !== null) {
                console.log(`[SensorPoller] ${project.name}: ${humidity}% humidity`);

                // Enregistrer dans InfluxDB
                await influxService.writeHumidity(project.id, humidity);

                // Mettre à jour l'humidité actuelle dans SQLite
                databaseService.updateProjectHumidity(project.id, humidity);
              }
            }
          }
        } catch (error) {
          console.error(`[SensorPoller] Error polling sensor for project ${project.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[SensorPoller] Error in poll cycle:', error);
    }
  }

  private async getSensorTemperature(entityId: string): Promise<number | null> {
    return this.getSensorValue(entityId);
  }

  private async getSensorValue(entityId: string): Promise<number | null> {
    try {
      const url = `${HOME_ASSISTANT_URL}/api/states/${entityId}`;
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`[SensorPoller] Failed to fetch sensor ${entityId}: ${response.statusText}`);
        return null;
      }

      const data: HomeAssistantState = await response.json();
      const value = parseFloat(data.state);

      if (isNaN(value)) {
        console.warn(`[SensorPoller] Invalid value for ${entityId}: ${data.state}`);
        return null;
      }

      return value;
    } catch (error) {
      console.error(`[SensorPoller] Error fetching sensor ${entityId}:`, error);
      return null;
    }
  }

  private async manageOutlet(projectId: string, currentTemp: number, targetTemp: number, outletId: string) {
    const diff = targetTemp - currentTemp;
    const shouldActivate = Math.abs(diff) > 0.5 && diff > 0;

    const project = databaseService.getProject(projectId);
    if (!project) return;

    const device = databaseService.getDevice(outletId);
    if (!device) return;

    // Synchroniser l'état réel de la prise depuis Home Assistant
    const actualState = await this.getOutletState(device);
    if (actualState !== null && actualState !== project.outletActive) {
      console.log(`[SensorPoller] Project ${project.name}: Syncing outlet state from HA: ${actualState ? 'ON' : 'OFF'}`);
      databaseService.updateProjectOutletStatus(projectId, actualState);
    }

    // Si l'état doit changer (comparer avec l'état réel, pas celui en base)
    const currentState = actualState !== null ? actualState : project.outletActive;
    if (currentState !== shouldActivate) {
      console.log(`[SensorPoller] Project ${project.name}: Setting outlet to ${shouldActivate ? 'ON' : 'OFF'} at ${currentTemp}°C (target: ${targetTemp}°C)`);

      try {
        await this.controlOutlet(device, shouldActivate);
        databaseService.updateProjectOutletStatus(projectId, shouldActivate);
        // Enregistrer le changement d'état dans l'historique avec la température
        await influxService.writeOutletState(projectId, shouldActivate, 'automatic', currentTemp);
      } catch (error) {
        console.error(`[SensorPoller] Failed to control outlet for ${project.name}:`, error);
      }
    }
  }

  private async getOutletState(device: { ip?: string; entityId?: string }): Promise<boolean | null> {
    try {
      if (device.entityId) {
        const url = `${HOME_ASSISTANT_URL}/api/states/${device.entityId}`;
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (HOME_ASSISTANT_TOKEN) {
          headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) return null;

        const data = await response.json();
        return data.state === 'on';
      }
      return null;
    } catch (error) {
      console.error(`[SensorPoller] Error getting outlet state:`, error);
      return null;
    }
  }

  private async controlOutlet(device: { ip?: string; entityId?: string }, state: boolean): Promise<void> {
    // Utiliser Home Assistant API si entityId est disponible
    if (device.entityId) {
      const service = state ? 'turn_on' : 'turn_off';
      const url = `${HOME_ASSISTANT_URL}/api/services/switch/${service}`;

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entity_id: device.entityId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Home Assistant API returned ${response.status}: ${errorText}`);
      }

      console.log(`[SensorPoller] Outlet ${device.entityId} set to ${state} via Home Assistant`);
    } else if (device.ip) {
      // Fallback: Appeler l'API Shelly directement
      const url = `http://${device.ip}/rpc/Switch.Set?id=0&on=${state}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Shelly API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[SensorPoller] Shelly outlet ${device.ip} set to ${state}:`, result);
    } else {
      throw new Error('No entityId or IP configured for outlet');
    }
  }
}

export const sensorPollerService = new SensorPollerService();
