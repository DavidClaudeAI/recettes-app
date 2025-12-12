import type { Ingredient } from '../types'

// JSON-LD Schema.org types
interface JsonLdItem {
  '@type'?: string | string[]
  '@graph'?: JsonLdItem[]
  text?: string
  description?: string
  name?: string
  itemListElement?: JsonLdItem[]
  [key: string]: unknown
}

interface HowToStep extends JsonLdItem {
  '@type': 'HowToStep' | string[]
  text?: string
  description?: string
  name?: string
}

interface HowToSection extends JsonLdItem {
  '@type': 'HowToSection' | string[]
  itemListElement?: HowToStep[]
}

interface RecipeSchema extends JsonLdItem {
  '@type': 'Recipe' | string[]
  name?: string
  prepTime?: string
  cookTime?: string
  recipeYield?: string | number | string[]
  recipeIngredient?: string[]
  recipeInstructions?: InstructionItem[] | string
  recipeSteps?: InstructionItem[] | string
  image?: string | string[] | { url?: string }
}

type InstructionItem = string | HowToStep | HowToSection

// Upgrade HTTP URLs to HTTPS to avoid mixed content issues
export function secureImageUrl(url: string | undefined): string | undefined {
  if (!url) return url
  // Skip data URLs (base64)
  if (url.startsWith('data:')) return url
  // Upgrade HTTP to HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

// Decode HTML entities like &#39; &amp; etc. (using DOMParser for safety)
function decodeHtmlEntities(text: string): string {
  if (!text) return text
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return doc.body.textContent || text
}

export interface ParsedRecipe {
  title: string
  source: string
  prepTime?: number
  cookTime?: number
  servings: number
  ingredients: Ingredient[]
  steps: string[]
  image?: string
}

// Parse ISO 8601 duration (PT15M, PT1H30M, etc.)
function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return undefined

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  return hours * 60 + minutes
}

// Parse yield/servings from various formats
function parseServings(recipeYield: string | number | string[] | undefined): number {
  if (!recipeYield) return 4

  if (typeof recipeYield === 'number') return recipeYield

  const yieldStr = Array.isArray(recipeYield) ? recipeYield[0] : recipeYield
  const match = yieldStr.match(/(\d+)/)
  return match ? parseInt(match[1]) : 4
}

// Parse ingredient string into structured format
export function parseIngredientString(str: string): Ingredient {
  // Decode HTML entities and clean up the string
  str = decodeHtmlEntities(str).trim().replace(/\s+/g, ' ')

  // Pattern 1: quantity + known unit + ingredient name
  // "2 cups flour", "250 g de farine", "1/2 c. à soupe sucre"
  const unitPattern = /^([\d\/\.\,]+(?:\s*[\d\/]+)?)\s*(cups?|tasses?|c\.\s*à\s*s\.?|c\.\s*à\s*c\.?|cuillères?\s*à\s*(?:soupe|café)|tbsp?|tsp?|tablespoons?|teaspoons?|ml|cl|l|litres?|g|kg|grammes?|kilogrammes?|oz|ounces?|lb|lbs?|pounds?|tranches?|slices?|gousses?|cloves?)\s+(?:de\s+)?(.+)$/i

  const unitMatch = str.match(unitPattern)
  if (unitMatch) {
    return {
      quantity: parseQuantity(unitMatch[1]),
      unit: normalizeUnit(unitMatch[2]),
      name: unitMatch[3].trim()
    }
  }

  // Pattern 2: quantity + ingredient name (no unit, like "2 oeufs", "3 poivrons")
  const noUnitPattern = /^([\d\/\.\,]+)\s+(.+)$/
  const noUnitMatch = str.match(noUnitPattern)
  if (noUnitMatch) {
    return {
      quantity: parseQuantity(noUnitMatch[1]),
      unit: '',
      name: noUnitMatch[2].trim()
    }
  }

  // Fallback: just the name
  return { quantity: 1, unit: '', name: str }
}

function parseQuantity(str: string): number {
  str = str.replace(',', '.').trim()

  // Handle fractions like "1/2" or "1 1/2"
  if (str.includes('/')) {
    const parts = str.split(/\s+/)
    let total = 0

    for (const part of parts) {
      if (part.includes('/')) {
        const [num, den] = part.split('/')
        total += parseInt(num) / parseInt(den)
      } else {
        total += parseFloat(part) || 0
      }
    }
    return total
  }

  return parseFloat(str) || 1
}

function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'cup': 'tasse',
    'cups': 'tasses',
    'tbsp': 'c. à soupe',
    'tablespoon': 'c. à soupe',
    'tablespoons': 'c. à soupe',
    'tsp': 'c. à café',
    'teaspoon': 'c. à café',
    'teaspoons': 'c. à café',
    'c. à s.': 'c. à soupe',
    'c. à c.': 'c. à café',
    'cuillère à soupe': 'c. à soupe',
    'cuillères à soupe': 'c. à soupe',
    'cuillère à café': 'c. à café',
    'cuillères à café': 'c. à café',
    'gramme': 'g',
    'grammes': 'g',
    'kilogramme': 'kg',
    'kilogrammes': 'kg',
    'litre': 'L',
    'litres': 'L',
    'l': 'L',
    'ounce': 'oz',
    'ounces': 'oz',
    'pound': 'lb',
    'pounds': 'lb',
    'lbs': 'lb',
    'piece': '',
    'pieces': '',
    'pièce': '',
    'pièces': '',
  }

  return unitMap[unit.toLowerCase()] || unit
}

// Check if type matches (handles prefixes like "schema:HowToStep")
function isType(item: JsonLdItem, typeName: string): boolean {
  const type = item['@type']
  if (!type) return false
  if (Array.isArray(type)) {
    return type.some(t => t === typeName || t.endsWith(`:${typeName}`) || t.endsWith(`/${typeName}`))
  }
  return type === typeName || type.endsWith(`:${typeName}`) || type.endsWith(`/${typeName}`)
}

// Parse instructions from various formats
function parseInstructions(instructions: InstructionItem[] | string | JsonLdItem | undefined): string[] {
  if (!instructions) return []

  // Array of items
  if (Array.isArray(instructions)) {
    return instructions.flatMap((item: InstructionItem) => {
      if (typeof item === 'string') return [decodeHtmlEntities(item)]
      if (isType(item, 'HowToStep')) {
        return [decodeHtmlEntities(item.text || item.description || item.name || '')]
      }
      if (isType(item, 'HowToSection')) {
        return parseInstructions(item.itemListElement as InstructionItem[])
      }
      // Object without @type but with text
      if (item.text) return [decodeHtmlEntities(item.text)]
      return []
    }).filter(s => s.trim())
  }

  // Single string (split by newlines or numbered steps)
  if (typeof instructions === 'string') {
    return instructions
      .split(/\n|(?=\d+\.\s)/)
      .map(s => decodeHtmlEntities(s.replace(/^\d+\.\s*/, '').trim()))
      .filter(s => s)
  }

  // Single object
  if (typeof instructions === 'object' && instructions.text) {
    return [decodeHtmlEntities(instructions.text)]
  }

  return []
}

// Extract JSON-LD from HTML
export function extractJsonLd(html: string): JsonLdItem[] {
  const scripts: JsonLdItem[] = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1]) as JsonLdItem | JsonLdItem[]
      if (Array.isArray(json)) {
        scripts.push(...json)
      } else {
        scripts.push(json)
      }
    } catch (error) {
      // Log but continue - websites often have multiple JSON-LD scripts
      console.warn('JSON-LD invalide ignoré:', error instanceof Error ? error.message : error)
    }
  }

  return scripts
}

// Find Recipe schema in JSON-LD
function findRecipeSchema(jsonLdList: JsonLdItem[]): RecipeSchema | null {
  for (const item of jsonLdList) {
    if (isType(item, 'Recipe')) {
      return item as RecipeSchema
    }
    if (item['@graph']) {
      const found = findRecipeSchema(item['@graph'])
      if (found) return found
    }
  }
  return null
}

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | undefined> {
  if (!imageUrl) return undefined

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(proxyUrl)

    if (!response.ok) return undefined

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return undefined

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('Échec du téléchargement de l\'image:', imageUrl, error instanceof Error ? error.message : error)
    return undefined
  }
}

// Extract image URL from various schema formats
function extractImageUrl(image: string | string[] | { url?: string } | undefined): string | undefined {
  if (!image) return undefined
  if (Array.isArray(image)) return image[0]
  if (typeof image === 'object' && image.url) return image.url
  if (typeof image === 'string') return image
  return undefined
}

// Main parsing function
export function parseRecipeFromHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const jsonLdList = extractJsonLd(html)
  const recipeSchema = findRecipeSchema(jsonLdList)

  if (!recipeSchema) {
    return null
  }

  const ingredients = (recipeSchema.recipeIngredient || []).map(parseIngredientString)
  const steps = parseInstructions(recipeSchema.recipeInstructions || recipeSchema.recipeSteps)

  return {
    title: decodeHtmlEntities(recipeSchema.name || '') || 'Recette sans titre',
    source: sourceUrl,
    prepTime: parseDuration(recipeSchema.prepTime),
    cookTime: parseDuration(recipeSchema.cookTime),
    servings: parseServings(recipeSchema.recipeYield),
    ingredients,
    steps,
    image: extractImageUrl(recipeSchema.image)
  }
}

// CORS proxies to try in order
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
]

// Fetch with timeout
async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Fetch HTML through CORS proxy with fallback
async function fetchHtmlWithProxy(url: string): Promise<string> {
  let lastError: Error | null = null

  for (const proxyFn of CORS_PROXIES) {
    const proxyUrl = proxyFn(url)
    try {
      const response = await fetchWithTimeout(proxyUrl)
      if (response.ok) {
        // Force UTF-8 decoding to avoid encoding issues
        const buffer = await response.arrayBuffer()
        const decoder = new TextDecoder('utf-8')
        return decoder.decode(buffer)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Erreur réseau')
      // Continue to next proxy
    }
  }

  throw lastError || new Error('Impossible de charger la page après plusieurs tentatives')
}

// Progress callback type
export type ProgressCallback = (step: string) => void

// Fetch and parse a recipe URL
export async function fetchAndParseRecipe(
  url: string,
  onProgress?: ProgressCallback
): Promise<ParsedRecipe> {
  onProgress?.('Chargement de la page...')
  const html = await fetchHtmlWithProxy(url)

  onProgress?.('Analyse de la recette...')
  const recipe = parseRecipeFromHtml(html, url)

  if (!recipe) {
    throw new Error('Aucune recette schema.org trouvée sur cette page')
  }

  // Convert image URL to base64
  if (recipe.image) {
    onProgress?.('Téléchargement de l\'image...')
    const base64Image = await fetchImageAsBase64(recipe.image)
    if (base64Image) {
      recipe.image = base64Image
    } else {
      // If base64 conversion fails, at least upgrade to HTTPS
      recipe.image = secureImageUrl(recipe.image)
    }
  }

  onProgress?.('Terminé !')
  return recipe
}
