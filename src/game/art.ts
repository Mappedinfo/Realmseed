import type { Structure, Terrain } from './types'

export const ART_CELL = 16
export type ArtTheme = 'verdant' | 'ember' | 'moonlit'

export const artThemes: Record<ArtTheme, { name: string; caption: string; accent: string }> = {
  verdant: { name: '森林遗迹', caption: '苔色、麦金与青蓝魔法', accent: '#66d2bd' },
  ember: { name: '余烬边境', caption: '赭土、旧铁与营火微光', accent: '#e36d42' },
  moonlit: { name: '月潮海岸', caption: '深海、珊瑚与月下遗迹', accent: '#52d5ca' },
}

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

export function atlasUrl(theme: ArtTheme): string {
  return `${import.meta.env.BASE_URL}assets/art/realmseed-atlas-${theme}.png`
}

export function atlasPreviewUrl(theme: ArtTheme): string {
  return `${import.meta.env.BASE_URL}assets/art/realmseed-atlas-${theme}-preview.png`
}
