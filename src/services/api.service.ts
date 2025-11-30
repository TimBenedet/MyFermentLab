import { Project, Device, FermentationType } from '../types';

const API_BASE_URL = '/api';

export interface CreateProjectRequest {
  name: string;
  fermentationType: FermentationType;
  sensorId: string;
  outletId: string;
  targetTemperature: number;
  controlMode: 'manual' | 'automatic';
}

export interface ProjectWithHistory extends Project {
  history: Array<{ timestamp: number; temperature: number }>;
  densityHistory: Array<{ timestamp: number; density: number }>;
}

class ApiService {
  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`);
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    return response.json();
  }

  async getProject(id: string, start: string = '-30d'): Promise<ProjectWithHistory> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}?start=${start}`);
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    return response.json();
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    return response.json();
  }

  async updateProjectTarget(id: string, targetTemperature: number): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/target`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTemperature })
    });
    if (!response.ok) {
      throw new Error('Failed to update target temperature');
    }
    return response.json();
  }

  async toggleOutlet(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/outlet/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      throw new Error('Failed to toggle outlet');
    }
    return response.json();
  }

  async addDensity(id: string, density: number, timestamp?: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/density`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ density, timestamp })
    });
    if (!response.ok) {
      throw new Error('Failed to add density');
    }
  }

  async toggleControlMode(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/control-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      throw new Error('Failed to toggle control mode');
    }
    return response.json();
  }

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    const response = await fetch(`${API_BASE_URL}/devices`);
    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }
    return response.json();
  }

  async createDevice(device: Omit<Device, 'id'>): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device)
    });
    if (!response.ok) {
      throw new Error('Failed to create device');
    }
    return response.json();
  }

  async deleteDevice(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete device');
    }
  }
}

export const apiService = new ApiService();
