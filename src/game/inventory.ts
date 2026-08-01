import type { FishId, ResourceInventory } from './types'

export interface CollectibleItem {
  id: FishId
  name: string
  glyph: string
  recovery: number
  description: string
}

export const collectibleCatalog: CollectibleItem[] = [
  { id: 'minnow', name: '溪流小鱼', glyph: '≈', recovery: 1, description: '常见溪鱼 · 食用恢复 1 体力' },
  { id: 'carp', name: '红鳞鲤', glyph: '◈', recovery: 2, description: '水岸鱼获 · 食用恢复 2 体力' },
  { id: 'loach', name: '泥鳅', glyph: '∿', recovery: 2, description: '湿地鱼获 · 食用恢复 2 体力' },
  { id: 'golden-koi', name: '金鲤', glyph: '✦', recovery: 3, description: '稀有收藏 · 食用恢复 3 体力' },
]

export function ownedCollectibles(resources: ResourceInventory): (CollectibleItem & { count: number })[] {
  return collectibleCatalog
    .filter((item) => resources.fish[item.id] > 0)
    .map((item) => ({ ...item, count: resources.fish[item.id] }))
}
