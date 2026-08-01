import { describe, expect, it } from 'vitest'
import { findNavigationPath, findNearestResourceRoute, navigationStopsAdjacent } from './navigation'
import type { FogLevel, Tile, World } from './types'

function flatWorld(): World {
  const tiles: Tile[] = Array.from({ length: 7 * 5 }, () => ({ terrain: 'meadow', coin: 0 }))
  return { kind: 'overworld', seed: 'nav', mapSize: 'small', size: 7, height: 5, sceneX: 0, sceneY: 0, sceneName: '导航测试', tiles }
}

describe('automatic navigation', () => {
  it('finds a shortest four-direction path around impassable terrain', () => {
    const world = flatWorld()
    world.tiles[1 * world.size + 2].terrain = 'mountain'
    world.tiles[2 * world.size + 2].terrain = 'mountain'
    const path = findNavigationPath(world, { x: 1, y: 2 }, { x: 4, y: 2 }, false)
    expect(path.at(-1)).toEqual({ x: 4, y: 2 })
    expect(path).toHaveLength(5)
    expect(path.every((position) => world.tiles[position.y * world.size + position.x].terrain !== 'mountain')).toBe(true)
  })

  it('stops beside water, gathering nodes, chests and dungeon entrances', () => {
    const world = flatWorld()
    const targets = [
      { x: 4, y: 2, patch: { terrain: 'water' as const } },
      { x: 4, y: 2, patch: { resourceNode: 'wood' as const } },
      { x: 4, y: 2, patch: { structure: 'chest' as const } },
      { x: 4, y: 2, patch: { structure: 'cave' as const } },
    ]
    for (const target of targets) {
      world.tiles = world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0 }))
      const tile = { ...world.tiles[target.y * world.size + target.x], ...target.patch }
      world.tiles[target.y * world.size + target.x] = tile
      expect(navigationStopsAdjacent(tile)).toBe(true)
      const path = findNavigationPath(world, { x: 1, y: 2 }, target)
      const end = path.at(-1)!
      expect(Math.abs(end.x - target.x) + Math.abs(end.y - target.y)).toBe(1)
    }
  })

  it('returns no route for a sealed destination', () => {
    const world = flatWorld()
    const target = { x: 3, y: 2 }
    for (const position of [{ x: 3, y: 1 }, { x: 4, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 2 }]) {
      world.tiles[position.y * world.size + position.x].terrain = 'mountain'
    }
    expect(findNavigationPath(world, { x: 1, y: 1 }, target)).toEqual([])
  })

  it('selects the nearest explored, ready and reachable resource of the active kind', () => {
    const world = flatWorld()
    world.tiles[1 * world.size + 2] = { ...world.tiles[1 * world.size + 2], resourceNode: 'wood', resourceReadyDay: 4 }
    world.tiles[1 * world.size + 4] = { ...world.tiles[1 * world.size + 4], resourceNode: 'wood' }
    world.tiles[4 * world.size + 1] = { ...world.tiles[4 * world.size + 1], resourceNode: 'wood' }
    world.tiles[2 * world.size + 3] = { ...world.tiles[2 * world.size + 3], resourceNode: 'stone' }
    const fog: FogLevel[] = world.tiles.map(() => 2)
    fog[1 * world.size + 4] = 0
    const route = findNearestResourceRoute(world, fog, { x: 1, y: 1 }, 'wood', 1)
    expect(route?.target).toEqual({ x: 1, y: 4 })
    expect(route?.path.length).toBeGreaterThan(0)
  })
})
