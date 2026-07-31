import { hashString, pick, seededRandom } from './rng'
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
  return x >= 0 && y >= 0 && x < world.size && y < world.size
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
      const roll = random()
      tiles.push({
        terrain,
        coin: traversable && roll > 0.946 ? 1 + Math.floor(random() * 4) : 0,
        food: traversable && roll >= 0.012 && roll < 0.03 ? 1 + Math.floor(random() * 2) : 0,
        structure: traversable && roll < 0.009 ? 'ruin' : undefined,
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
  const nameRandom = seededRandom(`${sceneSeed}:name`)
  const sceneName = `${pick(nameRandom, scenePrefixes)}${pick(nameRandom, sceneSuffixes)}`
  return { seed, mapSize, size, sceneX, sceneY, sceneName, tiles }
}

export function revealFog(state: Pick<GameState, 'world' | 'fog' | 'player' | 'agents'>): FogLevel[] {
  const next = state.fog.map((level) => (level === 2 ? 1 : level)) as FogLevel[]
  const sources = [
    { x: state.player.x, y: state.player.y, radius: 4 },
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
  const midpoint = Math.floor(world.size / 2)
  occupied.add(`${midpoint},${midpoint}`)
  const factionIds = ['moss', 'ember', 'tide'] as const
  const sceneId = `${sceneX}_${sceneY}`
  const agents: Agent[] = Array.from({ length: mapSize === 'large' ? 28 : 12 }, (_, index) => ({
    id: `agent-${sceneId}-${index}`,
    name: makeName(random),
    factionId: pick(random, factionIds),
    role: 'wanderer' as const,
    ...randomPassable(world, random, occupied),
    affection: 0,
    stamina: 7,
    maxStamina: 7,
    gold: 2 + Math.floor(random() * 8),
  }))
  const monsters: Monster[] = Array.from({ length: mapSize === 'large' ? 34 : 14 }, (_, index) => ({
    id: `monster-${sceneId}-${index}`,
    species: pick(random, ['slime', 'boar', 'wisp'] as const),
    hp: 1 + Math.floor(random() * 3),
    ...randomPassable(world, random, occupied),
  }))
  return { world, agents, monsters }
}

export function sceneEntry(world: World, direction?: Direction): Position {
  const midpoint = Math.floor(world.size / 2)
  if (direction === 'right') return { x: 2, y: midpoint }
  if (direction === 'left') return { x: world.size - 3, y: midpoint }
  if (direction === 'up') return { x: midpoint, y: world.size - 3 }
  if (direction === 'down') return { x: midpoint, y: 2 }
  return nearestPassable(world, { x: midpoint, y: midpoint })
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
    gold: 7,
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
    gameId: `${seed}-${mapSize}`,
  }
  initial.fog = revealFog(initial)
  return initial
}
