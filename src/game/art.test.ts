import { describe, expect, it } from 'vitest'
import { artThemes, atlasPreviewUrl, atlasUrl, spriteIndex, type ArtTheme } from './art'

describe('pixel art contract', () => {
  it('keeps every sprite in a unique atlas cell', () => {
    const indexes = Object.values(spriteIndex)
    expect(indexes).toHaveLength(24)
    expect(new Set(indexes).size).toBe(indexes.length)
    expect(Math.min(...indexes)).toBe(0)
    expect(Math.max(...indexes)).toBe(23)
  })

  it('publishes one atlas URL for every selectable theme', () => {
    const themes = Object.keys(artThemes) as ArtTheme[]
    expect(themes).toEqual(['verdant', 'ember', 'moonlit'])
    for (const theme of themes) {
      expect(atlasUrl(theme)).toMatch(new RegExp(`realmseed-atlas-${theme}\\.png$`))
    }
  })

  it('uses the generated hybrid preview for Verdant only', () => {
    expect(atlasPreviewUrl('verdant')).toMatch(/verdant-generated-preview\.png$/)
    expect(atlasPreviewUrl('ember')).toMatch(/realmseed-atlas-ember-preview\.png$/)
    expect(atlasPreviewUrl('moonlit')).toMatch(/realmseed-atlas-moonlit-preview\.png$/)
  })
})
