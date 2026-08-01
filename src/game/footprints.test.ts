import { describe, expect, it } from 'vitest'
import { addFootprint, FOOTPRINT_LIFETIME_MS, footprintOpacity, MAX_FOOTPRINTS, movementDirection } from './footprints'

describe('movement footprints', () => {
  it('records the departed tile and movement direction for every cardinal step', () => {
    expect(movementDirection({ x: 4, y: 4 }, { x: 4, y: 3 })).toBe('up')
    expect(movementDirection({ x: 4, y: 4 }, { x: 5, y: 4 })).toBe('right')
    const trail = addFootprint([], { x: 4, y: 4 }, { x: 4, y: 5 }, 100)
    expect(trail[0]).toMatchObject({ x: 4, y: 4, direction: 'down', createdAt: 100 })
  })

  it('fades smoothly, expires without flashing, and bounds the trail length', () => {
    const footprint = addFootprint([], { x: 0, y: 0 }, { x: 1, y: 0 }, 100)[0]
    expect(footprintOpacity(footprint, 100)).toBeCloseTo(0.48)
    expect(footprintOpacity(footprint, 100 + FOOTPRINT_LIFETIME_MS / 2)).toBeCloseTo(0.24)
    expect(footprintOpacity(footprint, 100 + FOOTPRINT_LIFETIME_MS)).toBe(0)
    let trail = [footprint]
    for (let index = 1; index < 12; index += 1) {
      trail = addFootprint(trail, { x: index, y: 0 }, { x: index + 1, y: 0 }, 100 + index)
    }
    expect(trail).toHaveLength(MAX_FOOTPRINTS)
  })

  it('clears stale footprints for teleports and scene transitions', () => {
    const trail = addFootprint([], { x: 2, y: 2 }, { x: 3, y: 2 }, 1)
    expect(addFootprint(trail, { x: 3, y: 2 }, { x: 12, y: 9 }, 2)).toEqual([])
  })
})
