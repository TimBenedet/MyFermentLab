// Build trigger: 2025-12-17T13:00
import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.routes.js';
import devicesRouter from './routes/devices.routes.js';
import authRouter from './routes/auth.routes.js';
import waterRouter from './routes/water.routes.js';
import { sensorPollerService } from './services/sensor-poller.service.js';
import { healthCheckService } from './services/health-check.service.js';

const PORT = process.env.PORT || 3001;
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '3600000'); // 1 hour

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/water', waterRouter);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Detailed system health check
app.get('/api/health', async (req, res) => {
  try {
    const report = await healthCheckService.runAllChecks();
    const statusCode = report.overall === 'ok' ? 200 : report.overall === 'warning' ? 200 : 503;
    res.status(statusCode).json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get last health report without running new checks
app.get('/api/health/last', (req, res) => {
  const report = healthCheckService.getLastReport();
  if (report) {
    res.json(report);
  } else {
    res.status(404).json({ error: 'No health report available yet' });
  }
});

// Démarrer le service de polling des capteurs
sensorPollerService.start();

// Démarrer les health checks périodiques
let healthCheckTimer: NodeJS.Timeout | null = null;

async function runScheduledHealthCheck() {
  console.log('[HealthCheck] Running scheduled health check...');
  const report = await healthCheckService.runAllChecks();

  // Si le statut n'est pas OK, on pourrait envoyer une notification
  if (report.overall !== 'ok') {
    console.error(`[HealthCheck] ⚠️ System health issue detected: ${report.overall}`);
    // TODO: Envoyer notification (email, webhook, etc.)
  }
}

// Premier check après 1 minute, puis toutes les heures
setTimeout(() => {
  runScheduledHealthCheck();
  healthCheckTimer = setInterval(runScheduledHealthCheck, HEALTH_CHECK_INTERVAL);
}, 60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  sensorPollerService.stop();
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  sensorPollerService.stop();
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[Server] Backend API listening on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
});
