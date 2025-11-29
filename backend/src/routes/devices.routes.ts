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
    const { name, type, ip, entityId } = req.body;

    if (!name || !type || !ip || !entityId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newDevice: Device = {
      id: Date.now().toString(),
      name,
      type,
      ip,
      entityId
    };

    databaseService.createDevice(newDevice);

    res.status(201).json(newDevice);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/devices/:id - Supprimer un appareil
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    databaseService.deleteDevice(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
