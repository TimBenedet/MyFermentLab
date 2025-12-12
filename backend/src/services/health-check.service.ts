import { databaseService } from './database.service.js';

interface HealthCheckResult {
  service: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  lastCheck: number;
  details?: Record<string, any>;
}

interface SystemHealthReport {
  timestamp: number;
  overall: 'ok' | 'warning' | 'error';
  checks: HealthCheckResult[];
}

const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';
const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086';
const HA_VM_IP = process.env.HA_VM_IP || '192.168.1.51';

class HealthCheckService {
  private lastReport: SystemHealthReport | null = null;

  async runAllChecks(): Promise<SystemHealthReport> {
    const checks: HealthCheckResult[] = [];

    // Check VM connectivity first
    checks.push(await this.checkVMConnectivity());

    // Check Home Assistant
    checks.push(await this.checkHomeAssistant());

    // Check InfluxDB
    checks.push(await this.checkInfluxDB());

    // Check all active project sensors
    checks.push(await this.checkActiveSensors());

    // Check outlet connectivity with friendly names
    checks.push(await this.checkOutlets());

    // Determine overall status
    const hasError = checks.some(c => c.status === 'error');
    const hasWarning = checks.some(c => c.status === 'warning');
    const overall = hasError ? 'error' : hasWarning ? 'warning' : 'ok';

    const report: SystemHealthReport = {
      timestamp: Date.now(),
      overall,
      checks
    };

    this.lastReport = report;

    // Log report
    this.logReport(report);

    return report;
  }

  private async checkVMConnectivity(): Promise<HealthCheckResult> {
    const service = 'VM Home Assistant';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Try to connect to HA VM port directly
      const startTime = Date.now();
      const response = await fetch(`http://${HA_VM_IP}:8123/api/`, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeout);

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          service,
          status: latency > 2000 ? 'warning' : 'ok',
          message: latency > 2000
            ? `VM accessible mais lente (${latency}ms)`
            : `VM accessible (${latency}ms)`,
          lastCheck: Date.now(),
          details: { ip: HA_VM_IP, latency, port: 8123 }
        };
      } else {
        return {
          service,
          status: 'warning',
          message: `VM accessible mais HTTP ${response.status}`,
          lastCheck: Date.now(),
          details: { ip: HA_VM_IP, httpStatus: response.status }
        };
      }
    } catch (error: any) {
      return {
        service,
        status: 'error',
        message: `VM inaccessible: ${error.name === 'AbortError' ? 'timeout' : error.message}`,
        lastCheck: Date.now(),
        details: { ip: HA_VM_IP }
      };
    }
  }

  private async checkHomeAssistant(): Promise<HealthCheckResult> {
    const service = 'Home Assistant';
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const startTime = Date.now();
      const response = await fetch(`${HOME_ASSISTANT_URL}/api/`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        return {
          service,
          status: 'ok',
          message: `API accessible (${latency}ms)`,
          lastCheck: Date.now(),
          details: { version: data.version, latency }
        };
      } else {
        return {
          service,
          status: 'error',
          message: `Home Assistant returned HTTP ${response.status}`,
          lastCheck: Date.now()
        };
      }
    } catch (error: any) {
      return {
        service,
        status: 'error',
        message: `Cannot reach Home Assistant: ${error.message}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkInfluxDB(): Promise<HealthCheckResult> {
    const service = 'InfluxDB';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${INFLUX_URL}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return {
          service,
          status: data.status === 'pass' ? 'ok' : 'warning',
          message: `InfluxDB status: ${data.status}`,
          lastCheck: Date.now(),
          details: data
        };
      } else {
        return {
          service,
          status: 'error',
          message: `InfluxDB returned HTTP ${response.status}`,
          lastCheck: Date.now()
        };
      }
    } catch (error: any) {
      return {
        service,
        status: 'error',
        message: `Cannot reach InfluxDB: ${error.message}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkActiveSensors(): Promise<HealthCheckResult> {
    const service = 'Capteurs Actifs';
    try {
      // Get all active (non-archived) projects
      const projects = databaseService.getAllProjects().filter((p: any) => !p.archived);

      if (projects.length === 0) {
        return {
          service,
          status: 'ok',
          message: 'Aucun projet actif',
          lastCheck: Date.now()
        };
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      // Get all states from HA
      const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, { headers });
      if (!response.ok) {
        return {
          service,
          status: 'error',
          message: 'Cannot fetch sensor states from Home Assistant',
          lastCheck: Date.now()
        };
      }

      const states = await response.json();
      const sensorResults: Array<{
        project: string;
        sensor: string;
        status: 'ok' | 'warning' | 'error';
        temperature?: string;
        ageMinutes?: number;
      }> = [];

      let hasError = false;
      let hasWarning = false;

      for (const project of projects) {
        // Get device for this project
        const device = databaseService.getDevice(project.sensorId);
        if (!device?.entityId) continue;

        const sensorState = states.find((s: any) => s.entity_id === device.entityId);
        const sensorName = sensorState?.attributes?.friendly_name || device.name;

        if (!sensorState) {
          sensorResults.push({
            project: project.name,
            sensor: sensorName,
            status: 'error'
          });
          hasError = true;
          continue;
        }

        if (sensorState.state === 'unavailable' || sensorState.state === 'unknown') {
          sensorResults.push({
            project: project.name,
            sensor: sensorName,
            status: 'error'
          });
          hasError = true;
          continue;
        }

        const lastUpdated = new Date(sensorState.last_updated).getTime();
        const ageMinutes = Math.round((Date.now() - lastUpdated) / 60000);

        if (ageMinutes > 120) {
          sensorResults.push({
            project: project.name,
            sensor: sensorName,
            status: 'error',
            temperature: sensorState.state,
            ageMinutes
          });
          hasError = true;
        } else if (ageMinutes > 60) {
          sensorResults.push({
            project: project.name,
            sensor: sensorName,
            status: 'warning',
            temperature: sensorState.state,
            ageMinutes
          });
          hasWarning = true;
        } else {
          sensorResults.push({
            project: project.name,
            sensor: sensorName,
            status: 'ok',
            temperature: sensorState.state,
            ageMinutes
          });
        }
      }

      const okCount = sensorResults.filter(s => s.status === 'ok').length;
      const warningCount = sensorResults.filter(s => s.status === 'warning').length;
      const errorCount = sensorResults.filter(s => s.status === 'error').length;

      let message: string;
      if (hasError) {
        message = `${errorCount} capteur(s) en erreur`;
      } else if (hasWarning) {
        message = `${warningCount} capteur(s) avec données anciennes`;
      } else {
        message = `${okCount} capteur(s) OK`;
      }

      return {
        service,
        status: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
        message,
        lastCheck: Date.now(),
        details: { sensors: sensorResults }
      };
    } catch (error: any) {
      return {
        service,
        status: 'error',
        message: `Sensor check failed: ${error.message}`,
        lastCheck: Date.now()
      };
    }
  }

  private async checkOutlets(): Promise<HealthCheckResult> {
    const service = 'Prises Connectées';
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      const response = await fetch(`${HOME_ASSISTANT_URL}/api/states`, { headers });

      if (!response.ok) {
        return {
          service,
          status: 'error',
          message: 'Cannot fetch outlet states from Home Assistant',
          lastCheck: Date.now()
        };
      }

      const states = await response.json();
      const outlets = states.filter((s: any) =>
        s.entity_id.startsWith('switch.') && s.entity_id.includes('outlet')
      );

      const unavailable = outlets.filter((o: any) => o.state === 'unavailable');

      if (unavailable.length > 0) {
        return {
          service,
          status: 'error',
          message: `${unavailable.length} prise(s) indisponible(s)`,
          lastCheck: Date.now(),
          details: {
            unavailable: unavailable.map((o: any) => ({
              id: o.entity_id,
              name: o.attributes?.friendly_name || o.entity_id
            }))
          }
        };
      }

      return {
        service,
        status: 'ok',
        message: `${outlets.length} prise(s) disponible(s)`,
        lastCheck: Date.now(),
        details: {
          outlets: outlets.map((o: any) => ({
            id: o.entity_id,
            name: o.attributes?.friendly_name || o.entity_id,
            state: o.state
          }))
        }
      };
    } catch (error: any) {
      return {
        service,
        status: 'error',
        message: `Outlet check failed: ${error.message}`,
        lastCheck: Date.now()
      };
    }
  }

  private logReport(report: SystemHealthReport) {
    const statusEmoji = report.overall === 'ok' ? '✅' : report.overall === 'warning' ? '⚠️' : '❌';
    console.log(`[HealthCheck] ${statusEmoji} System status: ${report.overall.toUpperCase()}`);

    for (const check of report.checks) {
      const emoji = check.status === 'ok' ? '✓' : check.status === 'warning' ? '!' : '✗';
      console.log(`[HealthCheck]   ${emoji} ${check.service}: ${check.message}`);
    }
  }

  getLastReport(): SystemHealthReport | null {
    return this.lastReport;
  }
}

export const healthCheckService = new HealthCheckService();
