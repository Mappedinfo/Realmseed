export type Terrain = 'meadow' | 'forest' | 'water' | 'mountain' | 'marsh' | 'sand'
export type FogLevel = 0 | 1 | 2
export type MapSize = 'small' | 'large'
export type Structure = 'camp' | 'village' | 'ruin' | 'waystone' | 'camp-building'
export type CampBuildingKind = 'house' | 'farm' | 'watchtower' | 'market' | 'workshop' | 'shrine'
export type AgentSkillId = 'scout' | 'forager' | 'guard' | 'medic' | 'trader' | 'duelist'
export type BattleMode = 'duel' | 'field'
export type AttackRange = 'melee' | 'ranged'
export type DamageKind = 'physical' | 'magic' | 'firearm' | 'explosive'
export type CombatMoveId =
  | 'quick-strike'
  | 'heavy-cleave'
  | 'arrow-shot'
  | 'seed-bolt'
  | 'rifle-shot'
  | 'field-bomb'
export type EquipmentSlot = 'weapon' | 'focus' | 'firearm' | 'explosive' | 'armor'

export interface Tile {
  terrain: Terrain
  coin: number
  food?: number
  structure?: Structure
  road?: boolean
  campId?: string
  buildingKind?: CampBuildingKind
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
  berries: number
  facing?: Direction
  homeCampId?: string
  skill: AgentSkillId
  skillLevel: 1 | 2 | 3
  lastChallengeDay?: number
  challengeWon?: boolean
}

export interface Camp extends Position {
  id: string
  name: string
  sceneX: number
  sceneY: number
  population: number
  housing: number
  defense: number
  economy: number
  food: number
  morale: number
  controlRadius: number
  buildings: { x: number; y: number; kind: CampBuildingKind }[]
}

export interface Monster extends Position {
  id: string
  species: 'slime' | 'boar' | 'wisp'
  hp: number
  facing?: Direction
  alert?: number
}

export interface EquipmentItem {
  id: string
  name: string
  slot: EquipmentSlot
  kind?: DamageKind
  power: number
  defense: number
  equipped: boolean
  description: string
}

export interface BattleEncounter {
  monsterId: string
  mode: BattleMode
  round: number
  monsterMaxHp: number
  lastMoveId?: CombatMoveId
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
  camps: Camp[]
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
  combatPreference: BattleMode
  battle: BattleEncounter | null
  equipment: EquipmentItem[]
  camps: Camp[]
  constructionSteps: number
  buildingCredits: number
  challengeMarks: Record<AgentSkillId, number>
  gameId: string
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'SELECT'; position: Position }
  | { type: 'REST' }
  | { type: 'TALK'; agentId?: string }
  | { type: 'CHALLENGE_AGENT'; agentId: string }
  | { type: 'RECRUIT'; agentId?: string }
  | { type: 'EAT_BERRY' }
  | { type: 'TRADE_BERRIES'; agentId: string; direction: 'buy' | 'sell' }
  | { type: 'SET_COMBAT_PREFERENCE'; mode: BattleMode }
  | { type: 'SET_BATTLE_MODE'; mode: BattleMode }
  | { type: 'COMBAT_ACTION'; moveId: CombatMoveId }
  | { type: 'FLEE_BATTLE' }
  | { type: 'TOGGLE_EQUIPMENT'; itemId: string }
  | { type: 'FOUND_CAMP' }
  | { type: 'STATION_FOLLOWER' }
  | { type: 'BUILD_CAMP_TILE'; kind: CampBuildingKind }
  | { type: 'RETURN_TO_CAMP'; campId: string }
  | { type: 'PLEDGE_FACTION'; factionId: string }
  | { type: 'BREAK_OATH' }
  | { type: 'MAKE_VASSAL'; factionId: string }
  | { type: 'TRAVEL'; direction: Direction }
