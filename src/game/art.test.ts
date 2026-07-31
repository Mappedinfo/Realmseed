import { describe, expect, it } from 'vitest'
import {
  artThemes,
  atlasPreviewUrl,
  atlasUrl,
  directionalCharactersUrl,
  directionalMonstersUrl,
  directionalRoleIndex,
  directionalRow,
  facilityAtlasUrl,
  facilityIndex,
  spriteIndex,
  type ArtTheme,
} from './art'
import directionalManifest from '../../art/generated/directional/manifest.json'
import facilityManifest from '../../art/generated/facilities/manifest.json'

describe('pixel art contract', () => {
  it('keeps every sprite in a unique atlas cell', () => {
    const indexes = Object.values(spriteIndex)
    expect(indexes).toHaveLength(25)
    expect(new Set(indexes).size).toBe(indexes.length)
    expect(Math.min(...indexes)).toBe(0)
    expect(Math.max(...indexes)).toBe(24)
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

  it('publishes a four-direction runtime contract', () => {
    expect(directionalCharactersUrl()).toMatch(/verdant-directional-characters\.png$/)
    expect(directionalMonstersUrl()).toMatch(/verdant-directional-monsters\.png$/)
    expect(directionalRow).toEqual({ down: 0, up: 1, left: 2, right: 3 })
    expect(directionalManifest.postprocess.horizontal_flip).toEqual({
      characters: ['west'],
      monsters: [],
    })
    expect(directionalManifest.runtime_layout.columns.characters).toHaveLength(16)
    expect(directionalManifest.preview_outputs.new_roles_characters).toMatch(/new-roles-characters\.png$/)
    expect(directionalRoleIndex).toEqual({
      explorer: 8,
      swordsman: 9,
      mystic: 10,
      priest: 11,
      ranger: 12,
      engineer: 13,
      'caravan-merchant': 14,
      bard: 15,
    })
  })

  it('publishes the eight-cell facility atlas contract', () => {
    expect(facilityAtlasUrl()).toMatch(/verdant-facilities\.png$/)
    expect(facilityManifest.runtime_layout.cell).toBe(32)
    expect(facilityManifest.runtime_layout.columns).toEqual([
      'camp-core',
      'house',
      'farm',
      'watchtower',
      'market',
      'workshop',
      'shrine',
      'road-gate',
    ])
    expect(facilityIndex).toEqual({
      'camp-core': 0,
      house: 1,
      farm: 2,
      watchtower: 3,
      market: 4,
      workshop: 5,
      shrine: 6,
      'road-gate': 7,
    })
  })
})
