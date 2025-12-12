import { describe, it, expect } from 'vitest'
import { secureImageUrl, parseIngredientString, extractJsonLd } from './recipeParser'

describe('secureImageUrl', () => {
  it('should return undefined for undefined input', () => {
    expect(secureImageUrl(undefined)).toBeUndefined()
  })

  it('should not modify https URLs', () => {
    const url = 'https://example.com/image.jpg'
    expect(secureImageUrl(url)).toBe(url)
  })

  it('should upgrade http to https', () => {
    const url = 'http://example.com/image.jpg'
    expect(secureImageUrl(url)).toBe('https://example.com/image.jpg')
  })

  it('should not modify data URLs', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo='
    expect(secureImageUrl(url)).toBe(url)
  })
})

describe('parseIngredientString', () => {
  it('should parse simple ingredient without quantity (defaults to 1)', () => {
    const result = parseIngredientString('sel')
    expect(result.name).toBe('sel')
    expect(result.quantity).toBe(1)
    expect(result.unit).toBe('')
  })

  it('should parse ingredient with quantity and unit', () => {
    const result = parseIngredientString('200g de farine')
    expect(result.name).toBe('farine')
    expect(result.quantity).toBe(200)
    expect(result.unit).toBe('g')
  })

  it('should parse ingredient with cup measurement and normalize unit', () => {
    const result = parseIngredientString('2 cups flour')
    expect(result.name).toBe('flour')
    expect(result.quantity).toBe(2)
    expect(result.unit).toBe('tasses') // cups -> tasses
  })

  it('should parse ingredient with tablespoon and normalize unit', () => {
    const result = parseIngredientString('1 tbsp olive oil')
    expect(result.name).toBe('olive oil')
    expect(result.quantity).toBe(1)
    expect(result.unit).toBe('c. à soupe') // tbsp -> c. à soupe
  })

  it('should parse French cuillère à soupe', () => {
    const result = parseIngredientString('2 c. à s. de sucre')
    expect(result.name).toBe('sucre')
    expect(result.quantity).toBe(2)
    expect(result.unit).toBe('c. à soupe') // normalized
  })

  it('should convert fractional quantities to decimal', () => {
    const result = parseIngredientString('1/2 cup milk')
    expect(result.name).toBe('milk')
    expect(result.quantity).toBe(0.5) // 1/2 -> 0.5
    expect(result.unit).toBe('tasse') // cup -> tasse
  })
})

describe('extractJsonLd', () => {
  it('should return empty array for HTML without JSON-LD', () => {
    const html = '<html><body><p>Hello</p></body></html>'
    expect(extractJsonLd(html)).toEqual([])
  })

  it('should extract single JSON-LD script', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@type": "Recipe", "name": "Test Recipe"}
          </script>
        </head>
      </html>
    `
    const result = extractJsonLd(html)
    expect(result).toHaveLength(1)
    expect(result[0]['@type']).toBe('Recipe')
    expect(result[0].name).toBe('Test Recipe')
  })

  it('should extract JSON-LD with @graph (returns wrapper object)', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {"@graph": [{"@type": "Recipe", "name": "Graph Recipe"}]}
          </script>
        </head>
      </html>
    `
    const result = extractJsonLd(html)
    expect(result).toHaveLength(1)
    expect(result[0]['@graph']).toBeDefined()
    expect(result[0]['@graph'][0]['@type']).toBe('Recipe')
  })

  it('should handle malformed JSON gracefully', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {invalid json}
          </script>
        </head>
      </html>
    `
    expect(extractJsonLd(html)).toEqual([])
  })
})
