// GitHub Storage Service
// Stores data as JSON files in a GitHub repository

export interface GitHubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

interface GitHubFile {
  content: string
  sha: string
}

const CONFIG_KEY = 'github-config'
const DATA_PATH = 'data'

// Get stored config from localStorage
export function getGitHubConfig(): GitHubConfig | null {
  const stored = localStorage.getItem(CONFIG_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

// Save config to localStorage
export function saveGitHubConfig(config: GitHubConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

// Clear config
export function clearGitHubConfig(): void {
  localStorage.removeItem(CONFIG_KEY)
}

// Check if GitHub is configured
export function isGitHubConfigured(): boolean {
  const config = getGitHubConfig()
  return !!(config?.token && config?.owner && config?.repo)
}

// GitHub API helpers
async function githubFetch(
  config: GitHubConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  return response
}

// Get file content from GitHub
async function getFile(config: GitHubConfig, path: string): Promise<GitHubFile | null> {
  const response = await githubFetch(config, `/contents/${path}?ref=${config.branch}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()
  // Decode base64 + UTF-8 properly
  const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))))

  return {
    content,
    sha: data.sha
  }
}

// Save file to GitHub
async function saveFile(
  config: GitHubConfig,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: config.branch
  }

  if (sha) {
    body.sha = sha
  }

  const response = await githubFetch(config, `/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    if (response.status === 403) {
      throw new Error('Permission refusee. Verifiez que le token a "Contents: Read and write".')
    }
    if (response.status === 404) {
      throw new Error('Branche ou repo non trouve. Verifiez la config.')
    }
    if (response.status === 409) {
      throw new Error('Conflit de version. Rechargez la page et reessayez.')
    }
    throw new Error(`Erreur GitHub: ${error.message || response.status}`)
  }
}

// Delete file from GitHub
async function deleteFile(
  config: GitHubConfig,
  path: string,
  sha: string,
  message: string
): Promise<void> {
  const response = await githubFetch(config, `/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha,
      branch: config.branch
    })
  })

  if (!response.ok) {
    throw new Error(`GitHub delete error: ${response.status}`)
  }
}

// Data file paths
const FILES = {
  recipes: `${DATA_PATH}/recipes.json`,
  metadata: `${DATA_PATH}/metadata.json`,
  planning: `${DATA_PATH}/planning.json`,
  shoppingLists: `${DATA_PATH}/shopping-lists.json`
}

// SHA cache to avoid refetching
const shaCache = new Map<string, string>()

// Generic data operations
async function getData<T>(config: GitHubConfig, fileKey: keyof typeof FILES): Promise<T[]> {
  const file = await getFile(config, FILES[fileKey])

  if (!file) {
    return []
  }

  shaCache.set(fileKey, file.sha)

  try {
    return JSON.parse(file.content)
  } catch {
    return []
  }
}

async function saveData<T>(
  config: GitHubConfig,
  fileKey: keyof typeof FILES,
  data: T[],
  message: string
): Promise<void> {
  const content = JSON.stringify(data, null, 2)

  // Always get fresh SHA to avoid conflicts
  const existingFile = await getFile(config, FILES[fileKey])
  const sha = existingFile?.sha

  await saveFile(config, FILES[fileKey], content, message, sha)

  // Update SHA cache
  const newFile = await getFile(config, FILES[fileKey])
  if (newFile) {
    shaCache.set(fileKey, newFile.sha)
  }
}

// ============ PUBLIC API ============

import type { Recipe, RecipeMetadata, RecipeWithMeta } from '../types'
import type { PlanningEntry, ShoppingList } from './storage'

// Test connection to GitHub
export async function testGitHubConnection(config: GitHubConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // Test repo access
    const response = await githubFetch(config, '')

    if (response.status === 401) {
      return { success: false, error: 'Token invalide' }
    }

    if (response.status === 404) {
      return { success: false, error: 'Repository non trouve' }
    }

    if (response.status === 403) {
      return { success: false, error: 'Token n\'a pas acces a ce repo. Verifiez les permissions.' }
    }

    if (!response.ok) {
      return { success: false, error: `Erreur ${response.status}` }
    }

    // Check if repo has commits (not empty)
    const repoData = await response.json()
    if (repoData.size === 0) {
      return { success: false, error: 'Le repo est vide. Ajoutez un README.md d\'abord sur GitHub.' }
    }

    // Test write permission by checking if we can read contents
    const contentsResponse = await githubFetch(config, `/contents?ref=${config.branch}`)
    if (contentsResponse.status === 403) {
      return { success: false, error: 'Permission "Contents: Read and write" requise sur le token.' }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: 'Erreur de connexion' }
  }
}

// Initialize data folder if needed
export async function initializeDataFolder(config: GitHubConfig): Promise<void> {
  // Try to create a .gitkeep file to ensure the data folder exists
  const file = await getFile(config, `${DATA_PATH}/.gitkeep`)

  if (!file) {
    await saveFile(config, `${DATA_PATH}/.gitkeep`, '', 'Initialize data folder')
  }
}

// ============ RECIPES ============

export async function getAllRecipes(config: GitHubConfig): Promise<Recipe[]> {
  return getData<Recipe>(config, 'recipes')
}

export async function getRecipe(config: GitHubConfig, id: string): Promise<Recipe | undefined> {
  const recipes = await getAllRecipes(config)
  return recipes.find(r => r.id === id)
}

export async function saveRecipe(config: GitHubConfig, recipe: Recipe): Promise<void> {
  const recipes = await getAllRecipes(config)
  const index = recipes.findIndex(r => r.id === recipe.id)

  if (index >= 0) {
    recipes[index] = recipe
  } else {
    recipes.push(recipe)
  }

  await saveData(config, 'recipes', recipes, `Update recipe: ${recipe.title}`)
}

export async function deleteRecipe(config: GitHubConfig, id: string): Promise<void> {
  const recipes = await getAllRecipes(config)
  const filtered = recipes.filter(r => r.id !== id)
  await saveData(config, 'recipes', filtered, `Delete recipe ${id}`)

  // Also delete metadata
  const metadata = await getAllMetadata(config)
  const filteredMeta = metadata.filter(m => m.id !== id)
  await saveData(config, 'metadata', filteredMeta, `Delete metadata ${id}`)
}

export async function saveAllRecipes(config: GitHubConfig, recipes: Recipe[]): Promise<void> {
  await saveData(config, 'recipes', recipes, `Bulk update ${recipes.length} recipes`)
}

// ============ METADATA ============

export async function getAllMetadata(config: GitHubConfig): Promise<RecipeMetadata[]> {
  return getData<RecipeMetadata>(config, 'metadata')
}

export async function getMetadata(config: GitHubConfig, id: string): Promise<RecipeMetadata | undefined> {
  const metadata = await getAllMetadata(config)
  return metadata.find(m => m.id === id)
}

export async function saveMetadata(config: GitHubConfig, meta: RecipeMetadata): Promise<void> {
  const metadata = await getAllMetadata(config)
  const index = metadata.findIndex(m => m.id === meta.id)

  if (index >= 0) {
    metadata[index] = meta
  } else {
    metadata.push(meta)
  }

  await saveData(config, 'metadata', metadata, `Update metadata ${meta.id}`)
}

export async function createDefaultMetadata(config: GitHubConfig, recipeId: string): Promise<RecipeMetadata> {
  const metadata: RecipeMetadata = {
    id: recipeId,
    status: 'to-test',
    tags: [],
    history: []
  }
  await saveMetadata(config, metadata)
  return metadata
}

// ============ COMBINED ============

export async function getRecipeWithMeta(config: GitHubConfig, id: string): Promise<RecipeWithMeta | undefined> {
  const [recipe, metadata] = await Promise.all([
    getRecipe(config, id),
    getMetadata(config, id)
  ])

  if (!recipe) return undefined

  return {
    ...recipe,
    metadata: metadata || await createDefaultMetadata(config, id)
  }
}

export async function getAllRecipesWithMeta(config: GitHubConfig): Promise<RecipeWithMeta[]> {
  const [recipes, allMetadata] = await Promise.all([
    getAllRecipes(config),
    getAllMetadata(config)
  ])

  const metaMap = new Map(allMetadata.map(m => [m.id, m]))

  return Promise.all(recipes.map(async recipe => ({
    ...recipe,
    metadata: metaMap.get(recipe.id) || await createDefaultMetadata(config, recipe.id)
  })))
}

// ============ PLANNING ============

export async function getAllPlanning(config: GitHubConfig): Promise<PlanningEntry[]> {
  return getData<PlanningEntry>(config, 'planning')
}

export async function getPlanningForWeek(config: GitHubConfig, weekStart: string): Promise<PlanningEntry[]> {
  const planning = await getAllPlanning(config)
  return planning.filter(p => p.weekStart === weekStart)
}

export async function savePlanningEntry(config: GitHubConfig, entry: PlanningEntry): Promise<void> {
  const planning = await getAllPlanning(config)
  const index = planning.findIndex(p => p.id === entry.id)

  if (index >= 0) {
    planning[index] = entry
  } else {
    planning.push(entry)
  }

  await saveData(config, 'planning', planning, `Update planning ${entry.id}`)
}

export async function deletePlanningEntry(config: GitHubConfig, id: string): Promise<void> {
  const planning = await getAllPlanning(config)
  const filtered = planning.filter(p => p.id !== id)
  await saveData(config, 'planning', filtered, `Delete planning ${id}`)
}

// ============ SHOPPING LISTS ============

export async function getAllShoppingLists(config: GitHubConfig): Promise<ShoppingList[]> {
  return getData<ShoppingList>(config, 'shoppingLists')
}

export async function getShoppingList(config: GitHubConfig, id: string): Promise<ShoppingList | undefined> {
  const lists = await getAllShoppingLists(config)
  return lists.find(l => l.id === id)
}

export async function saveShoppingList(config: GitHubConfig, list: ShoppingList): Promise<void> {
  const lists = await getAllShoppingLists(config)
  const index = lists.findIndex(l => l.id === list.id)

  if (index >= 0) {
    lists[index] = list
  } else {
    lists.push(list)
  }

  await saveData(config, 'shoppingLists', lists, `Update shopping list: ${list.name}`)
}

export async function deleteShoppingList(config: GitHubConfig, id: string): Promise<void> {
  const lists = await getAllShoppingLists(config)
  const filtered = lists.filter(l => l.id !== id)
  await saveData(config, 'shoppingLists', filtered, `Delete shopping list ${id}`)
}

// ============ EXPORT ALL DATA ============

export interface ExportData {
  version: number
  exportedAt: string
  recipes: Recipe[]
  metadata: RecipeMetadata[]
  planning: PlanningEntry[]
  shoppingLists: ShoppingList[]
}

export async function exportAllData(config: GitHubConfig): Promise<ExportData> {
  const [recipes, metadata, planning, shoppingLists] = await Promise.all([
    getAllRecipes(config),
    getAllMetadata(config),
    getAllPlanning(config),
    getAllShoppingLists(config)
  ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes,
    metadata,
    planning,
    shoppingLists
  }
}

export async function importAllData(config: GitHubConfig, data: ExportData): Promise<void> {
  // Sequential writes to avoid conflicts
  await saveData(config, 'recipes', data.recipes, 'Import recipes')
  await saveData(config, 'metadata', data.metadata, 'Import metadata')
  await saveData(config, 'planning', data.planning, 'Import planning')
  await saveData(config, 'shoppingLists', data.shoppingLists, 'Import shopping lists')
}

// Clear SHA cache (useful after sync issues)
export function clearCache(): void {
  shaCache.clear()
}
