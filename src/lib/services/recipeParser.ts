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

// Common HTML entities mapping
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&eacute;': 'é', '&egrave;': 'è', '&ecirc;': 'ê', '&euml;': 'ë',
  '&agrave;': 'à', '&acirc;': 'â', '&auml;': 'ä', '&ugrave;': 'ù', '&ucirc;': 'û',
  '&uuml;': 'ü', '&ocirc;': 'ô', '&ouml;': 'ö', '&icirc;': 'î', '&iuml;': 'ï',
  '&ccedil;': 'ç', '&oelig;': 'œ', '&aelig;': 'æ', '&Eacute;': 'É', '&Egrave;': 'È',
  '&Ecirc;': 'Ê', '&Agrave;': 'À', '&Acirc;': 'Â', '&Ugrave;': 'Ù', '&Ucirc;': 'Û',
  '&Ocirc;': 'Ô', '&Icirc;': 'Î', '&Ccedil;': 'Ç', '&deg;': '°', '&frac12;': '½',
  '&frac14;': '¼', '&frac34;': '¾', '&rsquo;': '\u2019', '&lsquo;': '\u2018',
  '&rdquo;': '\u201D', '&ldquo;': '\u201C', '&ndash;': '\u2013', '&mdash;': '\u2014',
  '&hellip;': '\u2026'
}

// Decode HTML entities like &#39; &amp; &eacute; etc.
function decodeHtmlEntities(text: string): string {
  if (!text) return text

  // First pass: decode named entities with regex
  let decoded = text.replace(/&[a-zA-Z]+;/g, entity => HTML_ENTITIES[entity] || entity)

  // Second pass: decode numeric entities (&#233; or &#xe9;)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

  // Final pass: use DOMParser for any remaining entities
  try {
    const doc = new DOMParser().parseFromString(decoded, 'text/html')
    return doc.body.textContent || decoded
  } catch {
    return decoded
  }
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

  console.log(`[Import] Recherche JSON-LD dans ${html.length} caractères de HTML`)

  let match
  let count = 0
  while ((match = regex.exec(html)) !== null) {
    count++
    try {
      const json = JSON.parse(match[1]) as JsonLdItem | JsonLdItem[]
      console.log(`[Import] JSON-LD #${count} trouvé, type:`, Array.isArray(json) ? 'array' : (json['@type'] || 'unknown'))
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

  console.log(`[Import] Total: ${count} blocs JSON-LD trouvés, ${scripts.length} items extraits`)
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

// CORS proxies to try in order (corsproxy.io first - works for most sites including 750g.com)
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://proxy.cors.sh/${url}`
]

// Fetch with timeout (20s to handle slow proxies)
async function fetchWithTimeout(url: string, timeout = 20000): Promise<Response> {
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

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyFn = CORS_PROXIES[i]
    const proxyUrl = proxyFn(url)
    try {
      console.log(`[Import] Tentative ${i + 1}/${CORS_PROXIES.length}...`)
      const response = await fetchWithTimeout(proxyUrl)
      if (response.ok) {
        console.log(`[Import] Succès avec le proxy ${i + 1}`)
        // Force UTF-8 decoding to avoid encoding issues
        const buffer = await response.arrayBuffer()
        const decoder = new TextDecoder('utf-8')
        return decoder.decode(buffer)
      } else {
        console.warn(`[Import] Proxy ${i + 1} a échoué avec status ${response.status}`)
        lastError = new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur réseau'
      console.warn(`[Import] Proxy ${i + 1} erreur: ${errorMsg}`)
      lastError = error instanceof Error ? error : new Error(errorMsg)
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

  // Debug: log first 500 chars to verify we got real HTML
  console.log(`[Import] HTML reçu (${html.length} chars), début:`, html.substring(0, 500))

  // Debug: check if ld+json exists at all in the HTML
  const ldJsonCount = (html.match(/ld\+json/gi) || []).length
  console.log(`[Import] Occurrences de "ld+json" dans le HTML: ${ldJsonCount}`)

  // Debug: check for Marmiton-specific data
  const mrtnMatch = html.match(/window\.Mrtn\.recipesData\s*=\s*(\[[\s\S]*?\]);/i)
  if (mrtnMatch) {
    console.log(`[Import] Trouvé window.Mrtn.recipesData:`, mrtnMatch[1].substring(0, 200))
  }

  // Debug: check for ingredient/step patterns in HTML (for sites without JSON-LD)
  if (url.includes('marmiton.org')) {
    // Look for recipe content in the HTML structure
    const ingredientClasses = html.match(/class="[^"]*ingredient[^"]*"/gi) || []
    const stepClasses = html.match(/class="[^"]*instruction[^"]*|class="[^"]*step[^"]*"/gi) || []
    console.log(`[Import] Marmiton: ${ingredientClasses.length} classes ingredient, ${stepClasses.length} classes step/instruction`)

    // Sample some content
    const bodyStart = html.indexOf('<body')
    if (bodyStart > 0) {
      console.log(`[Import] Début du <body>:`, html.substring(bodyStart, bodyStart + 2000))
    }
  }

  if (ldJsonCount === 0) {
    // Log a sample around where JSON-LD typically appears
    const headEnd = html.indexOf('</head>')
    if (headEnd > 0) {
      console.log(`[Import] Fin du <head> (derniers 1000 chars):`, html.substring(Math.max(0, headEnd - 1000), headEnd + 10))
    }
  }

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
