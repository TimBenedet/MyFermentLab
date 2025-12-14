import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface Project {
  id: string;
  name: string;
  fermentationType: 'beer' | 'mead' | 'cheese' | 'bread' | 'koji' | 'kombucha' | 'mushroom';
  sensorId: string;
  outletId: string;
  targetTemperature: number;
  currentTemperature: number;
  outletActive: boolean;
  controlMode: 'manual' | 'automatic';
  archived: boolean;
  createdAt: number;
  archivedAt?: number;
  brewingSession?: any;
  recipe?: any;
  // Mushroom-specific fields
  humiditySensorId?: string;
  targetHumidity?: number;
  currentHumidity?: number;
  mushroomType?: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'outlet' | 'humidity_sensor';
  ip?: string;
  entityId?: string;
}

class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH || './data/fermentation.db';
    // Ensure the data directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        fermentation_type TEXT NOT NULL,
        sensor_id TEXT NOT NULL,
        outlet_id TEXT NOT NULL,
        target_temperature REAL NOT NULL,
        current_temperature REAL NOT NULL DEFAULT 20.0,
        outlet_active INTEGER NOT NULL DEFAULT 0,
        control_mode TEXT NOT NULL DEFAULT 'automatic',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        ip TEXT NOT NULL,
        entity_id TEXT NOT NULL
      );
    `);

    // Migration: Add control_mode column if it doesn't exist
    try {
      const columns = this.db.prepare("PRAGMA table_info(projects)").all() as any[];
      const hasControlMode = columns.some(col => col.name === 'control_mode');
      const hasArchived = columns.some(col => col.name === 'archived');
      const hasArchivedAt = columns.some(col => col.name === 'archived_at');

      if (!hasControlMode) {
        console.log('Adding control_mode column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN control_mode TEXT NOT NULL DEFAULT 'automatic'");
        console.log('Migration completed successfully');
      }

      if (!hasArchived) {
        console.log('Adding archived column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
        console.log('Migration completed successfully');
      }

      if (!hasArchivedAt) {
        console.log('Adding archived_at column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN archived_at INTEGER");
        console.log('Migration completed successfully');
      }

      const hasBrewingSession = columns.some(col => col.name === 'brewing_session');
      if (!hasBrewingSession) {
        console.log('Adding brewing_session column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN brewing_session TEXT");
        console.log('Migration completed successfully');
      }

      const hasRecipe = columns.some(col => col.name === 'recipe');
      if (!hasRecipe) {
        console.log('Adding recipe column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN recipe TEXT");
        console.log('Migration completed successfully');
      }

      // Mushroom-specific columns
      const hasHumiditySensorId = columns.some(col => col.name === 'humidity_sensor_id');
      if (!hasHumiditySensorId) {
        console.log('Adding humidity_sensor_id column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN humidity_sensor_id TEXT");
        console.log('Migration completed successfully');
      }

      const hasTargetHumidity = columns.some(col => col.name === 'target_humidity');
      if (!hasTargetHumidity) {
        console.log('Adding target_humidity column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN target_humidity REAL");
        console.log('Migration completed successfully');
      }

      const hasCurrentHumidity = columns.some(col => col.name === 'current_humidity');
      if (!hasCurrentHumidity) {
        console.log('Adding current_humidity column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN current_humidity REAL");
        console.log('Migration completed successfully');
      }

      const hasMushroomType = columns.some(col => col.name === 'mushroom_type');
      if (!hasMushroomType) {
        console.log('Adding mushroom_type column to projects table...');
        this.db.exec("ALTER TABLE projects ADD COLUMN mushroom_type TEXT");
        console.log('Migration completed successfully');
      }

      // Ajouter des sondes de test pour les champignons si elles n'existent pas
      this.initTestDevices();
    } catch (error) {
      console.error('Migration error:', error);
    }
  }

  private initTestDevices() {
    // Vérifier si les sondes de test existent déjà
    const testHumiditySensor1 = this.getDevice('test-humidity-sensor-1');
    const testHumiditySensor2 = this.getDevice('test-humidity-sensor-2');
    const testTempSensor = this.getDevice('test-temp-sensor-mushroom');
    const testOutlet = this.getDevice('test-outlet-mushroom');

    if (!testHumiditySensor1) {
      console.log('Creating test humidity sensor 1...');
      this.createDevice({
        id: 'test-humidity-sensor-1',
        name: '🧪 Sonde Humidité Test 1',
        type: 'humidity_sensor',
        ip: '',
        entityId: 'sensor.test_humidity_1'
      });
    }

    if (!testHumiditySensor2) {
      console.log('Creating test humidity sensor 2...');
      this.createDevice({
        id: 'test-humidity-sensor-2',
        name: '🧪 Sonde Humidité Test 2',
        type: 'humidity_sensor',
        ip: '',
        entityId: 'sensor.test_humidity_2'
      });
    }

    if (!testTempSensor) {
      console.log('Creating test temperature sensor for mushrooms...');
      this.createDevice({
        id: 'test-temp-sensor-mushroom',
        name: '🧪 Sonde Temp Champignon',
        type: 'sensor',
        ip: '',
        entityId: 'sensor.test_temp_mushroom'
      });
    }

    if (!testOutlet) {
      console.log('Creating test outlet for mushrooms...');
      this.createDevice({
        id: 'test-outlet-mushroom',
        name: '🧪 Prise Test Champignon',
        type: 'outlet',
        ip: '',
        entityId: 'switch.test_outlet_mushroom'
      });
    }

    // Second set of test devices for mushroom projects (in case first set is in use)
    const testTempSensor2 = this.getDevice('test-temp-sensor-mushroom-2');
    const testOutlet2 = this.getDevice('test-outlet-mushroom-2');

    if (!testTempSensor2) {
      console.log('Creating test temperature sensor 2 for mushrooms...');
      this.createDevice({
        id: 'test-temp-sensor-mushroom-2',
        name: '🧪 Sonde Temp Champignon 2',
        type: 'sensor',
        ip: '',
        entityId: 'sensor.test_temp_mushroom_2'
      });
    }

    if (!testOutlet2) {
      console.log('Creating test outlet 2 for mushrooms...');
      this.createDevice({
        id: 'test-outlet-mushroom-2',
        name: '🧪 Prise Test Champignon 2',
        type: 'outlet',
        ip: '',
        entityId: 'switch.test_outlet_mushroom_2'
      });
    }
  }

  // Projects CRUD
  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY archived ASC, created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      fermentationType: row.fermentation_type,
      sensorId: row.sensor_id,
      outletId: row.outlet_id,
      targetTemperature: row.target_temperature,
      currentTemperature: row.current_temperature,
      outletActive: row.outlet_active === 1,
      controlMode: row.control_mode || 'automatic',
      archived: row.archived === 1,
      createdAt: row.created_at,
      archivedAt: row.archived_at || undefined,
      brewingSession: row.brewing_session ? JSON.parse(row.brewing_session) : undefined,
      recipe: row.recipe ? JSON.parse(row.recipe) : undefined,
      humiditySensorId: row.humidity_sensor_id || undefined,
      targetHumidity: row.target_humidity || undefined,
      currentHumidity: row.current_humidity || undefined,
      mushroomType: row.mushroom_type || undefined
    }));
  }

  getProject(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      fermentationType: row.fermentation_type,
      sensorId: row.sensor_id,
      outletId: row.outlet_id,
      targetTemperature: row.target_temperature,
      currentTemperature: row.current_temperature,
      outletActive: row.outlet_active === 1,
      controlMode: row.control_mode || 'automatic',
      archived: row.archived === 1,
      createdAt: row.created_at,
      archivedAt: row.archived_at || undefined,
      brewingSession: row.brewing_session ? JSON.parse(row.brewing_session) : undefined,
      recipe: row.recipe ? JSON.parse(row.recipe) : undefined,
      humiditySensorId: row.humidity_sensor_id || undefined,
      targetHumidity: row.target_humidity || undefined,
      currentHumidity: row.current_humidity || undefined,
      mushroomType: row.mushroom_type || undefined
    };
  }

  createProject(project: Omit<Project, 'currentTemperature' | 'outletActive'>): Project {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, fermentation_type, sensor_id, outlet_id, target_temperature, control_mode, created_at, recipe, humidity_sensor_id, target_humidity, mushroom_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const recipeJson = project.recipe ? JSON.stringify(project.recipe) : null;

    stmt.run(
      project.id,
      project.name,
      project.fermentationType,
      project.sensorId,
      project.outletId,
      project.targetTemperature,
      project.controlMode,
      project.createdAt,
      recipeJson,
      project.humiditySensorId || null,
      project.targetHumidity || null,
      project.mushroomType || null
    );

    return this.getProject(project.id)!;
  }

  updateProjectTemperature(id: string, temperature: number) {
    const stmt = this.db.prepare('UPDATE projects SET current_temperature = ? WHERE id = ?');
    stmt.run(temperature, id);
  }

  updateProjectTarget(id: string, targetTemperature: number) {
    const stmt = this.db.prepare('UPDATE projects SET target_temperature = ? WHERE id = ?');
    stmt.run(targetTemperature, id);
  }

  updateProjectOutletStatus(id: string, active: boolean) {
    const stmt = this.db.prepare('UPDATE projects SET outlet_active = ? WHERE id = ?');
    stmt.run(active ? 1 : 0, id);
  }

  updateProjectControlMode(id: string, controlMode: 'manual' | 'automatic') {
    const stmt = this.db.prepare('UPDATE projects SET control_mode = ? WHERE id = ?');
    stmt.run(controlMode, id);
  }

  updateProjectBrewingSession(id: string, brewingSession: any) {
    const stmt = this.db.prepare('UPDATE projects SET brewing_session = ? WHERE id = ?');
    stmt.run(brewingSession ? JSON.stringify(brewingSession) : null, id);
  }

  updateProjectRecipe(id: string, recipe: any) {
    console.log('updateProjectRecipe called for id:', id);
    const recipeJson = recipe ? JSON.stringify(recipe) : null;
    console.log('Recipe JSON length:', recipeJson?.length || 0);
    const stmt = this.db.prepare('UPDATE projects SET recipe = ? WHERE id = ?');
    const result = stmt.run(recipeJson, id);
    console.log('Update result - changes:', result.changes);
  }

  updateProjectDevices(id: string, sensorId: string, outletId: string) {
    const stmt = this.db.prepare('UPDATE projects SET sensor_id = ?, outlet_id = ? WHERE id = ?');
    stmt.run(sensorId, outletId, id);
  }

  updateProjectInfo(id: string, name: string, fermentationType: string) {
    const stmt = this.db.prepare('UPDATE projects SET name = ?, fermentation_type = ? WHERE id = ?');
    stmt.run(name, fermentationType, id);
  }

  archiveProject(id: string) {
    const stmt = this.db.prepare('UPDATE projects SET archived = 1, archived_at = ? WHERE id = ?');
    stmt.run(Date.now(), id);
  }

  unarchiveProject(id: string) {
    const stmt = this.db.prepare('UPDATE projects SET archived = 0, archived_at = NULL WHERE id = ?');
    stmt.run(id);
  }

  isDeviceInUse(deviceId: string, excludeProjectId?: string): boolean {
    let stmt;
    if (excludeProjectId) {
      stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE (sensor_id = ? OR outlet_id = ? OR humidity_sensor_id = ?) AND archived = 0 AND id != ?');
      const result = stmt.get(deviceId, deviceId, deviceId, excludeProjectId) as { count: number };
      return result.count > 0;
    } else {
      stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE (sensor_id = ? OR outlet_id = ? OR humidity_sensor_id = ?) AND archived = 0');
      const result = stmt.get(deviceId, deviceId, deviceId) as { count: number };
      return result.count > 0;
    }
  }

  deleteProject(id: string) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }

  // Devices CRUD
  getAllDevices(): Device[] {
    const stmt = this.db.prepare('SELECT * FROM devices ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      ip: row.ip,
      entityId: row.entity_id
    }));
  }

  getDevice(id: string): Device | null {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      ip: row.ip,
      entityId: row.entity_id
    };
  }

  createDevice(device: Device) {
    const stmt = this.db.prepare(`
      INSERT INTO devices (id, name, type, ip, entity_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(device.id, device.name, device.type, device.ip || '', device.entityId || '');
    return device;
  }

  updateDevice(id: string, updates: Partial<Omit<Device, 'id'>>) {
    const device = this.getDevice(id);
    if (!device) return null;

    const updatedDevice = { ...device, ...updates };
    const stmt = this.db.prepare(`
      UPDATE devices
      SET name = ?, type = ?, ip = ?, entity_id = ?
      WHERE id = ?
    `);

    stmt.run(
      updatedDevice.name,
      updatedDevice.type,
      updatedDevice.ip || '',
      updatedDevice.entityId || '',
      id
    );

    return this.getDevice(id);
  }

  deleteDevice(id: string) {
    const stmt = this.db.prepare('DELETE FROM devices WHERE id = ?');
    stmt.run(id);
  }

  close() {
    this.db.close();
  }
}

export const databaseService = new DatabaseService();
