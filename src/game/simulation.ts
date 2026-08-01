import type { Agent, Camp, ChronicleEntry, CombatMoveId, Direction, EquipmentItem, FacilityEventKind, FogLevel, GameAction, GameState, Position, SceneSnapshot, World } from './types'
import { hashString } from './rng'
import { combatMove, equipmentDefense, equipmentPower, relicEquipment, resolveCombatRoll } from './combat'
import {
  buildingCount,
  campBuildingDefinitions,
  campDailyYield,
  campOfficeDefinitions,
  campPopulation,
  campRestRecovery,
  effectiveCampStats,
} from './camps'
import { facilityEventDefinitions, facilityEventKind } from './facilities'
import { isWithinInteractionRange } from './geometry'
import { agentSkillIds, agentSkills, challengeChance, partyBonuses } from './skills'
import { advanceCalendarDays, createFoundingResidents } from './settlements'
import { createScene, isPassable, revealFog, sceneEntry, sceneKey, tileIndex } from './world'
import { redNameDistance, redNameTargetAt, structureMaxHp } from './redName'

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
export const AUTO_AGGRO_REPAIR_COST = 100

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
      distance(camp, position) <= effectiveCampStats(state, camp).controlRadius,
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

interface AgentLoot {
  gold: number
  berries: number
  equipment?: EquipmentItem
}

function resolveAgentLoot(state: GameState, agent: Agent, salt: string): AgentLoot {
  const roll = hashString(`${state.gameId}:agent-loot:${agent.id}:${salt}`)
  const equipmentChance = 20 + agent.skillLevel * 15
  const template = relicEquipment[roll % relicEquipment.length]
  return {
    gold: Math.max(1, agent.gold),
    berries: Math.min(agent.berries, 1 + (Math.floor(roll / 7) % 4)),
    equipment: roll % 100 < equipmentChance
      ? { ...template, id: `${template.id}-${agent.id}-${salt}`, equipped: false }
      : undefined,
  }
}

function clearAgentFromCampOffices(camps: Camp[], agentId: string): Camp[] {
  return camps.map((camp) => ({
    ...camp,
    offices: Object.fromEntries(
      Object.entries(camp.offices).filter(([, official]) => official?.id !== agentId),
    ),
  }))
}

function beginMonsterBattle(
  state: GameState,
  monster: GameState['monsters'][number],
  message: string,
): GameState {
  return {
    ...state,
    battle: {
      targetId: monster.id,
      targetKind: 'monster',
      mode: state.combatPreference,
      round: 1,
      targetMaxHp: monster.hp,
    },
    player: { ...state.player, facing: facingToward(state.player, monster) },
    monsters: state.monsters.map((item) =>
      item.id === monster.id ? { ...item, alert: 3, facing: facingToward(item, state.player) } : item,
    ),
    chronicle: log(state, message, 'danger'),
  }
}

function beginAgentBattle(state: GameState, agent: Agent, message: string): GameState {
  return {
    ...state,
    battle: {
      targetId: agent.id,
      targetKind: 'agent',
      mode: state.combatPreference,
      round: 1,
      targetMaxHp: agent.maxHp,
    },
    player: { ...state.player, facing: facingToward(state.player, agent) },
    agents: state.agents.map((item) => item.id === agent.id
      ? { ...item, hostility: Math.max(3, item.hostility ?? 0), fear: 0, facing: facingToward(item, state.player) }
      : item),
    chronicle: log(state, message, 'danger'),
  }
}

function facilityNotice(
  state: GameState,
  kind: FacilityEventKind,
  description: string,
): GameState['facilityEvent'] {
  const definition = facilityEventDefinitions[kind]
  return {
    id: state.day * 1000 + state.chronicle.reduce((maximum, entry) => Math.max(maximum, entry.id), 0) + 1,
    kind,
    title: `${definition.icon} ${definition.title}`,
    description,
  }
}

function resolveRuinEvent(state: GameState, position: Position): GameState {
  const kind = facilityEventKind(state, position)
  const roll = hashString(
    `${state.gameId}:facility-reward:${state.world.sceneX}:${state.world.sceneY}:${position.x}:${position.y}`,
  )
  const definition = facilityEventDefinitions[kind]

  if (kind === 'monster') {
    const species = (['slime', 'boar', 'wisp'] as const)[roll % 3]
    const monster = {
      id: `ruin-${state.world.sceneX}-${state.world.sceneY}-${position.x}-${position.y}`,
      species,
      hp: 7 + (roll % 5),
      x: position.x,
      y: position.y,
      facing: 'down' as const,
      alert: 3,
    }
    const prepared = {
      ...state,
      monsters: [...state.monsters, monster],
      facilityEvent: facilityNotice(state, kind, `${definition.description} ${monsterName(species)}挡住了出口。`),
    }
    return beginMonsterBattle(prepared, monster, `探索遗迹时惊醒了${monsterName(species)}！`)
  }

  if (kind === 'coins') {
    const amount = 2 + (roll % 5)
    const description = `${definition.description} 获得 ${amount} 金。`
    return {
      ...state,
      player: { ...state.player, gold: state.player.gold + amount },
      facilityEvent: facilityNotice(state, kind, description),
      chronicle: log(state, description, 'good'),
    }
  }

  if (kind === 'food') {
    const amount = 3 + (roll % 6)
    const description = `${definition.description} 获得 ${amount} 枚野果。`
    return {
      ...state,
      player: { ...state.player, berries: state.player.berries + amount },
      facilityEvent: facilityNotice(state, kind, description),
      chronicle: log(state, description, 'good'),
    }
  }

  if (kind === 'restoration') {
    const description = `${definition.description} 体力恢复至 ${state.player.maxStamina}。`
    return {
      ...state,
      player: { ...state.player, stamina: state.player.maxStamina },
      fatigue: 0,
      facilityEvent: facilityNotice(state, kind, description),
      chronicle: log(state, description, 'good'),
    }
  }

  if (kind === 'equipment') {
    const available = relicEquipment.filter(
      (candidate) => !state.equipment.some((item) => item.id === candidate.id),
    )
    if (available.length === 0) {
      const description = '装备架已经空了，但回收的零件换得 4 金。'
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold + 4 },
        facilityEvent: facilityNotice(state, kind, description),
        chronicle: log(state, description, 'good'),
      }
    }
    const item = { ...available[roll % available.length] }
    const description = `${definition.description} 获得「${item.name}」，可在装备栏启用。`
    return {
      ...state,
      equipment: [...state.equipment, item],
      facilityEvent: facilityNotice(state, kind, description),
      chronicle: log(state, description, 'good'),
    }
  }

  const names = ['苔影', '烬叶', '露弦', '星槲', '雾岚', '青铃']
  const companion: Agent = {
    id: `companion-${state.world.sceneX}-${state.world.sceneY}-${position.x}-${position.y}`,
    name: names[roll % names.length],
    factionId: 'free',
    role: 'follower',
    x: state.player.x,
    y: state.player.y,
    affection: 3,
    stamina: 7,
    maxStamina: 7,
    hp: 12,
    maxHp: 12,
    gold: 0,
    berries: 0,
    facing: state.player.facing,
    skill: agentSkillIds[roll % agentSkillIds.length],
    skillLevel: (1 + (roll % 3)) as 1 | 2 | 3,
  }
  const description = `${definition.description} ${companion.name}成为随从，并收纳到左侧队伍列表。`
  return {
    ...state,
    agents: [...state.agents, companion],
    facilityEvent: facilityNotice(state, kind, description),
    chronicle: log(state, description, 'good'),
  }
}

function resolveCampBuildingTouch(state: GameState, position: Position): GameState {
  const index = tileIndex(state.world, position.x, position.y)
  const tile = state.world.tiles[index]
  if (
    tile.structure !== 'camp-building' ||
    (tile.lastUsedDay !== undefined && state.day - tile.lastUsedDay < 20)
  ) return state
  if (!tile.buildingKind || !['house', 'farm', 'shrine'].includes(tile.buildingKind)) return state
  const tiles = state.world.tiles.map((item, itemIndex) =>
    itemIndex === index ? { ...item, lastUsedDay: state.day } : item,
  )
  if (tile.buildingKind === 'farm') {
    return {
      ...state,
      world: { ...state.world, tiles },
      player: { ...state.player, berries: state.player.berries + 1 },
      chronicle: log(state, '林缘农圃今日可采的野果已经收获：野果 +1。', 'good'),
    }
  }
  const fullRecovery = tile.buildingKind === 'shrine'
  const stamina = fullRecovery
    ? state.player.maxStamina
    : Math.min(state.player.maxStamina, state.player.stamina + 1)
  return {
    ...state,
    world: { ...state.world, tiles },
    player: { ...state.player, stamina },
    fatigue: fullRecovery ? 0 : state.fatigue,
    chronicle: log(
      state,
      fullRecovery ? '篝火祠的暖光让体力完全恢复。' : '在旅人居所短歇，恢复 1 点体力。',
      'good',
    ),
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

function isAutoAggroAgent(state: GameState, agent: Agent): boolean {
  return Boolean(agent.autoAggro || state.factions.find((faction) => faction.id === agent.factionId)?.autoAggro)
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

function frightenedAgentStep(state: GameState, agent: Agent): Agent {
  const occupied = new Set([
    ...state.agents.filter((item) => item.id !== agent.id).map((item) => `${item.x},${item.y}`),
    ...state.monsters.map((monster) => `${monster.x},${monster.y}`),
    `${state.player.x},${state.player.y}`,
  ])
  const candidates = (Object.entries(directionDelta) as [Direction, Position][])
    .map(([direction, delta]) => ({ direction, x: agent.x + delta.x, y: agent.y + delta.y }))
    .filter((position) => isPassable(state.world, position.x, position.y) && !occupied.has(`${position.x},${position.y}`))
    .sort((a, b) => distance(b, state.player) - distance(a, state.player) || a.direction.localeCompare(b.direction))
  const step = candidates[0]
  return step
    ? { ...agent, x: step.x, y: step.y, facing: step.direction, fear: Math.max(0, (agent.fear ?? 0) - 1) }
    : { ...agent, fear: Math.max(0, (agent.fear ?? 0) - 1), facing: facingToward(agent, state.player) }
}

function hostileAgentStep(state: GameState, agent: Agent): Agent {
  if (distance(agent, state.player) <= 1) {
    return { ...agent, fear: 0, hostility: 5, facing: facingToward(agent, state.player) }
  }
  const occupied = new Set([
    ...state.agents.filter((item) => item.id !== agent.id).map((item) => `${item.x},${item.y}`),
    ...state.monsters.map((monster) => `${monster.x},${monster.y}`),
    `${state.player.x},${state.player.y}`,
  ])
  const candidates = (Object.entries(directionDelta) as [Direction, Position][])
    .map(([direction, delta]) => ({ direction, x: agent.x + delta.x, y: agent.y + delta.y }))
    .filter((position) => isPassable(state.world, position.x, position.y) && !occupied.has(`${position.x},${position.y}`))
    .sort((a, b) => distance(a, state.player) - distance(b, state.player) || a.direction.localeCompare(b.direction))
  const step = candidates[0]
  return step
    ? { ...agent, x: step.x, y: step.y, facing: step.direction, fear: 0, hostility: 5 }
    : { ...agent, fear: 0, hostility: 5, facing: facingToward(agent, state.player) }
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
    const noticeRoll = hashString(`${state.gameId}:notice:${state.turn}:${monster.id}`) % 100
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

    const isSlowStep = (state.turn + index) % 2 === 0
    const chaseRoll = hashString(`${state.gameId}:chase:${state.turn}:${monster.id}`) % 100
    if (!isSlowStep || chaseRoll >= MONSTER_CHASE_PERCENT) {
      return { ...monster, alert, facing: facingToward(monster, state.player) }
    }
    const step = monsterChaseStep(state, monster)
    return step
      ? { ...monster, ...step, alert, facing: facingToward(monster, step) }
      : { ...monster, alert, facing: facingToward(monster, state.player) }
  })
}

function advanceAi(state: GameState): Pick<GameState, 'agents' | 'monsters' | 'turn'> {
  const agents = state.agents.map((agent, index) => {
    if (agent.role === 'follower') return followerStep(state, agent)
    if (isAutoAggroAgent(state, agent)) return hostileAgentStep(state, agent)
    if ((agent.fear ?? 0) > 0) return frightenedAgentStep(state, agent)
    if (agent.role !== 'wanderer') return agent
    const cycle = (state.turn + index * 3) % 4
    const direction = (['up', 'right', 'down', 'left'] as const)[cycle]
    const delta = directionDelta[direction]
    const x = agent.x + delta.x
    const y = agent.y + delta.y
    if (!isPassable(state.world, x, y)) return agent
    return { ...agent, x, y, facing: direction }
  })
  return { agents, monsters: advanceMonsters({ ...state, agents }), turn: state.turn + 1 }
}

function finishTurn(state: GameState, patch: Partial<GameState>): GameState {
  const merged = { ...state, ...patch }
  const ai = advanceAi(merged)
  const next = { ...merged, ...ai }
  const revealed = { ...next, fog: revealFog(next) }
  if (revealed.battle || revealed.player.stamina <= 0) return revealed
  const pursuer = revealed.agents.find((agent) =>
    agent.role !== 'follower' && agent.hp > 0 && isAutoAggroAgent(revealed, agent) && distance(agent, revealed.player) <= 1,
  )
  if (pursuer) {
    return beginAgentBattle(revealed, pursuer, `${pursuer.name}执行阵营追缉，主动向你发起攻击！`)
  }
  const attacker = revealed.monsters.find((monster) => {
    if ((monster.alert ?? 0) <= 0 || distance(monster, revealed.player) > 1) return false
    const localCamp = campAt(revealed, revealed.player)
    const localDefense = localCamp ? effectiveCampStats(revealed, localCamp).defense : 0
    const ambushChance = Math.max(8, MONSTER_AMBUSH_PERCENT - localDefense * 4)
    return hashString(`${revealed.gameId}:ambush:${revealed.turn}:${monster.id}`) % 100 < ambushChance
  })
  if (!attacker) return revealed
  if (revealed.redNameMode) {
    const hit = hashString(`${revealed.gameId}:red-map-ambush:${revealed.turn}:${attacker.id}`) % 2
    return {
      ...revealed,
      player: { ...revealed.player, stamina: Math.max(0, revealed.player.stamina - hit), facing: facingToward(revealed.player, attacker) },
      monsters: revealed.monsters.map((monster) => monster.id === attacker.id
        ? { ...monster, alert: 3, facing: facingToward(monster, revealed.player) }
        : monster),
      chronicle: log(revealed, hit
        ? `${monsterName(attacker.species)}从地图上扑来，造成 1 点体力损失。`
        : `${monsterName(attacker.species)}从地图上扑来，但攻击落空。`, hit ? 'danger' : 'plain'),
    }
  }
  return beginMonsterBattle(revealed, attacker, `${monsterName(attacker.species)}逼近并发起攻击！`)
}

function advanceMovementClock(state: GameState): GameState {
  const progress = state.dayProgress + 1
  if (progress < 10) return { ...state, dayProgress: progress }
  return advanceCalendarDays({ ...state, dayProgress: 0 }, 1)
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
    campRestRecovery(state, localCamp) + partyBonuses(state.agents).recovery,
  )
  return advanceCalendarDays(finishTurn(state, {
    player: {
      ...state.player,
      stamina: recovery,
    },
    fatigue: 0,
    chronicle: log(state, `体力归零，队伍自动扎营休整，恢复到 ${recovery} 点体力。`, 'good'),
  }), 1)
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
    if (state.redNameMode) {
      return {
        ...state,
        player: { ...state.player, facing: direction },
        selected: { x, y },
        monsters: state.monsters.map((item) => item.id === monster.id ? { ...item, alert: 3, facing: facingToward(item, state.player) } : item),
        chronicle: log(state, `${monsterName(monster.species)}挡住了格子；在红名准星中选择招式即可直接攻击。`, 'danger'),
      }
    }
    const exertion = addFatigue(state, state.player.stamina, COMBAT_STEP_MULTIPLIER)
    return beginMonsterBattle(
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

  let stepped: GameState = {
    ...state,
    world: { ...state.world, tiles },
    player: { ...state.player, x, y, gold, berries, stamina, facing: direction },
    fatigue,
    constructionSteps,
    buildingCredits,
    chronicle,
    selected: { x, y },
  }
  stepped = resolveCampBuildingTouch(stepped, { x, y })
  if (tile.structure === 'ruin' && !tile.eventResolved) {
    tile.eventResolved = true
    stepped = { ...stepped, world: { ...stepped.world, tiles } }
    stepped = resolveRuinEvent(stepped, { x, y })
  }
  const turned = stepped.battle
    ? { ...stepped, turn: stepped.turn + 1, fog: revealFog(stepped) }
    : finishTurn(stepped, {})
  const next = advanceMovementClock(turned)
  return earnedCredits > 0
    ? { ...next, chronicle: log(next, '队伍完成 100 步建设勘察，获得 1 格营地建筑额度。', 'good') }
    : next
}

function redNameAttack(state: GameState, position: Position, moveId: CombatMoveId): GameState {
  if (!state.redNameMode) return { ...state, chronicle: log(state, '先开启右上角的红名模式。', 'danger') }
  if (state.battle) return { ...state, chronicle: log(state, '对战中无法使用地图红名攻击。', 'danger') }
  const target = redNameTargetAt(state, position)
  if (!target) return { ...state, chronicle: log(state, '准星位置没有可以攻击的目标。') }
  if (!target.attackable) return { ...state, chronicle: log(state, target.reason ?? '这个目标不能攻击。') }
  const move = combatMove(moveId)
  const targetDistance = redNameDistance(state, position)
  if (targetDistance < move.minRange || targetDistance > move.maxRange) {
    return { ...state, chronicle: log(state, `${move.name}射程 ${move.minRange}–${move.maxRange} 格，目标距离 ${targetDistance} 格。`, 'danger') }
  }
  if (state.player.stamina < move.staminaCost) {
    return { ...state, chronicle: log(state, `${move.name}需要 ${move.staminaCost} 点体力。`, 'danger') }
  }

  const sequence = state.attackSequence + 1
  const roll = resolveCombatRoll(state.gameId, target.id, sequence, move)
  const bonuses = partyBonuses(state.agents)
  const localCamp = campAt(state, state.player)
  const workshopBonus = localCamp && buildingCount(localCamp, 'workshop') > 0 ? 1 : 0
  const baseDamage = move.power + equipmentPower(state.equipment, move.kind) + bonuses.combatPower + workshopBonus
  const damage = Math.floor(baseDamage * roll.multiplier)
  const splashDamage = roll.hit && move.target === 'area' ? Math.max(1, Math.floor(damage * move.splashRatio)) : 0
  const damageFor = (kind: 'agent' | 'monster' | 'structure', id: string, targetPosition: Position) => {
    if (kind === target.kind && id === target.id) return damage
    return splashDamage > 0 && distance(targetPosition, position) <= move.blastRadius ? splashDamage : 0
  }

  const affectedAgentIds = new Set<string>()
  const provokedAgentIds = new Set<string>()
  const damagedAgents = state.agents.map((agent) => {
    if (agent.role === 'follower') return agent
    const dealt = damageFor('agent', agent.id, agent)
    const directlyAttacked = target.kind === 'agent' && agent.id === target.id
    const provoked = directlyAttacked || dealt > 0
    const witnessed = distance(agent, position) <= 4 || distance(agent, state.player) <= 4
    if (!provoked && !witnessed) return agent
    if (dealt > 0) affectedAgentIds.add(agent.id)
    if (provoked) provokedAgentIds.add(agent.id)
    return {
      ...agent,
      hp: dealt > 0 ? Math.max(0, agent.hp - dealt) : agent.hp,
      hostility: provoked ? 5 : Math.min(5, Math.max(agent.hostility ?? 0, 1)),
      fear: provoked ? 0 : Math.max(agent.fear ?? 0, 2),
      autoAggro: provoked ? true : agent.autoAggro,
      facing: facingToward(agent, state.player),
    }
  })
  const defeatedAgents = damagedAgents.filter((agent) => agent.role !== 'follower' && agent.hp <= 0)
  const defeatedAgentIds = new Set(defeatedAgents.map((agent) => agent.id))
  const agentLoot = defeatedAgents.map((agent) => resolveAgentLoot(state, agent, `map-${sequence}`))
  const agentLootGold = agentLoot.reduce((total, loot) => total + loot.gold, 0)
  const agentLootBerries = agentLoot.reduce((total, loot) => total + loot.berries, 0)
  const agentLootEquipment = agentLoot.flatMap((loot) => loot.equipment ? [loot.equipment] : [])
  let agents = damagedAgents.filter((agent) => !defeatedAgentIds.has(agent.id))

  const affectedMonsterIds = new Set<string>()
  let monsters = state.monsters.map((monster) => {
    const dealt = damageFor('monster', monster.id, monster)
    if (dealt <= 0) return monster
    affectedMonsterIds.add(monster.id)
    return { ...monster, hp: Math.max(0, monster.hp - dealt), alert: 3, facing: facingToward(monster, state.player) }
  })
  const defeatedMonsters = monsters.filter((monster) => monster.hp <= 0).length
  monsters = monsters.filter((monster) => monster.hp > 0)

  let destroyedStructures = 0
  const tiles = state.world.tiles.map((tile, index) => {
    if (!tile.structure) return tile
    const tilePosition = { x: index % state.world.size, y: Math.floor(index / state.world.size) }
    const tileTarget = redNameTargetAt(state, tilePosition)
    if (!tileTarget || !tileTarget.attackable) return tile
    const dealt = damageFor('structure', tileTarget.id, tilePosition)
    if (dealt <= 0) return tile
    const maxHp = tile.structureMaxHp ?? structureMaxHp(tile)
    const structureHp = Math.max(0, (tile.structureHp ?? maxHp) - dealt)
    if (structureHp > 0) return { ...tile, structureHp, structureMaxHp: maxHp }
    destroyedStructures += 1
    const cleared = { ...tile }
    delete cleared.structure
    delete cleared.structureHp
    delete cleared.structureMaxHp
    delete cleared.buildingKind
    delete cleared.eventResolved
    delete cleared.campId
    return cleared
  })

  const exertion = addFatigue(
    state,
    state.player.stamina - move.staminaCost,
    COMBAT_STEP_MULTIPLIER * (move.size === 'large' ? 2 : 1),
  )
  const targetAgent = target.kind === 'agent' ? state.agents.find((agent) => agent.id === target.id) : undefined
  const attackedFactionIds = new Set(
    damagedAgents.filter((agent) => provokedAgentIds.has(agent.id)).map((agent) => agent.factionId),
  )
  const relationPenaltyIds = new Set(
    damagedAgents.filter((agent) => affectedAgentIds.has(agent.id) || ((agent.hostility ?? 0) > (state.agents.find((old) => old.id === agent.id)?.hostility ?? 0)))
      .map((agent) => agent.factionId),
  )
  const factions = state.factions.map((faction) => relationPenaltyIds.has(faction.id)
    ? {
        ...faction,
        relation: Math.max(-100, faction.relation - (targetAgent?.factionId === faction.id ? 12 : 3)),
        autoAggro: faction.autoAggro || attackedFactionIds.has(faction.id),
      }
    : faction)
  const hitSummary = roll.hit
    ? `${roll.critical ? '暴击，' : ''}造成 ${damage} 点伤害`
    : '没有命中'
  const collateral = Math.max(0, affectedAgentIds.size + affectedMonsterIds.size - 1) + destroyedStructures
  const defeatedCount = defeatedMonsters + defeatedAgents.length
  const lootSummary = defeatedAgents.length
    ? `，击败 ${defeatedAgents.length} 名 NPC 并获得 ${agentLootGold} 金${agentLootBerries ? `、${agentLootBerries} 果` : ''}${agentLootEquipment.length ? `、${agentLootEquipment.length} 件装备` : ''}`
    : ''
  let camps = state.camps
  defeatedAgents.forEach((agent) => { camps = clearAgentFromCampOffices(camps, agent.id) })
  let patched: GameState = {
    ...state,
    world: { ...state.world, tiles },
    agents,
    monsters,
    factions,
    camps,
    equipment: [...state.equipment, ...agentLootEquipment],
    player: {
      ...state.player,
      stamina: exertion.stamina,
      facing: facingToward(state.player, position),
      gold: state.player.gold + defeatedMonsters * 2 + agentLootGold,
      berries: state.player.berries + agentLootBerries,
      maxStamina: Math.min(MAX_STAMINA_CAP, state.player.maxStamina + defeatedCount),
    },
    fatigue: exertion.fatigue,
    combatWins: state.combatWins + defeatedCount,
    attackSequence: sequence,
    lastMapAttack: { sequence, targetName: target.name, moveId, hit: roll.hit, critical: roll.critical, damage },
    selected: position,
    chronicle: log(
      state,
      `红名攻击：${move.name}对${target.name}${hitSummary}${collateral ? `，并波及 ${collateral} 个目标` : ''}${destroyedStructures ? `，摧毁 ${destroyedStructures} 座设施` : ''}${lootSummary}。${attackedFactionIds.size ? '受攻击者及其阵营已开启持续追缉。' : '附近 NPC 已经警觉。'}`,
      roll.hit ? 'danger' : 'plain',
    ),
  }

  const retaliationCandidates = agents.filter((agent) =>
    agent.hp > 0 && agent.skillLevel >= 2 &&
    (agent.id === target.id || (agent.hostility ?? 0) >= 1 && distance(agent, position) <= 2),
  )
  const retaliator = retaliationCandidates.find((agent) => {
    const chance = agent.id === target.id
      ? 4 + agent.skillLevel * 4 + (agent.skill === 'duelist' || agent.skill === 'guard' ? 8 : 0)
      : 4 + (agent.skillLevel === 3 ? 4 : 0)
    return hashString(`${state.gameId}:red-retaliation:${sequence}:${agent.id}`) % 100 < chance
  })
  if (retaliator) {
    agents = agents.map((agent) => agent.id === retaliator.id ? { ...agent, fear: 0, hostility: 5, autoAggro: true } : agent)
    patched = { ...patched, agents }
    return beginAgentBattle(
      { ...patched, turn: patched.turn + 1, fog: revealFog(patched) },
      agents.find((agent) => agent.id === retaliator.id)!,
      `${retaliator.name}压住恐惧，直接向红名者发起对战！`,
    )
  }
  return finishTurn(patched, {})
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MOVE':
      return move(state, action.direction)
    case 'DISMISS_FACILITY_EVENT':
      return { ...state, facilityEvent: null }
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
          const daily = campDailyYield(state, camp)
          return { gold: total.gold + daily.gold, berries: total.berries + daily.berries }
        },
        { gold: 0, berries: 0 },
      )
      const vassalIncome = state.factions.filter((faction) => faction.isVassal).length * 2
      const goldIncome = settlementYield.gold + vassalIncome
      const localCamp = campAt(state, state.player)
      const exhaustedRecovery = Math.min(
        state.player.maxStamina,
        campRestRecovery(state, localCamp) + partyBonuses(state.agents).recovery,
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
      return advanceCalendarDays(finishTurn(state, patched), 1)
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
    case 'SET_RED_NAME_MODE':
      return {
        ...state,
        redNameMode: action.enabled,
        selected: action.enabled ? state.selected : null,
        chronicle: log(state, action.enabled
          ? '红名模式已开启：地图准星可以直接攻击中立与敌对目标，附近 NPC 会目击并逃离。'
          : '红名模式已关闭，地图重新以探索与交谈为主。', action.enabled ? 'danger' : 'plain'),
      }
    case 'RED_NAME_ATTACK':
      return redNameAttack(state, action.position, action.moveId)
    case 'REPAIR_FACTION_AGGRO': {
      if (state.battle) return { ...state, chronicle: log(state, '战斗中无法进行赎偿交易。', 'danger') }
      const target = interactableAgent(state, action.agentId)
      const faction = state.factions.find((item) => item.id === action.factionId)
      if (!target || !faction || target.factionId !== faction.id) {
        return { ...state, chronicle: log(state, '需要在阵营成员周围 1 格内完成赎偿交易。', 'danger') }
      }
      if (!faction.autoAggro && !target.autoAggro) {
        return { ...state, chronicle: log(state, `${faction.name}当前没有发布针对你的追缉令。`) }
      }
      if (state.player.gold < AUTO_AGGRO_REPAIR_COST) {
        return { ...state, chronicle: log(state, `解除${faction.name}追缉需要 ${AUTO_AGGRO_REPAIR_COST} 金。`, 'danger') }
      }
      const forgive = (agent: Agent): Agent => agent.factionId === faction.id
        ? { ...agent, autoAggro: false, hostility: 0, fear: 0 }
        : agent
      const sceneCache = Object.fromEntries(Object.entries(state.sceneCache).map(([key, snapshot]) => [
        key,
        { ...snapshot, agents: snapshot.agents.map(forgive) },
      ]))
      return {
        ...state,
        player: { ...state.player, gold: state.player.gold - AUTO_AGGRO_REPAIR_COST },
        agents: state.agents.map(forgive),
        factions: state.factions.map((item) => item.id === faction.id
          ? { ...item, autoAggro: false, relation: Math.max(0, item.relation) }
          : item),
        sceneCache,
        chronicle: log(state, `你支付 ${AUTO_AGGRO_REPAIR_COST} 金完成赎偿交易；${faction.name}撤销全境追缉，所属成员停止主动攻击。`, 'good'),
      }
    }
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
      const monster = state.battle.targetKind === 'monster'
        ? state.monsters.find((item) => item.id === state.battle?.targetId)
        : undefined
      const agent = state.battle.targetKind === 'agent'
        ? state.agents.find((item) => item.id === state.battle?.targetId)
        : undefined
      const target = monster ?? agent
      if (!target) return { ...state, battle: null }
      const targetName = monster ? monsterName(monster.species) : agent!.name
      const targetHp = monster ? monster.hp : agent!.hp
      const move = combatMove(action.moveId)
      if (state.player.stamina < move.staminaCost) {
        return { ...state, chronicle: log(state, `${move.name}需要 ${move.staminaCost} 点体力。`, 'danger') }
      }
      // A monster occupying the player's destination is represented on the same
      // logical tile during the encounter, but still fights from the adjacent band.
      const targetDistance = Math.max(1, distance(state.player, target))
      if (targetDistance < move.minRange || targetDistance > move.maxRange) {
        return { ...state, chronicle: log(state, `${move.name}射程 ${move.minRange}–${move.maxRange} 格，当前目标距离 ${targetDistance} 格。`, 'danger') }
      }
      const bonuses = partyBonuses(state.agents)
      const localCamp = campAt(state, state.player)
      const workshopBonus = localCamp && buildingCount(localCamp, 'workshop') > 0 ? 1 : 0
      const roll = resolveCombatRoll(state.gameId, target.id, state.battle.round, move)
      const baseDamage = move.power + equipmentPower(state.equipment, move.kind) + bonuses.combatPower + workshopBonus
      const damage = Math.floor(baseDamage * roll.multiplier)
      const remainingHp = Math.max(0, targetHp - damage)
      const splashDamage = roll.hit && move.target === 'area' ? Math.max(1, Math.floor(damage * move.splashRatio)) : 0
      const splashTargets = splashDamage > 0
        ? state.monsters.filter((item) => item.id !== monster?.id && distance(item, target) <= move.blastRadius)
        : []
      const splashIds = new Set(splashTargets.map((item) => item.id))
      const damagedMonsters = state.monsters.map((item) =>
        item.id === monster?.id ? { ...item, hp: remainingHp, alert: 3, facing: facingToward(item, state.player) }
          : splashIds.has(item.id) ? { ...item, hp: Math.max(0, item.hp - splashDamage), alert: 3 }
            : item,
      )
      const damagedAgents = state.agents.map((item) => item.id === agent?.id
        ? { ...item, hp: remainingHp, hostility: 5, fear: 0, autoAggro: true, facing: facingToward(item, state.player) }
        : item)
      const exertion = addFatigue(
        state,
        state.player.stamina - move.staminaCost,
        COMBAT_STEP_MULTIPLIER * (move.size === 'large' ? 2 : 1),
      )
      if (remainingHp <= 0) {
        if (agent) {
          const loot = resolveAgentLoot(state, agent, `battle-${state.battle.round}`)
          const maxStamina = Math.min(MAX_STAMINA_CAP, state.player.maxStamina + 1)
          const lootText = `${loot.gold} 金${loot.berries ? `、${loot.berries} 果` : ''}${loot.equipment ? `和装备「${loot.equipment.name}」` : ''}`
          return {
            ...state,
            battle: null,
            agents: damagedAgents.filter((item) => item.id !== agent.id),
            monsters: damagedMonsters.filter((item) => item.hp > 0),
            camps: clearAgentFromCampOffices(state.camps, agent.id),
            equipment: loot.equipment ? [...state.equipment, loot.equipment] : state.equipment,
            player: {
              ...state.player,
              stamina: exertion.stamina,
              maxStamina,
              gold: state.player.gold + loot.gold,
              berries: state.player.berries + loot.berries,
            },
            fatigue: exertion.fatigue,
            combatWins: state.combatWins + 1,
            chronicle: log(state, `${move.name}${roll.critical ? '触发暴击，' : ''}造成 ${damage} 点伤害，击败${agent.name}。获得 ${lootText}，体力上限提升到 ${maxStamina}。`, 'good'),
          }
        }
        const maxStamina = Math.min(MAX_STAMINA_CAP, state.player.maxStamina + 1)
        return {
          ...state,
          battle: null,
          monsters: damagedMonsters.filter((item) => item.hp > 0 && item.id !== monster!.id),
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
            `${move.name}${roll.critical ? '触发暴击，' : ''}造成 ${damage} 点伤害，击退${targetName}${splashTargets.length ? `，并波及 ${splashTargets.length} 个邻近目标` : ''}。获得 2 金，体力上限提升到 ${maxStamina}。`,
            'good',
          ),
        }
      }
      const rawHit = hashString(`${state.gameId}:counter:${state.day}:${target.id}:${state.battle.round}`) % 2
      const blockRoll = hashString(`${state.gameId}:block:${state.day}:${target.id}:${state.battle.round}`) % 100
      const blocked = rawHit > 0 && blockRoll < Math.min(90, equipmentDefense(state.equipment) * 20 + bonuses.guardChance)
      const hit = blocked ? 0 : rawHit
      const stamina = Math.max(0, exertion.stamina - hit)
      return {
        ...state,
        battle: stamina <= 0
          ? null
          : {
              ...state.battle,
              round: state.battle.round + 1,
              lastMoveId: move.id,
              lastDamage: damage,
              lastHit: roll.hit,
              lastCritical: roll.critical,
            },
        monsters: damagedMonsters.filter((item) => item.hp > 0),
        agents: damagedAgents,
        player: { ...state.player, stamina },
        fatigue: exertion.fatigue,
        chronicle: log(
          state,
          `${move.name}${roll.hit ? `${roll.critical ? '暴击，' : ''}造成 ${damage} 点伤害${splashTargets.length ? `并波及 ${splashTargets.length} 个目标` : ''}` : '未命中'}；${blocked ? '旅衣挡下反击' : hit ? `${targetName}反击造成 1 点体力损失` : `${targetName}反击落空`}。`,
          hit || !roll.hit ? 'danger' : 'plain',
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
      const factionPursuit = state.factions.find((faction) => faction.id === target.factionId)?.autoAggro ?? false
      if ((target.hostility ?? 0) > 0 || target.autoAggro || factionPursuit) {
        const hostileAgents = state.agents.map((agent) => agent.id === target.id
          ? { ...agent, affection: Math.max(0, agent.affection - 1), fear: 0, facing: facingToward(agent, state.player) }
          : agent)
        const hostileState: GameState = {
          ...state,
          agents: hostileAgents,
          factions: state.factions.map((faction) => faction.id === target.factionId
            ? { ...faction, relation: Math.max(-100, faction.relation - 2) }
            : faction),
          player: { ...state.player, stamina: exertion.stamina, facing: facingToward(state.player, target) },
          fatigue: exertion.fatigue,
          chronicle: log(state, `${target.name}戒备地说：“收起武器。这里没人相信一个红名者。”`, 'danger'),
        }
        const counterChance = target.hp > 0 && target.skillLevel >= 2
          ? 3 + target.skillLevel * 3 + (target.skill === 'duelist' || target.skill === 'guard' ? 5 : 0)
          : 0
        if (hashString(`${state.gameId}:hostile-talk:${state.turn}:${target.id}`) % 100 < counterChance) {
          return beginAgentBattle(hostileState, hostileAgents.find((agent) => agent.id === target.id)!, `${target.name}拒绝交谈，并直接拔出武器！`)
        }
        return hostileState
      }
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
        housing: 3,
        defense: 1,
        economy: 1,
        food: 2,
        morale: 3,
        controlRadius: 3,
        buildings: [],
        offices: {},
      }
      const tiles = state.world.tiles.map((item, itemIndex) =>
        itemIndex === index ? { ...item, structure: 'camp' as const, campId: camp.id, road: true } : item,
      )
      const camps = [...state.camps, camp]
      const next = {
        ...state,
        world: connectCampRoads({ ...state.world, tiles }, camps, camp),
        camps,
        residents: [...state.residents, ...createFoundingResidents(state, camp)],
        player: { ...state.player, gold: state.player.gold - 8 },
        chronicle: log(
          state,
          camps.length > 1 ? '新营地落成，两名开拓居民入住，并与同场景营地接通道路。' : '木桩落地，旗帜升起。两名开拓居民入住，营地周围成为可建设的控制范围。',
          'good',
        ),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'ASSIGN_CAMP_OFFICE': {
      const follower = state.agents.find((agent) => agent.id === action.agentId && agent.role === 'follower')
      const tile = state.world.tiles[tileIndex(state.world, state.player.x, state.player.y)]
      if (!follower) return { ...state, chronicle: log(state, '该精英已不在随行队伍中。', 'danger') }
      if (tile.structure !== 'camp' || tile.campId !== action.campId) {
        return { ...state, chronicle: log(state, '必须站在对应营地核心才能任命官员。', 'danger') }
      }
      const camp = state.camps.find((item) => item.id === action.campId)
      if (!camp) return state
      const definition = campOfficeDefinitions[action.office]
      if (!definition.unlocked(camp)) {
        return { ...state, chronicle: log(state, `${definition.name}职位尚未由对应建筑解锁。`, 'danger') }
      }
      if (camp.offices[action.office]) {
        return { ...state, chronicle: log(state, `${definition.name}已有任职者，请先召回。`, 'danger') }
      }
      if (campPopulation(state, camp.id) >= camp.housing) {
        return { ...state, chronicle: log(state, `${camp.name}没有空余床位，请先修建旅人居所。`, 'danger') }
      }
      const official = { ...follower, role: 'villager' as const, x: camp.x, y: camp.y, homeCampId: camp.id }
      const text = `${follower.name} 被任命为${camp.name}的${definition.name}，专长开始影响聚落治理。`
      const eventId = state.settlementEvents.reduce((maximum, event) => Math.max(maximum, event.id), 0) + 1
      const next = {
        ...state,
        agents: state.agents.filter((agent) => agent.id !== follower.id),
        camps: state.camps.map((item) =>
          item.id === camp.id ? { ...item, offices: { ...item.offices, [action.office]: official } } : item,
        ),
        settlementEvents: [{ id: eventId, campId: camp.id, day: state.day, kind: 'office' as const, residentIds: [follower.id], text }, ...state.settlementEvents].slice(0, 120),
        chronicle: log(state, text, 'good'),
      }
      return { ...next, fog: revealFog(next) }
    }
    case 'RECALL_CAMP_OFFICIAL': {
      const tile = state.world.tiles[tileIndex(state.world, state.player.x, state.player.y)]
      if (tile.structure !== 'camp' || tile.campId !== action.campId) {
        return { ...state, chronicle: log(state, '必须站在对应营地核心才能召回官员。', 'danger') }
      }
      const camp = state.camps.find((item) => item.id === action.campId)
      const official = camp?.offices[action.office]
      if (!camp || !official) return { ...state, chronicle: log(state, '该职位目前无人任职。') }
      const definition = campOfficeDefinitions[action.office]
      const follower: Agent = { ...official, role: 'follower', x: state.player.x, y: state.player.y, homeCampId: undefined }
      const offices = { ...camp.offices }
      delete offices[action.office]
      const text = `${official.name} 卸任${camp.name}的${definition.name}，重新加入随行队伍。`
      const eventId = state.settlementEvents.reduce((maximum, event) => Math.max(maximum, event.id), 0) + 1
      return {
        ...state,
        agents: [...state.agents, follower],
        camps: state.camps.map((item) => item.id === camp.id ? { ...item, offices } : item),
        settlementEvents: [{ id: eventId, campId: camp.id, day: state.day, kind: 'office' as const, residentIds: [official.id], text }, ...state.settlementEvents].slice(0, 120),
        chronicle: log(state, text, 'good'),
      }
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
        turn: state.turn + 1,
        chronicle: log(
          state,
          `你沿古老交通线抵达${generated.world.sceneName} [${targetX}, ${targetY}]。场景由总种子继续展开。`,
          'good',
        ),
      }
      const advanced = advanceCalendarDays(next, 1)
      return { ...advanced, fog: revealFog(advanced) }
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
