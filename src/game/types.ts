export type Terrain = 'meadow' | 'forest' | 'water' | 'mountain' | 'marsh' | 'sand'
export type FogLevel = 0 | 1 | 2
export type MapSize = 'small' | 'large'
export type Structure = 'camp' | 'village' | 'ruin' | 'waystone'

export interface Tile {
  terrain: Terrain
  coin: number
  food?: number
  structure?: Structure
}

export interface Position {
  x: number
  y: number
}

export interface Faction {
  id: string
  name: string
  color: string
  relation: number
  isVassal: boolean
  isOverlord: boolean
}

export interface Agent extends Position {
  id: string
  name: string
  factionId: string
  role: 'player' | 'wanderer' | 'follower' | 'villager'
  affection: number
  stamina: number
  maxStamina: number
  gold: number
}

export interface Monster extends Position {
  id: string
  species: 'slime' | 'boar' | 'wisp'
  hp: number
}

export interface World {
  seed: string
  mapSize: MapSize
  size: number
  sceneX: number
  sceneY: number
  sceneName: string
  tiles: Tile[]
}

export interface SceneSnapshot {
  world: World
  fog: FogLevel[]
  agents: Agent[]
  monsters: Monster[]
}

export interface ChronicleEntry {
  id: number
  day: number
  text: string
  tone: 'plain' | 'good' | 'danger'
}

export interface GameState {
  world: World
  fog: FogLevel[]
  player: Agent
  agents: Agent[]
  monsters: Monster[]
  factions: Faction[]
  sceneCache: Record<string, SceneSnapshot>
  day: number
  weather: string
  chronicle: ChronicleEntry[]
  selected: Position | null
  fatigue: number
  combatWins: number
  gameId: string
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'SELECT'; position: Position }
  | { type: 'REST' }
  | { type: 'TALK' }
  | { type: 'RECRUIT' }
  | { type: 'FOUND_CAMP' }
  | { type: 'STATION_FOLLOWER' }
  | { type: 'PLEDGE_FACTION'; factionId: string }
  | { type: 'BREAK_OATH' }
  | { type: 'MAKE_VASSAL'; factionId: string }
  | { type: 'TRAVEL'; direction: Direction }
