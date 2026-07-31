import type { Agent, Camp, ChronicleEntry, Direction, FogLevel, GameAction, GameState, Position, SceneSnapshot, World } from './types'
import { hashString } from './rng'
import { combatMove, equipmentDefense, equipmentPower } from './combat'
import { buildingCount, campBuildingDefinitions, campDailyYield, campRestRecovery } from './camps'
import { isWithinInteractionRange } from './geometry'
import { agentSkills, challengeChance, partyBonuses } from './skills'
import { createScene, isPassable, revealFog, sceneEntry, sceneKey, tileIndex } from './world'

export const STEPS_PER_STAMINA = 100
export const COMBAT_STEP_MULTIPLIER = 1.5
export const TALK_STEP_COST = 10
export const SCENE_TRAVEL_STEP_COST = 25
export const EXHAUSTED_REST_RECOVERY = 3
export const MAX_STAMINA_CAP = 30
export const MONSTER_NOTICE_RADIUS = 5
export const MONSTER_NOTICE_PERCENT = 35
export const MONSTER_CHASE_PERCENT = 68
export const MONSTER_AMBUSH_PERCENT = 42
export const ROAD_STEP_COST = 0.35

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

function campAt(state: GameState, position: Position): Camp | undefined {
  return state.camps.find(
    (camp) =>
      camp.sceneX === state.world.sceneX &&
      camp.sceneY === state.world.sceneY &&
      distance(camp, position) <= camp.controlRadius,
  )
}

function shortestPath(world: World, start: Position, target: Position): Position[] {
  const key = (position: Position) => `${position.x},${position.y}`
  const queue: Position[] = [start]
  const parent = new Map<string, Position | null>([[key(start), null]])
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.x === target.x && current.y === target.y) break
    for (const direction of ['up', 'right', 'down', 'left'] as const) {
      const delta = directionDelta[direction]
      const next = { x: current.x + delta.x, y: current.y + delta.y }
      const nextKey = key(next)
      if (parent.has(nextKey) || !isPassable(world, next.x, next.y)) continue
      parent.set(nextKey, current)
      queue.push(next)
    }
  }
  if (!parent.has(key(target))) return []
  const path: Position[] = []
  let cursor: Position | null = target
  while (cursor && !(cursor.x === start.x && cursor.y === start.y)) {
    path.unshift(cursor)
    cursor = parent.get(key(cursor)) ?? null
  }
  return path
}

function connectCampRoads(world: World, camps: Camp[], newCamp: Camp): World {
  const tiles = world.tiles.map((tile) => ({ ...tile }))
  camps
    .filter((camp) => camp.id !== newCamp.id && camp.sceneX === newCamp.sceneX && camp.sceneY === newCamp.sceneY)
    .forEach((camp) => {
      shortestPath(world, camp, newCamp).forEach((position) => {
        tiles[tileIndex(world, position.x, position.y)].road = true
      })
    })
  tiles[tileIndex(world, newCamp.x, newCamp.y)].road = true
  return { ...world, tiles }
}

function directionBetween(from: Position, to: Position): Direction {
  if (to.x > from.x) return 'right'
  if (to.x < from.x) return 'left'
  if (to.y > from.y) return 'down'
  return 'up'
}

function facingToward(from: Position, to: Position): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0 ? 'right' : 'left'
    : dy >= 0 ? 'down' : 'up'
}

function monsterName(species: GameState['monsters'][number]['species']): string {
  return species === 'slime' ? '苔泥团' : species === 'boar' ? '棘背兽' : '迷雾精'
}

function beginBattle(
  state: GameState,
  monster: GameState['monsters'][number],
  message: string,
): GameState {
  return {
    ...state,
    battle: {
      monsterId: monster.id,
      mode: state.combatPreference,
      round: 1,
      monsterMaxHp: monster.hp,
    },
    player: { ...state.player, facing: facingToward(state.player, monster) },
    monsters: state.monsters.map((item) =>
      item.id === monster.id ? { ...item, alert: 3, facing: facingToward(item, state.player) } : item,
    ),
    chronicle: log(state, message, 'danger'),
  }
}

function interactableAgent(state: GameState, agentId?: string): Agent | undefined {
  const candidates = state.agents.filter(
    (agent) => agent.role !== 'follower' && isWithinInteractionRange(agent, state.player),
  )
  return agentId
    ? candidates.find((agent) => agent.id === agentId)
    : candidates.find((agent) => agent.role === 'wanderer') ?? candidates[0]
}

export function berryExchangeRate(
  state: Pick<GameState, 'gameId' | 'day'> & Partial<Pick<GameState, 'agents'>>,
  agentId: string,
  direction?: 'buy' | 'sell',
): number {
  const base = 8 + (hashString(`${state.gameId}:berry-market:${state.day}:${agentId}`) % 5)
  const bonus = state.agents ? partyBonuses(state.agents).tradeRate : 0
  if (direction === 'buy') return base + bonus
  if (direction === 'sell') return Math.max(6, base - bonus)
  return base
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
  return step ? { ...agent, ...step, facing: facingToward(agent, step) } : agent
}

function monsterChaseStep(state: GameState, monster: GameState['monsters'][number]): Position | undefined {
  const dx = state.player.x - monster.x
  const dy = state.player.y - monster.y
  const candidates =
    Math.abs(dx) >= Math.abs(dy)
      ? [
          { x: monster.x + Math.sign(dx), y: monster.y },
          { x: monster.x, y: monster.y + Math.sign(dy) },
        ]
      : [
          { x: monster.x, y: monster.y + Math.sign(dy) },
          { x: monster.x + Math.sign(dx), y: monster.y },
        ]
  const occupied = new Set([
    ...state.agents.map((agent) => `${agent.x},${agent.y}`),
    ...state.monsters.filter((item) => item.id !== monster.id).map((item) => `${item.x},${item.y}`),
    `${state.player.x},${state.player.y}`,
  ])
  return candidates.find(
    (position) => isPassable(state.world, position.x, position.y) && !occupied.has(`${position.x},${position.y}`),
  )
}

function advanceMonsters(state: GameState): GameState['monsters'] {
  return state.monsters.map((monster, index) => {
    const playerDistance = distance(monster, state.player)
    const noticeRoll = hashString(`${state.gameId}:notice:${state.day}:${monster.id}`) % 100
    if ((monster.alert ?? 0) <= 0) {
      if (playerDistance <= MONSTER_NOTICE_RADIUS && noticeRoll < MONSTER_NOTICE_PERCENT) {
        return { ...monster, alert: 3, facing: facingToward(monster, state.player) }
      }
      return monster
    }

    const alert = playerDistance <= MONSTER_NOTICE_RADIUS + 2
      ? 3
      : Math.max(0, (monster.alert ?? 0) - 1)
    if (playerDistance <= 1 || alert <= 0) return { ...monster, alert, facing: facingToward(monster, state.player) }

    const isSlowStep = (state.day + index) % 2 === 0
    const chaseRoll = hashString(`${state.gameId}:chase:${state.day}:${monster.id}`) % 100
    if (!isSlowStep || chaseRoll >= MONSTER_CHASE_PERCENT) {
      return { ...monster, alert, facing: facingToward(monster, state.player) }
    }
    const step = monsterChaseStep(state, monster)
    return step
      ? { ...monster, ...step, alert, facing: facingToward(monster, step) }
      : { ...monster, alert, facing: facingToward(monster, state.player) }
  })
}

function advanceAi(state: GameState): Pick<GameState, 'agents' | 'monsters' | 'day'> {
  const agents = state.agents.map((agent, index) => {
    if (agent.role === 'follower') return followerStep(state, agent)
    if (agent.role !== 'wanderer') return agent
    const cycle = (state.day + index * 3) % 4
    const direction = (['up', 'right', 'down', 'left'] as const)[cycle]
    const delta = directionDelta[direction]
    const x = agent.x + delta.x
    const y = agent.y + delta.y
    if (!isPassable(state.world, x, y)) return agent
    return { ...agent, x, y, facing: direction }
  })
  return { agents, monsters: advanceMonsters({ ...state, agents }), day: state.day + 1 }
}

function finishTurn(state: GameState, patch: Partial<GameState>): GameState {
  const merged = { ...state, ...patch }
  const ai = advanceAi(merged)
  const next = { ...merged, ...ai }
  const revealed = { ...next, fog: revealFog(next) }
  if (revealed.battle || revealed.player.stamina <= 0) return revealed
  const attacker = revealed.monsters.find((monster) => {
    if ((monster.alert ?? 0) <= 0 || distance(monster, revealed.player) > 1) return false
    const localDefense = campAt(revealed, revealed.player)?.defense ?? 0
    const ambushChance = Math.max(8, MONSTER_AMBUSH_PERCENT - localDefense * 4)
    return hashString(`${revealed.gameId}:ambush:${revealed.day}:${monster.id}`) % 100 < ambushChance
  })
  return attacker
    ? beginBattle(revealed, attacker, `${monsterName(attacker.species)}逼近并发起攻击！`)
    : revealed
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
  const localCamp = campAt(state, state.player)
  const recovery = Math.min(
    state.player.maxStamina,
    campRestRecovery(localCamp) + partyBonuses(state.agents).recovery,
  )
  return finishTurn(state, {
    player: {
      ...state.player,
      stamina: recovery,
    },
    fatigue: 0,
    chronicle: log(state, `体力归零，队伍自动扎营休整，恢复到 ${recovery} 点体力。`, 'good'),
  })
}

function move(state: GameState, direction: Direction): GameState {
  if (state.battle) {
    return { ...state, chronicle: log(state, '必须先结束眼前的战斗。', 'danger') }
  }
  if (state.player.stamina <= 0) {
    return automaticRest(state)
  }
  const delta = directionDelta[direction]
  const x = state.player.x + delta.x
  const y = state.player.y + delta.y
  if (!isPassable(state.world, x, y)) {
    return { ...state, chronicle: log(state, '前路被深水或峭壁挡住了。', 'danger') }
  }

  const monster = state.monsters.find((item) => item.x === x && item.y === y)
  if (monster) {
    const exertion = addFatigue(state, state.player.stamina, COMBAT_STEP_MULTIPLIER)
    return beginBattle(
      {
        ...state,
        player: { ...state.player, stamina: exertion.stamina, facing: direction },
        fatigue: exertion.fatigue,
        selected: { x, y },
      },
      monster,
      `你惊动了${monsterName(monster.species)}，战斗开始。`,
    )
  }

  const tiles = state.world.tiles.map((tile) => ({ ...tile }))
  const index = tileIndex(state.world, x, y)
  const tile = tiles[index]
  let gold = state.player.gold
  let berries = state.player.berries
  let stamina = state.player.stamina
  let fatigue = state.fatigue
  let chronicle = state.chronicle
  const exertion = addFatigue(state, stamina, tile.road ? ROAD_STEP_COST : 1)
  stamina = exertion.stamina
  fatigue = exertion.fatigue
  const constructionTotal = state.constructionSteps + (state.camps.length > 0 ? 1 : 0)
  const earnedCredits = Math.floor(constructionTotal / STEPS_PER_STAMINA)
  const constructionSteps = constructionTotal % STEPS_PER_STAMINA
  const buildingCredits = state.buildingCredits + earnedCredits

  if (tile.coin > 0) {
    gold += tile.coin
    chronicle = log({ ...state, chronicle }, `在路边发现 ${tile.coin} 枚旧金币。`, 'good')
    tile.coin = 0
  }

  if ((tile.food ?? 0) > 0) {
    const food = (tile.food ?? 0) + partyBonuses(state.agents).forage
    berries += food
    chronicle = log(
      { ...state, chronicle },
      `采到 ${food} 枚野果，已经放入左侧物品栏。`,
      'good',
    )
    tile.food = 0
  }

  const next = finishTurn(state, {
    world: { ...state.world, tiles },
    player: { ...state.player, x, y, gold, berries, stamina, facing: direction },
    fatigue,
    constructionSteps,
    buildingCredits,
    chronicle,
    selected: { x, y },
  })
  return earnedCredits > 0
    ? { ...next, chronicle: log(next, '队伍完成 100 步建设勘察，获得 1 格营地建筑额度。', 'good') }
    : next
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE':
      return move(state, action.direction)
    case 'SELECT': {
      const tile = state.world.tiles[tileIndex(state.world, action.position.x, action.position.y)]
      const hasMapElement =
        Boolean(tile.structure || tile.road || tile.coin > 0 || (tile.food ?? 0) > 0) ||
        state.agents.some(
          (agent) => agent.role !== 'follower' && agent.x === action.position.x && agent.y === action.position.y,
        ) ||
        state.monsters.some((monster) => monster.x === action.position.x && monster.y === action.position.y)
      if (hasMapElement) return { ...state, selected: action.position }
      const dx = action.position.x - state.player.x
      const dy = action.position.y - state.player.y
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const direction: Direction = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up'
        return move(state, direction)
      }
      return { ...state, selected: action.position }
    }
    case 'REST': {
      if (state.battle) return { ...state, chronicle: log(state, '战斗中无法扎营休息。', 'danger') }
      const settlementYield = state.camps.reduce(
        (total, camp) => {
          const daily = campDailyYield(camp)
          return { gold: total.gold + daily.gold, berries: total.berries + daily.berries }
        },
        { gold: 0, berries: 0 },
      )
      const vassalIncome = state.factions.filter((faction) => faction.isVassal).length * 2
      const goldIncome = settlementYield.gold + vassalIncome
      const localCamp = campAt(state, state.player)
      const exhaustedRecovery = Math.min(
        state.player.maxStamina,
        campRestRecovery(localCamp) + partyBonuses(state.agents).recovery,
      )
      const patched = {
        player: {
          ...state.player,
          stamina: state.player.stamina <= 0
            ? exhaustedRecovery
            : state.player.maxStamina,
          gold: state.player.gold + goldIncome,
          berries: state.player.berries + settlementYield.berries,
        },
        fatigue: 0,
        chronicle: log(
          state,
          goldIncome > 0 || settlementYield.berries > 0
            ? `领地结算：营地收入 ${settlementYield.gold} 金、食物盈余 ${settlementYield.berries} 果，附属贡金 ${vassalIncome} 金。`
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
    case 'SET_COMBAT_PREFERENCE':
      return { ...state, combatPreference: action.mode }
    case 'SET_BATTLE_MODE':
      return state.battle
        ? {
            ...state,
            battle: { ...state.battle, mode: action.mode },
            chronicle: log(state, `本次遭遇切换为${action.mode === 'duel' ? '左右回合对峙' : '地图内直接战斗'}。`),
          }
        : state
    case 'TOGGLE_EQUIPMENT':
      return {
        ...state,
        equipment: state.equipment.map((item) =>
          item.id === action.itemId ? { ...item, equipped: !item.equipped } : item,
        ),
      }
    case 'COMBAT_ACTION': {
      if (!state.battle) return state
      const monster = state.monsters.find((item) => item.id === state.battle?.monsterId)
      if (!monster) return { ...state, battle: null }
      const move = combatMove(action.moveId)
      if (state.player.stamina < move.staminaCost) {
        return { ...state, chronicle: log(state, `${move.name}需要 ${move.staminaCost} 点体力。`, 'danger') }
      }
      const bonuses = partyBonuses(state.agents)
      const localCamp = campAt(state, state.player)
      const workshopBonus = localCamp && buildingCount(localCamp, 'workshop') > 0 ? 1 : 0
      const damage = move.power + equipmentPower(state.equipment, move.kind) + bonuses.combatPower + workshopBonus
      const remainingHp = Math.max(0, monster.hp - damage)
      const exertion = addFatigue(
        state,
        state.player.stamina - move.staminaCost,
        COMBAT_STEP_MULTIPLIER * (move.size === 'large' ? 2 : 1),
      )
      if (remainingHp <= 0) {
        const maxStamina = Math.min(MAX_STAMINA_CAP, state.player.maxStamina + 1)
        return {
          ...state,
          battle: null,
          monsters: state.monsters.filter((item) => item.id !== monster.id),
          player: {
            ...state.player,
            stamina: exertion.stamina,
            maxStamina,
            gold: state.player.gold + 2,
          },
          fatigue: exertion.fatigue,
          combatWins: state.combatWins + 1,
          chronicle: log(
            state,
            `${move.name}造成 ${damage} 点伤害，击退${monsterName(monster.species)}。获得 2 金，体力上限提升到 ${maxStamina}。`,
            'good',
          ),
        }
      }
      const rawHit = hashString(`${state.gameId}:counter:${state.day}:${monster.id}:${state.battle.round}`) % 2
      const blockRoll = hashString(`${state.gameId}:block:${state.day}:${monster.id}:${state.battle.round}`) % 100
      const blocked = rawHit > 0 && blockRoll < Math.min(90, equipmentDefense(state.equipment) * 20 + bonuses.guardChance)
      const hit = blocked ? 0 : rawHit
      const stamina = Math.max(0, exertion.stamina - hit)
      return {
        ...state,
        battle: stamina <= 0
          ? null
          : { ...state.battle, round: state.battle.round + 1, lastMoveId: move.id },
        monsters: state.monsters.map((item) =>
          item.id === monster.id
            ? { ...item, hp: remainingHp, alert: 3, facing: facingToward(item, state.player) }
            : item,
        ),
        player: { ...state.player, stamina },
        fatigue: exertion.fatigue,
        chronicle: log(
          state,
          `${move.name}造成 ${damage} 点伤害；${blocked ? '旅衣挡下反击' : hit ? '怪物反击造成 1 点体力损失' : '怪物反击落空'}。`,
          hit ? 'danger' : 'plain',
        ),
      }
    }
    case 'FLEE_BATTLE':
      if (!state.battle) return state
      return {
        ...state,
        battle: null,
        player: { ...state.player, stamina: Math.max(0, state.player.stamina - 1) },
        chronicle: log(state, '你拉开距离脱离战斗，损失 1 点体力。', 'danger'),
      }
    case 'TALK': {
      if (state.battle) return { ...state, chronicle: log(state, '怪物正逼近，无法安心交谈。', 'danger') }
      if (state.player.stamina <= 0) return automaticRest(state)
      const target = interactableAgent(state, action.agentId)
      if (!target) return { ...state, chronicle: log(state, '附近没有可以交谈的旅人。') }
      const exertion = addFatigue(state, state.player.stamina, TALK_STEP_COST)
      const agents = state.agents.map((agent) =>
        agent.id === target.id
          ? { ...agent, affection: Math.min(5, agent.affection + 1), facing: facingToward(agent, state.player) }
          : agent,
      )
      const factions = state.factions.map((faction) =>
        faction.id === target.factionId ? { ...faction, relation: Math.min(100, faction.relation + 5) } : faction,
      )
      return {
        ...state,
        agents,
        factions,
        player: { ...state.player, stamina: exertion.stamina, facing: facingToward(state.player, target) },
        fatigue: exertion.fatigue,
        chronicle: log(state, `你与 ${target.name} 分享了旅途见闻。好感 +1，阵营声望 +5。`, 'good'),
      }
    }
    case 'CHALLENGE_AGENT': {
      if (state.battle) return { ...state, chronicle: log(state, '战斗中无法进行友好切磋。', 'danger') }
      const target = interactableAgent(state, action.agentId)
      if (!target || target.role !== 'wanderer') {
        return { ...state, chronicle: log(state, '挑战对象已经离开，或不再是自由旅人。', 'danger') }
      }
      if (target.lastChallengeDay === state.day) {
        return { ...state, chronicle: log(state, `${target.name} 今天已经接受过你的挑战。`) }
      }
      if (target.challengeWon) {
        return { ...state, chronicle: log(state, `${target.name} 已经认可你通过了这项试炼。`) }
      }
      if (state.player.stamina <= 0) return automaticRest(state)
      const chance = challengeChance(state, target)
      const roll = hashString(`${state.gameId}:challenge:${state.day}:${target.id}`) % 100
      const success = roll < chance
      const definition = agentSkills[target.skill]
      return {
        ...state,
        player: {
          ...state.player,
          stamina: Math.max(0, state.player.stamina - 1),
          gold: state.player.gold + (success ? target.skillLevel : 0),
          facing: facingToward(state.player, target),
        },
        agents: state.agents.map((agent) =>
          agent.id === target.id
            ? {
                ...agent,
                affection: Math.min(5, agent.affection + (success ? 2 : 0)),
                lastChallengeDay: state.day,
                challengeWon: agent.challengeWon || success,
                facing: facingToward(agent, state.player),
              }
            : agent,
        ),
        factions: state.factions.map((faction) =>
          faction.id === target.factionId && success
            ? { ...faction, relation: Math.min(100, faction.relation + 8) }
            : faction,
        ),
        challengeMarks: success
          ? { ...state.challengeMarks, [target.skill]: state.challengeMarks[target.skill] + 1 }
          : state.challengeMarks,
        chronicle: log(
          state,
          success
            ? `${definition.challenge}获胜！${target.name}认可你的本领：好感 +2、${definition.name}印记 +1、获得 ${target.skillLevel} 金。`
            : `${definition.challenge}未能通过。${target.name}建议你积累战绩与专精后再来。`,
          success ? 'good' : 'danger',
        ),
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
      const rate = berryExchangeRate(state, target.id, action.direction)
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
      const camp: Camp = {
        id: `camp-${state.world.sceneX}-${state.world.sceneY}-${state.camps.length + 1}`,
        name: `${state.world.sceneName}营地 ${state.camps.length + 1}`,
        x: state.player.x,
        y: state.player.y,
        sceneX: state.world.sceneX,
        sceneY: state.world.sceneY,
        population: 1,
        housing: 3,
        defense: 1,
        economy: 1,
        food: 2,
        morale: 3,
        controlRadius: 3,
        buildings: [],
      }
      const tiles = state.world.tiles.map((item, itemIndex) =>
        itemIndex === index ? { ...item, structure: 'camp' as const, campId: camp.id, road: true } : item,
      )
      const camps = [...state.camps, camp]
      const next = {
        ...state,
        world: connectCampRoads({ ...state.world, tiles }, camps, camp),
        camps,
        player: { ...state.player, gold: state.player.gold - 8 },
        chronicle: log(
          state,
          camps.length > 1 ? '新营地落成，并与同场景的营地自动接通道路。' : '木桩落地，旗帜升起。营地周围成为可建设的控制范围。',
          'good',
        ),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'STATION_FOLLOWER': {
      const follower = state.agents.find((agent) => agent.role === 'follower')
      const tile = state.world.tiles[tileIndex(state.world, state.player.x, state.player.y)]
      if (!follower) return { ...state, chronicle: log(state, '你还没有可以驻守的随从。', 'danger') }
      if (tile.structure !== 'camp') return { ...state, chronicle: log(state, '随从只能在已建立的营地驻守。', 'danger') }
      const camp = state.camps.find((item) => item.id === tile.campId)
      if (!camp) return state
      if (camp.population >= camp.housing) {
        return { ...state, chronicle: log(state, `${camp.name}没有空余床位，请先修建旅人居所。`, 'danger') }
      }
      const stationGain: Record<Agent['skill'], Partial<Pick<Camp, 'defense' | 'economy' | 'food' | 'morale' | 'controlRadius'>>> = {
        scout: { controlRadius: 1 },
        forager: { food: follower.skillLevel },
        guard: { defense: follower.skillLevel },
        medic: { morale: follower.skillLevel },
        trader: { economy: follower.skillLevel },
        duelist: { defense: Math.ceil(follower.skillLevel / 2) },
      }
      const gain = stationGain[follower.skill]
      const next = {
        ...state,
        agents: state.agents.map((agent) =>
          agent.id === follower.id
            ? { ...agent, role: 'villager' as const, x: state.player.x, y: state.player.y, homeCampId: camp?.id }
            : agent,
        ),
        camps: state.camps.map((item) =>
          item.id === camp.id
            ? {
                ...item,
                population: item.population + 1,
                defense: item.defense + (gain.defense ?? 0),
                economy: item.economy + (gain.economy ?? 0),
                food: item.food + (gain.food ?? 0),
                morale: item.morale + (gain.morale ?? 0),
                controlRadius: Math.min(7, item.controlRadius + (gain.controlRadius ?? 0)),
              }
            : item,
        ),
        chronicle: log(
          state,
          `${follower.name} 以${agentSkills[follower.skill].title}身份留守${camp.name}，专长开始影响营地运营。`,
          'good',
        ),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'BUILD_CAMP_TILE': {
      if (state.battle) return { ...state, chronicle: log(state, '战斗中无法施工。', 'danger') }
      if (state.buildingCredits <= 0) {
        return { ...state, chronicle: log(state, '每在建营后移动 100 步，才会获得 1 格建筑额度。', 'danger') }
      }
      if (!state.selected) return { ...state, chronicle: log(state, '先在地图上选择营地控制范围内的空地。') }
      const camp = campAt(state, state.selected)
      if (!camp) return { ...state, chronicle: log(state, '所选格子不在当前场景的营地控制范围内。', 'danger') }
      const index = tileIndex(state.world, state.selected.x, state.selected.y)
      const tile = state.world.tiles[index]
      if (!isPassable(state.world, state.selected.x, state.selected.y) || tile.structure) {
        return { ...state, chronicle: log(state, '该格无法修建营地建筑。', 'danger') }
      }
      const definition = campBuildingDefinitions[action.kind]
      if (state.player.gold < definition.cost) {
        return { ...state, chronicle: log(state, `修建${definition.name}还需要 ${definition.cost} 金。`, 'danger') }
      }
      const gain = definition.gains
      const tiles = state.world.tiles.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, structure: 'camp-building' as const, campId: camp.id, buildingKind: action.kind }
          : item,
      )
      const next = {
        ...state,
        world: { ...state.world, tiles },
        camps: state.camps.map((item) =>
          item.id === camp.id
            ? {
                ...item,
                housing: item.housing + gain.housing,
                defense: item.defense + gain.defense,
                economy: item.economy + gain.economy,
                food: item.food + gain.food,
                morale: item.morale + gain.morale,
                controlRadius: Math.min(7, item.controlRadius + gain.controlRadius),
                buildings: [...item.buildings, { ...state.selected!, kind: action.kind }],
              }
            : item,
        ),
        player: { ...state.player, gold: state.player.gold - definition.cost },
        buildingCredits: state.buildingCredits - 1,
        chronicle: log(state, `${camp.name}建成${definition.name}：${definition.summary}。`, 'good'),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'RETURN_TO_CAMP': {
      if (state.battle) return { ...state, chronicle: log(state, '先结束战斗，才能自动寻路。', 'danger') }
      const camp = state.camps.find((item) => item.id === action.campId)
      if (!camp) return state
      if (camp.sceneX !== state.world.sceneX || camp.sceneY !== state.world.sceneY) {
        return { ...state, chronicle: log(state, `${camp.name}位于其他大场景，请先使用古道切换场景。`, 'danger') }
      }
      const path = shortestPath(state.world, state.player, camp)
      if (path.length === 0 && distance(state.player, camp) > 0) {
        return { ...state, chronicle: log(state, '没有找到可通行的返程路线。', 'danger') }
      }
      let next = state
      for (const position of path) {
        if (next.battle || next.player.stamina <= 0) break
        next = move(next, directionBetween(next.player, position))
      }
      return {
        ...next,
        chronicle: log(
          next,
          distance(next.player, camp) === 0 ? `已沿最短路径返回${camp.name}。` : `返程途中遭遇阻碍，自动寻路暂停。`,
          distance(next.player, camp) === 0 ? 'good' : 'danger',
        ),
      }
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
      if (state.battle) return { ...state, chronicle: log(state, '战斗中无法使用交通设施。', 'danger') }
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
          camps: state.camps.filter(
            (camp) => camp.sceneX === state.world.sceneX && camp.sceneY === state.world.sceneY,
          ),
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
