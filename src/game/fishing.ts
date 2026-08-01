import { hashString } from './rng'
import type { FishId, FishingInfluence, FishingSignalKind, FishingSpotProgress, Position, World } from './types'
import { isInside, tileIndex } from './world'

export const FISHING_SPOT_CAPACITY = 10
export const FISHING_RECOVERY_DAYS = 3

const signalPriority: Record<FishingSignalKind, number> = { current: 1, glimmer: 2, whirlpool: 3 }

export interface FishingLootRoll {
  kind: 'empty' | 'wood' | 'fish' | 'gold' | 'equipment'
  fishId?: FishId
  amount: number
}

export function fishingSpotKey(world: World, position: Position): string {
  return `${world.sceneX},${world.sceneY}:${position.x},${position.y}`
}

export function fishingSpotProgress(progress: FishingSpotProgress | undefined, day: number): FishingSpotProgress {
  if (!progress || (progress.readyDay !== undefined && day >= progress.readyDay)) return { uses: 0 }
  return progress
}

export function fishingFatigue(castNumber: number): number {
  return castNumber <= 3 ? 10 : castNumber <= 6 ? 15 : 20
}

export function fishingSignalAt(world: World, position: Position): FishingSignalKind | null {
  if (!isInside(world, position.x, position.y)) return null
  if (world.tiles[tileIndex(world, position.x, position.y)]?.terrain !== 'water') return null
  const roll = hashString(`${world.seed}:fishing-signal:${world.sceneX}:${world.sceneY}:${position.x}:${position.y}`) % 10_000
  if (roll < 40) return 'whirlpool'
  if (roll < 140) return 'glimmer'
  if (roll < 440) return 'current'
  return null
}

export function fishingInfluenceAt(world: World, target: Position): FishingInfluence | null {
  const candidates: FishingInfluence[] = []
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.abs(dx) + Math.abs(dy)
      if (distance > 2) continue
      const source = { x: target.x + dx, y: target.y + dy }
      const kind = fishingSignalAt(world, source)
      if (!kind) continue
      candidates.push({ kind, source, distance: distance as 0 | 1 | 2, strength: distance <= 1 ? 'strong' : 'weak' })
    }
  }
  return chooseFishingInfluence(candidates)
}

export function chooseFishingInfluence(candidates: FishingInfluence[]): FishingInfluence | null {
  return [...candidates].sort((a, b) => signalPriority[b.kind] - signalPriority[a.kind] || a.distance - b.distance)[0] ?? null
}

function rareThresholds(influence: FishingInfluence | null, perfect: boolean): [number, number, number] {
  if (!influence) return perfect ? [8, 18, 35] : [0, 0, 0]
  if (influence.kind === 'current') return perfect ? [8, 18, 35] : [0, 0, 0]
  if (influence.kind === 'glimmer') {
    if (influence.strength === 'strong') return perfect ? [10, 35, 65] : [1, 11, 31]
    return perfect ? [8, 26, 50] : [0, 5, 17]
  }
  if (influence.strength === 'strong') return perfect ? [20, 35, 45] : [6, 14, 20]
  return perfect ? [14, 26, 38] : [3, 8, 13]
}

export function rollFishingLoot(seed: string, success: boolean, perfect: boolean, influence: FishingInfluence | null): FishingLootRoll {
  const roll = hashString(`${seed}:loot`) % 100
  if (!success) return roll % 4 === 0 ? { kind: 'wood', amount: 1 } : { kind: 'empty', amount: 0 }
  const [equipmentEnd, koiEnd, goldEnd] = rareThresholds(influence, perfect)
  if (roll < equipmentEnd) return { kind: 'equipment', amount: 1 }
  if (roll < koiEnd) return { kind: 'fish', fishId: 'golden-koi', amount: 1 }
  if (roll < goldEnd) return { kind: 'gold', amount: 1 }

  const fishRoll = hashString(`${seed}:fish`) % 100
  let fishId: FishId
  if (influence?.kind === 'current' && influence.strength === 'strong') fishId = fishRoll < 20 ? 'minnow' : fishRoll < 60 ? 'carp' : 'loach'
  else if (influence?.kind === 'current') fishId = fishRoll < 40 ? 'minnow' : fishRoll < 70 ? 'carp' : 'loach'
  else fishId = (['minnow', 'carp', 'loach'] as FishId[])[fishRoll % 3]
  const doubleChance = influence?.kind === 'current' ? (influence.strength === 'strong' ? 60 : 30) : 0
  const amount = hashString(`${seed}:quantity`) % 100 < doubleChance ? 2 : 1
  return { kind: 'fish', fishId, amount }
}

export const fishingSignalNames: Record<FishingSignalKind, string> = {
  current: '流纹', glimmer: '闪光', whirlpool: '深涡',
}
