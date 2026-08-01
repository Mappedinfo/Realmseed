import { describe, expect, it } from 'vitest'
import { chooseFishingInfluence, fishingFatigue, fishingSignalAt, fishingSpotProgress, rollFishingLoot } from './fishing'
import { hashString } from './rng'
import type { FishingInfluence, World } from './types'

function seedForLootRoll(target: number): string {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `loot-${index}`
    if (hashString(`${seed}:loot`) % 100 === target) return seed
  }
  throw new Error(`No seed for roll ${target}`)
}

describe('fishing spots and signals', () => {
  it('uses the three fatigue bands and resets a rested spot lazily', () => {
    expect([1, 3, 4, 6, 7, 10].map(fishingFatigue)).toEqual([10, 10, 15, 15, 20, 20])
    expect(fishingSpotProgress({ uses: 10, readyDay: 6 }, 5)).toEqual({ uses: 10, readyDay: 6 })
    expect(fishingSpotProgress({ uses: 10, readyDay: 6 }, 6)).toEqual({ uses: 0 })
  })

  it('derives signals without mutating terrain and prioritizes tier before distance', () => {
    const world: World = { kind: 'overworld', seed: 'signal-contract', mapSize: 'small', size: 40, sceneX: 0, sceneY: 0, sceneName: '水域', tiles: Array.from({ length: 1600 }, () => ({ terrain: 'water' as const, coin: 0 })) }
    const terrain = world.tiles.map((tile) => tile.terrain)
    const signals = world.tiles.map((_, index) => fishingSignalAt(world, { x: index % 40, y: Math.floor(index / 40) })).filter(Boolean)
    expect(signals.length).toBeGreaterThan(30)
    expect(signals).toContain('current')
    expect(signals).toContain('glimmer')
    expect(signals).toContain('whirlpool')
    expect(world.tiles.map((tile) => tile.terrain)).toEqual(terrain)
    const candidates: FishingInfluence[] = [
      { kind: 'current', source: { x: 1, y: 1 }, distance: 0, strength: 'strong' },
      { kind: 'glimmer', source: { x: 2, y: 1 }, distance: 1, strength: 'strong' },
      { kind: 'whirlpool', source: { x: 3, y: 1 }, distance: 2, strength: 'weak' },
    ]
    expect(chooseFishingInfluence(candidates)?.kind).toBe('whirlpool')
  })

  it('applies glimmer and whirlpool rare-loot tables deterministically', () => {
    const glimmer: FishingInfluence = { kind: 'glimmer', source: { x: 0, y: 0 }, distance: 0, strength: 'strong' }
    const whirlpool: FishingInfluence = { kind: 'whirlpool', source: { x: 0, y: 0 }, distance: 1, strength: 'strong' }
    expect(rollFishingLoot(seedForLootRoll(5), true, false, glimmer)).toMatchObject({ kind: 'fish', fishId: 'golden-koi' })
    expect(rollFishingLoot(seedForLootRoll(18), true, false, glimmer)).toMatchObject({ kind: 'gold' })
    expect(rollFishingLoot(seedForLootRoll(10), true, true, whirlpool)).toMatchObject({ kind: 'equipment' })
    expect(rollFishingLoot(seedForLootRoll(50), false, false, whirlpool).kind).toMatch(/empty|wood/)
  })
})
