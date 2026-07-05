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
    // Utiliser -30d pour couvrir les mesures de densité saisies manuellement avec une date antérieure
    let start = req.query.start as string;
    if (!start) {
      start = '-30d';
    }
    const temperatureHistory = await influxService.getTemperatureHistory(id, start);
    const densityHistory = await influxService.getDensityHistory(id, start);

    // Récupérer l'historique d'humidité pour les projets champignon et koji
    let humidityHistory: any[] = [];
    if (project.fermentationType === 'mushroom' || project.fermentationType === 'koji') {
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

    // Récupérer l'historique d'humidité pour les projets champignon et koji
    let humidityHistory: any[] = [];
    if (project.fermentationType === 'mushroom' || project.fermentationType === 'koji') {
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

// Helper: control a list of outlets (turn on or off)
async function controlOutlets(outletIds: string[], newState: boolean, projectName: string) {
  const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
  const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (HOME_ASSISTANT_TOKEN) headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
  const service = newState ? 'turn_on' : 'turn_off';

  await Promise.all(outletIds.map(async (outletId) => {
    const device = databaseService.getDevice(outletId);
    if (!device) return;
    try {
      if (device.entityId) {
        const domain = device.entityId.split('.')[0];
        await fetch(`${HOME_ASSISTANT_URL}/api/services/${domain}/${service}`, {
          method: 'POST', headers,
          body: JSON.stringify({ entity_id: device.entityId })
        });
        console.log(`[Outlet] ${service} ${device.entityId} for ${projectName}`);
      } else if (device.ip) {
        await fetch(`http://${device.ip}/rpc/Switch.Set?id=0&on=${newState}`);
        console.log(`[Outlet] Set ${device.ip} to ${newState} for ${projectName}`);
      }
    } catch (err) {
      console.error(`[Outlet] Failed to control ${outletId} for ${projectName}:`, err);
    }
  }));
}

// POST /api/projects - Créer un nouveau projet
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, fermentationType, sensorId, outletId, outletIds: rawOutletIds, targetTemperature, controlMode, recipe, humiditySensorId, targetHumidity, mushroomType } = req.body;

    if (!name || !fermentationType || !sensorId || !targetTemperature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // outletIds takes precedence over outletId; fall back to [outletId] for backward compat
    const outletIds: string[] = Array.isArray(rawOutletIds) && rawOutletIds.length > 0
      ? rawOutletIds
      : outletId ? [outletId] : [];

    // Note: humiditySensorId est optionnel pour tous les types de projets

    // Vérifier que les devices ne sont pas déjà utilisés par un projet actif
    if (databaseService.isDeviceInUse(sensorId)) {
      return res.status(400).json({ error: 'Sensor is already in use by another active project' });
    }

    for (const oid of outletIds) {
      if (databaseService.isDeviceInUse(oid)) {
        return res.status(400).json({ error: `Outlet ${oid} is already in use by another active project` });
      }
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
      outletId: outletIds[0] || '',
      outletIds,
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

// POST /api/projects/:id/outlet/toggle - Basculer l'état de toutes les prises
router.post('/:id/outlet/toggle', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.outletIds || project.outletIds.length === 0) {
      return res.status(400).json({ error: 'No outlet device configured' });
    }

    const newState = !project.outletActive;

    await controlOutlets(project.outletIds, newState, project.name);

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

    // Enregistrer dans InfluxDB seulement si le projet n'est pas archivé
    if (!project.archived) {
      await influxService.writeTemperature(id, temperature);
    }

    // Gérer le contrôle automatique des prises (seulement si mode automatique)
    let outletChanged = false;
    if (project.controlMode === 'automatic' && project.outletIds && project.outletIds.length > 0) {
      const diff = project.targetTemperature - temperature;
      const threshold = project.activationThreshold ?? 0.2;
      const shouldActivate = diff >= threshold;

      // Synchroniser l'état réel depuis la première prise (prise principale)
      const primaryDevice = databaseService.getDevice(project.outletIds[0]);
      let currentOutletState = project.outletActive;
      if (primaryDevice && primaryDevice.entityId) {
        try {
          const outletResponse = await fetch(`${HOME_ASSISTANT_URL}/api/states/${primaryDevice.entityId}`, { headers });
          if (outletResponse.ok) {
            const outletData = await outletResponse.json();
            currentOutletState = outletData.state === 'on';
            if (currentOutletState !== project.outletActive) {
              console.log(`[LiveTemp] Project ${project.name}: Syncing outlet state from HA: ${currentOutletState ? 'ON' : 'OFF'}`);
              databaseService.updateProjectOutletStatus(id, currentOutletState);
            }
          }
        } catch (err) {
          console.error(`[LiveTemp] Failed to get outlet state for ${project.name}:`, err);
        }
      }

      // Si l'état doit changer, contrôler toutes les prises
      if (currentOutletState !== shouldActivate) {
        try {
          await controlOutlets(project.outletIds, shouldActivate, project.name);
          databaseService.updateProjectOutletStatus(id, shouldActivate);
          await influxService.writeOutletState(id, shouldActivate, 'automatic', temperature);
          outletChanged = true;
          console.log(`[LiveTemp] Project ${project.name}: Setting ${project.outletIds.length} outlet(s) to ${shouldActivate ? 'ON' : 'OFF'} at ${temperature}°C (target: ${project.targetTemperature}°C)`);
        } catch (err) {
          console.error(`[LiveTemp] Failed to control outlets for ${project.name}:`, err);
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

// GET /api/projects/:id/live-humidity - Récupérer l'humidité en temps réel depuis Home Assistant
router.get('/:id/live-humidity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = databaseService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.humiditySensorId) {
      return res.status(400).json({ error: 'No humidity sensor configured for this project' });
    }

    const device = databaseService.getDevice(project.humiditySensorId);
    if (!device || !device.entityId) {
      return res.status(400).json({ error: 'Humidity sensor not found or has no entityId' });
    }

    // Récupérer l'humidité depuis Home Assistant
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
    const humidity = parseFloat(haData.state);

    if (isNaN(humidity)) {
      return res.status(500).json({ error: 'Invalid humidity value from sensor' });
    }

    // Mettre à jour l'humidité dans la base de données
    databaseService.updateProjectHumidity(id, humidity);

    // Enregistrer dans InfluxDB seulement si le projet n'est pas archivé
    if (!project.archived) {
      await influxService.writeHumidity(id, humidity);
    }

    res.json({
      humidity,
      timestamp: Date.now(),
      entityId: device.entityId,
      sensorName: device.name
    });
  } catch (error) {
    console.error('Error fetching live humidity:', error);
    res.status(500).json({ error: 'Failed to fetch humidity from Home Assistant' });
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

    // Éteindre toutes les prises si actives avant d'archiver
    if (project.outletActive && project.outletIds && project.outletIds.length > 0) {
      try {
        await controlOutlets(project.outletIds, false, project.name);
        databaseService.updateProjectOutletStatus(id, false);
        await influxService.writeOutletState(id, false, 'manual', project.currentTemperature);
        console.log(`[Archive] Turned off ${project.outletIds.length} outlet(s) for project ${project.name}`);
      } catch (outletErr) {
        console.error(`[Archive] Failed to turn off outlets for project ${project.name}:`, outletErr);
        // On continue l'archivage même si l'extinction échoue
      }
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
    const { brewingSession, recipe, name, fermentationType, sensorId, outletId, outletIds: rawOutletIds, humiditySensorId, targetHumidity, activationThreshold } = req.body;

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

    // Mise à jour des appareils (sonde et prises)
    if (sensorId !== undefined) {
      const newSensorId = sensorId ?? project.sensorId;
      if (newSensorId !== project.sensorId && databaseService.isDeviceInUse(newSensorId, id)) {
        return res.status(400).json({ error: 'Cette sonde est déjà utilisée par un autre projet actif' });
      }
      databaseService.updateProjectDevices(id, newSensorId, project.outletId);
    }

    // outletIds array update (takes precedence over single outletId)
    if (Array.isArray(rawOutletIds)) {
      databaseService.updateProjectOutletIds(id, rawOutletIds);
    } else if (outletId !== undefined) {
      const newOutletId = outletId ?? project.outletId;
      if (newOutletId !== project.outletId && databaseService.isDeviceInUse(newOutletId, id)) {
        return res.status(400).json({ error: 'Cette prise est déjà utilisée par un autre projet actif' });
      }
      databaseService.updateProjectOutletIds(id, newOutletId ? [newOutletId] : []);
    }

    // Mise à jour de la sonde d'humidité et de l'humidité cible
    if (humiditySensorId !== undefined || targetHumidity !== undefined) {
      const newHumiditySensorId = humiditySensorId ?? project.humiditySensorId;
      const newTargetHumidity = targetHumidity ?? project.targetHumidity;

      // Vérifier que la sonde d'humidité n'est pas utilisée par un autre projet
      if (newHumiditySensorId && newHumiditySensorId !== project.humiditySensorId && databaseService.isDeviceInUse(newHumiditySensorId, id)) {
        return res.status(400).json({ error: 'Cette sonde d\'humidité est déjà utilisée par un autre projet actif' });
      }

      databaseService.updateProjectHumiditySettings(id, newHumiditySensorId, newTargetHumidity);
    }

    if (activationThreshold !== undefined) {
      databaseService.updateProjectActivationThreshold(id, activationThreshold);
    }

    const updatedProject = databaseService.getProject(id);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
