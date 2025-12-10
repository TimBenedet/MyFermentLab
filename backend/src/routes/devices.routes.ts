import { Router, Request, Response } from 'express';
import { databaseService, Device } from '../services/database.service.js';
import { requireAuth, requireAdmin } from './auth.routes.js';

const router = Router();

// GET /api/devices - Liste tous les appareils
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = databaseService.getAllDevices();
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/devices/:id - Récupère un appareil
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = databaseService.getDevice(id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices - Créer un nouvel appareil
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[POST /api/devices] Received request body:', JSON.stringify(req.body));
    const { name, type, ip, entityId } = req.body;

    if (!name || !type) {
      console.error('[POST /api/devices] Missing required fields:', { name, type });
      return res.status(400).json({ error: 'Missing required fields: name and type', received: { name, type, ip, entityId } });
    }

    const newDevice: Device = {
      id: Date.now().toString(),
      name,
      type,
      ip,
      entityId
    };

    console.log('[POST /api/devices] Creating device:', JSON.stringify(newDevice));
    databaseService.createDevice(newDevice);
    console.log('[POST /api/devices] Device created successfully');

    res.status(201).json(newDevice);
  } catch (error) {
    console.error('[POST /api/devices] Error creating device:', error);
    res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/devices/:id - Mettre à jour un appareil
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, ip, entityId } = req.body;

    const existingDevice = databaseService.getDevice(id);
    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const updates: Partial<Omit<Device, 'id'>> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (ip !== undefined) updates.ip = ip;
    if (entityId !== undefined) updates.entityId = entityId;

    const updatedDevice = databaseService.updateDevice(id, updates);
    res.json(updatedDevice);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/devices/:id/toggle - Toggle l'état d'une prise
router.post('/:id/toggle', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = databaseService.getDevice(id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.type !== 'outlet') {
      return res.status(400).json({ error: 'Device is not an outlet' });
    }

    if (!device.entityId) {
      return res.status(400).json({ error: 'No entityId configured for this outlet' });
    }

    // Récupérer l'état actuel de la prise via Home Assistant
    const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
    const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (HOME_ASSISTANT_TOKEN) {
      headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
    }

    // D'abord, récupérer l'état actuel
    const stateResponse = await fetch(`${HOME_ASSISTANT_URL}/api/states/${device.entityId}`, { headers });
    if (!stateResponse.ok) {
      return res.status(500).json({ error: 'Failed to get outlet state from Home Assistant' });
    }

    const stateData = await stateResponse.json();
    const currentState = stateData.state === 'on';
    const newState = !currentState;

    // Envoyer la commande toggle
    const service = newState ? 'turn_on' : 'turn_off';
    const url = `${HOME_ASSISTANT_URL}/api/services/switch/${service}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ entity_id: device.entityId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: `Home Assistant API error: ${errorText}` });
    }

    console.log(`[Devices] Outlet ${device.name} (${device.entityId}) set to ${newState ? 'ON' : 'OFF'}`);
    res.json({ ...device, isOn: newState });
  } catch (error) {
    console.error('Error toggling device:', error);
    res.status(500).json({ error: 'Failed to toggle device' });
  }
});

// GET /api/devices/:id/state - Récupérer l'état d'une prise
router.get('/:id/state', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = databaseService.getDevice(id);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.type !== 'outlet' || !device.entityId) {
      return res.json({ ...device, isOn: null });
    }

    const HOME_ASSISTANT_URL = process.env.HOME_ASSISTANT_URL || 'http://192.168.1.51:8123';
    const HOME_ASSISTANT_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (HOME_ASSISTANT_TOKEN) {
      headers['Authorization'] = `Bearer ${HOME_ASSISTANT_TOKEN}`;
    }

    const stateResponse = await fetch(`${HOME_ASSISTANT_URL}/api/states/${device.entityId}`, { headers });
    if (!stateResponse.ok) {
      return res.json({ ...device, isOn: null });
    }

    const stateData = await stateResponse.json();
    res.json({ ...device, isOn: stateData.state === 'on' });
  } catch (error) {
    console.error('Error getting device state:', error);
    res.json({ isOn: null });
  }
});

// DELETE /api/devices/:id - Supprimer un appareil
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`[DELETE /api/devices/${id}] Deleting device`);
    databaseService.deleteDevice(id);
    console.log(`[DELETE /api/devices/${id}] Device deleted successfully`);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
