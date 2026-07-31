import type { Structure, Terrain } from './types'

export const ART_CELL = 16

export type SpriteId =
  | `${Terrain}-${0 | 1}`
  | Structure
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
  player: 16,
  wanderer: 17,
  villager: 18,
  follower: 19,
  slime: 20,
  boar: 21,
  wisp: 22,
  coin: 23,
}

export function atlasUrl(): string {
  return `${import.meta.env.BASE_URL}assets/art/realmseed-atlas.png`
}
