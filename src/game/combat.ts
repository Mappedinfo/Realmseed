import type { CombatMoveId, DamageKind, EquipmentItem, GameState } from './types'

export interface CombatMove {
  id: CombatMoveId
  name: string
  range: 'melee' | 'ranged'
  kind: DamageKind
  size: 'small' | 'large'
  power: number
  staminaCost: number
  glyph: string
  description: string
}

export const combatMoves: CombatMove[] = [
  {
    id: 'quick-strike',
    name: '短刃快击',
    range: 'melee',
    kind: 'physical',
    size: 'small',
    power: 2,
    staminaCost: 0,
    glyph: '╱',
    description: '近程物理小招，稳定且不额外消耗体力。',
  },
  {
    id: 'heavy-cleave',
    name: '沉重劈砍',
    range: 'melee',
    kind: 'physical',
    size: 'large',
    power: 4,
    staminaCost: 1,
    glyph: '✦',
    description: '近程物理大招，破坏力强。',
  },
  {
    id: 'arrow-shot',
    name: '猎弓穿叶',
    range: 'ranged',
    kind: 'physical',
    size: 'small',
    power: 3,
    staminaCost: 0,
    glyph: '➶',
    description: '远程物理小招，适合稳妥输出。',
  },
  {
    id: 'seed-bolt',
    name: '青种术弹',
    range: 'ranged',
    kind: 'magic',
    size: 'small',
    power: 3,
    staminaCost: 1,
    glyph: '◆',
    description: '远程魔法攻击，受到法器增幅。',
  },
  {
    id: 'rifle-shot',
    name: '游侠枪击',
    range: 'ranged',
    kind: 'firearm',
    size: 'large',
    power: 4,
    staminaCost: 1,
    glyph: '⌁',
    description: '远程枪械大招，单点威力高。',
  },
  {
    id: 'field-bomb',
    name: '野战炸弹',
    range: 'ranged',
    kind: 'explosive',
    size: 'large',
    power: 5,
    staminaCost: 2,
    glyph: '✹',
    description: '远程爆炸大招，威力最高且消耗更多体力。',
  },
]

export const starterEquipment: EquipmentItem[] = [
  {
    id: 'field-knife',
    name: '修补短刃',
    slot: 'weapon',
    kind: 'physical',
    power: 1,
    defense: 0,
    equipped: true,
    description: '物理威力 +1',
  },
  {
    id: 'grove-focus',
    name: '青种法器',
    slot: 'focus',
    kind: 'magic',
    power: 1,
    defense: 0,
    equipped: true,
    description: '魔法威力 +1',
  },
  {
    id: 'frontier-pistol',
    name: '旧式短铳',
    slot: 'firearm',
    kind: 'firearm',
    power: 2,
    defense: 0,
    equipped: true,
    description: '枪械威力 +2',
  },
  {
    id: 'bomb-satchel',
    name: '爆弹挎包',
    slot: 'explosive',
    kind: 'explosive',
    power: 2,
    defense: 0,
    equipped: true,
    description: '爆炸威力 +2',
  },
  {
    id: 'stitched-coat',
    name: '缝补旅衣',
    slot: 'armor',
    power: 0,
    defense: 1,
    equipped: true,
    description: '格挡率 +20%',
  },
]

export function equipmentPower(equipment: EquipmentItem[], kind: DamageKind): number {
  return equipment
    .filter((item) => item.equipped && item.kind === kind)
    .reduce((total, item) => total + item.power, 0)
}

export function equipmentDefense(equipment: EquipmentItem[]): number {
  return equipment
    .filter((item) => item.equipped)
    .reduce((total, item) => total + item.defense, 0)
}

export function combatMove(moveId: CombatMoveId): CombatMove {
  return combatMoves.find((move) => move.id === moveId) ?? combatMoves[0]
}

export function combatPowerSummary(state: Pick<GameState, 'equipment'>): Record<DamageKind, number> {
  return {
    physical: equipmentPower(state.equipment, 'physical'),
    magic: equipmentPower(state.equipment, 'magic'),
    firearm: equipmentPower(state.equipment, 'firearm'),
    explosive: equipmentPower(state.equipment, 'explosive'),
  }
}
