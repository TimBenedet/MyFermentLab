import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

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
  archived: boolean;
  createdAt: number;
  archivedAt?: number;
}

export interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'outlet';
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
    } catch (error) {
      console.error('Migration error:', error);
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
      archivedAt: row.archived_at || undefined
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
      archivedAt: row.archived_at || undefined
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
      stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE (sensor_id = ? OR outlet_id = ?) AND archived = 0 AND id != ?');
      const result = stmt.get(deviceId, deviceId, excludeProjectId) as { count: number };
      return result.count > 0;
    } else {
      stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects WHERE (sensor_id = ? OR outlet_id = ?) AND archived = 0');
      const result = stmt.get(deviceId, deviceId) as { count: number };
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
