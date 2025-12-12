import { writable, derived, type Readable } from 'svelte/store'
import { v4 as uuidv4 } from 'uuid'
import type { Recipe, RecipeMetadata, RecipeWithMeta, RecipeStatus } from '../types'
import * as dataService from '../services/dataService'

// Debounce helper for stores
function debounceStore<T>(store: Readable<T>, delay: number): Readable<T> {
  let timeout: ReturnType<typeof setTimeout>
  let initialValue: T

  // Get initial value synchronously
  const unsubscribe = store.subscribe(v => { initialValue = v })
  unsubscribe()

  return derived(store, ($value, set) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => set($value), delay)
    return () => clearTimeout(timeout)
  }, initialValue!)
}

// Main store for recipes with metadata
const recipesStore = writable<RecipeWithMeta[]>([])
const loadingStore = writable(true)
const errorStore = writable<string | null>(null)

// Filters
const searchQueryStore = writable('')
const debouncedSearchStore = debounceStore(searchQueryStore, 300)
const statusFilterStore = writable<RecipeStatus | null>(null)
const tagsFilterStore = writable<string[]>([])
const minRatingStore = writable<number | null>(null)

// Derived store for filtered recipes (uses debounced search for performance)
export const filteredRecipes = derived(
  [recipesStore, debouncedSearchStore, statusFilterStore, tagsFilterStore, minRatingStore],
  ([$recipes, $search, $status, $tags, $minRating]) => {
    let result = $recipes

    // Search filter
    if ($search.trim()) {
      const query = $search.toLowerCase().trim()
      result = result.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.ingredients.some(i => i.name.toLowerCase().includes(query)) ||
        r.metadata.tags.some(t => t.toLowerCase().includes(query)) ||
        r.notes?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if ($status) {
      result = result.filter(r => r.metadata.status === $status)
    }

    // Tags filter
    if ($tags.length > 0) {
      result = result.filter(r =>
        $tags.every(tag => r.metadata.tags.includes(tag))
      )
    }

    // Rating filter
    if ($minRating !== null) {
      result = result.filter(r =>
        r.metadata.rating !== undefined && r.metadata.rating >= $minRating
      )
    }

    return result
  }
)

// All unique tags across recipes
export const allTags = derived(recipesStore, $recipes => {
  const tags = new Set<string>()
  $recipes.forEach(r => r.metadata.tags.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
})

// Load initial data
export async function loadRecipes() {
  loadingStore.set(true)
  errorStore.set(null)

  try {
    const recipes = await dataService.getAllRecipesWithMeta()
    recipesStore.set(recipes)
  } catch (e) {
    errorStore.set('Erreur lors du chargement des recettes')
    console.error(e)
  } finally {
    loadingStore.set(false)
  }
}

// Create a new recipe
export async function createRecipe(recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = uuidv4()
  const now = new Date().toISOString()

  const recipe: Recipe = {
    ...recipeData,
    id,
    createdAt: now,
    updatedAt: now
  }

  const metadata: RecipeMetadata = {
    id,
    status: 'to-test',
    tags: [],
    history: []
  }

  await dataService.saveRecipe(recipe)
  await dataService.saveMetadata(metadata)

  recipesStore.update(recipes => [...recipes, { ...recipe, metadata }])

  return id
}

// Update a recipe
export async function updateRecipe(id: string, updates: Partial<Recipe>): Promise<void> {
  const existing = await dataService.getRecipe(id)
  if (!existing) throw new Error('Recipe not found')

  const updated: Recipe = {
    ...existing,
    ...updates,
    id, // prevent ID change
    updatedAt: new Date().toISOString()
  }

  await dataService.saveRecipe(updated)

  recipesStore.update(recipes =>
    recipes.map(r => r.id === id ? { ...r, ...updated } : r)
  )
}

// Update metadata
export async function updateMetadata(id: string, updates: Partial<RecipeMetadata>): Promise<void> {
  let existing = await dataService.getMetadata(id)

  // Create default metadata if it doesn't exist
  if (!existing) {
    existing = await dataService.createDefaultMetadata(id)
  }

  const updated: RecipeMetadata = {
    ...existing,
    ...updates,
    id // prevent ID change
  }

  await dataService.saveMetadata(updated)

  recipesStore.update(recipes =>
    recipes.map(r => r.id === id ? { ...r, metadata: updated } : r)
  )
}

// Delete a recipe
export async function deleteRecipe(id: string): Promise<void> {
  await dataService.deleteRecipe(id)

  recipesStore.update(recipes => recipes.filter(r => r.id !== id))
}

// Add history entry
export async function addHistoryEntry(id: string, notes?: string): Promise<void> {
  const metadata = await dataService.getMetadata(id)
  if (!metadata) throw new Error('Metadata not found')

  const entry = {
    date: new Date().toISOString(),
    notes
  }

  await updateMetadata(id, {
    history: [...metadata.history, entry]
  })
}

// Export stores
export const recipes = { subscribe: recipesStore.subscribe }
export const loading = { subscribe: loadingStore.subscribe }
export const error = { subscribe: errorStore.subscribe }
export const searchQuery = searchQueryStore
export const statusFilter = statusFilterStore
export const tagsFilter = tagsFilterStore
export const minRating = minRatingStore
