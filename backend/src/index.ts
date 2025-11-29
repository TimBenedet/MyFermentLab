import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.routes.js';
import devicesRouter from './routes/devices.routes.js';
import { sensorPollerService } from './services/sensor-poller.service.js';

const PORT = process.env.PORT || 3001;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/devices', devicesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Démarrer le service de polling des capteurs
sensorPollerService.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  sensorPollerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  sensorPollerService.stop();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[Server] Backend API listening on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
});
