// GitHub Storage Service
// Stores data as JSON files in a GitHub repository

// Hardcoded repo configuration (same repo as the app)
const DEFAULT_OWNER = 'DavidClaudeAI'
const DEFAULT_REPO = 'recettes-app'
const DEFAULT_BRANCH = 'main'

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

const CONFIG_KEY = 'github-token'
const DATA_PATH = 'data'

// UTF-8 safe Base64 encoding/decoding (replaces deprecated unescape/escape)
function encodeBase64Utf8(content: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)
  const binString = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binString)
}

function decodeBase64Utf8(base64: string): string {
  const binString = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binString, c => c.charCodeAt(0))
  const decoder = new TextDecoder()
  return decoder.decode(bytes)
}

// Get stored config from localStorage (only token is stored, rest is hardcoded)
export function getGitHubConfig(): GitHubConfig | null {
  const token = localStorage.getItem(CONFIG_KEY)
  if (!token) return null
  return {
    token,
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH
  }
}

// Save token to localStorage (owner/repo/branch are hardcoded)
export function saveGitHubConfig(config: GitHubConfig): void {
  localStorage.setItem(CONFIG_KEY, config.token)
}

// Save just the token
export function saveGitHubToken(token: string): void {
  localStorage.setItem(CONFIG_KEY, token)
}

// Clear config
export function clearGitHubConfig(): void {
  localStorage.removeItem(CONFIG_KEY)
}

// Check if GitHub is configured (just need a token)
export function isGitHubConfigured(): boolean {
  const token = localStorage.getItem(CONFIG_KEY)
  return !!token
}

// Get the hardcoded repo info for display
export function getRepoInfo(): { owner: string; repo: string; branch: string } {
  return {
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH
  }
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
async function getFile(config: GitHubConfig, path: string, noCache = false): Promise<GitHubFile | null> {
  // Add timestamp to prevent caching when needed
  const cacheBuster = noCache ? `&_t=${Date.now()}` : ''
  const response = await githubFetch(config, `/contents/${path}?ref=${config.branch}${cacheBuster}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()
  // Decode base64 + UTF-8 properly
  const content = decodeBase64Utf8(data.content)

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
    content: encodeBase64Utf8(content),
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
async function getData<T>(config: GitHubConfig, fileKey: keyof typeof FILES, noCache = false): Promise<T[]> {
  const file = await getFile(config, FILES[fileKey], noCache)

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
  message: string,
  maxRetries = 3
): Promise<void> {
  const content = JSON.stringify(data, null, 2)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Always get fresh SHA to avoid conflicts (noCache=true)
      const existingFile = await getFile(config, FILES[fileKey], true)
      const sha = existingFile?.sha

      await saveFile(config, FILES[fileKey], content, message, sha)

      // Update SHA cache
      const newFile = await getFile(config, FILES[fileKey])
      if (newFile) {
        shaCache.set(fileKey, newFile.sha)
      }
      return // Success
    } catch (error) {
      const isConflict = error instanceof Error && error.message.includes('Conflit')
      if (isConflict && attempt < maxRetries - 1) {
        // Wait with exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
        continue
      }
      throw error
    }
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

export async function getAllMetadata(config: GitHubConfig, noCache = false): Promise<RecipeMetadata[]> {
  return getData<RecipeMetadata>(config, 'metadata', noCache)
}

export async function getMetadata(config: GitHubConfig, id: string): Promise<RecipeMetadata | undefined> {
  const metadata = await getAllMetadata(config)
  return metadata.find(m => m.id === id)
}

export async function saveMetadata(config: GitHubConfig, meta: RecipeMetadata, maxRetries = 3): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use noCache=true to get fresh data and avoid stale SHA conflicts
      const metadata = await getAllMetadata(config, true)
      const index = metadata.findIndex(m => m.id === meta.id)

      if (index >= 0) {
        metadata[index] = meta
      } else {
        metadata.push(meta)
      }

      await saveData(config, 'metadata', metadata, `Update metadata ${meta.id}`, 1)
      return
    } catch (error) {
      const isConflict = error instanceof Error && error.message.includes('Conflit')
      if (isConflict && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 150 * Math.pow(2, attempt)))
        continue
      }
      throw error
    }
  }
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

export async function getAllPlanning(config: GitHubConfig, noCache = false): Promise<PlanningEntry[]> {
  return getData<PlanningEntry>(config, 'planning', noCache)
}

export async function getPlanningForWeek(config: GitHubConfig, weekStart: string): Promise<PlanningEntry[]> {
  const planning = await getAllPlanning(config)
  return planning.filter(p => p.weekStart === weekStart)
}

export async function savePlanningEntry(config: GitHubConfig, entry: PlanningEntry, maxRetries = 3): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use noCache=true to get fresh data and avoid stale SHA conflicts
      const planning = await getAllPlanning(config, true)
      const index = planning.findIndex(p => p.id === entry.id)

      if (index >= 0) {
        planning[index] = entry
      } else {
        planning.push(entry)
      }

      await saveData(config, 'planning', planning, `Update planning ${entry.id}`, 1)
      return
    } catch (error) {
      const isConflict = error instanceof Error && error.message.includes('Conflit')
      if (isConflict && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 150 * Math.pow(2, attempt)))
        continue
      }
      throw error
    }
  }
}

export async function deletePlanningEntry(config: GitHubConfig, id: string): Promise<void> {
  const planning = await getAllPlanning(config)
  const filtered = planning.filter(p => p.id !== id)
  await saveData(config, 'planning', filtered, `Delete planning ${id}`)
}

// ============ SHOPPING LISTS ============

export async function getAllShoppingLists(config: GitHubConfig, noCache = false): Promise<ShoppingList[]> {
  return getData<ShoppingList>(config, 'shoppingLists', noCache)
}

export async function getShoppingList(config: GitHubConfig, id: string): Promise<ShoppingList | undefined> {
  const lists = await getAllShoppingLists(config)
  return lists.find(l => l.id === id)
}

export async function saveShoppingList(config: GitHubConfig, list: ShoppingList, maxRetries = 3): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use noCache=true to get fresh data and avoid stale SHA conflicts
      const lists = await getAllShoppingLists(config, true)
      const index = lists.findIndex(l => l.id === list.id)

      if (index >= 0) {
        lists[index] = list
      } else {
        lists.push(list)
      }

      await saveData(config, 'shoppingLists', lists, `Update shopping list: ${list.name}`, 1)
      return
    } catch (error) {
      const isConflict = error instanceof Error && error.message.includes('Conflit')
      if (isConflict && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 150 * Math.pow(2, attempt)))
        continue
      }
      throw error
    }
  }
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
