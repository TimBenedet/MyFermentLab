import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database.service.js';
import { influxService } from '../services/influx.service.js';
import { statsService } from '../services/stats.service.js';
import { requireAuth, requireAdmin } from './auth.routes.js';

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

// GET /api/projects/:id/stats - Récupère les statistiques d'un projet archivé
router.get('/:id/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.archived || !project.archivedAt) {
      return res.status(400).json({ error: 'Project is not completed. Complete it first to see stats.' });
    }

    // Récupérer tout l'historique depuis la création
    const temperatureHistory = await influxService.getTemperatureHistory(id, `-${Math.ceil((project.archivedAt - project.createdAt) / 86400000)}d`);
    const densityHistory = await influxService.getDensityHistory(id, `-${Math.ceil((project.archivedAt - project.createdAt) / 86400000)}d`);

    // Calculer les statistiques
    const stats = await statsService.calculateProjectStats(
      id,
      project.createdAt,
      project.archivedAt,
      temperatureHistory,
      densityHistory
    );

    res.json({
      project,
      stats,
      temperatureHistory,
      densityHistory
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Créer un nouveau projet
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, fermentationType, sensorId, outletId, targetTemperature, controlMode, recipe } = req.body;

    if (!name || !fermentationType || !sensorId || !outletId || !targetTemperature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Vérifier que les devices ne sont pas déjà utilisés par un projet actif
    if (databaseService.isDeviceInUse(sensorId)) {
      return res.status(400).json({ error: 'Sensor is already in use by another active project' });
    }

    if (databaseService.isDeviceInUse(outletId)) {
      return res.status(400).json({ error: 'Outlet is already in use by another active project' });
    }

    const projectId = Date.now().toString();

    console.log('Creating project with recipe:', !!recipe);
    if (recipe) {
      console.log('Recipe has grains:', recipe.grains?.length || 0);
      console.log('Recipe has hops:', recipe.hops?.length || 0);
    }

    const newProject = databaseService.createProject({
      id: projectId,
      name,
      fermentationType,
      sensorId,
      outletId,
      targetTemperature,
      controlMode: controlMode || 'automatic',
      archived: false,
      createdAt: Date.now(),
      recipe: recipe || undefined
    });

    console.log('Project created, has recipe:', !!newProject?.recipe);

    // Si c'est un projet de test, générer des données simulées
    const isTestProject = recipe?.style?.includes('Test bière') || name?.includes('Test');
    if (isTestProject) {
      console.log('Test project detected - generating simulated data...');
      try {
        await influxService.generateTestData(projectId, targetTemperature);
        console.log('Simulated data generated successfully');
      } catch (err) {
        console.error('Failed to generate test data:', err);
        // On continue même si la génération échoue
      }
    }

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/target - Modifier la température cible
router.put('/:id/target', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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
router.post('/:id/outlet/toggle', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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
router.post('/:id/density', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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
router.put('/:id/control-mode', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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

// PUT /api/projects/:id/complete - Terminer un projet (alias pour archive)
router.put('/:id/complete', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.archived) {
      return res.status(400).json({ error: 'Project is already completed' });
    }

    databaseService.archiveProject(id);
    const updatedProject = databaseService.getProject(id);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error completing project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/archive - Archiver un projet
router.put('/:id/archive', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    databaseService.archiveProject(id);
    const updatedProject = databaseService.getProject(id);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error archiving project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/unarchive - Désarchiver un projet
router.put('/:id/unarchive', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Vérifier que les devices ne sont pas déjà utilisés
    if (databaseService.isDeviceInUse(project.sensorId, id)) {
      return res.status(400).json({ error: 'Sensor is already in use by another active project' });
    }

    if (databaseService.isDeviceInUse(project.outletId, id)) {
      return res.status(400).json({ error: 'Outlet is already in use by another active project' });
    }

    databaseService.unarchiveProject(id);
    const updatedProject = databaseService.getProject(id);

    res.json(updatedProject);
  } catch (error) {
    console.error('Error unarchiving project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id - Supprimer un projet
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    databaseService.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:id - Mettre à jour partiellement un projet
router.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { brewingSession, recipe } = req.body;

    const project = databaseService.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (brewingSession !== undefined) {
      databaseService.updateProjectBrewingSession(id, brewingSession);
    }

    if (recipe !== undefined) {
      databaseService.updateProjectRecipe(id, recipe);
    }

    const updatedProject = databaseService.getProject(id);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
