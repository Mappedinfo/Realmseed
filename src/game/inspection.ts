import type { GameState, Position, Terrain } from './types'
import { campBuildingDefinitions, campDailyYield, campPopulation, effectiveCampStats } from './camps'
import { isWithinInteractionRange } from './geometry'
import { agentSkills } from './skills'
import { isInside, tileIndex } from './world'
import { FISHING_SPOT_CAPACITY, fishingFatigue, fishingInfluenceAt, fishingSignalNames, fishingSpotKey, fishingSpotProgress } from './fishing'

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
  if (!isInside(state.world, position.x, position.y)) {
    return {
      position: state.player,
      category: '未知',
      name: '已离开的区域',
      icon: '?',
      description: '当前查看目标属于刚才的场景，已在场景切换时失效。',
      stats: [],
      hint: '请在当前地图中重新选择目标。',
      tone: 'neutral',
    }
  }
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
    Boolean(tile.structure || tile.resourceNode || tile.road || tile.coin > 0 || (tile.food ?? 0) > 0)
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
    const pursuit = Boolean(agent.autoAggro || faction?.autoAggro)
    const weapon = agent.loadout.find((item) => item.equipped && item.moveId)
    const armor = agent.loadout.find((item) => item.equipped && item.slot === 'armor')
    return {
      ...base,
      category: '人物',
      name: agent.name,
      icon: agent.role === 'villager' ? '⚑' : '♟',
      description: `${faction?.name ?? '无阵营'}的${role}，专长是${skill.name}。`,
      stats: [
        { label: '身份', value: role },
        { label: '生命', value: `${agent.hp}/${agent.maxHp}` },
        { label: '武器', value: weapon?.name ?? '徒手' },
        { label: '护甲', value: armor ? `${armor.name} · 防 ${armor.defense}` : '无' },
        { label: '好感', value: `${agent.affection}/5` },
        { label: '金币', value: agent.gold },
        { label: '野果', value: agent.berries },
        { label: '专长', value: `${skill.title} Lv.${agent.skillLevel}` },
        { label: '挑战', value: agent.challengeWon ? '已通过' : '未通过' },
        { label: '态度', value: pursuit ? '阵营追缉' : (agent.hostility ?? 0) > 0 ? `敌意 ${agent.hostility}/5` : '中立' },
        { label: '反应', value: pursuit ? '追击并主动开战' : (agent.fear ?? 0) > 0 ? '警觉逃离' : '正常' },
      ],
      hint: pursuit
        ? '该阵营会跨场景持续追缉；靠近成员将自动开战。只能在周围 1 格内支付 100 金完成赎偿交易。'
        : (agent.hostility ?? 0) > 0
        ? '对方目击过红名攻击；交涉带有敌意，精英可能直接发起对战。'
        : nearby ? '位于交谈距离内，可点击气泡对话或交易。' : '靠近到周围 1 格后可以交谈。',
      tone: pursuit || (agent.hostility ?? 0) > 0 ? 'danger' : nearby ? 'good' : 'neutral',
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
        { label: '生命', value: `${monster.hp}/${monster.maxHp ?? monster.hp}` },
        { label: '等级', value: monster.rank === 'boss' ? `Boss · 阶段 ${monster.phase ?? 1}` : monster.rank === 'elite' ? '守层精英' : '普通' },
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
    const names = { camp: '未登记营地', village: '村庄', ruin: '古代遗迹', waystone: '古道界碑', cave: '深岩洞穴', nest: '腐根巢穴', 'stairs-down': '下层阶梯', 'stairs-up': '上层阶梯', chest: tile.chestOpened ? '已开启宝箱' : '地下宝箱', 'dungeon-exit': '返程出口' } as const
    const descriptions = {
      camp: '尚未登记属性的营地。',
      village: '有人驻守的常亮聚落。',
      ruin: '可能藏有旧时代线索的残垣。',
      waystone: '连接相邻大场景的古代交通设施。',
      cave: '山地边缘的可重复三层副本，深处盘踞着 Boss。',
      nest: '森林与湿地中的可重复三层巢穴，藏有材料与遗迹装备。',
      'stairs-down': '通向更危险楼层的阶梯；守层精英会封锁它。',
      'stairs-up': '返回已经探索的上一层。',
      chest: '只在主动开启后结算的地下战利品。',
      'dungeon-exit': '返回地表入口并保留已经取得的奖励。',
    } as const
    const structure = tile.structure as keyof typeof names
    const ruinResolved = structure === 'ruin' && Boolean(tile.eventResolved)
    return {
      ...base,
      category: '建筑',
      name: ruinResolved ? '已搜寻的古代遗迹' : names[structure],
      icon: structure === 'waystone' ? '◇' : structure === 'ruin' ? '▥' : structure === 'cave' || structure === 'nest' ? '▼' : structure === 'chest' ? '▣' : structure.includes('stairs') ? '↕' : structure === 'dungeon-exit' ? '↥' : '⌂',
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
            : structure === 'cave' || structure === 'nest' ? '站在入口相邻一格，使用下方行动栏进入。'
              : structure === 'chest' ? tile.chestOpened ? '宝箱已经开启。' : '站在相邻一格主动开启。'
                : structure === 'dungeon-exit' ? '使用下方“携宝返程”或“撤退”。'
                  : structure.includes('stairs') ? '站在相邻一格使用阶梯。' : undefined,
      tone: structure === 'ruin' ? 'neutral' : 'good',
    }
  }

  if (tile.resourceNode) {
    const ready = tile.resourceReadyDay === undefined || tile.resourceReadyDay <= state.day
    return {
      ...base,
      category: '物品',
      name: tile.resourceNode === 'wood' ? '林木资源点' : '山缘石料点',
      icon: tile.resourceNode === 'wood' ? '▥' : '◆',
      description: tile.resourceNode === 'wood' ? '可再生木材，用于营地与建筑施工。' : '可再生石材，用于地基、防御与工坊。',
      stats: [
        { label: '状态', value: ready ? '可以采集' : `第 ${tile.resourceReadyDay} 日再生` },
        { label: '基础产量', value: tile.resourceAmount ?? 2 },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: ready ? `使用下方行动栏自动寻路并完成${tile.resourceNode === 'wood' ? '三次斧击' : '五次锤击'}。` : '离开场景后仍会按日期恢复。',
      tone: ready ? 'good' : 'neutral',
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

  if (tile.terrain === 'water') {
    const influence = fishingInfluenceAt(state.world, position)
    const spot = fishingSpotProgress(state.fishingSpots[fishingSpotKey(state.world, position)], state.day)
    const exhausted = spot.uses >= FISHING_SPOT_CAPACITY
    const distanceToPlayer = Math.abs(position.x - state.player.x) + Math.abs(position.y - state.player.y)
    return {
      ...base,
      category: '地形',
      name: influence ? `${fishingSignalNames[influence.kind]}水域` : '普通水域',
      icon: influence?.kind === 'glimmer' ? '✦' : influence?.kind === 'whirlpool' ? '◎' : '≈',
      description: influence?.kind === 'current' ? '水面流纹聚拢鱼群，更容易一次带回多条普通鱼。'
        : influence?.kind === 'glimmer' ? '水下闪光预示旧金币与金鲤，强钓讯也可能带出装备。'
          : influence?.kind === 'whirlpool' ? '深水旋流卷着遗物，是取得遗迹装备概率最高的钓讯。'
            : '没有明显钓讯的基础水域，完美收竿仍可能发现稀有物。',
      stats: [
        { label: '钓位', value: exhausted ? `沉寂至第 ${spot.readyDay} 日` : `${spot.uses}/10` },
        { label: '钓讯', value: influence ? `${fishingSignalNames[influence.kind]} · ${influence.strength === 'strong' ? '强' : '弱'}` : '无' },
        ...(influence ? [{ label: '讯源距离', value: influence.distance }] : []),
        { label: '下一杆', value: exhausted ? '不可抛竿' : `疲劳 +${fishingFatigue(spot.uses + 1)}` },
        { label: '抛竿距离', value: distanceToPlayer <= 2 ? `${distanceToPlayer} 格 · 可达` : `${distanceToPlayer} 格` },
        { label: '坐标', value: `${position.x}, ${position.y}` },
      ],
      hint: exhausted ? `钓满 10 次后需要等待 3 日；第 ${spot.readyDay} 日恢复。` : '选择一到两格内的水格，在下方行动栏抛竿。',
      tone: exhausted ? 'neutral' : influence ? 'good' : 'neutral',
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
      { label: '通行', value: tile.terrain === 'mountain' ? '不可通行' : '可通行' },
      { label: '坐标', value: `${position.x}, ${position.y}` },
    ],
    tone: 'neutral',
  }
}
