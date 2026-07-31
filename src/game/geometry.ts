import type { Position } from './types'

export function tileProximity(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function isWithinInteractionRange(a: Position, b: Position): boolean {
  return tileProximity(a, b) <= 1
}
