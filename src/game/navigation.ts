import type { Position, Tile, World } from './types'
import { isInside, isPassable } from './world'

const steps = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const

function key(position: Position): string {
  return `${position.x},${position.y}`
}

export function navigationStopsAdjacent(tile: Tile): boolean {
  return Boolean(
    !['meadow', 'forest', 'marsh', 'sand'].includes(tile.terrain) ||
    tile.resourceNode ||
    tile.structure === 'cave' ||
    tile.structure === 'nest' ||
    tile.structure === 'stairs-down' ||
    tile.structure === 'stairs-up' ||
    tile.structure === 'chest' ||
    tile.structure === 'dungeon-exit',
  )
}

export function navigationGoals(world: World, target: Position, stopAdjacent: boolean): Position[] {
  if (!isInside(world, target.x, target.y)) return []
  if (!stopAdjacent && isPassable(world, target.x, target.y)) return [target]
  return steps
    .map((step) => ({ x: target.x + step.x, y: target.y + step.y }))
    .filter((position) => isPassable(world, position.x, position.y))
}

export function findNavigationPath(
  world: World,
  start: Position,
  target: Position,
  stopAdjacent?: boolean,
): Position[] {
  if (!isInside(world, target.x, target.y)) return []
  const shouldStopAdjacent = stopAdjacent ?? navigationStopsAdjacent(world.tiles[target.y * world.size + target.x])
  const goals = navigationGoals(world, target, shouldStopAdjacent)
  if (!goals.length) return []
  const goalKeys = new Set(goals.map(key))
  if (goalKeys.has(key(start))) return []
  const queue: Position[] = [start]
  const parent = new Map<string, Position | null>([[key(start), null]])
  let reached: Position | null = null
  while (queue.length) {
    const current = queue.shift()!
    for (const step of steps) {
      const next = { x: current.x + step.x, y: current.y + step.y }
      const nextKey = key(next)
      if (parent.has(nextKey) || !isPassable(world, next.x, next.y)) continue
      parent.set(nextKey, current)
      if (goalKeys.has(nextKey)) {
        reached = next
        queue.length = 0
        break
      }
      queue.push(next)
    }
  }
  if (!reached) return []
  const path: Position[] = []
  let cursor: Position | null = reached
  while (cursor && key(cursor) !== key(start)) {
    path.unshift(cursor)
    cursor = parent.get(key(cursor)) ?? null
  }
  return path
}
