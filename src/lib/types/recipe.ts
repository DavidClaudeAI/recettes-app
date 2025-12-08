export interface Ingredient {
  name: string
  quantity: number
  unit: string
  group?: string // ex: "pour la sauce"
}

export interface HistoryEntry {
  date: string // ISO date string
  notes?: string
}

export interface Recipe {
  id: string
  title: string
  source?: string // URL d'origine
  prepTime?: number // minutes
  cookTime?: number // minutes
  servings: number
  ingredients: Ingredient[]
  steps: string[]
  notes?: string
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
}

export interface RecipeMetadata {
  id: string
  status: 'to-test' | 'testing' | 'validated' | 'archived'
  rating?: number // 1-5
  tags: string[]
  history: HistoryEntry[]
}

export interface RecipeWithMeta extends Recipe {
  metadata: RecipeMetadata
}

export type RecipeStatus = RecipeMetadata['status']
