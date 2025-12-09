import { openDB, type IDBPDatabase } from 'idb'
import type { Recipe, RecipeMetadata, RecipeWithMeta } from '../types'

const DB_NAME = 'recettes-db'
const DB_VERSION = 1

interface RecettesDB {
  recipes: {
    key: string
    value: Recipe
    indexes: { 'by-title': string }
  }
  metadata: {
    key: string
    value: RecipeMetadata
    indexes: { 'by-status': string }
  }
  planning: {
    key: string
    value: PlanningEntry
    indexes: { 'by-week': string }
  }
  shoppingLists: {
    key: string
    value: ShoppingList
  }
}

export interface PlanningEntry {
  id: string
  weekStart: string // ISO date (Monday)
  day: number // 0-6
  slot: 'lunch' | 'dinner'
  recipeId: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity?: number
  unit?: string
  checked: boolean
  category?: string
  fromRecipes?: string[] // recipe titles
}

export type ShoppingListStatus = 'active' | 'completed' | 'archived'

export interface ShoppingList {
  id: string
  name: string
  createdAt: string
  updatedAt?: string
  status: ShoppingListStatus
  items: ShoppingItem[]
}

let dbPromise: Promise<IDBPDatabase<RecettesDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<RecettesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Recipes store
        if (!db.objectStoreNames.contains('recipes')) {
          const recipeStore = db.createObjectStore('recipes', { keyPath: 'id' })
          recipeStore.createIndex('by-title', 'title')
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          const metaStore = db.createObjectStore('metadata', { keyPath: 'id' })
          metaStore.createIndex('by-status', 'status')
        }

        // Planning store
        if (!db.objectStoreNames.contains('planning')) {
          const planningStore = db.createObjectStore('planning', { keyPath: 'id' })
          planningStore.createIndex('by-week', 'weekStart')
        }

        // Shopping lists store
        if (!db.objectStoreNames.contains('shoppingLists')) {
          db.createObjectStore('shoppingLists', { keyPath: 'id' })
        }
      }
    })
  }
  return dbPromise
}

// ============ RECIPES ============

export async function getAllRecipes(): Promise<Recipe[]> {
  const db = await getDB()
  return db.getAll('recipes')
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const db = await getDB()
  return db.get('recipes', id)
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const db = await getDB()
  // Deep clone to remove Svelte 5 Proxy (cannot be stored in IndexedDB)
  const plainRecipe = JSON.parse(JSON.stringify(recipe))
  await db.put('recipes', plainRecipe)
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('recipes', id)
  await db.delete('metadata', id)
}

// ============ METADATA ============

export async function getMetadata(id: string): Promise<RecipeMetadata | undefined> {
  const db = await getDB()
  return db.get('metadata', id)
}

export async function getAllMetadata(): Promise<RecipeMetadata[]> {
  const db = await getDB()
  return db.getAll('metadata')
}

export async function saveMetadata(metadata: RecipeMetadata): Promise<void> {
  const db = await getDB()
  // Deep clone to remove Svelte 5 Proxy (cannot be stored in IndexedDB)
  const plainMetadata = JSON.parse(JSON.stringify(metadata))
  await db.put('metadata', plainMetadata)
}

export async function createDefaultMetadata(recipeId: string): Promise<RecipeMetadata> {
  const metadata: RecipeMetadata = {
    id: recipeId,
    status: 'to-test',
    tags: [],
    history: []
  }
  await saveMetadata(metadata)
  return metadata
}

// ============ COMBINED ============

export async function getRecipeWithMeta(id: string): Promise<RecipeWithMeta | undefined> {
  const [recipe, metadata] = await Promise.all([
    getRecipe(id),
    getMetadata(id)
  ])

  if (!recipe) return undefined

  return {
    ...recipe,
    metadata: metadata || await createDefaultMetadata(id)
  }
}

export async function getAllRecipesWithMeta(): Promise<RecipeWithMeta[]> {
  const [recipes, allMetadata] = await Promise.all([
    getAllRecipes(),
    getAllMetadata()
  ])

  const metaMap = new Map(allMetadata.map(m => [m.id, m]))

  return Promise.all(recipes.map(async recipe => ({
    ...recipe,
    metadata: metaMap.get(recipe.id) || await createDefaultMetadata(recipe.id)
  })))
}

// ============ PLANNING ============

export async function getPlanningForWeek(weekStart: string): Promise<PlanningEntry[]> {
  const db = await getDB()
  const index = db.transaction('planning').store.index('by-week')
  return index.getAll(weekStart)
}

export async function savePlanningEntry(entry: PlanningEntry): Promise<void> {
  const db = await getDB()
  // Deep clone to remove Svelte 5 Proxy (cannot be stored in IndexedDB)
  const plainEntry = JSON.parse(JSON.stringify(entry))
  await db.put('planning', plainEntry)
}

export async function deletePlanningEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('planning', id)
}

// ============ SHOPPING LISTS ============

export async function getAllShoppingLists(): Promise<ShoppingList[]> {
  const db = await getDB()
  return db.getAll('shoppingLists')
}

export async function getShoppingList(id: string): Promise<ShoppingList | undefined> {
  const db = await getDB()
  return db.get('shoppingLists', id)
}

export async function saveShoppingList(list: ShoppingList): Promise<void> {
  const db = await getDB()
  // Deep clone to remove Svelte 5 Proxy (cannot be stored in IndexedDB)
  const plainList = JSON.parse(JSON.stringify(list))
  await db.put('shoppingLists', plainList)
}

export async function deleteShoppingList(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('shoppingLists', id)
}

// ============ EXPORT / IMPORT ============

export interface ExportData {
  version: number
  exportedAt: string
  recipes: Recipe[]
  metadata: RecipeMetadata[]
  planning: PlanningEntry[]
  shoppingLists: ShoppingList[]
}

export async function exportAllData(): Promise<ExportData> {
  const db = await getDB()

  const [recipes, metadata, planning, shoppingLists] = await Promise.all([
    db.getAll('recipes'),
    db.getAll('metadata'),
    db.getAll('planning'),
    db.getAll('shoppingLists')
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

export async function importAllData(data: ExportData): Promise<void> {
  const db = await getDB()

  const tx = db.transaction(['recipes', 'metadata', 'planning', 'shoppingLists'], 'readwrite')

  await Promise.all([
    ...data.recipes.map(r => tx.objectStore('recipes').put(r)),
    ...data.metadata.map(m => tx.objectStore('metadata').put(m)),
    ...data.planning.map(p => tx.objectStore('planning').put(p)),
    ...data.shoppingLists.map(s => tx.objectStore('shoppingLists').put(s)),
    tx.done
  ])
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()

  const tx = db.transaction(['recipes', 'metadata', 'planning', 'shoppingLists'], 'readwrite')

  await Promise.all([
    tx.objectStore('recipes').clear(),
    tx.objectStore('metadata').clear(),
    tx.objectStore('planning').clear(),
    tx.objectStore('shoppingLists').clear(),
    tx.done
  ])
}
