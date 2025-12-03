import { Project, Device, FermentationType, BrewingLogEntry, BrewingSession } from '../types';

const API_BASE_URL = '/api';

// Get auth headers - access localStorage directly since we can't use hooks in a class
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

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

export interface ProjectStats {
  duration: {
    days: number;
    hours: number;
    minutes: number;
    totalMs: number;
  };
  temperature: {
    average: number;
    min: number;
    max: number;
    stdDeviation: number;
  };
  density?: {
    initial: number;
    final: number;
    abv: number;
  };
  heatingHours: number;
  dataPoints: number;
}

export interface ProjectStatsResponse {
  project: Project;
  stats: ProjectStats;
  temperatureHistory: Array<{ timestamp: number; temperature: number }>;
  densityHistory: Array<{ timestamp: number; density: number }>;
}

class ApiService {
  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    return response.json();
  }

  async getProject(id: string, start: string = '-30d'): Promise<ProjectWithHistory> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}?start=${start}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    return response.json();
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    if (!response.ok) {
      throw new Error('Failed to toggle outlet');
    }
    return response.json();
  }

  async addDensity(id: string, density: number, timestamp?: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/density`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ density, timestamp })
    });
    if (!response.ok) {
      throw new Error('Failed to add density');
    }
  }

  async toggleControlMode(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/control-mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    if (!response.ok) {
      throw new Error('Failed to toggle control mode');
    }
    return response.json();
  }

  async completeProject(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    if (!response.ok) {
      throw new Error('Failed to complete project');
    }
    return response.json();
  }

  async archiveProject(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/archive`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    if (!response.ok) {
      throw new Error('Failed to archive project');
    }
    return response.json();
  }

  async getProjectStats(id: string): Promise<ProjectStatsResponse> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/stats`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch project stats');
    }
    return response.json();
  }

  async unarchiveProject(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/unarchive`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to unarchive project');
    }
    return response.json();
  }

  async deleteProject(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  async updateProjectLog(id: string, brewingLog: BrewingLogEntry[]): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}/log`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ brewingLog })
    });
    if (!response.ok) {
      throw new Error('Failed to update brewing log');
    }
    return response.json();
  }

  async updateProject(id: string, data: { brewingSession?: BrewingSession }): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error('Failed to update project');
    }
    return response.json();
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to fetch devices');
    }
    return response.json();
  }

  async createDevice(device: Omit<Device, 'id'>): Promise<Device> {
    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(device)
    });
    if (!response.ok) {
      throw new Error('Failed to create device');
    }
    return response.json();
  }

  async deleteDevice(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/devices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to delete device');
    }
  }
}

export const apiService = new ApiService();
