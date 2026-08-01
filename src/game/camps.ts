import type { Camp, CampBuildingKind, CampOffice, GameState } from './types'

export interface CampBuildingDefinition {
  kind: CampBuildingKind
  name: string
  glyph: string
  cost: number
  materials: { wood: number; stone: number; gold: number }
  summary: string
  detail: string
  gains: Pick<Camp, 'housing' | 'defense' | 'economy' | 'food' | 'morale' | 'controlRadius'>
}

export const campBuildingDefinitions: Record<CampBuildingKind, CampBuildingDefinition> = {
  house: {
    kind: 'house',
    name: '旅人居所',
    glyph: '⌂',
    cost: 1,
    materials: { wood: 4, stone: 1, gold: 0 },
    summary: '容量 +3 · 士气 +1',
    detail: '干燥床铺与储物角让更多成员能够在营地长期生活。',
    gains: { housing: 3, defense: 0, economy: 0, food: 0, morale: 1, controlRadius: 0 },
  },
  farm: {
    kind: 'farm',
    name: '林缘农圃',
    glyph: '❧',
    cost: 2,
    materials: { wood: 3, stone: 2, gold: 0 },
    summary: '食物 +3 · 经济 +1',
    detail: '每日休整按食物盈余产出野果，先满足驻守人口。',
    gains: { housing: 0, defense: 0, economy: 1, food: 3, morale: 0, controlRadius: 0 },
  },
  watchtower: {
    kind: 'watchtower',
    name: '木制瞭望塔',
    glyph: '♜',
    cost: 3,
    materials: { wood: 6, stone: 4, gold: 0 },
    summary: '防御 +3 · 范围 +1',
    detail: '扩大常亮控制区，并降低范围内怪物伏击成功率。',
    gains: { housing: 0, defense: 3, economy: 0, food: 0, morale: 0, controlRadius: 1 },
  },
  market: {
    kind: 'market',
    name: '篷布集市',
    glyph: '◇',
    cost: 4,
    materials: { wood: 4, stone: 2, gold: 2 },
    summary: '经济 +3 · 士气 +1',
    detail: '吸引商旅停靠；营地经济每 2 点在休整时结算 1 金。',
    gains: { housing: 0, defense: 0, economy: 3, food: 0, morale: 1, controlRadius: 0 },
  },
  workshop: {
    kind: 'workshop',
    name: '修造工坊',
    glyph: '⚒',
    cost: 4,
    materials: { wood: 4, stone: 6, gold: 2 },
    summary: '防御 +1 · 经济 +2',
    detail: '修缮路障与工具；在本营控制区战斗时额外造成 1 点伤害。',
    gains: { housing: 0, defense: 1, economy: 2, food: 0, morale: 0, controlRadius: 0 },
  },
  shrine: {
    kind: 'shrine',
    name: '篝火祠',
    glyph: '✦',
    cost: 3,
    materials: { wood: 3, stone: 4, gold: 1 },
    summary: '士气 +3 · 休整强化',
    detail: '让体力归零后的营地休整额外恢复，最高受士气影响。',
    gains: { housing: 0, defense: 0, economy: 0, food: 0, morale: 3, controlRadius: 0 },
  },
}

export const campBuildingKinds = Object.keys(campBuildingDefinitions) as CampBuildingKind[]

export function buildingCount(camp: Camp, kind: CampBuildingKind): number {
  return camp.buildings.filter((building) => building.kind === kind).length
}

export const campOfficeDefinitions: Record<CampOffice, {
  name: string
  glyph: string
  detail: string
  preferredSkills: GameState['player']['skill'][]
  unlocked: (camp: Camp) => boolean
}> = {
  mayor: {
    name: '村长', glyph: '♛', detail: '统筹士气；侦察、医疗和交易专长具有额外协同。',
    preferredSkills: ['scout', 'medic', 'trader'],
    unlocked: () => true,
  },
  'guard-captain': {
    name: '守备长', glyph: '♜', detail: '提高防御；守卫与决斗专长效果翻倍。',
    preferredSkills: ['guard', 'duelist'],
    unlocked: (camp) => buildingCount(camp, 'watchtower') > 0,
  },
  'production-steward': {
    name: '生产主管', glyph: '⚒', detail: '提高食物；采集专长效果翻倍，医疗专长改善家庭照护。',
    preferredSkills: ['forager', 'medic'],
    unlocked: (camp) => buildingCount(camp, 'farm') > 0 || buildingCount(camp, 'workshop') > 0,
  },
  'trade-steward': {
    name: '商贸主管', glyph: '◇', detail: '提高经济；交易专长效果翻倍，侦察专长吸引更多移民。',
    preferredSkills: ['trader', 'scout'],
    unlocked: (camp) => buildingCount(camp, 'market') > 0,
  },
}

export const campOfficeKinds = Object.keys(campOfficeDefinitions) as CampOffice[]

export function campOfficials(state: Pick<GameState, 'camps'>, campId: string) {
  const camp = state.camps.find((item) => item.id === campId)
  return camp ? Object.values(camp.offices) : []
}

export function campPopulation(state: Pick<GameState, 'camps' | 'residents'>, campId: string): number {
  return state.residents.filter((resident) => resident.campId === campId).length + campOfficials(state, campId).length
}

export function campFoodDemand(state: Pick<GameState, 'camps' | 'residents'>, campId: string): number {
  const residents = state.residents.filter((resident) => resident.campId === campId)
  const adults = residents.filter((resident) => resident.stage === 'adult').length
  const children = residents.length - adults
  return Math.ceil(adults + children * 0.5 + campOfficials(state, campId).length)
}

export interface EffectiveCampStats {
  housing: number
  defense: number
  economy: number
  food: number
  morale: number
  controlRadius: number
  workforce: number
}

export function effectiveCampStats(
  state: Pick<GameState, 'camps' | 'residents'>,
  camp: Camp,
): EffectiveCampStats {
  const adultResidents = state.residents.filter(
    (resident) => resident.campId === camp.id && resident.stage === 'adult',
  ).length
  const workforce = Math.floor(adultResidents / 3)
  const stats: EffectiveCampStats = {
    housing: camp.housing,
    defense: camp.defense,
    economy: camp.economy + workforce,
    food: camp.food,
    morale: camp.morale,
    controlRadius: camp.controlRadius,
    workforce,
  }
  for (const [office, agent] of Object.entries(camp.offices) as [CampOffice, GameState['player']][]) {
    if (office === 'mayor') {
      stats.morale += agent.skillLevel
      if (agent.skill === 'scout') stats.controlRadius += 1
      if (agent.skill === 'medic') stats.morale += 1
      if (agent.skill === 'trader') stats.economy += 1
    }
    if (office === 'guard-captain') {
      stats.defense += agent.skillLevel * (agent.skill === 'guard' || agent.skill === 'duelist' ? 2 : 1)
    }
    if (office === 'production-steward') {
      stats.food += agent.skillLevel * (agent.skill === 'forager' ? 2 : 1)
    }
    if (office === 'trade-steward') {
      stats.economy += agent.skillLevel * (agent.skill === 'trader' ? 2 : 1)
    }
  }
  return stats
}

export function campDailyYield(
  state: Pick<GameState, 'camps' | 'residents'>,
  camp: Camp,
): { gold: number; berries: number } {
  const stats = effectiveCampStats(state, camp)
  return {
    gold: Math.floor(stats.economy / 2),
    berries: Math.max(0, stats.food - campFoodDemand(state, camp.id)),
  }
}

export function campRestRecovery(
  state: Pick<GameState, 'camps' | 'residents'>,
  camp?: Camp,
): number {
  return camp ? Math.min(6, 3 + Math.floor(effectiveCampStats(state, camp).morale / 3)) : 3
}
