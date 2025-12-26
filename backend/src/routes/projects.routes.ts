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

    // Récupérer l'historique d'humidité pour les projets champignon
    let humidityHistory: any[] = [];
    if (project.fermentationType === 'mushroom') {
      humidityHistory = await influxService.getHumidityHistory(id, start);
    }

    res.json({
      ...project,
      history: temperatureHistory,
      densityHistory,
      humidityHistory
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/stats - Récupère les statistiques d'un projet (archivé ou actif avec session de brassage)
router.get('/:id/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Autoriser si archivé OU si le projet a une session de brassage
    const hasBrewingSession = project.brewingSession != null;
    if (!project.archived && !hasBrewingSession) {
      return res.status(400).json({ error: 'Project is not completed and has no brewing session.' });
    }

    // Déterminer la plage de dates (minimum 7 jours pour inclure les données simulées)
    const endDate = project.archivedAt || Date.now();
    const daysSinceCreation = Math.max(7, Math.ceil((endDate - project.createdAt) / 86400000));

    // Récupérer tout l'historique depuis la création
    const temperatureHistory = await influxService.getTemperatureHistory(id, `-${daysSinceCreation}d`);
    const densityHistory = await influxService.getDensityHistory(id, `-${daysSinceCreation}d`);

    // Récupérer l'historique d'humidité pour les projets champignon
    let humidityHistory: any[] = [];
    if (project.fermentationType === 'mushroom') {
      humidityHistory = await influxService.getHumidityHistory(id, `-${daysSinceCreation}d`);
    }

    // Calculer les statistiques
    const stats = await statsService.calculateProjectStats(
      id,
      project.createdAt,
      endDate,
      temperatureHistory,
      densityHistory,
      humidityHistory
    );

    res.json({
      project,
      stats,
      temperatureHistory,
      densityHistory,
      humidityHistory
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Créer un nouveau projet
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, fermentationType, sensorId, outletId, targetTemperature, controlMode, recipe, humiditySensorId, targetHumidity, mushroomType } = req.body;

    if (!name || !fermentationType || !sensorId || !outletId || !targetTemperature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Note: humiditySensorId est optionnel pour tous les types de projets

    // Vérifier que les devices ne sont pas déjà utilisés par un projet actif
    if (databaseService.isDeviceInUse(sensorId)) {
      return res.status(400).json({ error: 'Sensor is already in use by another active project' });
    }

    if (databaseService.isDeviceInUse(outletId)) {
      return res.status(400).json({ error: 'Outlet is already in use by another active project' });
    }

    if (humiditySensorId && databaseService.isDeviceInUse(humiditySensorId)) {
      return res.status(400).json({ error: 'Humidity sensor is already in use by another active project' });
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
      recipe: recipe || undefined,
      humiditySensorId: humiditySensorId || undefined,
      targetHumidity: targetHumidity || undefined,
      mushroomType: mushroomType || undefined
    });

    console.log('Project created, has recipe:', !!newProject?.recipe);

    // Détecter si c'est un projet de test et générer les données appropriées
    const isTestProject = name?.toLowerCase().includes('test');

    // Test bière (avec densité)
    const isTestBeerProject = recipe?.style?.includes('Test bière') || (isTestProject && fermentationType === 'beer');
    if (isTestBeerProject) {
      console.log('Test beer project detected - generating simulated data...');
      try {
        await influxService.generateTestData(projectId, targetTemperature);
        console.log('Simulated beer data generated successfully');
      } catch (err) {
        console.error('Failed to generate test data:', err);
      }
    }

    // Test champignon (avec humidité)
    const isTestMushroomProject = mushroomType?.includes('Test champignon') || (isTestProject && fermentationType === 'mushroom');
    if (isTestMushroomProject) {
      console.log('Test mushroom project detected - generating simulated humidity data...');
      try {
        await influxService.generateMushroomTestData(projectId, targetTemperature, targetHumidity || 85);
        console.log('Simulated mushroom data generated successfully');
      } catch (err) {
        console.error('Failed to generate mushroom test data:', err);
      }
    }

    // Test koji (avec humidité - similaire aux champignons)
    if (isTestProject && fermentationType === 'koji') {
      console.log('Test koji project detected - generating simulated data...');
      try {
        await influxService.generateMushroomTestData(projectId, targetTemperature, targetHumidity || 80);
        console.log('Simulated koji data generated successfully');
      } catch (err) {
        console.error('Failed to generate koji test data:', err);
      }
    }

    // Test fromage (avec humidité)
    if (isTestProject && fermentationType === 'cheese') {
      console.log('Test cheese project detected - generating simulated data...');
      try {
        await influxService.generateMushroomTestData(projectId, targetTemperature, targetHumidity || 85);
        console.log('Simulated cheese data generated successfully');
      } catch (err) {
        console.error('Failed to generate cheese test data:', err);
      }
    }

    // Test kombucha, hydromel, levain (température seulement)
    const tempOnlyTypes = ['kombucha', 'mead', 'sourdough'];
    if (isTestProject && tempOnlyTypes.includes(fermentationType)) {
      console.log(`Test ${fermentationType} project detected - generating simulated temperature data...`);
      try {
        await influxService.generateTestData(projectId, targetTemperature);
        console.log(`Simulated ${fermentationType} data generated successfully`);
      } catch (err) {
        console.error(`Failed to generate ${fermentationType} test data:`, err);
      }
    }

    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/projects/:id/devices - Modifier la sonde et la prise du projet
router.put('/:id/devices', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sensorId, outletId } = req.body;

    const project = databaseService.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.archived) {
      return res.status(400).json({ error: 'Cannot modify archived project' });
    }

    if (!sensorId || !outletId) {
      return res.status(400).json({ error: 'Missing sensorId or outletId' });
    }

    // Vérifier que les nouveaux devices ne sont pas utilisés par d'autres projets
    if (sensorId !== project.sensorId && databaseService.isDeviceInUse(sensorId, id)) {
      return res.status(400).json({ error: 'Sensor is already in use by another active project' });
    }

    if (outletId !== project.outletId && databaseService.isDeviceInUse(outletId, id)) {
      return res.status(400).json({ error: 'Outlet is already in use by another active project' });
    }

    databaseService.updateProjectDevices(id, sensorId, outletId);
    const updatedProject = databaseService.getProject(id);

    console.log(`[Projects] Updated devices for project ${project.name}: sensor=${sensorId}, outlet=${outletId}`);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project devices:', error);
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
    if (!device) {
      return res.status(400).json({ error: 'No outlet device configured' });
    }

    const newState = !project.outletActive;

    // Utiliser Home Assistant API si entityId est disponible, sinon fallback sur IP directe
    if (device.entityId) {
      const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
      const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';

      const service = newState ? 'turn_on' : 'turn_off';
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

      console.log(`[Outlet] Controlled ${device.entityId} via Home Assistant: ${newState ? 'ON' : 'OFF'}`);
    } else if (device.ip) {
      // Fallback: Appeler l'API Shelly directement
      const response = await fetch(`http://${device.ip}/rpc/Switch.Set?id=0&on=${newState}`);

      if (!response.ok) {
        throw new Error(`Shelly API returned ${response.status}`);
      }

      console.log(`[Outlet] Controlled ${device.ip} via direct Shelly API: ${newState ? 'ON' : 'OFF'}`);
    } else {
      return res.status(400).json({ error: 'No entityId or IP configured for outlet' });
    }

    databaseService.updateProjectOutletStatus(id, newState);

    // Enregistrer l'état dans InfluxDB pour l'historique avec la température actuelle
    await influxService.writeOutletState(id, newState, 'manual', project.currentTemperature);

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

// POST /api/projects/:id/humidity - Ajouter une mesure d'humidité
router.post('/:id/humidity', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { humidity, timestamp } = req.body;

    if (humidity === undefined) {
      return res.status(400).json({ error: 'Missing humidity value' });
    }

    const ts = timestamp || Date.now();

    await influxService.writeHumidity(id, humidity, ts);

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error adding humidity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/outlet-history - Récupérer l'historique des états de la prise
router.get('/:id/outlet-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const start = req.query.start as string || '-7d';
    const outletHistory = await influxService.getOutletHistory(id, start);

    res.json({ outletHistory });
  } catch (error) {
    console.error('Error fetching outlet history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/live-temperature - Récupérer la température en temps réel depuis Home Assistant
router.get('/:id/live-temperature', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const device = databaseService.getDevice(project.sensorId);
    if (!device || !device.entityId) {
      return res.status(400).json({ error: 'No sensor configured for this project' });
    }

    // Récupérer la température depuis Home Assistant
    const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
    const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';

    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (HOME_ASSISTANT_TOKEN) {
      headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
    }

    const haResponse = await fetch(`${HOME_ASSISTANT_URL}/api/states/${device.entityId}`, { headers });

    if (!haResponse.ok) {
      throw new Error(`Home Assistant API returned ${haResponse.status}`);
    }

    const haData = await haResponse.json();
    const temperature = parseFloat(haData.state);

    if (isNaN(temperature)) {
      return res.status(500).json({ error: 'Invalid temperature value from sensor' });
    }

    // Mettre à jour la température dans la base de données
    databaseService.updateProjectTemperature(id, temperature);

    // Enregistrer dans InfluxDB
    await influxService.writeTemperature(id, temperature);

    // Gérer le contrôle automatique de la prise (seulement si mode automatique)
    let outletChanged = false;
    if (project.controlMode === 'automatic' && project.outletId) {
      const diff = project.targetTemperature - temperature;
      const shouldActivate = Math.abs(diff) > 0.5 && diff > 0;

      const outletDevice = databaseService.getDevice(project.outletId);
      if (outletDevice && outletDevice.entityId) {
        // D'abord synchroniser l'état réel de la prise depuis Home Assistant
        let currentOutletState = project.outletActive;
        try {
          const outletResponse = await fetch(`${HOME_ASSISTANT_URL}/api/states/${outletDevice.entityId}`, { headers });
          if (outletResponse.ok) {
            const outletData = await outletResponse.json();
            currentOutletState = outletData.state === 'on';
            // Mettre à jour la base si l'état réel diffère
            if (currentOutletState !== project.outletActive) {
              console.log(`[LiveTemp] Project ${project.name}: Syncing outlet state from HA: ${currentOutletState ? 'ON' : 'OFF'}`);
              databaseService.updateProjectOutletStatus(id, currentOutletState);
            }
          }
        } catch (err) {
          console.error(`[LiveTemp] Failed to get outlet state for ${project.name}:`, err);
        }

        // Si l'état doit changer (comparer avec l'état réel)
        if (currentOutletState !== shouldActivate) {
          try {
            const action = shouldActivate ? 'turn_on' : 'turn_off';
            const domain = outletDevice.entityId.split('.')[0];

            await fetch(`${HOME_ASSISTANT_URL}/api/services/${domain}/${action}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ entity_id: outletDevice.entityId })
            });

            databaseService.updateProjectOutletStatus(id, shouldActivate);
            await influxService.writeOutletState(id, shouldActivate, 'automatic', temperature);
            outletChanged = true;
            console.log(`[LiveTemp] Project ${project.name}: Setting outlet to ${shouldActivate ? 'ON' : 'OFF'} at ${temperature}°C (target: ${project.targetTemperature}°C)`);
          } catch (err) {
            console.error(`[LiveTemp] Failed to control outlet for ${project.name}:`, err);
          }
        }
      }
    }

    res.json({
      temperature,
      timestamp: Date.now(),
      entityId: device.entityId,
      sensorName: device.name,
      outletChanged
    });
  } catch (error) {
    console.error('Error fetching live temperature:', error);
    res.status(500).json({ error: 'Failed to fetch temperature from Home Assistant' });
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
    const { brewingSession, recipe, name, fermentationType, sensorId, outletId } = req.body;

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

    // Mise à jour des informations de base (nom et type de fermentation)
    if (name !== undefined || fermentationType !== undefined) {
      databaseService.updateProjectInfo(
        id,
        name ?? project.name,
        fermentationType ?? project.fermentationType
      );
    }

    // Mise à jour des appareils (sonde et prise)
    if (sensorId !== undefined || outletId !== undefined) {
      const newSensorId = sensorId ?? project.sensorId;
      const newOutletId = outletId ?? project.outletId;

      // Vérifier que les appareils ne sont pas utilisés par d'autres projets
      if (newSensorId !== project.sensorId && databaseService.isDeviceInUse(newSensorId, id)) {
        return res.status(400).json({ error: 'Cette sonde est déjà utilisée par un autre projet actif' });
      }
      if (newOutletId !== project.outletId && databaseService.isDeviceInUse(newOutletId, id)) {
        return res.status(400).json({ error: 'Cette prise est déjà utilisée par un autre projet actif' });
      }

      databaseService.updateProjectDevices(id, newSensorId, newOutletId);
    }

    const updatedProject = databaseService.getProject(id);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
