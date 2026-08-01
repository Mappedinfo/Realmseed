import { hashString, pick, seededRandom } from './rng'
import { createNpcLoadout, starterEquipment } from './combat'
import { agentSkillIds, partyBonuses } from './skills'
import { effectiveCampStats } from './camps'
import type { Agent, Direction, Faction, FogLevel, GameState, MapSize, Monster, Position, SceneSnapshot, Terrain, Tile, World } from './types'

const firstNames = ['Ari', 'Bram', 'Cleo', 'Dara', 'Eli', 'Fenn', 'Gale', 'Hana', 'Ivo', 'Juno', 'Kiri', 'Lark', 'Mira', 'Nox', 'Orin', 'Pia', 'Quin', 'Rhea', 'Sora', 'Tavi']
const lastNames = ['Ash', 'Bell', 'Brook', 'Dew', 'Ember', 'Fallow', 'Grove', 'Hearth', 'Isle', 'Juniper', 'Kestrel', 'Lumen', 'Moss', 'North', 'Oak', 'Pine', 'Reed', 'Stone', 'Thorn', 'Vale']
const weathers = ['苔光晴日', '薄雾低垂', '金叶微风', '远雷将至', '萤火之夜']
const scenePrefixes = ['琥珀', '苍苔', '雾杉', '风铃', '月泉', '星落', '灰烬', '碧潮', '金穗', '霜叶']
const sceneSuffixes = ['原', '谷', '林', '泽', '丘', '岸', '径', '台地', '荒野', '秘境']

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lattice(seed: string, x: number, y: number): number {
  return (hashString(`${seed}:${x}:${y}`) % 10000) / 10000
}

function valueNoise(seed: string, x: number, y: number, scale: number): number {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smoothstep(gx - x0)
  const ty = smoothstep(gy - y0)
  const a = lattice(seed, x0, y0)
  const b = lattice(seed, x0 + 1, y0)
  const c = lattice(seed, x0, y0 + 1)
  const d = lattice(seed, x0 + 1, y0 + 1)
  const top = a + (b - a) * tx
  const bottom = c + (d - c) * tx
  return top + (bottom - top) * ty
}

function terrainAt(seed: string, x: number, y: number, size: number): Terrain {
  const edge = Math.min(x, y, size - x - 1, size - y - 1) / Math.max(5, size * 0.13)
  const elevation =
    valueNoise(`${seed}:e1`, x, y, 18) * 0.55 +
    valueNoise(`${seed}:e2`, x, y, 8) * 0.3 +
    valueNoise(`${seed}:e3`, x, y, 3) * 0.15
  const moisture = valueNoise(`${seed}:m`, x, y, 11)
  const islandElevation = elevation * Math.min(1, edge + 0.22)

  if (islandElevation < 0.25) return 'water'
  if (islandElevation > 0.76) return 'mountain'
  if (islandElevation < 0.32 && moisture < 0.52) return 'sand'
  if (moisture > 0.72 && islandElevation < 0.48) return 'marsh'
  if (moisture > 0.56) return 'forest'
  return 'meadow'
}

export function tileIndex(world: World, x: number, y: number): number {
  return y * world.size + x
}

export function isInside(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.size && y < (world.height ?? world.size)
}

export function isPassable(world: World, x: number, y: number): boolean {
  if (!isInside(world, x, y)) return false
  const terrain = world.tiles[tileIndex(world, x, y)].terrain
  return terrain !== 'water' && terrain !== 'mountain'
}

function nearestPassable(world: World, origin: Position): Position {
  for (let radius = 0; radius < world.size; radius += 1) {
    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        if (isPassable(world, x, y)) return { x, y }
      }
    }
  }
  return { x: 1, y: 1 }
}

function randomPassable(world: World, random: () => number, occupied: Set<string>): Position {
  for (let attempts = 0; attempts < 5000; attempts += 1) {
    const x = Math.floor(random() * world.size)
    const y = Math.floor(random() * world.size)
    const key = `${x},${y}`
    if (isPassable(world, x, y) && !occupied.has(key)) {
      occupied.add(key)
      return { x, y }
    }
  }
  return nearestPassable(world, { x: world.size / 2, y: world.size / 2 })
}

export function sceneKey(sceneX: number, sceneY: number): string {
  return `${sceneX},${sceneY}`
}

export function createWorld(seed: string, mapSize: MapSize, sceneX = 0, sceneY = 0): World {
  const size = mapSize === 'large' ? 96 : 40
  const sceneSeed = `${seed}:scene:${sceneX}:${sceneY}`
  const random = seededRandom(`${sceneSeed}:resources`)
  const tiles: Tile[] = []

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const terrain = terrainAt(sceneSeed, x, y, size)
      const traversable = terrain !== 'water' && terrain !== 'mountain'
      const berryBaseChance: Record<Terrain, number> = {
        meadow: 0.045,
        forest: 0.072,
        marsh: 0.058,
        sand: 0.018,
        water: 0,
        mountain: 0,
      }
      const berryPatch = 0.7 + valueNoise(`${sceneSeed}:berry-patch`, x, y, 9) * 0.6
      const berryRoll = random()
      const coinRoll = random()
      const structureRoll = random()
      tiles.push({
        terrain,
        coin: traversable && coinRoll < 0.009 ? 1 : 0,
        food: traversable && berryRoll < berryBaseChance[terrain] * berryPatch ? 1 + Math.floor(random() * 3) : 0,
        structure: traversable && structureRoll < 0.009 ? 'ruin' : undefined,
      })
    }
  }
  const midpoint = Math.floor(size / 2)
  const waystones = [
    { x: midpoint, y: 1 },
    { x: midpoint, y: size - 2 },
    { x: 1, y: midpoint },
    { x: size - 2, y: midpoint },
  ]
  for (const waystone of waystones) {
    for (let offset = -1; offset <= 1; offset += 1) {
      const horizontalIndex = waystone.y * size + Math.max(0, Math.min(size - 1, waystone.x + offset))
      const verticalIndex = Math.max(0, Math.min(size - 1, waystone.y + offset)) * size + waystone.x
      tiles[horizontalIndex] = { terrain: 'meadow', coin: 0 }
      tiles[verticalIndex] = { terrain: 'meadow', coin: 0 }
    }
    tiles[waystone.y * size + waystone.x] = { terrain: 'meadow', coin: 0, structure: 'waystone' }
  }
  const entryCandidates: { index: number; structure: 'cave' | 'nest'; score: number }[] = []
  const woodCandidates: { index: number; score: number }[] = []
  const stoneCandidates: { index: number; score: number }[] = []
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = y * size + x
      const tile = tiles[index]
      if (!tile || tile.structure || tile.terrain === 'water' || tile.terrain === 'mountain') continue
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => tiles[(y + dy) * size + x + dx]?.terrain)
      const nearMountain = neighbors.includes('mountain')
      if (tile.terrain === 'forest') woodCandidates.push({ index, score: hashString(`${sceneSeed}:wood:${x}:${y}`) })
      if (nearMountain) stoneCandidates.push({ index, score: hashString(`${sceneSeed}:stone:${x}:${y}`) })
      if (nearMountain) entryCandidates.push({ index, structure: 'cave', score: hashString(`${sceneSeed}:dungeon:cave:${x}:${y}`) })
      if (tile.terrain === 'forest' || tile.terrain === 'marsh') entryCandidates.push({ index, structure: 'nest', score: hashString(`${sceneSeed}:dungeon:nest:${x}:${y}`) })
    }
  }
  const hubCandidates: { position: Position; distance: number }[] = []
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      if (!isPassable({ kind: 'overworld', seed, mapSize, size, sceneX, sceneY, sceneName: '', tiles }, x, y)) continue
      const nearby = (candidates: { index: number }[]) => candidates.filter((candidate) => {
        const dx = candidate.index % size - x
        const dy = Math.floor(candidate.index / size) - y
        return dx * dx + dy * dy <= 18
      }).length
      if (nearby(woodCandidates) >= 2 && nearby(stoneCandidates) >= 2) {
        hubCandidates.push({ position: { x, y }, distance: Math.abs(x - size / 2) + Math.abs(y - size / 2) })
      }
    }
  }
  const naturalHub = hubCandidates.sort((a, b) => a.distance - b.distance)[0]?.position
  const provisionalWorld: World = { kind: 'overworld', seed, mapSize, size, sceneX, sceneY, sceneName: '', tiles }
  const expeditionStart = naturalHub ?? nearestPassable(provisionalWorld, { x: size / 2, y: size / 2 })
  const placeNodes = (candidates: { index: number; score: number }[], kind: 'wood' | 'stone') => {
    const centerX = expeditionStart?.x ?? size / 2
    const centerY = expeditionStart?.y ?? size / 2
    const nearest = [...candidates].sort((a, b) => {
      const ax = a.index % size - centerX
      const ay = Math.floor(a.index / size) - centerY
      const bx = b.index % size - centerX
      const by = Math.floor(b.index / size) - centerY
      return ax * ax + ay * ay - bx * bx - by * by
    }).slice(0, 2)
    const chosen = new Map([...nearest, ...[...candidates].sort((a, b) => a.score - b.score).slice(0, Math.max(8, Math.floor(size / 3)))].map((candidate) => [candidate.index, candidate]))
    chosen.forEach(({ index }) => {
      if (!tiles[index].structure && !tiles[index].resourceNode) {
        tiles[index] = { ...tiles[index], resourceNode: kind, resourceAmount: 2 + (hashString(`${sceneSeed}:${kind}:amount:${index}`) % 3) }
      }
    })
  }
  placeNodes(woodCandidates, 'wood')
  placeNodes(stoneCandidates, 'stone')
  const chosenEntries: typeof entryCandidates = []
  const firstCave = entryCandidates.filter((candidate) => candidate.structure === 'cave').sort((a, b) => a.score - b.score)[0]
  const firstNest = entryCandidates.filter((candidate) => candidate.structure === 'nest').sort((a, b) => a.score - b.score)[0]
  if (firstCave) chosenEntries.push(firstCave)
  if (firstNest && firstNest.index !== firstCave?.index) chosenEntries.push(firstNest)
  for (const candidate of entryCandidates.sort((a, b) => a.score - b.score)) {
    if (chosenEntries.some((entry) => entry.index === candidate.index)) continue
    const x = candidate.index % size
    const y = Math.floor(candidate.index / size)
    if (chosenEntries.some((entry) => Math.abs(entry.index % size - x) + Math.abs(Math.floor(entry.index / size) - y) < 10)) continue
    chosenEntries.push(candidate)
    if (chosenEntries.length >= (mapSize === 'large' ? 5 : 2)) break
  }
  chosenEntries.forEach(({ index, structure }) => {
    tiles[index] = { ...tiles[index], structure, resourceNode: undefined, resourceAmount: undefined, dungeonEntryId: `${sceneX},${sceneY}:${index}:${structure}` }
  })
  if (!naturalHub) {
    const starterCells: number[] = []
    for (let radius = 1; radius <= 4 && starterCells.length < 4; radius += 1) {
      for (let dy = -radius; dy <= radius && starterCells.length < 4; dy += 1) {
        for (let dx = -radius; dx <= radius && starterCells.length < 4; dx += 1) {
          if (dx * dx + dy * dy > 18) continue
          const x = expeditionStart.x + dx
          const y = expeditionStart.y + dy
          if (!isInside(provisionalWorld, x, y) || !isPassable(provisionalWorld, x, y)) continue
          const index = y * size + x
          if (tiles[index].structure || starterCells.includes(index)) continue
          starterCells.push(index)
        }
      }
    }
    starterCells.forEach((index, order) => {
      const resourceNode = order < 2 ? 'wood' as const : 'stone' as const
      tiles[index] = { ...tiles[index], resourceNode, resourceAmount: 2 + (hashString(`${sceneSeed}:starter:${resourceNode}:${index}`) % 3) }
    })
  }
  const nameRandom = seededRandom(`${sceneSeed}:name`)
  const sceneName = `${pick(nameRandom, scenePrefixes)}${pick(nameRandom, sceneSuffixes)}`
  return { kind: 'overworld', seed, mapSize, size, sceneX, sceneY, sceneName, tiles, expeditionStart }
}

export function revealFog(state: Pick<GameState, 'world' | 'fog' | 'player' | 'agents' | 'camps' | 'residents'>): FogLevel[] {
  const next = state.fog.map((level) => (level === 2 ? 1 : level)) as FogLevel[]
  const bonuses = partyBonuses(state.agents)
  const sources = [
    { x: state.player.x, y: state.player.y, radius: 4 + bonuses.vision },
    ...state.agents
      .filter((agent) => agent.role === 'follower' || agent.role === 'villager')
      .map((agent) => ({ x: agent.x, y: agent.y, radius: agent.role === 'villager' ? 3 : 2 })),
  ]

  for (const source of sources) {
    for (let dy = -source.radius; dy <= source.radius; dy += 1) {
      for (let dx = -source.radius; dx <= source.radius; dx += 1) {
        if (dx * dx + dy * dy > source.radius * source.radius + 2) continue
        const x = source.x + dx
        const y = source.y + dy
        if (isInside(state.world, x, y)) next[tileIndex(state.world, x, y)] = 2
      }
    }
  }

  for (const camp of state.world.kind === 'dungeon' ? [] : state.camps) {
    if (camp.sceneX !== state.world.sceneX || camp.sceneY !== state.world.sceneY) continue
    const radius = effectiveCampStats(state, camp).controlRadius
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue
        const x = camp.x + dx
        const y = camp.y + dy
        if (isInside(state.world, x, y)) next[tileIndex(state.world, x, y)] = 2
      }
    }
  }
  return next
}

function makeName(random: () => number): string {
  return `${pick(random, firstNames)} ${pick(random, lastNames)}`
}

export function createScene(
  seed: string,
  mapSize: MapSize,
  sceneX: number,
  sceneY: number,
): Omit<SceneSnapshot, 'fog'> {
  const world = createWorld(seed, mapSize, sceneX, sceneY)
  const random = seededRandom(`${seed}:scene:${sceneX}:${sceneY}:society`)
  const occupied = new Set<string>()
  const initialEntry = sceneEntry(world)
  occupied.add(`${initialEntry.x},${initialEntry.y}`)
  const factionIds = ['moss', 'ember', 'tide'] as const
  const sceneId = `${sceneX}_${sceneY}`
  const agents: Agent[] = Array.from({ length: mapSize === 'large' ? 28 : 12 }, (_, index) => {
    // Keep the original seeded draw order stable so adding HP does not move or
    // rename existing NPCs for a previously shared world seed.
    const name = makeName(random)
    const factionId = pick(random, factionIds)
    const position = randomPassable(world, random, occupied)
    const gold = 2 + Math.floor(random() * 8)
    const berries = 8 + Math.floor(random() * 24)
    const facing = pick(random, ['up', 'down', 'left', 'right'] as const)
    const skill = pick(random, agentSkillIds)
    const skillLevel = (1 + Math.floor(random() * 3)) as 1 | 2 | 3
    const maxHp = 8 + skillLevel * 4
    return {
      id: `agent-${sceneId}-${index}`,
      name,
      factionId,
      role: 'wanderer' as const,
      ...position,
      affection: 0,
      stamina: 7,
      maxStamina: 7,
      hp: maxHp,
      maxHp,
      gold,
      berries,
      facing,
      skill,
      skillLevel,
      loadout: createNpcLoadout(`agent-${sceneId}-${index}`, skill, skillLevel),
    }
  })
  const monsters: Monster[] = Array.from({ length: mapSize === 'large' ? 34 : 14 }, (_, index) => {
    const species = pick(random, ['slime', 'boar', 'wisp'] as const)
    const maxHp = 6 + Math.floor(random() * 5)
    const facing = pick(random, ['up', 'down', 'left', 'right'] as const)
    return {
      id: `monster-${sceneId}-${index}`,
      species,
      hp: maxHp,
      maxHp,
      rank: 'normal' as const,
      facing,
      alert: 0,
      ...randomPassable(world, random, occupied),
    }
  })
  return { world, agents, monsters, camps: [] }
}

export function sceneEntry(world: World, direction?: Direction): Position {
  const midpoint = Math.floor(world.size / 2)
  if (direction === 'right') return { x: 2, y: midpoint }
  if (direction === 'left') return { x: world.size - 3, y: midpoint }
  if (direction === 'up') return { x: midpoint, y: world.size - 3 }
  if (direction === 'down') return { x: midpoint, y: 2 }
  return world.expeditionStart ?? nearestPassable(world, { x: midpoint, y: midpoint })
}

export function createGame(seed: string, mapSize: MapSize): GameState {
  const scene = createScene(seed, mapSize, 0, 0)
  const { world, agents, monsters } = scene
  const random = seededRandom(`${seed}:player`)
  const start = sceneEntry(world)
  const factionTemplates = [
    ['moss', '苔冠盟', '#83b36c'],
    ['ember', '余烬社', '#df815f'],
    ['tide', '潮汐庭', '#65a7b7'],
  ] as const
  const factions: Faction[] = factionTemplates.map(([id, name, color]) => ({
    id,
    name,
    color,
    relation: 0,
    isVassal: false,
    isOverlord: false,
    autoAggro: false,
  }))
  const player: Agent = {
    id: 'player',
    name: makeName(random),
    factionId: 'free',
    role: 'player',
    ...start,
    affection: 0,
    stamina: 12,
    maxStamina: 12,
    hp: 12,
    maxHp: 12,
    gold: 12,
    berries: 4,
    facing: 'down',
    skill: 'scout',
    skillLevel: 1,
    loadout: [],
  }
  const fog = new Array<FogLevel>(world.tiles.length).fill(0)
  const initial: GameState = {
    world,
    fog,
    player,
    agents,
    monsters,
    factions,
    sceneCache: {},
    day: 1,
    weather: pick(random, weathers),
    chronicle: [
      { id: 1, day: 1, text: `${player.name} 在一片陌生草地醒来。世界种子是 ${seed}。`, tone: 'plain' },
      { id: 2, day: 1, text: '远方有炊烟，也有低吼。先点亮地图，再决定效忠谁。', tone: 'plain' },
    ],
    selected: null,
    fatigue: 0,
    combatWins: 0,
    combatPreference: 'field',
    redNameMode: false,
    attackSequence: 0,
    battle: null,
    equipment: starterEquipment.map((item) => ({ ...item })),
    resources: { wood: 0, stone: 0, fish: { minnow: 0, carp: 0, loach: 0, 'golden-koi': 0 } },
    activeDungeon: null,
    dungeonProgress: {},
    fishing: null,
    fishingSpots: {},
    camps: [],
    residents: [],
    constructionSteps: 0,
    buildingCredits: 0,
    challengeMarks: {
      scout: 0,
      forager: 0,
      guard: 0,
      medic: 0,
      trader: 0,
      duelist: 0,
    },
    facilityEvent: null,
    settlementEvents: [],
    turn: 0,
    dayProgress: 0,
    gameId: `${seed}-${mapSize}`,
  }
  initial.fog = revealFog(initial)
  return initial
}
