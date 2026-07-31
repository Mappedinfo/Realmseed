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

function flatState(seed: string) {
  const state = createGame(seed, 'small')
  state.world.tiles = state.world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0, food: 0 }))
  state.player.x = 20
  state.player.y = 20
  state.monsters = []
  return state
}

describe('game simulation', () => {
  it('spends exactly one stamina after 100 ordinary steps', () => {
    let state = flatState('move-check')
    const initialStamina = state.player.stamina
    for (let step = 0; step < 99; step += 1) {
      state = gameReducer(state, { type: 'MOVE', direction: step % 2 === 0 ? 'right' : 'left' })
    }
    expect(state.player.stamina).toBe(initialStamina)
    expect(state.fatigue).toBe(99)

    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.player.stamina).toBe(initialStamina - 1)
    expect(state.fatigue).toBe(0)
  })

  it('counts a combat step at 1.5x and raises max stamina after victory', () => {
    const state = flatState('combat-win-check')
    state.monsters = [{ id: 'training-slime', species: 'slime', hp: 1, x: 21, y: 20 }]
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(next.fatigue).toBe(1.5)
    expect(next.combatWins).toBe(1)
    expect(next.player.maxStamina).toBe(state.player.maxStamina + 1)
    expect(next.monsters).toHaveLength(0)
  })

  it('deducts only zero or one stamina when the player is hit', () => {
    const state = flatState('combat-hit-check')
    state.monsters = [{ id: 'strong-boar', species: 'boar', hp: 3, x: 21, y: 20 }]
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect([0, 1]).toContain(state.player.stamina - next.player.stamina)
    expect(next.fatigue).toBe(1.5)
  })

  it('automatically rests to three stamina when exhausted movement is attempted', () => {
    const state = flatState('auto-rest-check')
    state.player.stamina = 0
    state.fatigue = 72
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(next.player.stamina).toBe(3)
    expect(next.fatigue).toBe(0)
    expect(next.player.x).toBe(state.player.x)
    expect(next.chronicle[0].text).toContain('自动扎营')
  })

  it('automatically consumes gathered food to restore stamina', () => {
    const state = flatState('food-check')
    state.player.stamina = 5
    const index = state.player.y * state.world.size + state.player.x + 1
    state.world.tiles[index].food = 2
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(next.player.stamina).toBe(7)
    expect(next.world.tiles[index].food).toBe(0)
    expect(next.chronicle[0].text).toContain('自动恢复 2 点体力')
  })

  it('rest restores stamina', () => {
    const state = createGame('rest-check', 'small')
    state.player.stamina = 1
    const next = gameReducer(state, { type: 'REST' })
    expect(next.player.stamina).toBe(next.player.maxStamina)
  })

  it('manual rest at zero recovers to three instead of skipping exhaustion', () => {
    const state = createGame('zero-rest-check', 'small')
    state.player.stamina = 0
    const next = gameReducer(state, { type: 'REST' })
    expect(next.player.stamina).toBe(3)
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
    expect(east.fatigue).toBe(25)

    const home = gameReducer(east, { type: 'TRAVEL', direction: 'left' })
    expect(home.world.sceneX).toBe(0)
    expect(home.world.sceneY).toBe(0)
    expect(home.world.tiles[homeIndex].structure).toBe('camp')
    expect(home.fog[homeIndex]).toBeGreaterThan(0)
  })
})
