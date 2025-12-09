// Unified Data Service
// Routes to either IndexedDB (local) or GitHub storage based on configuration

import * as local from './storage'
import * as github from './githubStorage'
import type { Recipe, RecipeMetadata, RecipeWithMeta } from '../types'

export type { ShoppingList, ShoppingItem, ShoppingListStatus, PlanningEntry, ExportData } from './storage'
export { isGitHubConfigured, getGitHubConfig, saveGitHubConfig, clearGitHubConfig, testGitHubConnection, initializeDataFolder } from './githubStorage'

// Get the current storage mode
export function getStorageMode(): 'local' | 'github' {
  return github.isGitHubConfigured() ? 'github' : 'local'
}

// ============ RECIPES ============

export async function getAllRecipes(): Promise<Recipe[]> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getAllRecipes(config)
  }
  return local.getAllRecipes()
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getRecipe(config, id)
  }
  return local.getRecipe(id)
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.saveRecipe(config, recipe)
  }
  return local.saveRecipe(recipe)
}

export async function deleteRecipe(id: string): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.deleteRecipe(config, id)
  }
  return local.deleteRecipe(id)
}

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

export async function getMetadata(id: string): Promise<RecipeMetadata | undefined> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getMetadata(config, id)
  }
  return local.getMetadata(id)
}

export async function getAllMetadata(): Promise<RecipeMetadata[]> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getAllMetadata(config)
  }
  return local.getAllMetadata()
}

export async function saveMetadata(metadata: RecipeMetadata): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.saveMetadata(config, metadata)
  }
  return local.saveMetadata(metadata)
}

export async function createDefaultMetadata(recipeId: string): Promise<RecipeMetadata> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.createDefaultMetadata(config, recipeId)
  }
  return local.createDefaultMetadata(recipeId)
}

// ============ COMBINED ============

export async function getRecipeWithMeta(id: string): Promise<RecipeWithMeta | undefined> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getRecipeWithMeta(config, id)
  }
  return local.getRecipeWithMeta(id)
}

export async function getAllRecipesWithMeta(): Promise<RecipeWithMeta[]> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getAllRecipesWithMeta(config)
  }
  return local.getAllRecipesWithMeta()
}

// ============ PLANNING ============

export async function getPlanningForWeek(weekStart: string): Promise<local.PlanningEntry[]> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getPlanningForWeek(config, weekStart)
  }
  return local.getPlanningForWeek(weekStart)
}

export async function savePlanningEntry(entry: local.PlanningEntry): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.savePlanningEntry(config, entry)
  }
  return local.savePlanningEntry(entry)
}

export async function deletePlanningEntry(id: string): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.deletePlanningEntry(config, id)
  }
  return local.deletePlanningEntry(id)
}

// ============ SHOPPING LISTS ============

export async function getAllShoppingLists(): Promise<local.ShoppingList[]> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getAllShoppingLists(config)
  }
  return local.getAllShoppingLists()
}

export async function getShoppingList(id: string): Promise<local.ShoppingList | undefined> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.getShoppingList(config, id)
  }
  return local.getShoppingList(id)
}

export async function saveShoppingList(list: local.ShoppingList): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.saveShoppingList(config, list)
  }
  return local.saveShoppingList(list)
}

export async function deleteShoppingList(id: string): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.deleteShoppingList(config, id)
  }
  return local.deleteShoppingList(id)
}

// ============ EXPORT / IMPORT ============

export async function exportAllData(): Promise<local.ExportData> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.exportAllData(config)
  }
  return local.exportAllData()
}

export async function importAllData(data: local.ExportData): Promise<void> {
  const config = github.getGitHubConfig()
  if (config) {
    return github.importAllData(config, data)
  }
  return local.importAllData(data)
}

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
