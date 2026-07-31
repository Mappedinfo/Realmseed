import type { Agent, ChronicleEntry, Direction, GameAction, GameState, Position } from './types'
import { isPassable, revealFog, tileIndex } from './world'

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

function nearestAgent(state: GameState): Agent | undefined {
  return state.agents.find((agent) => agent.role === 'wanderer' && distance(agent, state.player) <= 1)
}

function advanceAi(state: GameState): Pick<GameState, 'agents' | 'day'> {
  const agents = state.agents.map((agent, index) => {
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

function move(state: GameState, direction: Direction): GameState {
  if (state.player.stamina <= 0) {
    return { ...state, chronicle: log(state, '体力耗尽。扎营休息，明天再走。', 'danger') }
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
  let stamina = state.player.stamina - (tile.terrain === 'marsh' ? 2 : 1)
  let monsters = state.monsters
  let chronicle = state.chronicle

  if (tile.coin > 0) {
    gold += tile.coin
    chronicle = log({ ...state, chronicle }, `在路边发现 ${tile.coin} 枚旧金币。`, 'good')
    tile.coin = 0
  }

  const monster = monsters.find((item) => item.x === x && item.y === y)
  if (monster) {
    const power = 1 + state.agents.filter((agent) => agent.role === 'follower').length
    if (power >= monster.hp) {
      monsters = monsters.filter((item) => item.id !== monster.id)
      gold += 2
      chronicle = log({ ...state, chronicle }, `随行队伍击退了${monster.species === 'slime' ? '泥团怪' : monster.species === 'boar' ? '棘背兽' : '迷雾精'}，获得 2 金。`, 'good')
    } else {
      stamina = Math.max(0, stamina - 2)
      chronicle = log({ ...state, chronicle }, '怪物逼近！队伍势单力薄，仓促脱身损失 2 体力。', 'danger')
    }
  }

  const next = finishTurn(state, {
    world: { ...state.world, tiles },
    player: { ...state.player, x, y, gold, stamina: Math.max(0, stamina) },
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
      const goldIncome = state.agents.filter((agent) => agent.role === 'villager').length
      const patched = {
        player: {
          ...state.player,
          stamina: state.player.maxStamina,
          gold: state.player.gold + goldIncome,
        },
        chronicle: log(
          state,
          goldIncome > 0 ? `营地度过一夜。村民带来 ${goldIncome} 金税收。` : '篝火熄灭前，体力已经恢复。',
          'good',
        ),
      }
      return finishTurn(state, patched)
    }
    case 'TALK': {
      if (state.player.stamina <= 0) return { ...state, chronicle: log(state, '没有体力继续交谈。', 'danger') }
      const target = nearestAgent(state)
      if (!target) return { ...state, chronicle: log(state, '附近没有可以交谈的旅人。') }
      const agents = state.agents.map((agent) =>
        agent.id === target.id ? { ...agent, affection: Math.min(5, agent.affection + 1) } : agent,
      )
      const factions = state.factions.map((faction) =>
        faction.id === target.factionId ? { ...faction, relation: Math.min(100, faction.relation + 5) } : faction,
      )
      return finishTurn(state, {
        agents,
        factions,
        player: { ...state.player, stamina: state.player.stamina - 1 },
        chronicle: log(state, `你与 ${target.name} 分享了旅途见闻。好感 +1，阵营声望 +5。`, 'good'),
      })
    }
    case 'RECRUIT': {
      const target = nearestAgent(state)
      if (!target) return { ...state, chronicle: log(state, '附近没有可招募的旅人。') }
      if (target.affection < 3) return { ...state, chronicle: log(state, `${target.name} 还不够信任你（需要 3 点好感）。`, 'danger') }
      if (state.player.gold < 5) return { ...state, chronicle: log(state, '准备行装至少需要 5 金。', 'danger') }
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - 5 },
        agents: state.agents.map((agent) => (agent.id === target.id ? { ...agent, role: 'follower' } : agent)),
        chronicle: log(state, `${target.name} 成为你的第一位随从。探索视野与战力提升。`, 'good'),
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
