import type { ArtTheme } from './art'
import type { GameState } from './types'
import { fishingFatigue, fishingInfluenceAt, fishingSpotKey, fishingSpotProgress } from './fishing'

export const GAME_SAVE_KEY = 'realmseed-save-v1'

export interface SavedGame {
  version: 1
  savedAt: number
  theme: ArtTheme
  state: GameState
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function validState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GameState>
  return Boolean(
    state.gameId &&
    state.world &&
    Array.isArray(state.world.tiles) &&
    Array.isArray(state.fog) &&
    state.world.tiles.length === state.fog.length &&
    state.player &&
    Array.isArray(state.agents) &&
    Array.isArray(state.monsters) &&
    state.resources,
  )
}

export function readSavedGame(storage: StorageLike): SavedGame | null {
  try {
    const raw = storage.getItem(GAME_SAVE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<SavedGame>
    if (saved.version !== 1 || !validState(saved.state)) return null
    if (!['verdant', 'ember', 'moonlit'].includes(saved.theme ?? '')) return null
    const state = saved.state
    if (state.activeDungeon) {
      const run = state.activeDungeon
      if (run.floors.length !== 3 || saved.state.world.kind !== 'dungeon') return null
    }
    const fishingSpots = state.fishingSpots ?? {}
    const fishing = state.fishing
      ? (() => {
          const key = fishingSpotKey(state.world, state.fishing!.water)
          const castNumber = state.fishing!.castNumber ?? fishingSpotProgress(fishingSpots[key], state.day).uses + 1
          return {
            ...state.fishing!,
            phase: state.fishing!.phase ?? 'timing' as const,
            castNumber,
            fatigueCost: state.fishing!.fatigueCost ?? fishingFatigue(castNumber),
            influence: state.fishing!.influence ?? fishingInfluenceAt(state.world, state.fishing!.water),
          }
        })()
      : null
    return { ...(saved as SavedGame), state: { ...state, fishingSpots, fishing } }
  } catch {
    return null
  }
}

export function writeSavedGame(storage: StorageLike, state: GameState, theme: ArtTheme): boolean {
  try {
    const saved: SavedGame = { version: 1, savedAt: Date.now(), theme, state }
    storage.setItem(GAME_SAVE_KEY, JSON.stringify(saved))
    return true
  } catch {
    return false
  }
}

export function clearSavedGame(storage: StorageLike): void {
  storage.removeItem(GAME_SAVE_KEY)
}
