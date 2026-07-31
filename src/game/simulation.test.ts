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

  it('moves follower AI toward the player on each world turn', () => {
    const state = createGame('follower-ai-check', 'small')
    state.world.tiles = state.world.tiles.map((tile) => ({ ...tile, terrain: 'meadow' }))
    const follower = state.agents[0]
    follower.role = 'follower'
    follower.x = state.player.x + 4
    follower.y = state.player.y
    const before = Math.abs(follower.x - state.player.x)
    const next = gameReducer(state, { type: 'REST' })
    const moved = next.agents.find((agent) => agent.id === follower.id)!
    expect(Math.abs(moved.x - next.player.x)).toBe(before - 1)
  })

  it('supports faction oaths and breaking them with consequences', () => {
    const state = createGame('oath-check', 'small')
    state.factions[0].relation = 15
    const sworn = gameReducer(state, { type: 'PLEDGE_FACTION', factionId: state.factions[0].id })
    expect(sworn.player.factionId).toBe(state.factions[0].id)
    expect(sworn.factions[0].isOverlord).toBe(true)
    expect(sworn.player.gold).toBe(state.player.gold + 4)

    const free = gameReducer(sworn, { type: 'BREAK_OATH' })
    expect(free.player.factionId).toBe('free')
    expect(free.factions[0].isOverlord).toBe(false)
    expect(free.factions[0].relation).toBe(-5)
  })

  it('turns a trusted faction into a tribute-paying vassal', () => {
    const state = createGame('vassal-check', 'small')
    state.player.gold = 20
    state.factions[0].relation = 30
    state.agents[0].role = 'villager'
    const vassalized = gameReducer(state, { type: 'MAKE_VASSAL', factionId: state.factions[0].id })
    expect(vassalized.factions[0].isVassal).toBe(true)
    expect(vassalized.player.gold).toBe(10)

    const rested = gameReducer(vassalized, { type: 'REST' })
    expect(rested.player.gold).toBe(13)
    expect(rested.chronicle[0].text).toContain('附属贡金 2 金')
  })

  it('travels across infinite scenes and restores the previous scene state on return', () => {
    const state = createGame('scene-cache-check', 'small')
    const homeIndex = state.player.y * state.world.size + state.player.x
    state.world.tiles[homeIndex] = { ...state.world.tiles[homeIndex], structure: 'camp' }
    state.fog[homeIndex] = 2

    const east = gameReducer(state, { type: 'TRAVEL', direction: 'right' })
    expect(east.world.sceneX).toBe(1)
    expect(east.world.sceneY).toBe(0)
    expect(east.sceneCache['0,0'].world.tiles[homeIndex].structure).toBe('camp')

    const home = gameReducer(east, { type: 'TRAVEL', direction: 'left' })
    expect(home.world.sceneX).toBe(0)
    expect(home.world.sceneY).toBe(0)
    expect(home.world.tiles[homeIndex].structure).toBe('camp')
    expect(home.fog[homeIndex]).toBeGreaterThan(0)
  })
})
