import type { Agent, ChronicleEntry, Direction, FogLevel, GameAction, GameState, Position, SceneSnapshot } from './types'
import { hashString } from './rng'
import { createScene, isPassable, revealFog, sceneEntry, sceneKey, tileIndex } from './world'

export const STEPS_PER_STAMINA = 100
export const COMBAT_STEP_MULTIPLIER = 1.5
export const TALK_STEP_COST = 10
export const SCENE_TRAVEL_STEP_COST = 25
export const EXHAUSTED_REST_RECOVERY = 3
export const MAX_STAMINA_CAP = 30

const directionDelta: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function log(state: GameState, text: string, tone: ChronicleEntry['tone'] = 'plain'): ChronicleEntry[] {
  const nextId = state.chronicle.reduce((maximum, entry) => Math.max(maximum, entry.id), 0) + 1
  return [
    { id: nextId, day: state.day, text, tone },
    ...state.chronicle,
  ].slice(0, 24)
}

function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function interactableAgent(state: GameState, agentId?: string): Agent | undefined {
  const candidates = state.agents.filter((agent) => distance(agent, state.player) <= 1)
  return agentId
    ? candidates.find((agent) => agent.id === agentId)
    : candidates.find((agent) => agent.role === 'wanderer') ?? candidates[0]
}

export function berryExchangeRate(state: Pick<GameState, 'gameId' | 'day'>, agentId: string): number {
  return 8 + (hashString(`${state.gameId}:berry-market:${state.day}:${agentId}`) % 5)
}

function followerStep(state: GameState, agent: Agent): Agent {
  if (distance(agent, state.player) <= 1) return agent
  const dx = state.player.x - agent.x
  const dy = state.player.y - agent.y
  const candidates =
    Math.abs(dx) >= Math.abs(dy)
      ? [
          { x: agent.x + Math.sign(dx), y: agent.y },
          { x: agent.x, y: agent.y + Math.sign(dy) },
        ]
      : [
          { x: agent.x, y: agent.y + Math.sign(dy) },
          { x: agent.x + Math.sign(dx), y: agent.y },
        ]
  const step = candidates.find((position) => isPassable(state.world, position.x, position.y))
  return step ? { ...agent, ...step } : agent
}

function advanceAi(state: GameState): Pick<GameState, 'agents' | 'day'> {
  const agents = state.agents.map((agent, index) => {
    if (agent.role === 'follower') return followerStep(state, agent)
    if (agent.role !== 'wanderer') return agent
    const cycle = (state.day + index * 3) % 4
    const direction = (['up', 'right', 'down', 'left'] as const)[cycle]
    const delta = directionDelta[direction]
    const x = agent.x + delta.x
    const y = agent.y + delta.y
    if (!isPassable(state.world, x, y)) return agent
    return { ...agent, x, y }
  })
  return { agents, day: state.day + 1 }
}

function finishTurn(state: GameState, patch: Partial<GameState>): GameState {
  const merged = { ...state, ...patch }
  const ai = advanceAi(merged)
  const next = { ...merged, ...ai }
  return { ...next, fog: revealFog(next) }
}

function addFatigue(
  state: Pick<GameState, 'fatigue'>,
  stamina: number,
  steps: number,
): { stamina: number; fatigue: number } {
  const total = state.fatigue + steps
  const staminaCost = Math.floor(total / STEPS_PER_STAMINA)
  return {
    stamina: Math.max(0, stamina - staminaCost),
    fatigue: total % STEPS_PER_STAMINA,
  }
}

function automaticRest(state: GameState): GameState {
  return finishTurn(state, {
    player: {
      ...state.player,
      stamina: Math.min(EXHAUSTED_REST_RECOVERY, state.player.maxStamina),
    },
    fatigue: 0,
    chronicle: log(state, `体力归零，队伍自动扎营休整，恢复到 ${Math.min(EXHAUSTED_REST_RECOVERY, state.player.maxStamina)} 点体力。`, 'good'),
  })
}

function move(state: GameState, direction: Direction): GameState {
  if (state.player.stamina <= 0) {
    return automaticRest(state)
  }
  const delta = directionDelta[direction]
  const x = state.player.x + delta.x
  const y = state.player.y + delta.y
  if (!isPassable(state.world, x, y)) {
    return { ...state, chronicle: log(state, '前路被深水或峭壁挡住了。', 'danger') }
  }

  const tiles = state.world.tiles.map((tile) => ({ ...tile }))
  const index = tileIndex(state.world, x, y)
  const tile = tiles[index]
  let gold = state.player.gold
  let berries = state.player.berries
  let stamina = state.player.stamina
  let maxStamina = state.player.maxStamina
  let fatigue = state.fatigue
  let combatWins = state.combatWins
  let monsters = state.monsters
  let chronicle = state.chronicle
  const monster = monsters.find((item) => item.x === x && item.y === y)
  const exertion = addFatigue(state, stamina, monster ? COMBAT_STEP_MULTIPLIER : 1)
  stamina = exertion.stamina
  fatigue = exertion.fatigue

  if (tile.coin > 0) {
    gold += tile.coin
    chronicle = log({ ...state, chronicle }, `在路边发现 ${tile.coin} 枚旧金币。`, 'good')
    tile.coin = 0
  }

  if ((tile.food ?? 0) > 0) {
    const food = tile.food ?? 0
    berries += food
    chronicle = log(
      { ...state, chronicle },
      `采到 ${food} 枚野果，已经放入左侧物品栏。`,
      'good',
    )
    tile.food = 0
  }

  if (monster) {
    const power = 1 + state.agents.filter((agent) => agent.role === 'follower').length
    if (power >= monster.hp) {
      monsters = monsters.filter((item) => item.id !== monster.id)
      gold += 2
      combatWins += 1
      const previousMax = maxStamina
      maxStamina = Math.min(MAX_STAMINA_CAP, maxStamina + 1)
      chronicle = log(
        { ...state, chronicle },
        `随行队伍击退了${monster.species === 'slime' ? '泥团怪' : monster.species === 'boar' ? '棘背兽' : '迷雾精'}，获得 2 金。${maxStamina > previousMax ? `体力上限提升到 ${maxStamina}。` : ''}`,
        'good',
      )
    } else {
      const hit = hashString(`${state.gameId}:hit:${state.day}:${monster.id}:${x}:${y}`) % 2
      stamina = Math.max(0, stamina - hit)
      chronicle = log(
        { ...state, chronicle },
        hit > 0
          ? '怪物击中了队伍，损失 1 点体力；战斗步数按 1.5 倍累计。'
          : '怪物的攻击被挡住，没有损失体力；战斗步数仍按 1.5 倍累计。',
        hit > 0 ? 'danger' : 'plain',
      )
    }
  }

  const next = finishTurn(state, {
    world: { ...state.world, tiles },
    player: { ...state.player, x, y, gold, berries, stamina, maxStamina },
    fatigue,
    combatWins,
    monsters,
    chronicle,
    selected: { x, y },
  })
  return next
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE':
      return move(state, action.direction)
    case 'SELECT': {
      const dx = action.position.x - state.player.x
      const dy = action.position.y - state.player.y
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const direction: Direction = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up'
        return move(state, direction)
      }
      return { ...state, selected: action.position }
    }
    case 'REST': {
      const villageIncome = state.agents.filter((agent) => agent.role === 'villager').length
      const vassalIncome = state.factions.filter((faction) => faction.isVassal).length * 2
      const goldIncome = villageIncome + vassalIncome
      const patched = {
        player: {
          ...state.player,
          stamina: state.player.stamina <= 0
            ? Math.min(EXHAUSTED_REST_RECOVERY, state.player.maxStamina)
            : state.player.maxStamina,
          gold: state.player.gold + goldIncome,
        },
        fatigue: 0,
        chronicle: log(
          state,
          goldIncome > 0
            ? `营地度过一夜。村庄税收 ${villageIncome} 金，附属贡金 ${vassalIncome} 金。`
            : '篝火熄灭前，体力已经恢复。',
          'good',
        ),
      }
      return finishTurn(state, patched)
    }
    case 'EAT_BERRY': {
      if (state.player.berries <= 0) {
        return { ...state, chronicle: log(state, '物品栏里已经没有野果了。', 'danger') }
      }
      if (state.player.stamina >= state.player.maxStamina) {
        return { ...state, chronicle: log(state, '体力充足，先把野果留在行囊里。') }
      }
      return {
        ...state,
        player: {
          ...state.player,
          berries: state.player.berries - 1,
          stamina: Math.min(state.player.maxStamina, state.player.stamina + 1),
        },
        chronicle: log(state, '吃下一枚野果，恢复 1 点体力。', 'good'),
      }
    }
    case 'TALK': {
      if (state.player.stamina <= 0) return automaticRest(state)
      const target = interactableAgent(state, action.agentId)
      if (!target) return { ...state, chronicle: log(state, '附近没有可以交谈的旅人。') }
      const exertion = addFatigue(state, state.player.stamina, TALK_STEP_COST)
      const agents = state.agents.map((agent) =>
        agent.id === target.id ? { ...agent, affection: Math.min(5, agent.affection + 1) } : agent,
      )
      const factions = state.factions.map((faction) =>
        faction.id === target.factionId ? { ...faction, relation: Math.min(100, faction.relation + 5) } : faction,
      )
      return {
        ...state,
        agents,
        factions,
        player: { ...state.player, stamina: exertion.stamina },
        fatigue: exertion.fatigue,
        chronicle: log(state, `你与 ${target.name} 分享了旅途见闻。好感 +1，阵营声望 +5。`, 'good'),
      }
    }
    case 'RECRUIT': {
      const target = interactableAgent(state, action.agentId)
      if (!target) return { ...state, chronicle: log(state, '附近没有可招募的旅人。') }
      if (target.role !== 'wanderer') return { ...state, chronicle: log(state, `${target.name} 已经有自己的职责。`) }
      if (target.affection < 3) return { ...state, chronicle: log(state, `${target.name} 还不够信任你（需要 3 点好感）。`, 'danger') }
      if (state.player.gold < 5) return { ...state, chronicle: log(state, '准备行装至少需要 5 金。', 'danger') }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - 5 },
        agents: state.agents.map((agent) => (agent.id === target.id ? { ...agent, role: 'follower' } : agent)),
        chronicle: log(state, `${target.name} 成为你的第一位随从。探索视野与战力提升。`, 'good'),
      }
    }
    case 'TRADE_BERRIES': {
      const target = interactableAgent(state, action.agentId)
      if (!target) return { ...state, chronicle: log(state, '交易对象已经离开身边。', 'danger') }
      const rate = berryExchangeRate(state, target.id)
      if (action.direction === 'buy') {
        if (state.player.gold < 1) return { ...state, chronicle: log(state, '购买野果需要 1 金。', 'danger') }
        if (target.berries < rate) return { ...state, chronicle: log(state, `${target.name} 的野果存货不足。`, 'danger') }
        return {
          ...state,
          player: { ...state.player, gold: state.player.gold - 1, berries: state.player.berries + rate },
          agents: state.agents.map((agent) =>
            agent.id === target.id ? { ...agent, gold: agent.gold + 1, berries: agent.berries - rate } : agent,
          ),
          chronicle: log(state, `用 1 金向 ${target.name} 买下 ${rate} 枚野果。`, 'good'),
        }
      }
      if (state.player.berries < rate) {
        return { ...state, chronicle: log(state, `出售一份需要凑齐 ${rate} 枚野果。`, 'danger') }
      }
      if (target.gold < 1) return { ...state, chronicle: log(state, `${target.name} 暂时没有金币收购野果。`, 'danger') }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold + 1, berries: state.player.berries - rate },
        agents: state.agents.map((agent) =>
          agent.id === target.id ? { ...agent, gold: agent.gold - 1, berries: agent.berries + rate } : agent,
        ),
        chronicle: log(state, `向 ${target.name} 出售 ${rate} 枚野果，获得 1 金。`, 'good'),
      }
    }
    case 'FOUND_CAMP': {
      const index = tileIndex(state.world, state.player.x, state.player.y)
      const tile = state.world.tiles[index]
      if (tile.structure) return { ...state, chronicle: log(state, '这里已有建筑，无法重复建营。', 'danger') }
      if (state.player.gold < 8) return { ...state, chronicle: log(state, '建立营地需要 8 金。', 'danger') }
      const tiles = state.world.tiles.map((item, itemIndex) =>
        itemIndex === index ? { ...item, structure: 'camp' as const } : item,
      )
      return {
        ...state,
        world: { ...state.world, tiles },
        player: { ...state.player, gold: state.player.gold - 8 },
        chronicle: log(state, '木桩落地，旗帜升起。这里成为你的第一个营地。', 'good'),
      }
    }
    case 'STATION_FOLLOWER': {
      const follower = state.agents.find((agent) => agent.role === 'follower')
      const tile = state.world.tiles[tileIndex(state.world, state.player.x, state.player.y)]
      if (!follower) return { ...state, chronicle: log(state, '你还没有可以驻守的随从。', 'danger') }
      if (tile.structure !== 'camp') return { ...state, chronicle: log(state, '随从只能在已建立的营地驻守。', 'danger') }
      const next = {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === follower.id
            ? { ...agent, role: 'villager' as const, x: state.player.x, y: state.player.y }
            : agent,
        ),
        chronicle: log(state, `${follower.name} 留守营地。这里将永久保持明亮，并每天产出 1 金。`, 'good'),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'PLEDGE_FACTION': {
      const faction = state.factions.find((item) => item.id === action.factionId)
      if (!faction) return state
      if (state.player.factionId !== 'free') {
        return { ...state, chronicle: log(state, '你已经立下效忠誓言；若要改换门庭，必须先脱离。', 'danger') }
      }
      if (faction.isVassal) {
        return { ...state, chronicle: log(state, `${faction.name} 已是你的附属，不能反向向它效忠。`, 'danger') }
      }
      if (faction.relation < 15) {
        return { ...state, chronicle: log(state, `${faction.name} 尚不接受你的誓言（需要 15 声望）。`, 'danger') }
      }
      return {
        ...state,
        player: { ...state.player, factionId: faction.id, gold: state.player.gold + 4 },
        factions: state.factions.map((item) =>
          item.id === faction.id ? { ...item, isOverlord: true } : item,
        ),
        chronicle: log(state, `你向${faction.name}宣誓效忠，获得 4 金远征资助。`, 'good'),
      }
    }
    case 'BREAK_OATH': {
      if (state.player.factionId === 'free') {
        return { ...state, chronicle: log(state, '你没有需要解除的效忠关系。') }
      }
      const overlord = state.factions.find((item) => item.id === state.player.factionId)
      return {
        ...state,
        player: {
          ...state.player,
          factionId: 'free',
          gold: Math.max(0, state.player.gold - 3),
        },
        factions: state.factions.map((item) =>
          item.id === state.player.factionId
            ? { ...item, isOverlord: false, relation: Math.max(-100, item.relation - 20) }
            : item,
        ),
        chronicle: log(
          state,
          `你撕毁了对${overlord?.name ?? '旧领主'}的誓约，支付 3 金并失去 20 声望。`,
          'danger',
        ),
      }
    }
    case 'MAKE_VASSAL': {
      const faction = state.factions.find((item) => item.id === action.factionId)
      if (!faction) return state
      if (state.player.factionId !== 'free') {
        return { ...state, chronicle: log(state, '效忠他人时不能建立自己的附属体系。', 'danger') }
      }
      if (faction.isVassal) {
        return { ...state, chronicle: log(state, `${faction.name} 已经承认你的宗主权。`) }
      }
      const villages = state.agents.filter((agent) => agent.role === 'villager').length
      if (villages < 1) {
        return { ...state, chronicle: log(state, '至少需要一处有村民驻守的领地，才能提出附属契约。', 'danger') }
      }
      if (faction.relation < 30) {
        return { ...state, chronicle: log(state, `${faction.name} 尚未充分信任你（需要 30 声望）。`, 'danger') }
      }
      if (state.player.gold < 10) {
        return { ...state, chronicle: log(state, '缔结保护与贡赋契约需要 10 金。', 'danger') }
      }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - 10 },
        factions: state.factions.map((item) =>
          item.id === faction.id ? { ...item, isVassal: true } : item,
        ),
        chronicle: log(state, `${faction.name} 接受保护契约，成为你的附属，每日进贡 2 金。`, 'good'),
      }
    }
    case 'TRAVEL': {
      if (state.player.stamina <= 0) return automaticRest(state)
      const delta = directionDelta[action.direction]
      const targetX = state.world.sceneX + delta.x
      const targetY = state.world.sceneY + delta.y
      const currentKey = sceneKey(state.world.sceneX, state.world.sceneY)
      const targetKey = sceneKey(targetX, targetY)
      const followers = state.agents.filter((agent) => agent.role === 'follower')
      const sceneCache = {
        ...state.sceneCache,
        [currentKey]: {
          world: state.world,
          fog: state.fog,
          agents: state.agents.filter((agent) => agent.role !== 'follower'),
          monsters: state.monsters,
        },
      }
      const cached = sceneCache[targetKey]
      const generated: SceneSnapshot = cached ?? {
        ...createScene(state.world.seed, state.world.mapSize, targetX, targetY),
        fog: new Array<FogLevel>(state.world.tiles.length).fill(0),
      }
      const entry = sceneEntry(generated.world, action.direction)
      const exertion = addFatigue(state, state.player.stamina, SCENE_TRAVEL_STEP_COST)
      const player = {
        ...state.player,
        ...entry,
        stamina: exertion.stamina,
      }
      const agents = [
        ...generated.agents.filter((agent) => agent.role !== 'follower'),
        ...followers.map((follower, index) => ({
          ...follower,
          x: Math.max(1, Math.min(generated.world.size - 2, entry.x + (index % 2))),
          y: Math.max(1, Math.min(generated.world.size - 2, entry.y + Math.floor(index / 2))),
        })),
      ]
      const next: GameState = {
        ...state,
        world: generated.world,
        fog: generated.fog,
        agents,
        monsters: generated.monsters,
        player,
        fatigue: exertion.fatigue,
        sceneCache,
        selected: null,
        day: state.day + 1,
        chronicle: log(
          state,
          `你沿古老交通线抵达${generated.world.sceneName} [${targetX}, ${targetY}]。场景由总种子继续展开。`,
          'good',
        ),
      }
      return { ...next, fog: revealFog(next) }
    }
    default:
      return state
  }
}

export function visibleCounts(state: GameState): { visible: number; explored: number; total: number } {
  return {
    visible: state.fog.filter((level) => level === 2).length,
    explored: state.fog.filter((level) => level > 0).length,
    total: state.fog.length,
  }
}
