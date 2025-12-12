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

class HealthCheckService {
  private lastReport: SystemHealthReport | null = null;

  async runAllChecks(): Promise<SystemHealthReport> {
    const checks: HealthCheckResult[] = [];

    // Check Home Assistant
    checks.push(await this.checkHomeAssistant());

    // Check InfluxDB
    checks.push(await this.checkInfluxDB());

    // Check sensors are reporting
    checks.push(await this.checkSensorData());

    // Check outlet connectivity
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

  private async checkHomeAssistant(): Promise<HealthCheckResult> {
    const service = 'Home Assistant';
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${HOME_ASSISTANT_URL}/api/`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          service,
          status: 'ok',
          message: 'Home Assistant API accessible',
          lastCheck: Date.now()
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

  private async checkSensorData(): Promise<HealthCheckResult> {
    const service = 'Sensor Data';
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (HOME_ASSISTANT_TOKEN) {
        headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
      }

      // Get sensor state from Home Assistant
      const response = await fetch(
        `${HOME_ASSISTANT_URL}/api/states/sensor.sonde_sonoff_1_temperature`,
        { headers }
      );

      if (!response.ok) {
        return {
          service,
          status: 'error',
          message: 'Cannot fetch sensor state from Home Assistant',
          lastCheck: Date.now()
        };
      }

      const data = await response.json();
      const lastUpdated = new Date(data.last_updated).getTime();
      const ageMinutes = (Date.now() - lastUpdated) / 60000;

      if (ageMinutes > 120) {
        return {
          service,
          status: 'error',
          message: `Sensor data is stale (${Math.round(ageMinutes)} minutes old)`,
          lastCheck: Date.now(),
          details: { lastUpdated: data.last_updated, ageMinutes: Math.round(ageMinutes) }
        };
      } else if (ageMinutes > 60) {
        return {
          service,
          status: 'warning',
          message: `Sensor data is ${Math.round(ageMinutes)} minutes old`,
          lastCheck: Date.now(),
          details: { lastUpdated: data.last_updated, ageMinutes: Math.round(ageMinutes) }
        };
      } else {
        return {
          service,
          status: 'ok',
          message: `Sensor reporting normally (${data.state}°C)`,
          lastCheck: Date.now(),
          details: { temperature: data.state, lastUpdated: data.last_updated }
        };
      }
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
    const service = 'Smart Outlets';
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
          message: `${unavailable.length} outlet(s) unavailable`,
          lastCheck: Date.now(),
          details: { unavailable: unavailable.map((o: any) => o.entity_id) }
        };
      }

      return {
        service,
        status: 'ok',
        message: `${outlets.length} outlet(s) available`,
        lastCheck: Date.now(),
        details: { outlets: outlets.map((o: any) => ({ id: o.entity_id, state: o.state })) }
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
