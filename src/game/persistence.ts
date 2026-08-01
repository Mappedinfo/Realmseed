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
export interface SaveBackup { id: string; reason: 'migration' | 'import' | 'restore'; createdAt: number; save: SavedGame; rawSource?: string }
export interface SavePreview { seed: string; day: number; mapSize: string; camps: number; residents: number; equipment: number; savedAt: number; schemaVersion: number; appVersion: string; migrationPath: string[] }
export interface ParsedSave { save: SavedGame; sourceVersion: number; migrationPath: string[] }
export interface SaveProblem { code: string; message: string; detail: string; raw: string; source: 'indexeddb' | 'localStorage' | 'file' }
export interface SaveWriteResult { backend: 'indexeddb' | 'localStorage'; degraded: boolean }
export interface SaveLoadResult { save: SavedGame | null; problem?: SaveProblem; backend: 'indexeddb' | 'localStorage'; degraded: boolean }

export class SaveFormatError extends Error {
  constructor(public code: string, message: string, public detail = message) { super(message) }
}

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

function stateIssues(value: unknown): string[] {
  const issues: string[] = []
  if (!value || typeof value !== 'object') return ['state 不是对象']
  const state = value as Partial<GameState>
  if (!state.gameId) issues.push('缺少 gameId')
  if (!state.world || !Array.isArray(state.world.tiles)) issues.push('世界地块缺失')
  if (!Array.isArray(state.fog)) issues.push('迷雾数组缺失')
  if (state.world && !['small', 'large'].includes(state.world.mapSize)) issues.push('地图尺度无效')
  if (state.world?.tiles && state.fog && state.world.tiles.length !== state.fog.length) issues.push('地块与迷雾长度不一致')
  if (!state.player || !Number.isFinite(state.player.x) || !Number.isFinite(state.player.y)) issues.push('玩家坐标无效')
  if (state.player && state.world && (state.player.x < 0 || state.player.y < 0 || state.player.x >= state.world.size || state.player.y >= (state.world.height ?? state.world.size))) issues.push('玩家位于地图外')
  for (const key of ['agents', 'monsters', 'factions', 'equipment', 'camps', 'residents'] as const) if (!Array.isArray(state[key])) issues.push(`${key} 不是数组`)
  if (!state.resources || !Number.isFinite(state.resources.wood) || !Number.isFinite(state.resources.stone) || !state.resources.fish) issues.push('资源库存无效')
  if (state.sceneCache && Object.values(state.sceneCache).some((scene) => !Array.isArray(scene.world?.tiles) || scene.world.tiles.length !== scene.fog?.length)) issues.push('场景缓存地块与迷雾不一致')
  if (state.activeDungeon && (state.activeDungeon.floors?.length !== 3 || state.world?.kind !== 'dungeon')) issues.push('地下副本快照必须为三层')
  if (state.activeDungeon?.floors?.some((floor) => floor.world.tiles.length !== floor.fog.length)) issues.push('地下层地块与迷雾不一致')
  return issues
}

function validState(value: unknown): value is GameState { return stateIssues(value).length === 0 }

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

type Migration = (value: LegacySave) => SavedGame
const migrations: Record<number, Migration> = {
  1: (value) => createSaveEnvelope(normalizeState(value.state), value.theme, value.savedAt ?? Date.now()),
}

export function parseSaveDetailed(value: unknown): ParsedSave {
  if (!value || typeof value !== 'object') throw new SaveFormatError('not-object', '存档不是有效对象。')
  const candidate = value as Partial<SavedGame & LegacySave> & { schemaVersion?: number; version?: number }
  const sourceVersion = candidate.schemaVersion ?? candidate.version ?? 0
  if (sourceVersion > CURRENT_SAVE_VERSION) throw new SaveFormatError('future-version', `存档版本 V${sourceVersion} 高于当前游戏 V${CURRENT_SAVE_VERSION}。`, '请先更新 Realmseed，再重新导入此存档。')
  if (candidate.version === 1) {
    const issues = stateIssues(candidate.state)
    if (issues.length || !['verdant', 'ember', 'moonlit'].includes(candidate.theme ?? '')) throw new SaveFormatError('invalid-v1', 'V1 存档结构不完整。', issues.join('；') || '美术主题无效')
    let migrated = candidate as LegacySave
    const path: string[] = []
    let version = 1
    while (version < CURRENT_SAVE_VERSION) {
      const migrate = migrations[version]
      if (!migrate) throw new SaveFormatError('missing-migration', `缺少 V${version} → V${version + 1} 迁移器。`)
      const next = migrate(migrated)
      path.push(`V${version} → V${version + 1}`)
      version = next.schemaVersion
      if (version === CURRENT_SAVE_VERSION) return { save: next, sourceVersion, migrationPath: path }
      migrated = next as unknown as LegacySave
    }
  }
  const issues = stateIssues(candidate.state)
  if (candidate.format !== 'realmseed-save' || candidate.schemaVersion !== 2 || issues.length) throw new SaveFormatError('invalid-current', '不是可识别的 Realmseed 存档。', issues.join('；') || '格式标识或版本无效')
  if (!['verdant', 'ember', 'moonlit'].includes(candidate.theme ?? '')) throw new SaveFormatError('invalid-theme', '存档美术主题无效。')
  const { integrity, ...base } = candidate as SavedGame
  if (!integrity || integrity.algorithm !== 'fnv1a32' || integrity.value !== hash(payload(base))) throw new SaveFormatError('integrity', '存档校验失败，文件可能损坏或被修改。', `期望 ${hash(payload(base))}，实际 ${integrity?.value ?? '无校验值'}`)
  const state = normalizeState(candidate.state as GameState)
  return { save: createSaveEnvelope(state, candidate.theme as ArtTheme, candidate.savedAt), sourceVersion, migrationPath: [] }
}

export function parseSave(value: unknown): SavedGame { return parseSaveDetailed(value).save }

export function parseSaveText(text: string): SavedGame {
  return parseSaveTextDetailed(text).save
}

export function parseSaveTextDetailed(text: string): ParsedSave {
  if (new Blob([text]).size > 32 * 1024 * 1024) throw new SaveFormatError('too-large', '存档超过 32 MiB 限制。')
  try { return parseSaveDetailed(JSON.parse(text)) } catch (error) { throw error instanceof SyntaxError ? new SaveFormatError('json', '存档 JSON 无法解析。', error.message) : error }
}

export function savePreview(save: SavedGame, migrationPath: string[] = []): SavePreview {
  return { seed: save.state.world.seed, day: save.state.day, mapSize: save.state.world.mapSize, camps: save.state.camps.length, residents: save.state.residents.length, equipment: save.state.equipment.length, savedAt: save.savedAt, schemaVersion: save.schemaVersion, appVersion: save.appVersion, migrationPath }
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

async function idbAtomicReplace(save: SavedGame, backup?: SaveBackup) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite')
    const store = transaction.objectStore('records')
    store.put({ id: 'active', save })
    if (backup) store.put({ id: backup.id, backup })
    const request = store.getAll()
    request.onsuccess = () => request.result
      .filter((record: { backup?: SaveBackup }) => record.backup)
      .sort((a: { backup: SaveBackup }, b: { backup: SaveBackup }) => b.backup.createdAt - a.backup.createdAt)
      .slice(3)
      .forEach((record: { id: string }) => store.delete(record.id))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
  database.close()
}

export class BrowserSaveStore {
  constructor(private storage: StorageLike) {}
  async loadDetailed(): Promise<SaveLoadResult> {
    let idbAvailable = true
    try {
      const active = (await idbRecords()).find((record) => record.id === 'active')?.save
      if (active) {
        try {
          const indexedSave = parseSave(active)
          const localRaw = this.storage.getItem(GAME_SAVE_KEY)
          if (localRaw) {
            try {
              const localSave = parseSaveTextDetailed(localRaw).save
              if (localSave.savedAt > indexedSave.savedAt) {
                await idbPut({ id: 'active', save: localSave })
                return { save: localSave, backend: 'indexeddb', degraded: false }
              }
            } catch { /* a valid IndexedDB save remains recoverable */ }
          }
          return { save: indexedSave, backend: 'indexeddb', degraded: false }
        }
        catch (error) { return { save: null, backend: 'indexeddb', degraded: false, problem: this.problem(error, JSON.stringify(active, null, 2), 'indexeddb') } }
      }
    } catch { idbAvailable = false }
    for (const key of [GAME_SAVE_KEY, LEGACY_SAVE_KEY]) {
      const raw = this.storage.getItem(key)
      if (!raw) continue
      try {
        const parsed = parseSaveTextDetailed(raw)
        if (parsed.migrationPath.length) await this.atomicReplace(parsed.save, parsed.save, 'migration', raw)
        else if (idbAvailable) await idbPut({ id: 'active', save: parsed.save })
        return { save: parsed.save, backend: idbAvailable ? 'indexeddb' : 'localStorage', degraded: !idbAvailable }
      } catch (error) { return { save: null, backend: idbAvailable ? 'indexeddb' : 'localStorage', degraded: !idbAvailable, problem: this.problem(error, raw, 'localStorage') } }
    }
    return { save: null, backend: idbAvailable ? 'indexeddb' : 'localStorage', degraded: !idbAvailable }
  }
  async load(): Promise<SavedGame | null> { return (await this.loadDetailed()).save }
  async save(save: SavedGame): Promise<SaveWriteResult> {
    try {
      await idbPut({ id: 'active', save })
      try { this.storage.setItem(GAME_SAVE_KEY, JSON.stringify(save)) } catch { /* IndexedDB remains canonical */ }
      return { backend: 'indexeddb', degraded: false }
    } catch {
      this.storage.setItem(GAME_SAVE_KEY, JSON.stringify(save))
      return { backend: 'localStorage', degraded: true }
    }
  }
  async backup(save: SavedGame, reason: SaveBackup['reason']) {
    const backup: SaveBackup = { id: `backup-${Date.now()}-${reason}`, reason, createdAt: Date.now(), save }
    try {
      await idbPut({ id: backup.id, backup })
      const backups = (await idbRecords()).filter((record) => record.backup).sort((a, b) => b.backup!.createdAt - a.backup!.createdAt)
      await Promise.all(backups.slice(3).map((record) => idbDelete(record.id)))
    } catch { putLocalBackup(this.storage, backup) }
    return backup
  }
  async atomicReplace(save: SavedGame, current?: SavedGame, reason: SaveBackup['reason'] = 'import', rawSource?: string): Promise<SaveWriteResult> {
    const backup = current ? { id: `backup-${Date.now()}-${reason}`, reason, createdAt: Date.now(), save: current, rawSource } satisfies SaveBackup : undefined
    try {
      await idbAtomicReplace(save, backup)
      try { this.storage.setItem(GAME_SAVE_KEY, JSON.stringify(save)) } catch { /* IndexedDB commit already succeeded */ }
      return { backend: 'indexeddb', degraded: false }
    } catch (idbError) {
      const oldActive = this.storage.getItem(GAME_SAVE_KEY)
      const oldBackups = this.storage.getItem(BACKUP_KEY)
      try {
        if (backup) putLocalBackup(this.storage, backup)
        this.storage.setItem(GAME_SAVE_KEY, JSON.stringify(save))
        return { backend: 'localStorage', degraded: true }
      } catch (localError) {
        try { oldActive === null ? this.storage.removeItem(GAME_SAVE_KEY) : this.storage.setItem(GAME_SAVE_KEY, oldActive) } catch { /* retain best available copy */ }
        try { oldBackups === null ? this.storage.removeItem(BACKUP_KEY) : this.storage.setItem(BACKUP_KEY, oldBackups) } catch { /* retain best available copy */ }
        throw new SaveFormatError('write-failed', '存档写入失败，当前进度没有被替换。', `${String(idbError)}；${String(localError)}`)
      }
    }
  }
  async import(save: SavedGame, current?: SavedGame) { return this.atomicReplace(save, current, 'import') }
  async backups(): Promise<SaveBackup[]> {
    try { return (await idbRecords()).flatMap((record) => record.backup ? [record.backup] : []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3) }
    catch { return localBackups(this.storage) }
  }
  async clearActive() { this.storage.removeItem(GAME_SAVE_KEY); this.storage.removeItem(LEGACY_SAVE_KEY); try { await idbDelete('active') } catch { /* already clear in fallback */ } }
  private problem(error: unknown, raw: string, source: SaveProblem['source']): SaveProblem {
    const known = error instanceof SaveFormatError ? error : new SaveFormatError('unknown', error instanceof Error ? error.message : '未知存档错误')
    return { code: known.code, message: known.message, detail: known.detail, raw, source }
  }
}
