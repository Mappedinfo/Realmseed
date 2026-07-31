import type { Camp, CampBuildingKind } from './types'

export interface CampBuildingDefinition {
  kind: CampBuildingKind
  name: string
  glyph: string
  cost: number
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
    summary: '容量 +3 · 士气 +1',
    detail: '干燥床铺与储物角让更多成员能够在营地长期生活。',
    gains: { housing: 3, defense: 0, economy: 0, food: 0, morale: 1, controlRadius: 0 },
  },
  farm: {
    kind: 'farm',
    name: '林缘农圃',
    glyph: '❧',
    cost: 2,
    summary: '食物 +3 · 经济 +1',
    detail: '每日休整按食物盈余产出野果，先满足驻守人口。',
    gains: { housing: 0, defense: 0, economy: 1, food: 3, morale: 0, controlRadius: 0 },
  },
  watchtower: {
    kind: 'watchtower',
    name: '木制瞭望塔',
    glyph: '♜',
    cost: 3,
    summary: '防御 +3 · 范围 +1',
    detail: '扩大常亮控制区，并降低范围内怪物伏击成功率。',
    gains: { housing: 0, defense: 3, economy: 0, food: 0, morale: 0, controlRadius: 1 },
  },
  market: {
    kind: 'market',
    name: '篷布集市',
    glyph: '◇',
    cost: 4,
    summary: '经济 +3 · 士气 +1',
    detail: '吸引商旅停靠；营地经济每 2 点在休整时结算 1 金。',
    gains: { housing: 0, defense: 0, economy: 3, food: 0, morale: 1, controlRadius: 0 },
  },
  workshop: {
    kind: 'workshop',
    name: '修造工坊',
    glyph: '⚒',
    cost: 4,
    summary: '防御 +1 · 经济 +2',
    detail: '修缮路障与工具；在本营控制区战斗时额外造成 1 点伤害。',
    gains: { housing: 0, defense: 1, economy: 2, food: 0, morale: 0, controlRadius: 0 },
  },
  shrine: {
    kind: 'shrine',
    name: '篝火祠',
    glyph: '✦',
    cost: 3,
    summary: '士气 +3 · 休整强化',
    detail: '让体力归零后的营地休整额外恢复，最高受士气影响。',
    gains: { housing: 0, defense: 0, economy: 0, food: 0, morale: 3, controlRadius: 0 },
  },
}

export const campBuildingKinds = Object.keys(campBuildingDefinitions) as CampBuildingKind[]

export function buildingCount(camp: Camp, kind: CampBuildingKind): number {
  return camp.buildings.filter((building) => building.kind === kind).length
}

export function campDailyYield(camp: Camp): { gold: number; berries: number } {
  return {
    gold: Math.floor(camp.economy / 2),
    berries: Math.max(0, camp.food - camp.population),
  }
}

export function campRestRecovery(camp?: Camp): number {
  return camp ? Math.min(6, 3 + Math.floor(camp.morale / 3)) : 3
}
