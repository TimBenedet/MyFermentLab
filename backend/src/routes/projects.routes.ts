import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database.service.js';
import { influxService } from '../services/influx.service.js';

const router = Router();

// GET /api/projects - Liste tous les projets
router.get('/', async (req: Request, res: Response) => {
  try {
    const projects = databaseService.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id - Récupère un projet avec son historique
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Récupérer l'historique depuis InfluxDB
    const start = req.query.start as string || '-30d';
    const temperatureHistory = await influxService.getTemperatureHistory(id, start);
    const densityHistory = await influxService.getDensityHistory(id, start);

    res.json({
      ...project,
      history: temperatureHistory,
      densityHistory
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Créer un nouveau projet
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, fermentationType, sensorId, outletId, targetTemperature, controlMode } = req.body;

    if (!name || !fermentationType || !sensorId || !outletId || !targetTemperature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newProject = databaseService.createProject({
      id: Date.now().toString(),
      name,
      fermentationType,
      sensorId,
      outletId,
      targetTemperature,
      controlMode: controlMode || 'automatic',
      createdAt: Date.now()
    });

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/target - Modifier la température cible
router.put('/:id/target', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetTemperature } = req.body;

    if (targetTemperature === undefined) {
      return res.status(400).json({ error: 'Missing targetTemperature' });
    }

    databaseService.updateProjectTarget(id, targetTemperature);
    const project = databaseService.getProject(id);

    res.json(project);
  } catch (error) {
    console.error('Error updating target temperature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects/:id/outlet/toggle - Basculer l'état de la prise
router.post('/:id/outlet/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const device = databaseService.getDevice(project.outletId);
    if (!device || !device.ip) {
      return res.status(400).json({ error: 'No outlet device configured' });
    }

    const newState = !project.outletActive;

    // Appeler l'API Shelly
    const response = await fetch(`http://${device.ip}/rpc/Switch.Set?id=0&on=${newState}`);

    if (!response.ok) {
      throw new Error(`Shelly API returned ${response.status}`);
    }

    databaseService.updateProjectOutletStatus(id, newState);
    const updatedProject = databaseService.getProject(id);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error toggling outlet:', error);
    res.status(500).json({ error: 'Failed to control outlet' });
  }
});

// POST /api/projects/:id/density - Ajouter une mesure de densité
router.post('/:id/density', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { density, timestamp } = req.body;

    if (!density) {
      return res.status(400).json({ error: 'Missing density value' });
    }

    const ts = timestamp || Date.now();

    await influxService.writeDensity(id, density, ts);

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding density:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/control-mode - Basculer le mode de contrôle
router.put('/:id/control-mode', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newMode = project.controlMode === 'automatic' ? 'manual' : 'automatic';
    databaseService.updateProjectControlMode(id, newMode);
    const updatedProject = databaseService.getProject(id);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating control mode:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id - Supprimer un projet
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    databaseService.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
