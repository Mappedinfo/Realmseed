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
export type FacilityEventKind = 'monster' | 'coins' | 'food' | 'restoration' | 'equipment' | 'companion'
export type ResidentSex = 'female' | 'male'
export type ResidentStage = 'child' | 'adult'
export type ResidentOrigin = 'founder' | 'migrant' | 'familiar' | 'born'
export type CampOffice = 'mayor' | 'guard-captain' | 'production-steward' | 'trade-steward'

export interface Tile {
  terrain: Terrain
  coin: number
  food?: number
  structure?: Structure
  road?: boolean
  campId?: string
  buildingKind?: CampBuildingKind
  eventResolved?: boolean
  lastUsedDay?: number
  structureHp?: number
  structureMaxHp?: number
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
  autoAggro: boolean
}

export interface Agent extends Position {
  id: string
  name: string
  factionId: string
  role: 'player' | 'wanderer' | 'follower' | 'villager'
  affection: number
  stamina: number
  maxStamina: number
  hp: number
  maxHp: number
  gold: number
  berries: number
  facing?: Direction
  homeCampId?: string
  skill: AgentSkillId
  skillLevel: 1 | 2 | 3
  lastChallengeDay?: number
  challengeWon?: boolean
  hostility?: number
  fear?: number
  autoAggro?: boolean
}

export interface Resident {
  id: string
  name: string
  sex: ResidentSex
  stage: ResidentStage
  birthDay: number
  settledDay: number
  origin: ResidentOrigin
  campId: string
  spouseId?: string
  parentIds: string[]
  aptitude: AgentSkillId
  lastBirthDay?: number
}

export interface Camp extends Position {
  id: string
  name: string
  sceneX: number
  sceneY: number
  housing: number
  defense: number
  economy: number
  food: number
  morale: number
  controlRadius: number
  buildings: { x: number; y: number; kind: CampBuildingKind }[]
  offices: Partial<Record<CampOffice, Agent>>
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
  targetId: string
  targetKind: 'monster' | 'agent'
  mode: BattleMode
  round: number
  targetMaxHp: number
  lastMoveId?: CombatMoveId
  lastDamage?: number
  lastHit?: boolean
  lastCritical?: boolean
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

export interface FacilityEventNotice {
  id: number
  kind: FacilityEventKind
  title: string
  description: string
}

export interface SettlementEvent {
  id: number
  campId: string
  day: number
  kind: 'marriage' | 'birth' | 'adulthood' | 'migration' | 'office'
  residentIds: string[]
  text: string
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
  redNameMode: boolean
  attackSequence: number
  lastMapAttack?: {
    sequence: number
    targetName: string
    moveId: CombatMoveId
    hit: boolean
    critical: boolean
    damage: number
  }
  battle: BattleEncounter | null
  equipment: EquipmentItem[]
  camps: Camp[]
  residents: Resident[]
  constructionSteps: number
  buildingCredits: number
  challengeMarks: Record<AgentSkillId, number>
  facilityEvent: FacilityEventNotice | null
  settlementEvents: SettlementEvent[]
  turn: number
  dayProgress: number
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
  | { type: 'SET_RED_NAME_MODE'; enabled: boolean }
  | { type: 'RED_NAME_ATTACK'; position: Position; moveId: CombatMoveId }
  | { type: 'REPAIR_FACTION_AGGRO'; factionId: string; agentId: string }
  | { type: 'SET_BATTLE_MODE'; mode: BattleMode }
  | { type: 'COMBAT_ACTION'; moveId: CombatMoveId }
  | { type: 'FLEE_BATTLE' }
  | { type: 'TOGGLE_EQUIPMENT'; itemId: string }
  | { type: 'FOUND_CAMP' }
  | { type: 'ASSIGN_CAMP_OFFICE'; campId: string; agentId: string; office: CampOffice }
  | { type: 'RECALL_CAMP_OFFICIAL'; campId: string; office: CampOffice }
  | { type: 'BUILD_CAMP_TILE'; kind: CampBuildingKind }
  | { type: 'RETURN_TO_CAMP'; campId: string }
  | { type: 'PLEDGE_FACTION'; factionId: string }
  | { type: 'BREAK_OATH' }
  | { type: 'MAKE_VASSAL'; factionId: string }
  | { type: 'DISMISS_FACILITY_EVENT' }
  | { type: 'TRAVEL'; direction: Direction }
