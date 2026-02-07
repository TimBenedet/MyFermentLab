import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type { BackendDevice } from '../types/backend'

export async function fetchDevices(): Promise<BackendDevice[]> {
  return apiGet<BackendDevice[]>('/devices')
}

export async function createDevice(device: Omit<BackendDevice, 'id'>): Promise<BackendDevice> {
  return apiPost<BackendDevice>('/devices', device)
}

export async function updateDevice(id: number, device: Partial<BackendDevice>): Promise<BackendDevice> {
  return apiPut<BackendDevice>(`/devices/${id}`, device)
}

export async function deleteDevice(id: number): Promise<void> {
  return apiDelete(`/devices/${id}`)
}

export async function toggleDevice(id: number): Promise<{ active: boolean }> {
  return apiPost<{ active: boolean }>(`/devices/${id}/toggle`)
}

export async function getDeviceState(id: number): Promise<{ state: string; attributes?: Record<string, unknown> }> {
  return apiGet(`/devices/${id}/state`)
}
