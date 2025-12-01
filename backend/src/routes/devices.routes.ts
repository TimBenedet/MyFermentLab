import { Router, Request, Response } from 'express';
import { databaseService, Device } from '../services/database.service.js';

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
router.post('/', async (req: Request, res: Response) => {
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
router.put('/:id', async (req: Request, res: Response) => {
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

// DELETE /api/devices/:id - Supprimer un appareil
router.delete('/:id', async (req: Request, res: Response) => {
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
