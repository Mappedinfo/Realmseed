import { describe, expect, it } from 'vitest'
import { createGame, createWorld, revealFog } from './world'

describe('procedural world', () => {
  it('is deterministic for the same seed and size', () => {
    expect(createWorld('willow-reach', 'small')).toEqual(createWorld('willow-reach', 'small'))
  })

  it('supports small and large worlds', () => {
    expect(createWorld('a', 'small').tiles).toHaveLength(40 * 40)
    expect(createWorld('a', 'large').tiles).toHaveLength(96 * 96)
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
