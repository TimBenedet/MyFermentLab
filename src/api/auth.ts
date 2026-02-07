import { apiPost, apiGet } from './client'
import type { AuthResponse } from '../types/backend'

export async function login(password: string): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/auth/login', { password })
  localStorage.setItem('auth_token', data.token)
  localStorage.setItem('auth_role', data.role)
  return data
}

export async function loginAsViewer(): Promise<AuthResponse> {
  const data = await apiPost<AuthResponse>('/auth/viewer')
  localStorage.setItem('auth_token', data.token)
  localStorage.setItem('auth_role', data.role)
  return data
}

export function logout() {
  const token = localStorage.getItem('auth_token')
  if (token) {
    apiPost('/auth/logout').catch(() => {})
  }
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_role')
}

export async function verifyToken(): Promise<boolean> {
  try {
    await apiGet<{ valid: boolean }>('/auth/verify')
    return true
  } catch {
    return false
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function getStoredRole(): 'admin' | 'viewer' | null {
  return localStorage.getItem('auth_role') as 'admin' | 'viewer' | null
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('auth_token')
}

export function isAdmin(): boolean {
  return localStorage.getItem('auth_role') === 'admin'
}
