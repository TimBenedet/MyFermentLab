import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client'
import type { BackendProject } from '../types/backend'

export async function fetchBackendProjects(): Promise<BackendProject[]> {
  return apiGet<BackendProject[]>('/projects')
}

export async function fetchBackendProject(id: string): Promise<BackendProject> {
  return apiGet<BackendProject>(`/projects/${id}`)
}

export async function createBackendProject(data: {
  name: string
  fermentationType: string
  sensorId?: string | null
  outletId?: string | null
  targetTemperature?: number
  humiditySensorId?: string | null
  targetHumidity?: number
  controlMode?: string
}): Promise<BackendProject> {
  return apiPost<BackendProject>('/projects', data)
}

export async function updateBackendProject(id: string, data: Partial<BackendProject>): Promise<BackendProject> {
  return apiPatch<BackendProject>(`/projects/${id}`, data)
}

export async function deleteBackendProject(id: string): Promise<void> {
  return apiDelete(`/projects/${id}`)
}

export async function updateTargetTemperature(id: string, temperature: number): Promise<void> {
  await apiPut(`/projects/${id}/target-temperature`, { temperature })
}

export async function toggleOutlet(id: string): Promise<{ active: boolean }> {
  return apiPost<{ active: boolean }>(`/projects/${id}/toggle-outlet`)
}

export async function setControlMode(id: string, mode: string): Promise<void> {
  await apiPut(`/projects/${id}/control-mode`, { mode })
}

export async function fetchLiveTemperature(id: string): Promise<{
  temperature: number
  timestamp: number
  entityId: string
  sensorName: string
  outletChanged?: boolean
}> {
  return apiGet(`/projects/${id}/live-temperature`)
}

export interface BackendHistoryPoint {
  timestamp: number   // ms epoch
  temperature: number
}

export interface BackendHumidityPoint {
  timestamp: number   // ms epoch
  humidity: number
}

export async function fetchProjectHistory(id: string): Promise<{
  history: BackendHistoryPoint[]
  humidityHistory: BackendHumidityPoint[]
}> {
  const project = await apiGet<{
    history: BackendHistoryPoint[]
    humidityHistory: BackendHumidityPoint[]
  }>(`/projects/${id}`)
  return {
    history: project.history ?? [],
    humidityHistory: project.humidityHistory ?? [],
  }
}

export async function archiveBackendProject(id: string): Promise<void> {
  await apiPost(`/projects/${id}/archive`)
}

export async function unarchiveBackendProject(id: string): Promise<void> {
  await apiPost(`/projects/${id}/unarchive`)
}
