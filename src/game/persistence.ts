import type { ArtTheme } from './art'
import type { GameState } from './types'
import { fishingFatigue, fishingInfluenceAt, fishingSpotKey, fishingSpotProgress } from './fishing'
import { migrateEquipment } from './equipment'

export const GAME_SAVE_KEY = 'realmseed-save-v2'
export const LEGACY_SAVE_KEY = 'realmseed-save-v1'
const BACKUP_KEY = 'realmseed-save-backups-v2'
export const CURRENT_SAVE_VERSION = 2
const APP_VERSION = '0.1.0'

export interface SavedGame {
  format: 'realmseed-save'
  schemaVersion: 2
  appVersion: string
  savedAt: number
  theme: ArtTheme
  state: GameState
  integrity: { algorithm: 'fnv1a32'; value: string }
}

interface LegacySave { version: 1; savedAt: number; theme: ArtTheme; state: GameState }
export interface SaveBackup { id: string; reason: 'migration' | 'import' | 'restore'; createdAt: number; save: SavedGame }
export interface SavePreview { seed: string; day: number; mapSize: string; camps: number; residents: number; equipment: number; savedAt: number; schemaVersion: number; appVersion: string }

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function hash(text: string): string {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return (value >>> 0).toString(16).padStart(8, '0')
}

function payload(save: Omit<SavedGame, 'integrity'>) { return JSON.stringify(save) }

function validState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<GameState>
  if (!state.gameId || !state.world || !Array.isArray(state.world.tiles) || !Array.isArray(state.fog)) return false
  if (state.world.tiles.length !== state.fog.length || !state.player || !Array.isArray(state.agents) || !Array.isArray(state.monsters)) return false
  if (!state.resources || !Array.isArray(state.equipment) || !Array.isArray(state.camps) || !Array.isArray(state.residents)) return false
  if (state.activeDungeon && (state.activeDungeon.floors?.length !== 3 || state.world.kind !== 'dungeon')) return false
  return true
}

function normalizeState(state: GameState): GameState {
  const fishingSpots = state.fishingSpots ?? {}
  const fishing = state.fishing ? (() => {
    const key = fishingSpotKey(state.world, state.fishing!.water)
    const castNumber = state.fishing!.castNumber ?? fishingSpotProgress(fishingSpots[key], state.day).uses + 1
    return { ...state.fishing!, phase: state.fishing!.phase ?? 'timing' as const, castNumber, fatigueCost: state.fishing!.fatigueCost ?? fishingFatigue(castNumber), influence: state.fishing!.influence ?? fishingInfluenceAt(state.world, state.fishing!.water) }
  })() : null
  return { ...state, fishingSpots, fishing, equipment: migrateEquipment(state.equipment, state.player.id) }
}

export function createSaveEnvelope(state: GameState, theme: ArtTheme, savedAt = Date.now()): SavedGame {
  const base: Omit<SavedGame, 'integrity'> = { format: 'realmseed-save', schemaVersion: 2, appVersion: APP_VERSION, savedAt, theme, state }
  return { ...base, integrity: { algorithm: 'fnv1a32', value: hash(payload(base)) } }
}

export function parseSave(value: unknown): SavedGame {
  if (!value || typeof value !== 'object') throw new Error('存档不是有效对象。')
  const candidate = value as Partial<SavedGame & LegacySave> & { schemaVersion?: number; version?: number }
  if (candidate.schemaVersion && candidate.schemaVersion > CURRENT_SAVE_VERSION) throw new Error(`存档版本 V${candidate.schemaVersion} 高于当前游戏 V${CURRENT_SAVE_VERSION}。`)
  if (candidate.version === 1) {
    if (!validState(candidate.state) || !['verdant', 'ember', 'moonlit'].includes(candidate.theme ?? '')) throw new Error('V1 存档结构不完整。')
    return createSaveEnvelope(normalizeState(candidate.state), candidate.theme as ArtTheme, candidate.savedAt ?? Date.now())
  }
  if (candidate.format !== 'realmseed-save' || candidate.schemaVersion !== 2 || !validState(candidate.state)) throw new Error('不是可识别的 Realmseed 存档。')
  if (!['verdant', 'ember', 'moonlit'].includes(candidate.theme ?? '')) throw new Error('存档美术主题无效。')
  const { integrity, ...base } = candidate as SavedGame
  if (!integrity || integrity.algorithm !== 'fnv1a32' || integrity.value !== hash(payload(base))) throw new Error('存档校验失败，文件可能损坏或被修改。')
  const state = normalizeState(candidate.state)
  return createSaveEnvelope(state, candidate.theme as ArtTheme, candidate.savedAt)
}

export function parseSaveText(text: string): SavedGame {
  if (new Blob([text]).size > 32 * 1024 * 1024) throw new Error('存档超过 32 MiB 限制。')
  try { return parseSave(JSON.parse(text)) } catch (error) { throw error instanceof SyntaxError ? new Error('存档 JSON 无法解析。') : error }
}

export function savePreview(save: SavedGame): SavePreview {
  return { seed: save.state.world.seed, day: save.state.day, mapSize: save.state.world.mapSize, camps: save.state.camps.length, residents: save.state.residents.length, equipment: save.state.equipment.length, savedAt: save.savedAt, schemaVersion: save.schemaVersion, appVersion: save.appVersion }
}

export function exportSaveText(state: GameState, theme: ArtTheme): string { return JSON.stringify(createSaveEnvelope(state, theme), null, 2) }
export function exportSaveFilename(state: GameState): string {
  const seed = state.world.seed.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 36) || 'world'
  return `realmseed-${seed}-D${state.day}-${new Date().toISOString().replace(/[:.]/g, '-')}.realmseed.json`
}

export function readSavedGame(storage: StorageLike): SavedGame | null {
  for (const key of [GAME_SAVE_KEY, LEGACY_SAVE_KEY]) {
    const raw = storage.getItem(key)
    if (!raw) continue
    try { return parseSave(JSON.parse(raw)) } catch { continue }
  }
  return null
}

export function writeSavedGame(storage: StorageLike, state: GameState, theme: ArtTheme): boolean {
  try { storage.setItem(GAME_SAVE_KEY, JSON.stringify(createSaveEnvelope(state, theme))); return true } catch { return false }
}

export function clearSavedGame(storage: StorageLike): void { storage.removeItem(GAME_SAVE_KEY); storage.removeItem(LEGACY_SAVE_KEY) }

function localBackups(storage: StorageLike): SaveBackup[] {
  try { return JSON.parse(storage.getItem(BACKUP_KEY) ?? '[]') as SaveBackup[] } catch { return [] }
}

function putLocalBackup(storage: StorageLike, backup: SaveBackup) {
  storage.setItem(BACKUP_KEY, JSON.stringify([backup, ...localBackups(storage)].slice(0, 3)))
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('realmseed-saves', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbPut(record: { id: string; [key: string]: unknown }) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite')
    transaction.objectStore('records').put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function idbRecords(): Promise<Array<{ id: string; save?: SavedGame; backup?: SaveBackup }>> {
  const database = await openDatabase()
  const records = await new Promise<Array<{ id: string; save?: SavedGame; backup?: SaveBackup }>>((resolve, reject) => {
    const request = database.transaction('records').objectStore('records').getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close(); return records
}

async function idbDelete(id: string) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite')
    transaction.objectStore('records').delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

export class BrowserSaveStore {
  constructor(private storage: StorageLike) {}
  async load(): Promise<SavedGame | null> {
    const local = readSavedGame(this.storage)
    if (local) return local
    try {
      const active = (await idbRecords()).find((record) => record.id === 'active')?.save
      return active ? parseSave(active) : null
    } catch { return null }
  }
  async save(save: SavedGame) { this.storage.setItem(GAME_SAVE_KEY, JSON.stringify(save)); try { await idbPut({ id: 'active', save }) } catch { /* local fallback remains canonical */ } }
  async backup(save: SavedGame, reason: SaveBackup['reason']) {
    const backup: SaveBackup = { id: `backup-${Date.now()}-${reason}`, reason, createdAt: Date.now(), save }
    try {
      await idbPut({ id: backup.id, backup })
      const backups = (await idbRecords()).filter((record) => record.backup).sort((a, b) => b.backup!.createdAt - a.backup!.createdAt)
      await Promise.all(backups.slice(3).map((record) => idbDelete(record.id)))
    } catch { putLocalBackup(this.storage, backup) }
    return backup
  }
  async import(save: SavedGame, current?: SavedGame) { if (current) await this.backup(current, 'import'); await this.save(save) }
  async backups(): Promise<SaveBackup[]> {
    try { return (await idbRecords()).flatMap((record) => record.backup ? [record.backup] : []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3) }
    catch { return localBackups(this.storage) }
  }
  async clearActive() { this.storage.removeItem(GAME_SAVE_KEY); this.storage.removeItem(LEGACY_SAVE_KEY); try { await idbDelete('active') } catch { /* already clear in fallback */ } }
}
