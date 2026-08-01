import { describe, expect, it } from 'vitest'
import { clearSavedGame, createSaveEnvelope, exportSaveText, GAME_SAVE_KEY, parseSaveText, readSavedGame, writeSavedGame, type StorageLike } from './persistence'
import { gameReducer } from './simulation'
import { createGame, isPassable } from './world'
import type { GameState } from './types'

function memoryStorage(): StorageLike & { value: Record<string, string> } {
  const value: Record<string, string> = {}
  return {
    value,
    getItem: (key) => value[key] ?? null,
    setItem: (key, next) => { value[key] = next },
    removeItem: (key) => { delete value[key] },
  }
}

describe('local game persistence', () => {
  it('round-trips an active dungeon including fog, monsters and overworld return state', () => {
    let state = createGame('saved-cave', 'small')
    const entryIndex = state.world.tiles.findIndex((tile) => tile.structure === 'cave')
    const entry = { x: entryIndex % state.world.size, y: Math.floor(entryIndex / state.world.size) }
    const shore = [{ x: entry.x - 1, y: entry.y }, { x: entry.x + 1, y: entry.y }, { x: entry.x, y: entry.y - 1 }, { x: entry.x, y: entry.y + 1 }]
      .find((position) => isPassable(state.world, position.x, position.y))!
    state.player = { ...state.player, ...shore }
    state = gameReducer(state, { type: 'ENTER_DUNGEON', position: entry })
    const storage = memoryStorage()
    expect(writeSavedGame(storage, state, 'verdant')).toBe(true)
    const restored = readSavedGame(storage)
    expect(restored?.schemaVersion).toBe(2)
    expect(restored?.state.activeDungeon).toEqual(state.activeDungeon)
    expect(restored?.state.activeDungeon?.floors).toHaveLength(3)
    expect(restored?.state.fog.some((level) => level === 2)).toBe(true)
  })

  it('exports readable V2 JSON and rejects checksum changes and future saves', () => {
    const state = createGame('portable-world', 'small')
    const text = exportSaveText(state, 'moonlit')
    expect(parseSaveText(text).state.world.seed).toBe('portable-world')
    const changed = JSON.parse(text)
    changed.state.day = 99
    expect(() => parseSaveText(JSON.stringify(changed))).toThrow(/校验失败/)
    const future = createSaveEnvelope(state, 'verdant') as unknown as { schemaVersion: number }
    future.schemaVersion = 99
    expect(() => parseSaveText(JSON.stringify(future))).toThrow(/高于当前游戏/)
  })

  it('rejects corrupt or incompatible saves and clears the canonical key', () => {
    const storage = memoryStorage()
    storage.value[GAME_SAVE_KEY] = '{broken'
    expect(readSavedGame(storage)).toBeNull()
    storage.value[GAME_SAVE_KEY] = JSON.stringify({ version: 99, state: {} })
    expect(readSavedGame(storage)).toBeNull()
    clearSavedGame(storage)
    expect(storage.getItem(GAME_SAVE_KEY)).toBeNull()
  })

  it('normalizes legacy saves without fishing spot progress or fishing phases', () => {
    const storage = memoryStorage()
    const legacy = createGame('legacy-fishing-save', 'small') as Omit<GameState, 'fishingSpots'> & { fishingSpots?: GameState['fishingSpots'] }
    const waterIndex = legacy.world.tiles.findIndex((tile) => tile.terrain === 'water')
    const water = { x: waterIndex % legacy.world.size, y: Math.floor(waterIndex / legacy.world.size) }
    delete legacy.fishingSpots
    legacy.fishing = { water, cursor: 12, direction: 1, perfectStart: 40, perfectEnd: 50, successStart: 25, successEnd: 65 } as GameState['fishing']
    storage.value[GAME_SAVE_KEY] = JSON.stringify({ version: 1, savedAt: 1, theme: 'verdant', state: legacy })
    const restored = readSavedGame(storage)?.state
    expect(restored?.fishingSpots).toEqual({})
    expect(restored?.fishing).toMatchObject({ phase: 'timing', castNumber: 1, fatigueCost: 10 })
  })
})
