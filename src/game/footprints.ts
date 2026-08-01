import type { Direction, Position } from './types'

export const FOOTPRINT_LIFETIME_MS = 1600
export const MAX_FOOTPRINTS = 7

export interface Footprint extends Position {
  id: number
  direction: Direction
  createdAt: number
}

export function movementDirection(from: Position, to: Position): Direction {
  if (to.x > from.x) return 'right'
  if (to.x < from.x) return 'left'
  if (to.y < from.y) return 'up'
  return 'down'
}

export function addFootprint(trail: Footprint[], from: Position, to: Position, createdAt: number): Footprint[] {
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return []
  return [
    ...trail,
    { id: createdAt, x: from.x, y: from.y, direction: movementDirection(from, to), createdAt },
  ].slice(-MAX_FOOTPRINTS)
}

export function footprintOpacity(footprint: Footprint, now: number): number {
  const age = Math.max(0, now - footprint.createdAt)
  return Math.max(0, 0.48 * (1 - age / FOOTPRINT_LIFETIME_MS))
}
