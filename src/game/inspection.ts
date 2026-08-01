import type { GameState, Position, Terrain } from './types'
import { campBuildingDefinitions, campDailyYield, campPopulation, effectiveCampStats } from './camps'
import { isWithinInteractionRange } from './geometry'
import { agentSkills } from './skills'
import { tileIndex } from './world'

export interface InspectionDetail {
  category: '人物' | '怪物' | '建筑' | '物品' | '道路' | '地形' | '未知'
  name: string
  icon: string
  description: string
  position: Position
  stats: { label: string; value: string | number }[]
  hint?: string
  tone: 'neutral' | 'good' | 'danger'
}

const terrainNames: Record<Terrain, string> = {
  meadow: '草甸',
  forest: '森林',
  water: '深水',
  mountain: '山地',
  marsh: '湿地',
  sand: '沙地',
}

const monsterNames = {
  slime: '苔泥团',
  boar: '棘背兽',
  wisp: '迷雾精',
} as const

export function inspectPosition(state: GameState, position: Position): InspectionDetail {
  const index = tileIndex(state.world, position.x, position.y)
  const fog = state.fog[index]
  const base = { position, tone: 'neutral' as const }
  if (fog === 0) {
    return {
      ...base,
      category: '未知',
      name: '未探索区域',
      icon: '?',
      description: '迷雾遮住了这里的一切。靠近后才能辨认地形与目标。',
      stats: [{ label: '坐标', value: `${position.x}, ${position.y}` }],
      hint: '移动或派遣视野来源来揭开迷雾。',
    }
  }

  const tile = state.world.tiles[index]
  const playerSharesMapElement =
    Boolean(tile.structure || tile.road || tile.coin > 0 || (tile.food ?? 0) > 0)
  if (state.player.x === position.x && state.player.y === position.y && !playerSharesMapElement) {
    return {
      ...base,
      category: '人物',
      name: state.player.name,
      icon: '◆',
      description: '当前由你控制的远征队长。',
      stats: [
        { label: '身份', value: '队长' },
        { label: '体力', value: `${state.player.stamina}/${state.player.maxStamina}` },
        { label: '金币', value: state.player.gold },
        { label: '野果', value: state.player.berries },
      ],
      tone: 'good',
    }
  }

  const agent = state.agents.find(
    (item) => item.role !== 'follower' && item.x === position.x && item.y === position.y,
  )
  if (agent) {
    const faction = state.factions.find((item) => item.id === agent.factionId)
    const role = agent.role === 'villager' ? '驻守村民' : '旅行者'
    const nearby = isWithinInteractionRange(agent, state.player)
    const skill = agentSkills[agent.skill]
    return {
      ...base,
      category: '人物',
      name: agent.name,
      icon: agent.role === 'villager' ? '⚑' : '♟',
      description: `${faction?.name ?? '无阵营'}的${role}，专长是${skill.name}。`,
      stats: [
        { label: '身份', value: role },
        { label: '好感', value: `${agent.affection}/5` },
        { label: '金币', value: agent.gold },
        { label: '野果', value: agent.berries },
        { label: '专长', value: `${skill.title} Lv.${agent.skillLevel}` },
        { label: '挑战', value: agent.challengeWon ? '已通过' : '未通过' },
        { label: '态度', value: (agent.hostility ?? 0) > 0 ? `敌意 ${agent.hostility}/5` : '中立' },
        { label: '反应', value: (agent.fear ?? 0) > 0 ? '警觉逃离' : '正常' },
      ],
      hint: (agent.hostility ?? 0) > 0
        ? '对方目击过红名攻击；交涉带有敌意，精英可能直接发起对战。'
        : nearby ? '位于交谈距离内，可点击气泡对话或交易。' : '靠近到周围 1 格后可以交谈。',
      tone: (agent.hostility ?? 0) > 0 ? 'danger' : nearby ? 'good' : 'neutral',
    }
  }

  const monster = state.monsters.find((item) => item.x === position.x && item.y === position.y)
  if (monster) {
    return {
      ...base,
      category: '怪物',
      name: monsterNames[monster.species],
      icon: '!',
      description: '会概率发现队伍并缓慢追击的野生怪物。',
      stats: [
        { label: '生命', value: monster.hp },
        { label: '警戒', value: (monster.alert ?? 0) > 0 ? '已发现队伍' : '未警戒' },
        { label: '朝向', value: monster.facing ?? 'down' },
      ],
      hint: '进入相邻格可能触发战斗。',
      tone: 'danger',
    }
  }

  if (tile.structure) {
    const camp = tile.campId ? state.camps.find((item) => item.id === tile.campId) : undefined
    if (tile.structure === 'camp-building') {
      const kind = tile.buildingKind ?? 'house'
      const definition = campBuildingDefinitions[kind]
      return {
        ...base,
        category: '建筑',
        name: definition.name,
        icon: definition.glyph,
        description: definition.detail,
        stats: [
          { label: '所属', value: camp?.name ?? '未知营地' },
          { label: '效果', value: definition.summary },
          { label: '成本', value: `${definition.cost} 金 / 1 格` },
          { label: '坐标', value: `${position.x}, ${position.y}` },
          { label: '耐久', value: `${tile.structureHp ?? tile.structureMaxHp ?? 14}/${tile.structureMaxHp ?? 14}` },
        ],
        hint:
          kind === 'farm' ? '每 20 个行动日首次踏入可收获 1 枚野果。'
            : kind === 'house' ? '每 20 个行动日首次踏入可短歇并恢复 1 点体力。'
              : kind === 'shrine' ? '每 20 个行动日首次踏入可回满体力并清空疲劳。'
                : definition.detail,
        tone: 'good',
      }
    }
    if (tile.structure === 'camp' && camp) {
      const daily = campDailyYield(state, camp)
      const stats = effectiveCampStats(state, camp)
      return {
        ...base,
        category: '建筑',
        name: camp.name,
        icon: '⌂',
        description: '远征队的控制中心；控制范围内可以消耗额度修建建筑。',
        stats: [
          { label: '人口', value: `${campPopulation(state, camp.id)}/${camp.housing}` },
          { label: '食物', value: stats.food },
          { label: '防御', value: stats.defense },
          { label: '经济', value: stats.economy },
          { label: '士气', value: stats.morale },
          { label: '范围', value: stats.controlRadius },
          { label: '建筑', value: camp.buildings.length },
          { label: '日产', value: `${daily.gold} 金 / ${daily.berries} 果` },
        ],
        hint: '可在下方营地列表查看并自动寻路返回。',
        tone: 'good',
      }
    }
    const names = { camp: '未登记营地', village: '村庄', ruin: '古代遗迹', waystone: '古道界碑' } as const
    const descriptions = {
      camp: '尚未登记属性的营地。',
      village: '有人驻守的常亮聚落。',
      ruin: '可能藏有旧时代线索的残垣。',
      waystone: '连接相邻大场景的古代交通设施。',
    } as const
    const structure = tile.structure as keyof typeof names
    const ruinResolved = structure === 'ruin' && Boolean(tile.eventResolved)
    return {
      ...base,
      category: '建筑',
      name: ruinResolved ? '已搜寻的古代遗迹' : names[structure],
      icon: structure === 'waystone' ? '◇' : structure === 'ruin' ? '▥' : '⌂',
      description: descriptions[structure],
      stats: [
        { label: '地形', value: terrainNames[tile.terrain] },
        ...(structure === 'ruin'
          ? [{ label: '探索状态', value: ruinResolved ? '事件已结算' : '尚未踏入' }]
          : []),
        { label: '坐标', value: `${position.x}, ${position.y}` },
        { label: '耐久', value: `${tile.structureHp ?? tile.structureMaxHp ?? (structure === 'village' ? 18 : structure === 'waystone' ? 20 : 12)}/${tile.structureMaxHp ?? (structure === 'village' ? 18 : structure === 'waystone' ? 20 : 12)}` },
      ],
      hint:
        structure === 'waystone' ? '使用右侧古道控制前往相邻场景。'
          : structure === 'ruin'
            ? ruinResolved
              ? '这处遗迹已经搜寻完毕，不会重复产出。'
              : '踏入后只结算一次：可能出现怪物、金币、食物、回满体力、新装备或新队友。'
            : undefined,
      tone: structure === 'ruin' ? 'neutral' : 'good',
    }
  }

  if (tile.coin > 0) {
    return {
      ...base,
      category: '物品',
      name: '旧金币',
      icon: '●',
      description: '散落在道路或遗迹附近的可拾取货币。',
      stats: [
        { label: '数量', value: tile.coin },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: '移动到该格即可自动拾取。',
      tone: 'good',
    }
  }

  if ((tile.food ?? 0) > 0) {
    return {
      ...base,
      category: '物品',
      name: '野果丛',
      icon: '●',
      description: '受地形与区域影响的野生食物资源。',
      stats: [
        { label: '野果', value: tile.food ?? 0 },
        { label: '用途', value: '恢复体力 / 交易' },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: '移动到该格后会自动放入物品栏。',
      tone: 'good',
    }
  }

  if (tile.road) {
    return {
      ...base,
      category: '道路',
      name: '营地道路',
      icon: '═',
      description: '营地之间自动铺设的低消耗通行路线。',
      stats: [
        { label: '移动疲劳', value: '0.35/格' },
        { label: '普通地形', value: '1/格' },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: '自动寻路会优先利用可通行的最短路线。',
      tone: 'good',
    }
  }

  return {
    ...base,
    category: '地形',
    name: terrainNames[tile.terrain],
    icon: '◇',
    description: fog === 1 ? '这里曾被探索，但当前不在队伍视野内。' : '当前视野内的基础地表。',
    stats: [
      { label: '状态', value: fog === 2 ? '当前可见' : '已探索' },
      { label: '通行', value: tile.terrain === 'water' || tile.terrain === 'mountain' ? '不可通行' : '可通行' },
      { label: '坐标', value: `${position.x}, ${position.y}` },
    ],
    tone: 'neutral',
  }
}
