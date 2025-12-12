import { describe, it, expect } from 'vitest'
import { encodeBase64Utf8, decodeBase64Utf8 } from './githubStorage'

describe('Base64 UTF-8 encoding/decoding', () => {
  it('should encode and decode simple ASCII text', () => {
    const original = 'Hello, World!'
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle French accented characters', () => {
    const original = 'Crème brûlée aux œufs frais'
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle emojis', () => {
    const original = 'Recipe 🍳🥗🍰'
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle JSON content', () => {
    const original = JSON.stringify({
      title: 'Tarte aux pommes',
      ingredients: ['pommes', 'sucre', 'beurre'],
      notes: 'Préchauffer le four à 180°C'
    })
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
    expect(JSON.parse(decoded)).toEqual(JSON.parse(original))
  })

  it('should handle special characters', () => {
    const original = 'Test: <>&"\' © ® ™ € £ ¥'
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle newlines in base64 input', () => {
    const original = 'Test content'
    const encoded = encodeBase64Utf8(original)
    // Simulate GitHub API response with newlines
    const encodedWithNewlines = encoded.match(/.{1,4}/g)?.join('\n') || encoded
    const decoded = decodeBase64Utf8(encodedWithNewlines)
    expect(decoded).toBe(original)
  })

  it('should handle empty string', () => {
    const original = ''
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle multi-byte Unicode characters', () => {
    const original = '日本語テスト 中文测试 한국어테스트'
    const encoded = encodeBase64Utf8(original)
    const decoded = decodeBase64Utf8(encoded)
    expect(decoded).toBe(original)
  })
})
