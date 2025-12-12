// Unified Data Service
// Routes to either IndexedDB (local) or GitHub storage based on configuration

import * as local from './storage'
import * as github from './githubStorage'
import type { GitHubConfig } from './githubStorage'
import type { Recipe, RecipeMetadata, RecipeWithMeta } from '../types'

export type { ShoppingList, ShoppingItem, ShoppingListStatus, PlanningEntry, ExportData } from './storage'
export { isGitHubConfigured, getGitHubConfig, saveGitHubConfig, clearGitHubConfig, testGitHubConnection, initializeDataFolder } from './githubStorage'

// Helper to route between local and GitHub storage
async function withStorage<T, Args extends unknown[]>(
  localFn: (...args: Args) => Promise<T>,
  githubFn: (config: GitHubConfig, ...args: Args) => Promise<T>,
  ...args: Args
): Promise<T> {
  const config = github.getGitHubConfig()
  if (config) {
    return githubFn(config, ...args)
  }
  return localFn(...args)
}

// Get the current storage mode
export function getStorageMode(): 'local' | 'github' {
  return github.isGitHubConfigured() ? 'github' : 'local'
}

// ============ RECIPES ============

export const getAllRecipes = () =>
  withStorage(local.getAllRecipes, github.getAllRecipes)

export const getRecipe = (id: string) =>
  withStorage(local.getRecipe, github.getRecipe, id)

export const saveRecipe = (recipe: Recipe) =>
  withStorage(local.saveRecipe, github.saveRecipe, recipe)

export const deleteRecipe = (id: string) =>
  withStorage(local.deleteRecipe, github.deleteRecipe, id)

export async function saveAllRecipes(recipes: Recipe[]): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.saveAllRecipes(config, recipes)
  }
  // For local, save each recipe
  for (const recipe of recipes) {
    await local.saveRecipe(recipe)
  }
}

// ============ METADATA ============

export const getMetadata = (id: string) =>
  withStorage(local.getMetadata, github.getMetadata, id)

export const getAllMetadata = () =>
  withStorage(local.getAllMetadata, github.getAllMetadata)

export const saveMetadata = (metadata: RecipeMetadata) =>
  withStorage(local.saveMetadata, github.saveMetadata, metadata)

export const createDefaultMetadata = (recipeId: string) =>
  withStorage(local.createDefaultMetadata, github.createDefaultMetadata, recipeId)

// ============ COMBINED ============

export const getRecipeWithMeta = (id: string) =>
  withStorage(local.getRecipeWithMeta, github.getRecipeWithMeta, id)

export const getAllRecipesWithMeta = () =>
  withStorage(local.getAllRecipesWithMeta, github.getAllRecipesWithMeta)

// ============ PLANNING ============

export const getPlanningForWeek = (weekStart: string) =>
  withStorage(local.getPlanningForWeek, github.getPlanningForWeek, weekStart)

export const savePlanningEntry = (entry: local.PlanningEntry) =>
  withStorage(local.savePlanningEntry, github.savePlanningEntry, entry)

export const deletePlanningEntry = (id: string) =>
  withStorage(local.deletePlanningEntry, github.deletePlanningEntry, id)

// ============ SHOPPING LISTS ============

export const getAllShoppingLists = () =>
  withStorage(local.getAllShoppingLists, github.getAllShoppingLists)

export const getShoppingList = (id: string) =>
  withStorage(local.getShoppingList, github.getShoppingList, id)

export const saveShoppingList = (list: local.ShoppingList) =>
  withStorage(local.saveShoppingList, github.saveShoppingList, list)

export const deleteShoppingList = (id: string) =>
  withStorage(local.deleteShoppingList, github.deleteShoppingList, id)

// ============ EXPORT / IMPORT ============

export const exportAllData = () =>
  withStorage(local.exportAllData, github.exportAllData)

export const importAllData = (data: local.ExportData) =>
  withStorage(local.importAllData, github.importAllData, data)

// ============ MIGRATION ============

// Export data from local IndexedDB
export async function exportLocalData(): Promise<local.ExportData> {
  return local.exportAllData()
}

// Migrate from local IndexedDB to GitHub
export async function migrateToGitHub(): Promise<{ success: boolean; error?: string }> {
  const config = github.getGitHubConfig()
  if (!config) {
    return { success: false, error: 'GitHub non configure' }
  }

  try {
    // Get all local data
    const localData = await local.exportAllData()

    // Check if there's any data to migrate
    const hasData = localData.recipes.length > 0 ||
      localData.metadata.length > 0 ||
      localData.planning.length > 0 ||
      localData.shoppingLists.length > 0

    if (!hasData) {
      return { success: true } // Nothing to migrate
    }

    // Initialize GitHub data folder
    await github.initializeDataFolder(config)

    // Import to GitHub
    await github.importAllData(config, localData)

    return { success: true }
  } catch (e) {
    console.error('Migration error:', e)
    return { success: false, error: e instanceof Error ? e.message : 'Erreur inconnue' }
  }
}

// Clear local data after successful migration
export async function clearLocalData(): Promise<void> {
  return local.clearAllData()
}
