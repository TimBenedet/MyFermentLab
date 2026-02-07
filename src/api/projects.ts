import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client'
import type { BackendProject } from '../types/backend'

export async function fetchBackendProjects(): Promise<BackendProject[]> {
  return apiGet<BackendProject[]>('/projects')
}

export async function fetchBackendProject(id: number): Promise<BackendProject> {
  return apiGet<BackendProject>(`/projects/${id}`)
}

export async function createBackendProject(data: {
  name: string
  fermentation_type: string
  sensor_id?: number | null
  outlet_id?: number | null
  target_temperature?: number
  humidity_sensor_id?: number | null
  target_humidity?: number
}): Promise<BackendProject> {
  return apiPost<BackendProject>('/projects', data)
}

export async function updateBackendProject(id: number, data: Partial<BackendProject>): Promise<BackendProject> {
  return apiPatch<BackendProject>(`/projects/${id}`, data)
}

export async function deleteBackendProject(id: number): Promise<void> {
  return apiDelete(`/projects/${id}`)
}

export async function updateTargetTemperature(id: number, temperature: number): Promise<void> {
  await apiPut(`/projects/${id}/target-temperature`, { temperature })
}

export async function toggleOutlet(id: number): Promise<{ active: boolean }> {
  return apiPost<{ active: boolean }>(`/projects/${id}/toggle-outlet`)
}

export async function setControlMode(id: number, mode: string): Promise<void> {
  await apiPut(`/projects/${id}/control-mode`, { mode })
}

export async function archiveBackendProject(id: number): Promise<void> {
  await apiPost(`/projects/${id}/archive`)
}

export async function unarchiveBackendProject(id: number): Promise<void> {
  await apiPost(`/projects/${id}/unarchive`)
}
