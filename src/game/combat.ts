import type { Agent, AgentSkillId, CombatMoveId, DamageKind, EquipmentItem, GameState } from './types'
import { hashString } from './rng'

export interface CombatMove {
  id: CombatMoveId
  name: string
  range: 'melee' | 'ranged'
  kind: DamageKind
  size: 'small' | 'large'
  power: number
  staminaCost: number
  minRange: number
  maxRange: number
  accuracy: number
  criticalChance: number
  target: 'single' | 'area'
  blastRadius: number
  splashRatio: number
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
    minRange: 1, maxRange: 1, accuracy: 96, criticalChance: 18,
    target: 'single', blastRadius: 0, splashRatio: 0,
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
    minRange: 1, maxRange: 1, accuracy: 78, criticalChance: 28,
    target: 'single', blastRadius: 0, splashRatio: 0,
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
    minRange: 1, maxRange: 5, accuracy: 88, criticalChance: 16,
    target: 'single', blastRadius: 0, splashRatio: 0,
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
    minRange: 1, maxRange: 4, accuracy: 92, criticalChance: 12,
    target: 'single', blastRadius: 0, splashRatio: 0,
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
    minRange: 1, maxRange: 6, accuracy: 82, criticalChance: 30,
    target: 'single', blastRadius: 0, splashRatio: 0,
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
    minRange: 1, maxRange: 4, accuracy: 76, criticalChance: 0,
    target: 'area', blastRadius: 1, splashRatio: 0.5,
    glyph: '✹',
    description: '远程爆炸大招，威力最高且消耗更多体力。',
  },
]

export interface CombatRoll {
  hit: boolean
  critical: boolean
  multiplier: number
}

export function resolveCombatRoll(
  gameId: string,
  targetId: string,
  round: number,
  move: CombatMove,
): CombatRoll {
  const hit = hashString(`${gameId}:attack-hit:${targetId}:${round}:${move.id}`) % 100 < move.accuracy
  const critical = hit && move.criticalChance > 0 &&
    hashString(`${gameId}:attack-critical:${targetId}:${round}:${move.id}`) % 100 < move.criticalChance
  return { hit, critical, multiplier: critical ? 1.5 : hit ? 1 : 0 }
}

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

export const relicEquipment: EquipmentItem[] = [
  {
    id: 'relic-thornblade',
    name: '遗迹棘刃',
    slot: 'weapon',
    kind: 'physical',
    power: 2,
    defense: 0,
    equipped: false,
    description: '物理威力 +2',
  },
  {
    id: 'relic-prism',
    name: '雾光棱镜',
    slot: 'focus',
    kind: 'magic',
    power: 2,
    defense: 0,
    equipped: false,
    description: '魔法威力 +2',
  },
  {
    id: 'relic-carbine',
    name: '巡林卡宾',
    slot: 'firearm',
    kind: 'firearm',
    power: 3,
    defense: 0,
    equipped: false,
    description: '枪械威力 +3',
  },
  {
    id: 'relic-satchel',
    name: '晶尘爆弹包',
    slot: 'explosive',
    kind: 'explosive',
    power: 3,
    defense: 0,
    equipped: false,
    description: '爆炸威力 +3',
  },
  {
    id: 'relic-mantle',
    name: '守望者披肩',
    slot: 'armor',
    power: 0,
    defense: 2,
    equipped: false,
    description: '格挡率 +40%',
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

const npcSkillMoves: Record<AgentSkillId, [CombatMoveId, CombatMoveId]> = {
  scout: ['arrow-shot', 'rifle-shot'],
  forager: ['arrow-shot', 'quick-strike'],
  guard: ['quick-strike', 'heavy-cleave'],
  medic: ['seed-bolt', 'seed-bolt'],
  trader: ['rifle-shot', 'seed-bolt'],
  duelist: ['quick-strike', 'heavy-cleave'],
}

const npcWeaponNames: Record<CombatMoveId, string> = {
  'quick-strike': '巡路短刃',
  'heavy-cleave': '边境重斧',
  'arrow-shot': '榛木猎弓',
  'seed-bolt': '苔纹法器',
  'rifle-shot': '旧式长铳',
  'field-bomb': '晶尘爆弹',
}

const npcWeaponSlots: Record<CombatMoveId, EquipmentItem['slot']> = {
  'quick-strike': 'weapon',
  'heavy-cleave': 'weapon',
  'arrow-shot': 'weapon',
  'seed-bolt': 'focus',
  'rifle-shot': 'firearm',
  'field-bomb': 'explosive',
}

export function createNpcLoadout(agentId: string, skill: AgentSkillId, skillLevel: 1 | 2 | 3): EquipmentItem[] {
  const choices = npcSkillMoves[skill]
  const moveId = skillLevel === 1
    ? choices[0]
    : skillLevel === 3
      ? choices[1]
      : choices[hashString(`${agentId}:npc-weapon-choice`) % choices.length]
  const move = combatMove(moveId)
  const tierName = skillLevel === 1 ? '旧制' : skillLevel === 2 ? '精工' : '遗迹'
  const weapon: EquipmentItem = {
    id: `npc-gear-${agentId}-${moveId}`,
    name: `${tierName}${npcWeaponNames[moveId]}`,
    slot: npcWeaponSlots[moveId],
    kind: move.kind,
    power: skillLevel,
    defense: 0,
    equipped: true,
    moveId,
    description: `${move.name} · 射程 ${move.minRange}–${move.maxRange} · 威力 +${skillLevel}`,
  }
  const armorChance = 35 + skillLevel * 20
  if (hashString(`${agentId}:npc-armor`) % 100 >= armorChance) return [weapon]
  const defense = skillLevel === 3 ? 2 : 1
  return [
    weapon,
    {
      id: `npc-gear-${agentId}-armor`,
      name: skillLevel === 3 ? '守望者鳞肩' : skillLevel === 2 ? '加固旅衣' : '旧皮护衣',
      slot: 'armor',
      power: 0,
      defense,
      equipped: true,
      description: `受到的伤害 -${defense}`,
    },
  ]
}

export function npcAttackEquipment(agent: Agent): EquipmentItem {
  return agent.loadout.find((item) => item.equipped && item.moveId) ?? createNpcLoadout(agent.id, agent.skill, agent.skillLevel)[0]
}

export function npcAttackMove(agent: Agent): CombatMove {
  return combatMove(npcAttackEquipment(agent).moveId ?? 'quick-strike')
}

export function npcArmorDefense(agent: Agent): number {
  return equipmentDefense(agent.loadout)
}

export function mitigateNpcDamage(agent: Agent, damage: number): number {
  return damage <= 0 ? 0 : Math.max(1, damage - npcArmorDefense(agent))
}
