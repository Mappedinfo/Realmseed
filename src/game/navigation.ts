import type { FogLevel, Position, ResourceNodeKind, Tile, World } from './types'
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

export interface ResourceRoute {
  target: Position
  path: Position[]
}

export function findNearestResourceRoute(
  world: World,
  fog: FogLevel[],
  start: Position,
  kind: ResourceNodeKind,
  day: number,
  exclude?: Position,
): ResourceRoute | null {
  const routes: (ResourceRoute & { distance: number; index: number })[] = []
  world.tiles.forEach((tile, index) => {
    if (tile.resourceNode !== kind || fog[index] === 0 || (tile.resourceReadyDay !== undefined && tile.resourceReadyDay > day)) return
    const target = { x: index % world.size, y: Math.floor(index / world.size) }
    if (exclude && target.x === exclude.x && target.y === exclude.y) return
    const path = findNavigationPath(world, start, target, true)
    const alreadyAdjacent = navigationGoals(world, target, true).some((goal) => goal.x === start.x && goal.y === start.y)
    if (!path.length && !alreadyAdjacent) return
    routes.push({ target, path, distance: Math.abs(target.x - start.x) + Math.abs(target.y - start.y), index })
  })
  routes.sort((a, b) => a.path.length - b.path.length || a.distance - b.distance || a.index - b.index)
  return routes[0] ? { target: routes[0].target, path: routes[0].path } : null
}
