import type { GameState, Position, Terrain } from './types'
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

const buildingNames = {
  house: '营地居所',
  watchtower: '营地哨塔',
  market: '营地集市',
} as const

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
    const nearby = Math.abs(agent.x - state.player.x) + Math.abs(agent.y - state.player.y) <= 1
    return {
      ...base,
      category: '人物',
      name: agent.name,
      icon: agent.role === 'villager' ? '⚑' : '♟',
      description: `${faction?.name ?? '无阵营'}的${role}。`,
      stats: [
        { label: '身份', value: role },
        { label: '好感', value: `${agent.affection}/5` },
        { label: '金币', value: agent.gold },
        { label: '野果', value: agent.berries },
      ],
      hint: nearby ? '位于交谈距离内，可点击气泡对话或交易。' : '靠近到周围 1 格后可以交谈。',
      tone: nearby ? 'good' : 'neutral',
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
      const effects = {
        house: '提供 2 人口容量',
        watchtower: '提供 2 防御并扩大控制范围',
        market: '提供 2 点营地经济',
      } as const
      return {
        ...base,
        category: '建筑',
        name: buildingNames[kind],
        icon: kind === 'watchtower' ? '♜' : kind === 'market' ? '¤' : '⌂',
        description: effects[kind],
        stats: [
          { label: '所属', value: camp?.name ?? '未知营地' },
          { label: '类型', value: buildingNames[kind] },
          { label: '坐标', value: `${position.x}, ${position.y}` },
        ],
        tone: 'good',
      }
    }
    if (tile.structure === 'camp' && camp) {
      return {
        ...base,
        category: '建筑',
        name: camp.name,
        icon: '⌂',
        description: '远征队的控制中心；控制范围内可以消耗额度修建建筑。',
        stats: [
          { label: '人口', value: camp.population },
          { label: '防御', value: camp.defense },
          { label: '经济', value: camp.economy },
          { label: '范围', value: camp.controlRadius },
          { label: '建筑', value: camp.buildings.length },
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
    return {
      ...base,
      category: '建筑',
      name: names[structure],
      icon: structure === 'waystone' ? '◇' : structure === 'ruin' ? '▥' : '⌂',
      description: descriptions[structure],
      stats: [
        { label: '地形', value: terrainNames[tile.terrain] },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: structure === 'waystone' ? '使用右侧古道控制前往相邻场景。' : undefined,
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
