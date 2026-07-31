import type { Agent, AgentSkillId, GameState } from './types'

export interface AgentSkillDefinition {
  id: AgentSkillId
  name: string
  glyph: string
  title: string
  challenge: string
  description: string
  followerEffect: string
}

export const agentSkills: Record<AgentSkillId, AgentSkillDefinition> = {
  scout: {
    id: 'scout',
    name: '寻路',
    glyph: '⌖',
    title: '雾径斥候',
    challenge: '辨路试炼',
    description: '能从风向、足迹与地貌判断安全路线。',
    followerEffect: '扩大队伍视野',
  },
  forager: {
    id: 'forager',
    name: '采集',
    glyph: '❧',
    title: '荒野采集者',
    challenge: '百草辨识',
    description: '熟悉可食植物与隐藏的林下资源。',
    followerEffect: '采集更多野果',
  },
  guard: {
    id: 'guard',
    name: '守卫',
    glyph: '▣',
    title: '路盾守卫',
    challenge: '持盾试炼',
    description: '善于观察袭击方向并替队伍承受冲击。',
    followerEffect: '提高反击格挡率',
  },
  medic: {
    id: 'medic',
    name: '疗愈',
    glyph: '✚',
    title: '草药医者',
    challenge: '急救问答',
    description: '使用草药、绷带与营火照料疲惫的旅伴。',
    followerEffect: '提高休整恢复',
  },
  trader: {
    id: 'trader',
    name: '议价',
    glyph: '◇',
    title: '行脚商人',
    challenge: '估价交锋',
    description: '能辨认货物成色，也熟悉各地供求。',
    followerEffect: '改善野果交易汇率',
  },
  duelist: {
    id: 'duelist',
    name: '决斗',
    glyph: '⚔',
    title: '游历剑手',
    challenge: '木剑切磋',
    description: '出手直接，擅长抓住怪物露出的破绽。',
    followerEffect: '提高战斗伤害',
  },
}

export const agentSkillIds = Object.keys(agentSkills) as AgentSkillId[]

export interface PartyBonuses {
  vision: number
  forage: number
  guardChance: number
  recovery: number
  tradeRate: number
  combatPower: number
}

export function partySkillTotals(agents: Agent[]): Record<AgentSkillId, number> {
  const totals = Object.fromEntries(agentSkillIds.map((id) => [id, 0])) as Record<AgentSkillId, number>
  agents
    .filter((agent) => agent.role === 'follower')
    .forEach((agent) => {
      totals[agent.skill] += agent.skillLevel
    })
  return totals
}

export function partyBonuses(agents: Agent[]): PartyBonuses {
  const totals = partySkillTotals(agents)
  return {
    vision: Math.min(3, Math.ceil(totals.scout / 2)),
    forage: Math.min(4, Math.ceil(totals.forager / 2)),
    guardChance: Math.min(24, totals.guard * 8),
    recovery: Math.min(3, Math.ceil(totals.medic / 2)),
    tradeRate: Math.min(2, Math.ceil(totals.trader / 2)),
    combatPower: Math.min(4, Math.ceil(totals.duelist / 2)),
  }
}

export function challengeChance(
  state: Pick<GameState, 'player' | 'combatWins' | 'challengeMarks'>,
  agent: Pick<Agent, 'skill' | 'skillLevel'>,
): number {
  const resolve = state.player.maxStamina + state.combatWins * 2 + state.challengeMarks[agent.skill] * 3
  const difficulty = 10 + agent.skillLevel * 5
  return Math.max(25, Math.min(85, 50 + (resolve - difficulty) * 3))
}
