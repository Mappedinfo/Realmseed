import { describe, expect, it } from 'vitest'
import { gameReducer } from './simulation'
import { createGame, isPassable } from './world'

function passableDirection(state: ReturnType<typeof createGame>) {
  const directions = [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ] as const
  return directions.find(([, dx, dy]) => isPassable(state.world, state.player.x + dx, state.player.y + dy))!
}

describe('game simulation', () => {
  it('spends stamina and advances the day when moving', () => {
    const state = createGame('move-check', 'small')
    const [direction] = passableDirection(state)
    const next = gameReducer(state, { type: 'MOVE', direction })
    expect(next.day).toBe(state.day + 1)
    expect(next.player.stamina).toBeLessThan(state.player.stamina)
  })

  it('rest restores stamina', () => {
    const state = createGame('rest-check', 'small')
    state.player.stamina = 1
    const next = gameReducer(state, { type: 'REST' })
    expect(next.player.stamina).toBe(next.player.maxStamina)
  })

  it('can found a camp when the tile is empty and gold is sufficient', () => {
    const state = createGame('camp-check', 'small')
    state.player.gold = 20
    const index = state.player.y * state.world.size + state.player.x
    state.world.tiles[index].structure = undefined
    const next = gameReducer(state, { type: 'FOUND_CAMP' })
    expect(next.world.tiles[index].structure).toBe('camp')
    expect(next.player.gold).toBe(12)
  })
})
