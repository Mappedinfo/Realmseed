import { hashString, pick, seededRandom } from './rng'
import type { Agent, Faction, FogLevel, GameState, MapSize, Monster, Position, Terrain, Tile, World } from './types'

const firstNames = ['Ari', 'Bram', 'Cleo', 'Dara', 'Eli', 'Fenn', 'Gale', 'Hana', 'Ivo', 'Juno', 'Kiri', 'Lark', 'Mira', 'Nox', 'Orin', 'Pia', 'Quin', 'Rhea', 'Sora', 'Tavi']
const lastNames = ['Ash', 'Bell', 'Brook', 'Dew', 'Ember', 'Fallow', 'Grove', 'Hearth', 'Isle', 'Juniper', 'Kestrel', 'Lumen', 'Moss', 'North', 'Oak', 'Pine', 'Reed', 'Stone', 'Thorn', 'Vale']
const weathers = ['苔光晴日', '薄雾低垂', '金叶微风', '远雷将至', '萤火之夜']

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

export function createWorld(seed: string, mapSize: MapSize): World {
  const size = mapSize === 'large' ? 96 : 40
  const random = seededRandom(`${seed}:resources`)
  const tiles: Tile[] = []

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const terrain = terrainAt(seed, x, y, size)
      const traversable = terrain !== 'water' && terrain !== 'mountain'
      const roll = random()
      tiles.push({
        terrain,
        coin: traversable && roll > 0.946 ? 1 + Math.floor(random() * 4) : 0,
        structure: traversable && roll < 0.009 ? 'ruin' : undefined,
      })
    }
  }
  return { seed, size, tiles }
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

export function createGame(seed: string, mapSize: MapSize): GameState {
  const world = createWorld(seed, mapSize)
  const random = seededRandom(`${seed}:society`)
  const occupied = new Set<string>()
  const start = nearestPassable(world, { x: Math.floor(world.size / 2), y: Math.floor(world.size / 2) })
  occupied.add(`${start.x},${start.y}`)
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
  const agents: Agent[] = Array.from({ length: mapSize === 'large' ? 28 : 12 }, (_, index) => ({
    id: `agent-${index}`,
    name: makeName(random),
    factionId: pick(random, factions).id,
    role: 'wanderer' as const,
    ...randomPassable(world, random, occupied),
    affection: 0,
    stamina: 7,
    maxStamina: 7,
    gold: 2 + Math.floor(random() * 8),
  }))
  const monsters: Monster[] = Array.from({ length: mapSize === 'large' ? 34 : 14 }, (_, index) => ({
    id: `monster-${index}`,
    species: pick(random, ['slime', 'boar', 'wisp'] as const),
    hp: 1 + Math.floor(random() * 3),
    ...randomPassable(world, random, occupied),
  }))
  const fog = new Array<FogLevel>(world.tiles.length).fill(0)
  const initial: GameState = {
    world,
    fog,
    player,
    agents,
    monsters,
    factions,
    day: 1,
    weather: pick(random, weathers),
    chronicle: [
      { id: 1, day: 1, text: `${player.name} 在一片陌生草地醒来。世界种子是 ${seed}。`, tone: 'plain' },
      { id: 2, day: 1, text: '远方有炊烟，也有低吼。先点亮地图，再决定效忠谁。', tone: 'plain' },
    ],
    selected: null,
    gameId: `${seed}-${mapSize}`,
  }
  initial.fog = revealFog(initial)
  return initial
}
