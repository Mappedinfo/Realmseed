import { hashString } from './rng'
import type { DungeonFloorSnapshot, DungeonRun, FogLevel, GameState, Monster, Position, Structure, Tile, World } from './types'

export const DUNGEON_WIDTH = 25
export const DUNGEON_HEIGHT = 17

function dungeonTile(seed: string, kind: 'cave' | 'nest', x: number, y: number): Tile {
  const edge = x === 0 || y === 0 || x === DUNGEON_WIDTH - 1 || y === DUNGEON_HEIGHT - 1
  const blocked = !edge && hashString(`${seed}:wall:${x}:${y}`) % 100 < 11 && x > 4 && x < 21
  if (edge || blocked) return { terrain: 'mountain', coin: 0 }
  if (kind === 'nest') return { terrain: hashString(`${seed}:ground:${x}:${y}`) % 4 === 0 ? 'marsh' : 'forest', coin: 0 }
  return { terrain: hashString(`${seed}:ground:${x}:${y}`) % 5 === 0 ? 'marsh' : 'sand', coin: 0 }
}

function setStructure(tiles: Tile[], position: Position, structure: Structure, extras: Partial<Tile> = {}) {
  const index = position.y * DUNGEON_WIDTH + position.x
  tiles[index] = { ...tiles[index], terrain: 'sand', coin: 0, structure, ...extras }
}

function monsterAt(seed: string, floor: number, index: number, rank: Monster['rank'], position: Position): Monster {
  const species = (['slime', 'boar', 'wisp'] as const)[hashString(`${seed}:species:${index}`) % 3]
  const base = rank === 'boss' ? 38 : rank === 'elite' ? 19 : 8
  const maxHp = base + floor * (rank === 'boss' ? 5 : 2) + (hashString(`${seed}:hp:${index}`) % 5)
  return {
    id: `${seed}:monster:${index}`,
    species,
    hp: maxHp,
    maxHp,
    rank,
    phase: 1,
    alert: rank === 'normal' ? 0 : 3,
    facing: 'left',
    ...position,
  }
}

export function createDungeonFloor(
  worldSeed: string,
  entryId: string,
  kind: 'cave' | 'nest',
  floor: number,
  completedRuns: number,
): DungeonFloorSnapshot {
  const seed = `${worldSeed}:dungeon:${entryId}:run:${completedRuns}:floor:${floor}`
  const tiles: Tile[] = []
  for (let y = 0; y < DUNGEON_HEIGHT; y += 1) {
    for (let x = 0; x < DUNGEON_WIDTH; x += 1) tiles.push(dungeonTile(seed, kind, x, y))
  }
  const safeCells = [
    { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 },
    { x: 8, y: 4 }, { x: 8, y: 8 }, { x: 8, y: 12 }, { x: 12, y: 4 },
    { x: 12, y: 8 }, { x: 12, y: 12 }, { x: 16, y: 4 }, { x: 16, y: 8 },
    { x: 16, y: 12 }, { x: 20, y: 4 }, { x: 20, y: 8 }, { x: 20, y: 12 },
    { x: 22, y: 8 },
  ]
  safeCells.forEach((position) => {
    const index = position.y * DUNGEON_WIDTH + position.x
    tiles[index] = { terrain: kind === 'nest' ? 'forest' : 'sand', coin: 0 }
  })
  setStructure(tiles, { x: 2, y: 8 }, floor === 1 ? 'dungeon-exit' : 'stairs-up')
  if (floor < 3) setStructure(tiles, { x: 22, y: 8 }, 'stairs-down')
  const chestPositions = floor === 3 ? [] : [{ x: 8, y: 4 }, ...(hashString(`${seed}:extra-chest`) % 2 ? [{ x: 16, y: 12 }] : [])]
  chestPositions.forEach((position, index) => setStructure(tiles, position, 'chest', {
    chestId: `${entryId}:${completedRuns}:${floor}:chest:${index}`,
    chestOpened: false,
  }))

  const monsters: Monster[] = []
  if (floor < 3) {
    const candidates = [{ x: 8, y: 8 }, { x: 12, y: 4 }, { x: 12, y: 12 }, { x: 16, y: 4 }, { x: 16, y: 8 }, { x: 20, y: 12 }]
    const count = 3 + (hashString(`${seed}:count`) % 4)
    candidates.slice(0, count).forEach((position, index) => monsters.push(monsterAt(seed, floor, index, 'normal', position)))
    monsters.push(monsterAt(seed, floor, 90, 'elite', { x: 20, y: 8 }))
  } else {
    monsters.push(monsterAt(seed, floor, 99, 'boss', { x: 18, y: 8 }))
  }
  const world: World = {
    kind: 'dungeon',
    seed: worldSeed,
    mapSize: 'small',
    size: DUNGEON_WIDTH,
    height: DUNGEON_HEIGHT,
    sceneX: 0,
    sceneY: floor,
    sceneName: kind === 'cave' ? `深岩洞穴 · ${floor}层` : `腐根巢穴 · ${floor}层`,
    tiles,
  }
  return { world, fog: new Array<FogLevel>(tiles.length).fill(0), monsters }
}

export function createDungeonRun(state: GameState, position: Position): DungeonRun | null {
  const tile = state.world.tiles[position.y * state.world.size + position.x]
  if ((tile.structure !== 'cave' && tile.structure !== 'nest') || !tile.dungeonEntryId) return null
  const progress = state.dungeonProgress[tile.dungeonEntryId]
  if (progress?.lastExitDay === state.day) return null
  const completedRuns = progress?.completedRuns ?? 0
  const floors = [1, 2, 3].map((floor) => createDungeonFloor(state.world.seed, tile.dungeonEntryId!, tile.structure as 'cave' | 'nest', floor, completedRuns))
  return {
    id: `${tile.dungeonEntryId}:run:${completedRuns}`,
    entryId: tile.dungeonEntryId,
    entryKind: tile.structure,
    entryPosition: position,
    sceneX: state.world.sceneX,
    sceneY: state.world.sceneY,
    floor: 1,
    floors,
    overworld: {
      world: state.world,
      fog: state.fog,
      agents: state.agents,
      monsters: state.monsters,
      camps: state.camps.filter((camp) => camp.sceneX === state.world.sceneX && camp.sceneY === state.world.sceneY),
    },
    returnPosition: { ...state.player },
    enteredDay: state.day,
    bossDefeated: false,
  }
}

export function dungeonEntryPosition(floor: number, fromBelow = false): Position {
  return fromBelow || floor === 1 ? { x: 3, y: 8 } : { x: 21, y: 8 }
}

export function eliteAlive(state: Pick<GameState, 'monsters'>): boolean {
  return state.monsters.some((monster) => monster.rank === 'elite' && monster.hp > 0)
}

export function bossAlive(state: Pick<GameState, 'monsters'>): boolean {
  return state.monsters.some((monster) => monster.rank === 'boss' && monster.hp > 0)
}
