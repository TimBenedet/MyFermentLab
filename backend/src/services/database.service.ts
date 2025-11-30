import Database from 'better-sqlite3';
import { join } from 'path';

export interface Project {
  id: string;
  name: string;
  fermentationType: 'beer' | 'wine' | 'cheese' | 'bread';
  sensorId: string;
  outletId: string;
  targetTemperature: number;
  currentTemperature: number;
  outletActive: boolean;
  controlMode: 'manual' | 'automatic';
  createdAt: number;
}

export interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'outlet';
  ip: string;
  entityId: string;
}

class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.DB_PATH || '/data/fermentation.db';
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
  }

  // Projects CRUD
  getAllProjects(): Project[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
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
      createdAt: row.created_at
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
      createdAt: row.created_at
    };
  }

  createProject(project: Omit<Project, 'currentTemperature' | 'outletActive'>): Project {
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, fermentation_type, sensor_id, outlet_id, target_temperature, control_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.id,
      project.name,
      project.fermentationType,
      project.sensorId,
      project.outletId,
      project.targetTemperature,
      project.controlMode,
      project.createdAt
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

  deleteProject(id: string) {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }

  // Devices CRUD
  getAllDevices(): Device[] {
    const stmt = this.db.prepare('SELECT * FROM devices ORDER BY name');
    return stmt.all() as Device[];
  }

  getDevice(id: string): Device | null {
    const stmt = this.db.prepare('SELECT * FROM devices WHERE id = ?');
    return stmt.get(id) as Device | null;
  }

  createDevice(device: Device) {
    const stmt = this.db.prepare(`
      INSERT INTO devices (id, name, type, ip, entity_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(device.id, device.name, device.type, device.ip, device.entityId);
    return device;
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
