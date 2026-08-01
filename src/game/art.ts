import type { Direction, Structure, Terrain } from './types'

export const ART_CELL = 16
export const GENERATED_CELL = 32
export type ArtTheme = 'verdant' | 'ember' | 'moonlit'

export const artThemes: Record<ArtTheme, { name: string; caption: string; accent: string }> = {
  verdant: { name: '森林遗迹', caption: '细节地表与像素角色', accent: '#66d2bd' },
  ember: { name: '余烬边境', caption: '赭土、旧铁与营火微光', accent: '#e36d42' },
  moonlit: { name: '月潮海岸', caption: '深海、珊瑚与月下遗迹', accent: '#52d5ca' },
}

export type SpriteId =
  | `${Terrain}-${0 | 1}`
  | Exclude<Structure, 'cave' | 'nest' | 'stairs-down' | 'stairs-up' | 'chest' | 'dungeon-exit'>
  | 'player'
  | 'wanderer'
  | 'villager'
  | 'follower'
  | 'slime'
  | 'boar'
  | 'wisp'
  | 'coin'

export const spriteIndex: Record<SpriteId, number> = {
  'meadow-0': 0,
  'meadow-1': 1,
  'forest-0': 2,
  'forest-1': 3,
  'water-0': 4,
  'water-1': 5,
  'mountain-0': 6,
  'mountain-1': 7,
  'marsh-0': 8,
  'marsh-1': 9,
  'sand-0': 10,
  'sand-1': 11,
  camp: 12,
  village: 13,
  ruin: 14,
  waystone: 15,
  'camp-building': 24,
  player: 16,
  wanderer: 17,
  villager: 18,
  follower: 19,
  slime: 20,
  boar: 21,
  wisp: 22,
  coin: 23,
}

export function atlasUrl(theme: ArtTheme): string {
  return `${import.meta.env.BASE_URL}assets/art/realmseed-atlas-${theme}.png`
}

export function atlasPreviewUrl(theme: ArtTheme): string {
  if (theme === 'verdant') {
    return `${import.meta.env.BASE_URL}assets/art/verdant-generated-preview.png`
  }
  return `${import.meta.env.BASE_URL}assets/art/realmseed-atlas-${theme}-preview.png`
}

export function generatedTerrainUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-generated-terrain.png`
}

export function generatedObjectsUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-generated-objects.png`
}

export function generatedCharactersUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-generated-characters.png`
}

export function directionalCharactersUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-directional-characters.png`
}

export function directionalMonstersUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-directional-monsters.png`
}

export function facilityAtlasUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-facilities.png`
}

export function generatedSceneUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/verdant-world-scene.webp`
}

export const generatedCharacterIndex = {
  player: 0,
  wanderer: 4,
  villager: 2,
  follower: 1,
} as const

export const generatedObjectIndex = {
  camp: 12,
  village: 13,
  ruin: 14,
  waystone: 15,
  'camp-building': 13,
  slime: 20,
  boar: 21,
  wisp: 22,
  coin: 23,
  food: 24,
  cave: 14,
  nest: 14,
  'stairs-down': 15,
  'stairs-up': 15,
  chest: 23,
  'dungeon-exit': 15,
} as const

export const directionalCharacterIndex = {
  player: 0,
  wanderer: 4,
  villager: 2,
  follower: 1,
} as const

// Newly ingested role art is kept addressable without changing the four
// currently simulated world roles. Future NPC jobs can opt into these columns.
export const directionalRoleIndex = {
  explorer: 8,
  swordsman: 9,
  mystic: 10,
  priest: 11,
  ranger: 12,
  engineer: 13,
  'caravan-merchant': 14,
  bard: 15,
} as const

export const directionalMonsterIndex = {
  slime: 0,
  boar: 1,
  wisp: 2,
} as const

export const facilityIndex = {
  'camp-core': 0,
  house: 1,
  farm: 2,
  watchtower: 3,
  market: 4,
  workshop: 5,
  shrine: 6,
  'road-gate': 7,
} as const

export const directionalRow: Record<Direction, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
}
