import { describe, expect, it } from 'vitest'
import { campBuildingDefinitions } from './camps'
import { createDungeonFloor, createDungeonRun } from './dungeons'
import { gameReducer } from './simulation'
import { createGame, isPassable, tileIndex } from './world'
import type { GameState, Position } from './types'

function adjacentPassable(state: GameState, target: Position): Position {
  const candidates = [
    { x: target.x - 1, y: target.y }, { x: target.x + 1, y: target.y },
    { x: target.x, y: target.y - 1 }, { x: target.x, y: target.y + 1 },
  ]
  return candidates.find((position) => isPassable(state.world, position.x, position.y))!
}

describe('dungeons, resources and fishing', () => {
  it('generates deterministic three-layer dungeon snapshots with elites, chests and a boss', () => {
    const first = [1, 2, 3].map((floor) => createDungeonFloor('seed', 'entry', 'cave', floor, 0))
    const second = [1, 2, 3].map((floor) => createDungeonFloor('seed', 'entry', 'cave', floor, 0))
    expect(first).toEqual(second)
    expect(first[0].world.tiles).toHaveLength(25 * 17)
    expect(first[0].monsters.filter((monster) => monster.rank === 'normal').length).toBeGreaterThanOrEqual(3)
    expect(first[0].monsters.filter((monster) => monster.rank === 'normal').length).toBeLessThanOrEqual(6)
    expect(first[0].monsters.some((monster) => monster.rank === 'elite')).toBe(true)
    const chestCount = first[0].world.tiles.filter((tile) => tile.structure === 'chest').length
    expect(chestCount).toBeGreaterThanOrEqual(1)
    expect(chestCount).toBeLessThanOrEqual(2)
    expect(first[2].monsters).toHaveLength(1)
    expect(first[2].monsters[0].rank).toBe('boss')
  })

  it('creates both repeatable entrance kinds without changing society generation determinism', () => {
    const left = createGame('entrance-contract', 'small')
    const right = createGame('entrance-contract', 'small')
    expect(left.agents).toEqual(right.agents)
    expect(left.world.tiles.some((tile) => tile.structure === 'cave')).toBe(true)
    expect(left.world.tiles.some((tile) => tile.structure === 'nest')).toBe(true)
    const entryIndex = left.world.tiles.findIndex((tile) => tile.structure === 'cave')
    const position = { x: entryIndex % left.world.size, y: Math.floor(entryIndex / left.world.size) }
    expect(createDungeonRun(left, position)?.floors).toHaveLength(3)
  })

  it('enters a cave with a visible floor and preserves follower identity', () => {
    let state = createGame('cave-entry-regression', 'small')
    const entryIndex = state.world.tiles.findIndex((tile) => tile.structure === 'cave')
    const entry = { x: entryIndex % state.world.size, y: Math.floor(entryIndex / state.world.size) }
    const follower = { ...state.agents[0], role: 'follower' as const }
    state.agents = [follower]
    state.monsters = []
    state.player = { ...state.player, ...adjacentPassable(state, entry) }
    const entered = gameReducer(state, { type: 'ENTER_DUNGEON', position: entry })
    expect(entered.activeDungeon).not.toBeNull()
    expect(entered.world.kind).toBe('dungeon')
    expect(entered.world.size).toBe(25)
    expect(entered.world.height).toBe(17)
    expect(entered.fog.filter((level) => level === 2).length).toBeGreaterThan(20)
    expect(entered.player).toMatchObject({ x: 3, y: 8 })
    expect(entered.agents[0]).toMatchObject({ id: follower.id, role: 'follower' })
  })

  it('gathers an adjacent renewable node with fatigue, travel progress and follower bonus', () => {
    let state = createGame('gather-contract', 'small')
    state.agents = []
    state.monsters = []
    const index = state.world.tiles.findIndex((tile) => tile.resourceNode === 'wood')
    const target = { x: index % state.world.size, y: Math.floor(index / state.world.size) }
    state.player = { ...state.player, ...adjacentPassable(state, target) }
    const amount = state.world.tiles[index].resourceAmount!
    state = gameReducer(state, { type: 'GATHER_RESOURCE', position: target })
    expect(state.resources.wood).toBe(amount)
    expect(state.fatigue).toBe(20)
    expect(state.dayProgress).toBe(1)
    expect(state.world.tiles[index].resourceReadyDay).toBe(state.day + 3)
  })

  it('runs the fishing timing check and stores a deterministic fish or perfect reward', () => {
    let state = createGame('fishing-contract', 'small')
    state.agents = []
    state.monsters = []
    let water: Position | undefined
    let shore: Position | undefined
    state.world.tiles.forEach((tile, index) => {
      if (water || tile.terrain !== 'water') return
      const target = { x: index % state.world.size, y: Math.floor(index / state.world.size) }
      const candidate = adjacentPassable(state, target)
      if (candidate) { water = target; shore = candidate }
    })
    state.player = { ...state.player, ...shore! }
    state = gameReducer(state, { type: 'CAST_FISH', position: water! })
    expect(state.fishing).not.toBeNull()
    expect(state.fatigue).toBe(10)
    state.fishing!.cursor = (state.fishing!.perfectStart + state.fishing!.perfectEnd) / 2
    const reeled = gameReducer(state, { type: 'REEL_FISH' })
    expect(reeled.fishing).toBeNull()
    const fishCount = Object.values(reeled.resources.fish).reduce((total, count) => total + count, 0)
    expect(fishCount + (reeled.player.gold - state.player.gold)).toBeGreaterThan(0)
  })

  it('uses material recipes alongside one building credit', () => {
    let state = createGame('material-building', 'small')
    state.world.tiles = state.world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0 }))
    state.monsters = []
    state.resources.wood = 30
    state.resources.stone = 30
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    state.buildingCredits = 1
    state.selected = { x: state.player.x + 1, y: state.player.y }
    const recipe = campBuildingDefinitions.workshop.materials
    const wood = state.resources.wood
    const stone = state.resources.stone
    const gold = state.player.gold
    state = gameReducer(state, { type: 'BUILD_CAMP_TILE', kind: 'workshop' })
    expect(state.resources.wood).toBe(wood - recipe.wood)
    expect(state.resources.stone).toBe(stone - recipe.stone)
    expect(state.player.gold).toBe(gold - recipe.gold)
    expect(state.buildingCredits).toBe(0)
    expect(state.world.tiles[tileIndex(state.world, state.selected!.x, state.selected!.y)].buildingKind).toBe('workshop')
  })
})
