import { describe, expect, it } from 'vitest'
import { createGame, createWorld, revealFog } from './world'

describe('procedural world', () => {
  it('is deterministic for the same seed and size', () => {
    expect(createWorld('willow-reach', 'small')).toEqual(createWorld('willow-reach', 'small'))
  })

  it('deterministically unfolds distinct neighboring scenes without a fixed world edge', () => {
    const origin = createWorld('endless-check', 'small', 0, 0)
    const east = createWorld('endless-check', 'small', 1, 0)
    expect(east).toEqual(createWorld('endless-check', 'small', 1, 0))
    expect(east.sceneX).toBe(1)
    expect(east.sceneY).toBe(0)
    expect(east.tiles).not.toEqual(origin.tiles)
    expect(east.sceneName.length).toBeGreaterThan(1)
  })

  it('supports small and large worlds', () => {
    expect(createWorld('a', 'small').tiles).toHaveLength(40 * 40)
    expect(createWorld('a', 'large').tiles).toHaveLength(96 * 96)
  })

  it('places four detailed waystone transport facilities in every scene', () => {
    const world = createWorld('waystone-check', 'small', -4, 9)
    expect(world.tiles.filter((tile) => tile.structure === 'waystone')).toHaveLength(4)
  })

  it('places deterministic food pickups on traversable terrain', () => {
    const world = createWorld('food-resource-check', 'small')
    const foodTiles = world.tiles.filter((tile) => (tile.food ?? 0) > 0)
    expect(foodTiles.length).toBeGreaterThan(0)
    expect(foodTiles.every((tile) => tile.terrain !== 'water' && tile.terrain !== 'mountain')).toBe(true)
  })

  it('keeps regional berry abundance near the ten-berries-per-coin economy', () => {
    const worlds = ['market-a', 'market-b', 'market-c'].map((seed) => createWorld(seed, 'large'))
    const berries = worlds.flatMap((world) => world.tiles).reduce((sum, tile) => sum + (tile.food ?? 0), 0)
    const coins = worlds.flatMap((world) => world.tiles).reduce((sum, tile) => sum + tile.coin, 0)
    expect(berries / coins).toBeGreaterThan(7)
    expect(berries / coins).toBeLessThan(14)
  })

  it('starts with three fog states available after exploration', () => {
    const state = createGame('fog-check', 'small')
    expect(state.fog.some((level) => level === 2)).toBe(true)
    expect(state.fog.some((level) => level === 0)).toBe(true)
    const oldVisible = state.fog.findIndex((level) => level === 2)
    const moved = { ...state, player: { ...state.player, x: state.player.x + 8 } }
    const nextFog = revealFog(moved)
    expect([1, 2]).toContain(nextFog[oldVisible])
  })
})
