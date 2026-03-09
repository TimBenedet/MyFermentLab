import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type { Recipe } from '../types/brewing'

export async function fetchRecipes(): Promise<Recipe[]> {
  return apiGet<Recipe[]>('/recipes')
}

export async function createBackendRecipe(recipe: Recipe): Promise<Recipe> {
  return apiPost<Recipe>('/recipes', recipe)
}

export async function updateBackendRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
  return apiPut<Recipe>(`/recipes/${id}`, updates)
}

export async function deleteBackendRecipe(id: string): Promise<void> {
  return apiDelete(`/recipes/${id}`)
}
