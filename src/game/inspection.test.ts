import { describe, expect, it } from 'vitest'
import { inspectPosition } from './inspection'
import { createGame } from './world'

function inspectionState() {
  const state = createGame('inspect-check', 'small')
  state.world.tiles = state.world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0, food: 0 }))
  state.fog.fill(2)
  state.player.x = 10
  state.player.y = 10
  state.agents = []
  state.monsters = []
  return state
}

describe('map inspection', () => {
  it('describes the player, people, and monsters', () => {
    const state = inspectionState()
    expect(inspectPosition(state, state.player).category).toBe('人物')

    state.agents = [{
      id: 'agent-inspect',
      name: 'Mira Fern',
      factionId: 'moss',
      role: 'wanderer',
      x: 12,
      y: 10,
      affection: 2,
      stamina: 7,
      maxStamina: 7,
      hp: 12,
      maxHp: 12,
      gold: 4,
      berries: 9,
      skill: 'trader',
      skillLevel: 2,
    }]
    const person = inspectPosition(state, { x: 12, y: 10 })
    expect(person.name).toBe('Mira Fern')
    expect(person.stats.find((item) => item.label === '好感')?.value).toBe('2/5')

    state.monsters = [{ id: 'monster-inspect', species: 'boar', hp: 8, x: 13, y: 10, alert: 3 }]
    const monster = inspectPosition(state, { x: 13, y: 10 })
    expect(monster.category).toBe('怪物')
    expect(monster.tone).toBe('danger')
  })

  it('describes camps, camp buildings, and their attributes', () => {
    const state = inspectionState()
    state.camps = [{
      id: 'camp-inspect',
      name: '青苔营地',
      x: 15,
      y: 15,
      sceneX: 0,
      sceneY: 0,
      housing: 6,
      defense: 3,
      economy: 5,
      food: 4,
      morale: 4,
      controlRadius: 4,
      buildings: [{ x: 16, y: 15, kind: 'market' }],
      offices: {},
    }]
    state.world.tiles[15 * state.world.size + 15] = {
      terrain: 'meadow',
      coin: 0,
      structure: 'camp',
      campId: 'camp-inspect',
      road: true,
    }
    state.world.tiles[15 * state.world.size + 16] = {
      terrain: 'meadow',
      coin: 0,
      structure: 'camp-building',
      campId: 'camp-inspect',
      buildingKind: 'market',
    }
    const camp = inspectPosition(state, { x: 15, y: 15 })
    expect(camp.category).toBe('建筑')
    expect(camp.stats.find((item) => item.label === '经济')?.value).toBe(5)
    expect(inspectPosition(state, { x: 16, y: 15 }).name).toBe('篷布集市')
    state.player.x = 15
    state.player.y = 15
    expect(inspectPosition(state, state.player).name).toBe('青苔营地')
  })

  it('describes collectible items, roads, terrain, and fog', () => {
    const state = inspectionState()
    state.world.tiles[20 * state.world.size + 20] = { terrain: 'forest', coin: 2 }
    state.world.tiles[20 * state.world.size + 21] = { terrain: 'forest', coin: 0, food: 4 }
    state.world.tiles[20 * state.world.size + 22] = { terrain: 'sand', coin: 0, road: true }
    state.world.tiles[20 * state.world.size + 23] = { terrain: 'marsh', coin: 0 }
    state.fog[20 * state.world.size + 24] = 0

    expect(inspectPosition(state, { x: 20, y: 20 }).name).toBe('旧金币')
    expect(inspectPosition(state, { x: 21, y: 20 }).name).toBe('野果丛')
    expect(inspectPosition(state, { x: 22, y: 20 }).category).toBe('道路')
    expect(inspectPosition(state, { x: 23, y: 20 }).name).toBe('湿地')
    expect(inspectPosition(state, { x: 24, y: 20 }).category).toBe('未知')
  })
})
