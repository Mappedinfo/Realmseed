import { describe, expect, it } from 'vitest'
import { berryExchangeRate, gameReducer } from './simulation'
import { combatMove, createNpcLoadout, resolveCombatRoll } from './combat'
import { hashString } from './rng'
import { facilityEventKind } from './facilities'
import { createGame, isPassable, revealFog } from './world'

function passableDirection(state: ReturnType<typeof createGame>) {
  const directions = [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ] as const
  return directions.find(([, dx, dy]) => isPassable(state.world, state.player.x + dx, state.player.y + dy))!
}

function flatState(seed: string) {
  const state = createGame(seed, 'small')
  state.world.tiles = state.world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0, food: 0 }))
  state.player.x = 20
  state.player.y = 20
  state.monsters = []
  return state
}

describe('game simulation', () => {
  it('spends exactly one stamina after 100 ordinary steps', () => {
    let state = flatState('move-check')
    const initialStamina = state.player.stamina
    for (let step = 0; step < 99; step += 1) {
      state = gameReducer(state, { type: 'MOVE', direction: step % 2 === 0 ? 'right' : 'left' })
    }
    expect(state.player.stamina).toBe(initialStamina)
    expect(state.fatigue).toBe(99)

    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.player.stamina).toBe(initialStamina - 1)
    expect(state.fatigue).toBe(0)
  })

  it('advances one calendar day after ten successful tiles while AI uses independent turns', () => {
    let state = flatState('calendar-check')
    const initialDay = state.day
    for (let step = 0; step < 9; step += 1) {
      state = gameReducer(state, { type: 'MOVE', direction: step % 2 === 0 ? 'right' : 'left' })
    }
    expect(state.day).toBe(initialDay)
    expect(state.dayProgress).toBe(9)
    expect(state.turn).toBe(9)
    state = gameReducer(state, { type: 'MOVE', direction: 'left' })
    expect(state.day).toBe(initialDay + 1)
    expect(state.dayProgress).toBe(0)
    expect(state.turn).toBe(10)
  })

  it('does not advance travel time for blocked movement or entering an occupied monster tile', () => {
    let state = flatState('calendar-block-check')
    const targetIndex = state.player.y * state.world.size + state.player.x + 1
    state.world.tiles[targetIndex].terrain = 'water'
    const blocked = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(blocked.dayProgress).toBe(0)
    expect(blocked.turn).toBe(0)
    state.world.tiles[targetIndex].terrain = 'meadow'
    state.monsters = [{ id: 'clock-monster', species: 'slime', hp: 8, x: state.player.x + 1, y: state.player.y }]
    const encounter = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(encounter.dayProgress).toBe(0)
    expect(encounter.player.x).toBe(state.player.x)
  })

  it('rest advances one day but preserves partial movement progress', () => {
    let state = flatState('calendar-rest-check')
    for (let step = 0; step < 4; step += 1) {
      state = gameReducer(state, { type: 'MOVE', direction: step % 2 === 0 ? 'right' : 'left' })
    }
    const day = state.day
    state = gameReducer(state, { type: 'REST' })
    expect(state.day).toBe(day + 1)
    expect(state.dayProgress).toBe(4)
  })

  it('starts an encounter at 1.5x fatigue and raises max stamina after victory', () => {
    const state = flatState('combat-win-check')
    state.monsters = [{ id: 'training-slime', species: 'slime', hp: 1, x: 21, y: 20 }]
    const engaged = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(engaged.fatigue).toBe(1.5)
    expect(engaged.battle?.targetId).toBe('training-slime')
    expect(engaged.battle?.targetKind).toBe('monster')
    expect(engaged.player.x).toBe(20)

    const victory = gameReducer(engaged, { type: 'COMBAT_ACTION', moveId: 'quick-strike' })
    expect(victory.combatWins).toBe(1)
    expect(victory.player.maxStamina).toBe(state.player.maxStamina + 1)
    expect(victory.monsters).toHaveLength(0)
    expect(victory.battle).toBeNull()
  })

  it('deducts only zero or one stamina when the monster counters', () => {
    const state = flatState('combat-hit-check')
    state.monsters = [{ id: 'strong-boar', species: 'boar', hp: 20, x: 21, y: 20 }]
    const engaged = gameReducer(state, { type: 'MOVE', direction: 'right' })
    const next = gameReducer(engaged, { type: 'COMBAT_ACTION', moveId: 'quick-strike' })
    expect([0, 1]).toContain(engaged.player.stamina - next.player.stamina)
    expect(next.battle?.round).toBe(2)
  })

  it('keeps a persistent default combat mode and permits a temporary encounter override', () => {
    const state = flatState('combat-mode-check')
    const preferred = gameReducer(state, { type: 'SET_COMBAT_PREFERENCE', mode: 'duel' })
    preferred.monsters = [{ id: 'mode-slime', species: 'slime', hp: 8, x: 21, y: 20 }]
    const engaged = gameReducer(preferred, { type: 'MOVE', direction: 'right' })
    expect(engaged.combatPreference).toBe('duel')
    expect(engaged.battle?.mode).toBe('duel')

    const overridden = gameReducer(engaged, { type: 'SET_BATTLE_MODE', mode: 'field' })
    expect(overridden.combatPreference).toBe('duel')
    expect(overridden.battle?.mode).toBe('field')
  })

  it('uses red-name mode to select a blocking monster without opening battle', () => {
    let state = flatState('red-name-map-check')
    state = gameReducer(state, { type: 'SET_RED_NAME_MODE', enabled: true })
    state.monsters = [{ id: 'map-slime', species: 'slime', hp: 20, x: 21, y: 20 }]
    const selected = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(selected.redNameMode).toBe(true)
    expect(selected.battle).toBeNull()
    expect(selected.selected).toEqual({ x: 21, y: 20 })
    let probe = 0
    while (!resolveCombatRoll(selected.gameId, 'map-slime', 1, combatMove('quick-strike')).hit) {
      selected.gameId = `red-map-hit-${probe++}`
    }
    const attacked = gameReducer(selected, { type: 'RED_NAME_ATTACK', position: { x: 21, y: 20 }, moveId: 'quick-strike' })
    expect(attacked.battle).toBeNull()
    expect(attacked.monsters[0].hp).toBeLessThan(20)
    expect(attacked.lastMapAttack?.targetName).toBe('苔泥团')
  })

  it('enforces map-attack range and protects the player faction', () => {
    const state = flatState('red-range-and-faction-check')
    state.redNameMode = true
    state.player.factionId = 'moss'
    state.agents = [{ ...state.agents[0], id: 'allied-scout', factionId: 'moss', x: 21, y: 20, stamina: 20, maxStamina: 20 }]
    const allied = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 21, y: 20 }, moveId: 'quick-strike' })
    expect(allied.agents[0].stamina).toBe(20)
    expect(allied.chronicle[0].text).toContain('同阵营')

    state.player.factionId = 'free'
    state.agents[0].x = 27
    const distant = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 27, y: 20 }, moveId: 'arrow-shot' })
    expect(distant.agents[0].stamina).toBe(20)
    expect(distant.chronicle[0].text).toContain('射程 1–5 格')
  })

  it('makes NPC witnesses hostile and inclined to flee after a map attack', () => {
    let state = flatState('red-witness-check')
    state.redNameMode = true
    state.monsters = [{ id: 'witness-target', species: 'slime', hp: 30, x: 21, y: 20 }]
    state.agents = [
      { ...state.agents[0], id: 'near-witness', x: 22, y: 20, hostility: 0, fear: 0 },
      { ...state.agents[1], id: 'far-witness', x: 35, y: 35, hostility: 0, fear: 0 },
    ]
    let probe = 0
    while (!resolveCombatRoll(state.gameId, 'witness-target', 1, combatMove('quick-strike')).hit) state.gameId = `witness-hit-${probe++}`
    const beforeDistance = Math.abs(state.agents[0].x - state.player.x) + Math.abs(state.agents[0].y - state.player.y)
    const attacked = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 21, y: 20 }, moveId: 'quick-strike' })
    const witness = attacked.agents.find((agent) => agent.id === 'near-witness')!
    expect(witness.hostility).toBeGreaterThan(0)
    expect(witness.fear).toBeGreaterThan(0)
    expect(Math.abs(witness.x - attacked.player.x) + Math.abs(witness.y - attacked.player.y)).toBeGreaterThanOrEqual(beforeDistance)
    expect(attacked.agents.find((agent) => agent.id === 'far-witness')?.hostility).toBe(0)
  })

  it('turns witnessed dialogue hostile instead of increasing affection', () => {
    const state = flatState('hostile-talk-check')
    state.agents = [{ ...state.agents[0], id: 'hostile-neighbor', x: 21, y: 20, affection: 2, hostility: 3, fear: 0, skillLevel: 1 }]
    const next = gameReducer(state, { type: 'TALK', agentId: 'hostile-neighbor' })
    expect(next.agents[0].affection).toBe(1)
    expect(next.chronicle[0].text).toContain('红名者')
  })

  it('can hurt but not kill an NPC on the map before its automatic counterattack opens battle', () => {
    const state = flatState('red-overlap-agent-check')
    state.redNameMode = true
    state.agents = [{ ...state.agents[0], id: 'overlap-agent', x: 20, y: 20, hp: 20, maxHp: 20, skillLevel: 1 }]
    let probe = 0
    while (!resolveCombatRoll(state.gameId, 'overlap-agent', 1, combatMove('quick-strike')).hit) state.gameId = `overlap-hit-${probe++}`
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 20, y: 20 }, moveId: 'quick-strike' })
    expect(next.battle).toMatchObject({ targetId: 'overlap-agent', targetKind: 'agent' })
    expect(next.agents[0].hp).toBeLessThan(20)
    expect(next.agents[0].hostility).toBe(5)
    expect(next.agents[0].autoAggro).toBe(true)
    expect(next.factions.find((faction) => faction.id === next.agents[0].factionId)?.autoAggro).toBe(true)
  })

  it('turns a direct NPC attack into faction pursuit even when the strike misses', () => {
    const state = flatState('faction-pursuit-miss')
    state.redNameMode = true
    state.agents = [{ ...state.agents[0], id: 'distant-target', factionId: 'moss', x: 23, y: 20, stamina: 20, maxStamina: 20 }]
    let probe = 0
    while (resolveCombatRoll(state.gameId, 'distant-target', 1, combatMove('arrow-shot')).hit) state.gameId = `pursuit-miss-${probe++}`
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 23, y: 20 }, moveId: 'arrow-shot' })
    expect(next.lastMapAttack?.hit).toBe(false)
    expect(next.agents[0].autoAggro).toBe(true)
    expect(next.factions.find((faction) => faction.id === 'moss')?.autoAggro).toBe(true)
    expect(next.chronicle.some((entry) => entry.text.includes('持续追缉'))).toBe(true)
  })

  it('defeats an NPC using independent health and drops deterministic gold, food and equipment', () => {
    const state = flatState('npc-loot-check')
    const target = {
      ...state.agents[0],
      id: 'loot-elite',
      x: 21,
      y: 20,
      hp: 1,
      maxHp: 20,
      stamina: 7,
      maxStamina: 7,
      gold: 7,
      berries: 9,
      skill: 'duelist' as const,
      skillLevel: 3 as const,
      loadout: createNpcLoadout('loot-elite', 'duelist', 3),
    }
    state.agents = [target]
    state.battle = { targetId: target.id, targetKind: 'agent', mode: 'field', round: 1, targetMaxHp: target.maxHp }
    let probe = 0
    while (
      !resolveCombatRoll(state.gameId, target.id, 1, combatMove('quick-strike')).hit ||
      hashString(`${state.gameId}:agent-gear-drop:${target.id}:${target.loadout[0].id}:battle-1`) % 100 >= 65
    ) state.gameId = `npc-loot-${probe++}`
    const equipmentBefore = state.equipment.length
    const staminaBefore = state.player.maxStamina
    const next = gameReducer(state, { type: 'COMBAT_ACTION', moveId: 'quick-strike' })
    expect(next.agents).toHaveLength(0)
    expect(next.player.gold).toBe(state.player.gold + 7)
    expect(next.player.berries).toBeGreaterThan(state.player.berries)
    expect(next.equipment.length).toBeGreaterThan(equipmentBefore)
    expect(next.equipment.slice(equipmentBefore).every((item) => target.loadout.some((worn) => worn.id === item.id))).toBe(true)
    expect(next.equipment.some((item) => item.id === target.loadout[0].id && !item.equipped)).toBe(true)
    expect(next.player.maxStamina).toBe(staminaBefore + 1)
    expect(next.combatWins).toBe(state.combatWins + 1)
    expect(next.chronicle[0].text).toContain('击败')
  })

  it('can defeat and loot an NPC directly from the red-name map attack', () => {
    const state = flatState('npc-map-loot-check')
    state.redNameMode = true
    const target = { ...state.agents[0], id: 'map-loot-agent', x: 20, y: 20, hp: 1, maxHp: 12, gold: 6, berries: 4, skillLevel: 3 as const }
    state.agents = [target]
    let probe = 0
    while (!resolveCombatRoll(state.gameId, target.id, 1, combatMove('quick-strike')).hit) state.gameId = `npc-map-loot-${probe++}`
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 20, y: 20 }, moveId: 'quick-strike' })
    expect(next.agents).toHaveLength(0)
    expect(next.battle).toBeNull()
    expect(next.player.gold).toBe(state.player.gold + 6)
    expect(next.combatWins).toBe(state.combatWins + 1)
    expect(next.chronicle[0].text).toContain('击败 1 名 NPC')
  })

  it('makes another member of the provoked faction chase and automatically open battle', () => {
    const state = flatState('faction-pursuit-chase')
    state.redNameMode = true
    state.agents = [
      { ...state.agents[0], id: 'faction-target', factionId: 'moss', x: 24, y: 20, stamina: 20, maxStamina: 20 },
      { ...state.agents[1], id: 'faction-guard', factionId: 'moss', x: 22, y: 20, stamina: 20, maxStamina: 20, skill: 'scout', skillLevel: 3, loadout: createNpcLoadout('faction-guard', 'scout', 3) },
      { ...state.agents[2], id: 'unrelated', factionId: 'tide', x: 30, y: 20, stamina: 20, maxStamina: 20 },
    ]
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 24, y: 20 }, moveId: 'arrow-shot' })
    expect(next.battle).toMatchObject({ targetId: 'faction-guard', targetKind: 'agent' })
    expect(next.agents.find((agent) => agent.id === 'faction-guard')).toMatchObject({ x: 22, hostility: 5 })
    expect(next.battle?.lastEnemyMoveId).toBe('rifle-shot')
    expect([0, 1]).toContain(state.player.stamina - next.player.stamina)
    expect(next.factions.find((faction) => faction.id === 'tide')?.autoAggro).toBe(false)
  })

  it('holds ranged pursuers at weapon range while melee pursuers must close distance', () => {
    const ranged = flatState('ranged-pursuer')
    ranged.agents = [{
      ...ranged.agents[0], id: 'ranged-pursuer', x: 25, y: 20, autoAggro: true,
      skill: 'scout', skillLevel: 3, loadout: createNpcLoadout('ranged-pursuer', 'scout', 3),
    }]
    const rangedTurn = gameReducer(ranged, { type: 'REST' })
    expect(rangedTurn.agents[0].x).toBe(25)
    expect(rangedTurn.battle).toMatchObject({ targetId: 'ranged-pursuer', lastEnemyMoveId: 'rifle-shot' })
    expect([0, 1]).toContain(ranged.player.stamina - rangedTurn.player.stamina)

    let melee = flatState('melee-pursuer')
    melee.agents = [{
      ...melee.agents[0], id: 'melee-pursuer', x: 23, y: 20, autoAggro: true,
      skill: 'duelist', skillLevel: 1, loadout: createNpcLoadout('melee-pursuer', 'duelist', 1),
    }]
    melee = gameReducer(melee, { type: 'REST' })
    expect(melee.battle).toBeNull()
    expect(melee.agents[0].x).toBe(22)
    melee = gameReducer(melee, { type: 'REST' })
    expect(melee.agents[0].x).toBe(21)
    expect(melee.battle?.targetId).toBe('melee-pursuer')
  })

  it('does not let a neutral armed NPC attack until personal or faction pursuit is active', () => {
    const state = flatState('neutral-armed-npc')
    state.agents = [{
      ...state.agents[0], id: 'neutral-rifle', x: 25, y: 20,
      autoAggro: false, hostility: 0, fear: 0,
      skill: 'scout', skillLevel: 3, loadout: createNpcLoadout('neutral-rifle', 'scout', 3),
    }]
    const next = gameReducer(state, { type: 'REST' })
    expect(next.battle).toBeNull()
  })

  it('applies NPC armor to both encounter damage and map damage with a one-damage floor', () => {
    const base = flatState('npc-armor-mitigation')
    const weapon = createNpcLoadout('armored-target', 'guard', 1)[0]
    const armor = { id: 'test-armor', name: '测试重甲', slot: 'armor' as const, power: 0, defense: 2, equipped: true, description: '伤害 -2' }
    const target = { ...base.agents[0], id: 'armored-target', x: 21, y: 20, hp: 20, maxHp: 20, loadout: [weapon, armor] }
    base.agents = [target]
    base.battle = { targetId: target.id, targetKind: 'agent', mode: 'field', round: 1, targetMaxHp: 20 }
    let probe = 0
    while (!resolveCombatRoll(base.gameId, target.id, 1, combatMove('quick-strike')).hit) base.gameId = `npc-armor-${probe++}`
    const encounter = gameReducer(base, { type: 'COMBAT_ACTION', moveId: 'quick-strike' })
    expect(encounter.agents[0].hp).toBe(19)

    const mapState = { ...base, redNameMode: true, battle: null, agents: [target] }
    const mapAttack = gameReducer(mapState, { type: 'RED_NAME_ATTACK', position: { x: 21, y: 20 }, moveId: 'quick-strike' })
    expect(mapAttack.agents[0].hp).toBe(19)
  })

  it('requires exactly 100 gold to clear pursuit for the faction and cached members', () => {
    const state = flatState('faction-ransom')
    const target = { ...state.agents[0], id: 'ransom-agent', factionId: 'ember', x: 21, y: 20, autoAggro: true, hostility: 5, fear: 0 }
    state.agents = [target]
    state.factions = state.factions.map((faction) => faction.id === 'ember'
      ? { ...faction, relation: -12, autoAggro: true }
      : faction)
    state.sceneCache['1,0'] = {
      world: state.world,
      fog: state.fog,
      agents: [{ ...target, id: 'cached-ember' }],
      monsters: [],
      camps: [],
    }
    state.player.gold = 99
    const rejected = gameReducer(state, { type: 'REPAIR_FACTION_AGGRO', factionId: 'ember', agentId: target.id })
    expect(rejected.player.gold).toBe(99)
    expect(rejected.factions.find((faction) => faction.id === 'ember')?.autoAggro).toBe(true)

    state.player.gold = 135
    const repaired = gameReducer(state, { type: 'REPAIR_FACTION_AGGRO', factionId: 'ember', agentId: target.id })
    expect(repaired.player.gold).toBe(35)
    expect(repaired.factions.find((faction) => faction.id === 'ember')).toMatchObject({ autoAggro: false, relation: 0 })
    expect(repaired.agents[0]).toMatchObject({ autoAggro: false, hostility: 0, fear: 0 })
    expect(repaired.sceneCache['1,0'].agents[0]).toMatchObject({ autoAggro: false, hostility: 0, fear: 0 })
    const peacefulTurn = gameReducer({ ...repaired, monsters: [] }, { type: 'REST' })
    expect(peacefulTurn.battle).toBeNull()
  })

  it('allows an attacked elite NPC to start a real battle at a low deterministic chance', () => {
    const state = flatState('elite-retaliation-check')
    state.redNameMode = true
    state.monsters = []
    state.agents = [{ ...state.agents[0], id: 'elite-guard', x: 21, y: 20, stamina: 50, maxStamina: 50, skill: 'duelist', skillLevel: 3, fear: 0 }]
    let probe = 0
    while (hashString(`${state.gameId}:red-retaliation:1:elite-guard`) % 100 >= 24) state.gameId = `elite-retaliation-${probe++}`
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position: { x: 21, y: 20 }, moveId: 'quick-strike' })
    expect(next.battle).toMatchObject({ targetId: 'elite-guard', targetKind: 'agent' })
    expect(next.agents[0].hostility).toBe(5)
  })

  it('damages and can destroy a neutral structure directly on the map', () => {
    const state = flatState('red-structure-check')
    state.redNameMode = true
    const position = { x: 21, y: 20 }
    const index = position.y * state.world.size + position.x
    state.world.tiles[index] = { terrain: 'meadow', coin: 0, food: 0, structure: 'village', structureHp: 2, structureMaxHp: 18 }
    let probe = 0
    while (!resolveCombatRoll(state.gameId, 'structure-21-20', 1, combatMove('heavy-cleave')).hit) state.gameId = `structure-hit-${probe++}`
    const next = gameReducer(state, { type: 'RED_NAME_ATTACK', position, moveId: 'heavy-cleave' })
    expect(next.battle).toBeNull()
    expect(next.world.tiles[index].structure).toBeUndefined()
    expect(next.chronicle[0].text).toContain('摧毁 1 座设施')
  })

  it('enforces melee and ranged attack bands from the target distance', () => {
    const state = flatState('combat-range-check')
    state.monsters = [{ id: 'range-boar', species: 'boar', hp: 50, x: 21, y: 20 }]
    const engaged = gameReducer(state, { type: 'MOVE', direction: 'right' })
    engaged.monsters[0].x = 25
    const rejected = gameReducer(engaged, { type: 'COMBAT_ACTION', moveId: 'quick-strike' })
    expect(rejected.battle?.round).toBe(1)
    expect(rejected.chronicle[0].text).toContain('射程 1–1 格')
    const ranged = gameReducer(engaged, { type: 'COMBAT_ACTION', moveId: 'arrow-shot' })
    expect(ranged.battle?.round).toBe(2)
  })

  it('applies deterministic bomb splash damage to monsters in the blast radius', () => {
    const state = flatState('combat-splash-check')
    state.monsters = [
      { id: 'bomb-target', species: 'boar', hp: 50, x: 21, y: 20 },
      { id: 'bomb-neighbor', species: 'slime', hp: 20, x: 21, y: 21 },
      { id: 'bomb-distant', species: 'wisp', hp: 20, x: 24, y: 20 },
    ]
    const engaged = gameReducer(state, { type: 'MOVE', direction: 'right' })
    let attempt = 0
    while (!resolveCombatRoll(engaged.gameId, 'bomb-target', 1, combatMove('field-bomb')).hit) {
      engaged.gameId = `combat-splash-hit-${attempt++}`
    }
    const resolved = gameReducer(engaged, { type: 'COMBAT_ACTION', moveId: 'field-bomb' })
    expect(resolved.monsters.find((monster) => monster.id === 'bomb-neighbor')?.hp).toBeLessThan(20)
    expect(resolved.monsters.find((monster) => monster.id === 'bomb-distant')?.hp).toBe(20)
  })

  it('turns adjacent conversation partners to face one another', () => {
    const state = flatState('facing-talk-check')
    const agent = state.agents[0]
    agent.x = 21
    agent.y = 20
    agent.facing = 'right'
    const next = gameReducer(state, { type: 'TALK', agentId: agent.id })
    expect(next.player.facing).toBe('right')
    expect(next.agents.find((item) => item.id === agent.id)?.facing).toBe('left')
  })

  it('allows dialogue with all eight surrounding tiles including diagonals', () => {
    const state = flatState('diagonal-talk-check')
    state.agents = [{
      ...state.agents[0],
      id: 'diagonal-neighbor',
      x: state.player.x - 1,
      y: state.player.y + 1,
      affection: 0,
    }]
    const next = gameReducer(state, { type: 'TALK', agentId: 'diagonal-neighbor' })
    expect(next.agents[0].affection).toBe(1)
    expect(next.chronicle[0].text).toContain(state.agents[0].name)
  })

  it('lets alerted monsters pursue slowly while changing facing', () => {
    let state = flatState('monster-chase-check')
    state.monsters = [{ id: 'hunter', species: 'boar', hp: 8, x: 26, y: 20, facing: 'up', alert: 3 }]
    const initialDistance = Math.abs(state.monsters[0].x - state.player.x)
    for (let turn = 0; turn < 10 && !state.battle; turn += 1) {
      state = gameReducer(state, { type: 'REST' })
    }
    const hunter = state.monsters.find((monster) => monster.id === 'hunter')
    expect(hunter).toBeDefined()
    expect(Math.abs(hunter!.x - state.player.x)).toBeLessThan(initialDistance)
    expect(['left', 'right', 'up', 'down']).toContain(hunter!.facing)
  })

  it('gives nearby monsters a probabilistic deterministic chance to notice the player', () => {
    let state = flatState('monster-notice-check')
    state.monsters = [{ id: 'watcher', species: 'wisp', hp: 8, x: 24, y: 20, facing: 'up', alert: 0 }]
    for (let turn = 0; turn < 12; turn += 1) {
      state = gameReducer(state, { type: 'REST' })
      if ((state.monsters[0]?.alert ?? 0) > 0 || state.battle) break
    }
    expect((state.monsters[0]?.alert ?? 0) > 0 || state.battle?.targetId === 'watcher').toBe(true)
  })

  it('toggles equipment bonuses without changing the character sprite contract', () => {
    const state = flatState('equipment-check')
    const knife = state.equipment.find((item) => item.id === 'field-knife')!
    expect(knife.equipped).toBe(true)
    const next = gameReducer(state, { type: 'TOGGLE_EQUIPMENT', itemId: knife.id })
    expect(next.equipment.find((item) => item.id === knife.id)?.equipped).toBe(false)
    expect(next.player.facing).toBe(state.player.facing)
  })

  it('automatically rests to three stamina when exhausted movement is attempted', () => {
    const state = flatState('auto-rest-check')
    state.player.stamina = 0
    state.fatigue = 72
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(next.player.stamina).toBe(3)
    expect(next.fatigue).toBe(0)
    expect(next.player.x).toBe(state.player.x)
    expect(next.chronicle[0].text).toContain('自动扎营')
  })

  it('puts gathered berries into inventory for manual use', () => {
    const state = flatState('food-check')
    state.player.stamina = 5
    const initialBerries = state.player.berries
    const index = state.player.y * state.world.size + state.player.x + 1
    state.world.tiles[index].food = 2
    const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(next.player.stamina).toBe(5)
    expect(next.player.berries).toBe(initialBerries + 2)
    expect(next.world.tiles[index].food).toBe(0)
    expect(next.chronicle[0].text).toContain('放入左侧物品栏')
  })

  it.each(['monster', 'coins', 'food', 'restoration', 'equipment', 'companion'] as const)(
    'resolves the seeded one-shot ruin outcome: %s',
    (expectedKind) => {
      const state = flatState(`ruin-${expectedKind}`)
      const target = { x: state.player.x + 1, y: state.player.y }
      const index = target.y * state.world.size + target.x
      state.world.tiles[index].structure = 'ruin'
      state.player.stamina = 4
      let probe = 0
      while (facilityEventKind(state, target) !== expectedKind) {
        probe += 1
        state.gameId = `ruin-probe-${expectedKind}-${probe}`
      }
      const before = {
        gold: state.player.gold,
        berries: state.player.berries,
        equipment: state.equipment.length,
        followers: state.agents.filter((agent) => agent.role === 'follower').length,
      }
      const next = gameReducer(state, { type: 'MOVE', direction: 'right' })
      expect(next.world.tiles[index].eventResolved).toBe(true)
      expect(next.facilityEvent?.kind).toBe(expectedKind)
      if (expectedKind === 'monster') expect(next.battle).not.toBeNull()
      if (expectedKind === 'coins') expect(next.player.gold).toBeGreaterThan(before.gold)
      if (expectedKind === 'food') expect(next.player.berries).toBeGreaterThan(before.berries)
      if (expectedKind === 'restoration') expect(next.player.stamina).toBe(next.player.maxStamina)
      if (expectedKind === 'equipment') expect(next.equipment).toHaveLength(before.equipment + 1)
      if (expectedKind === 'companion') {
        expect(next.agents.filter((agent) => agent.role === 'follower')).toHaveLength(before.followers + 1)
      }
    },
  )

  it('gives farm, house and shrine touch benefits with a 20-turn cooldown', () => {
    for (const kind of ['farm', 'house', 'shrine'] as const) {
      let state = flatState(`building-touch-${kind}`)
      state.player.stamina = 4
      const target = { x: state.player.x + 1, y: state.player.y }
      const index = target.y * state.world.size + target.x
      state.world.tiles[index] = {
        terrain: 'meadow',
        coin: 0,
        structure: 'camp-building',
        buildingKind: kind,
      }
      const first = gameReducer(state, { type: 'MOVE', direction: 'right' })
      expect(first.world.tiles[index].lastUsedDay).toBe(state.day)
      const afterFirst = { berries: first.player.berries, stamina: first.player.stamina }
      const away = gameReducer(first, { type: 'MOVE', direction: 'left' })
      const returned = gameReducer(away, { type: 'MOVE', direction: 'right' })
      expect(returned.player.berries).toBe(afterFirst.berries)
      expect(returned.player.stamina).toBe(afterFirst.stamina)
    }
  })

  it('selects an adjacent map element for inspection without moving onto it', () => {
    const state = flatState('inspect-before-move')
    const target = { x: state.player.x + 1, y: state.player.y }
    state.world.tiles[target.y * state.world.size + target.x].food = 3
    const next = gameReducer(state, { type: 'SELECT', position: target })
    expect(next.player.x).toBe(state.player.x)
    expect(next.selected).toEqual(target)
    expect(next.world.tiles[target.y * state.world.size + target.x].food).toBe(3)
  })

  it('eats one berry to restore one stamina', () => {
    const state = flatState('eat-berry-check')
    state.player.stamina = 5
    state.player.berries = 2
    const next = gameReducer(state, { type: 'EAT_BERRY' })
    expect(next.player.stamina).toBe(6)
    expect(next.player.berries).toBe(1)
  })

  it('trades berries with an adjacent agent at a deterministic 8–12 rate', () => {
    const state = flatState('berry-trade-check')
    const trader = state.agents[0]
    trader.x = 21
    trader.y = 20
    trader.berries = 30
    trader.gold = 3
    const rate = berryExchangeRate(state, trader.id)
    expect(rate).toBeGreaterThanOrEqual(8)
    expect(rate).toBeLessThanOrEqual(12)
    expect(berryExchangeRate(state, trader.id)).toBe(rate)

    const bought = gameReducer(state, { type: 'TRADE_BERRIES', agentId: trader.id, direction: 'buy' })
    expect(bought.player.gold).toBe(state.player.gold - 1)
    expect(bought.player.berries).toBe(state.player.berries + rate)
    expect(bought.agents[0].berries).toBe(30 - rate)

    bought.player.berries = rate
    const sold = gameReducer(bought, { type: 'TRADE_BERRIES', agentId: trader.id, direction: 'sell' })
    expect(sold.player.gold).toBe(bought.player.gold + 1)
    expect(sold.player.berries).toBe(0)
  })

  it('applies trader follower leverage differently to buying and selling', () => {
    const state = flatState('trader-rate-check')
    state.agents[0].role = 'follower'
    state.agents[0].skill = 'trader'
    state.agents[0].skillLevel = 3
    const targetId = state.agents[1].id
    const base = berryExchangeRate({ gameId: state.gameId, day: state.day }, targetId)
    expect(berryExchangeRate(state, targetId, 'buy')).toBe(base + 2)
    expect(berryExchangeRate(state, targetId, 'sell')).toBe(Math.max(6, base - 2))
  })

  it('resolves a nearby traveler skill challenge into permanent mastery and trust', () => {
    const state = flatState('traveler-challenge-check')
    const target = state.agents[0]
    state.agents = [target]
    target.x = state.player.x + 1
    target.y = state.player.y
    target.skill = 'duelist'
    target.skillLevel = 1
    state.challengeMarks.duelist = 100
    while (hashString(`${state.gameId}:challenge:${state.day}:${target.id}`) % 100 >= 85) state.day += 1
    const beforeGold = state.player.gold
    const beforeStamina = state.player.stamina
    const next = gameReducer(state, { type: 'CHALLENGE_AGENT', agentId: target.id })
    expect(next.agents[0].challengeWon).toBe(true)
    expect(next.agents[0].affection).toBe(2)
    expect(next.challengeMarks.duelist).toBe(101)
    expect(next.player.gold).toBe(beforeGold + 1)
    expect(next.player.stamina).toBe(beforeStamina - 1)
    expect(next.factions.find((faction) => faction.id === target.factionId)?.relation).toBe(8)
  })

  it('rest restores stamina', () => {
    const state = createGame('rest-check', 'small')
    state.player.stamina = 1
    const next = gameReducer(state, { type: 'REST' })
    expect(next.player.stamina).toBe(next.player.maxStamina)
  })

  it('manual rest at zero recovers to three instead of skipping exhaustion', () => {
    const state = createGame('zero-rest-check', 'small')
    state.player.stamina = 0
    const next = gameReducer(state, { type: 'REST' })
    expect(next.player.stamina).toBe(3)
  })

  it('can found a camp when the tile is empty and gold is sufficient', () => {
    const state = createGame('camp-check', 'small')
    state.player.gold = 20
    const index = state.player.y * state.world.size + state.player.x
    state.world.tiles[index].structure = undefined
    const next = gameReducer(state, { type: 'FOUND_CAMP' })
    expect(next.world.tiles[index].structure).toBe('camp')
    expect(next.player.gold).toBe(12)
    expect(next.residents.filter((resident) => resident.campId === next.camps[0].id)).toHaveLength(2)
    expect(new Set(next.residents.map((resident) => resident.sex))).toEqual(new Set(['female', 'male']))
  })

  it('keeps the full camp control range permanently visible after the player leaves', () => {
    let state = flatState('camp-vision-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    const camp = state.camps[0]
    state.player = { ...state.player, x: camp.x + 10, y: camp.y + 10 }
    const fog = revealFog(state)
    for (let dy = -camp.controlRadius; dy <= camp.controlRadius; dy += 1) {
      for (let dx = -camp.controlRadius; dx <= camp.controlRadius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > camp.controlRadius) continue
        expect(fog[(camp.y + dy) * state.world.size + camp.x + dx]).toBe(2)
      }
    }
  })

  it('keeps recruited followers in the party model instead of nearby interaction', () => {
    const state = flatState('hidden-party-check')
    state.agents = [{
      ...state.agents[0],
      role: 'follower',
      x: state.player.x + 1,
      y: state.player.y,
      affection: 3,
    }]
    const next = gameReducer(state, { type: 'TALK', agentId: state.agents[0].id })
    expect(next.agents[0].affection).toBe(3)
    expect(next.chronicle[0].text).toContain('附近没有')
  })

  it('earns one camp building tile after every 100 successful steps', () => {
    let state = flatState('construction-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    for (let step = 0; step < 100; step += 1) {
      state = gameReducer(state, { type: 'MOVE', direction: step % 2 === 0 ? 'right' : 'left' })
    }
    expect(state.buildingCredits).toBe(1)
    expect(state.constructionSteps).toBe(0)
  })

  it('builds only inside camp control and applies building attributes', () => {
    let state = flatState('camp-building-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    state.buildingCredits = 1
    state.selected = { x: state.player.x + 1, y: state.player.y }
    const built = gameReducer(state, { type: 'BUILD_CAMP_TILE', kind: 'watchtower' })
    const tile = built.world.tiles[built.player.y * built.world.size + built.player.x + 1]
    expect(tile.structure).toBe('camp-building')
    expect(tile.buildingKind).toBe('watchtower')
    expect(built.camps[0].defense).toBe(4)
    expect(built.camps[0].controlRadius).toBe(4)
    expect(built.buildingCredits).toBe(0)
    built.player = { ...built.player, x: built.player.x + 10, y: built.player.y + 10 }
    const expandedFog = revealFog(built)
    expect(expandedFog[built.camps[0].y * built.world.size + built.camps[0].x + 4]).toBe(2)
  })

  it('uses farms for food surplus and houses for stationing capacity', () => {
    let state = flatState('camp-operations-check')
    state.player.gold = 30
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    state.buildingCredits = 2
    state.selected = { x: state.player.x + 1, y: state.player.y }
    state = gameReducer(state, { type: 'BUILD_CAMP_TILE', kind: 'farm' })
    expect(state.camps[0].food).toBe(5)
    expect(state.camps[0].economy).toBe(2)
    expect(state.player.gold).toBe(20)

    state.selected = { x: state.player.x - 1, y: state.player.y }
    state = gameReducer(state, { type: 'BUILD_CAMP_TILE', kind: 'house' })
    expect(state.camps[0].housing).toBe(6)
    expect(state.camps[0].morale).toBe(4)

    const berries = state.player.berries
    const gold = state.player.gold
    state = gameReducer(state, { type: 'REST' })
    expect(state.player.gold).toBe(gold + 1)
    expect(state.player.berries).toBe(berries + 3)
  })

  it('assigns and recalls a follower through a local unlocked camp office', () => {
    let state = flatState('office-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    state.camps[0].housing = 8
    const follower = state.agents[0]
    follower.role = 'follower'
    follower.skill = 'trader'
    follower.skillLevel = 2
    const assigned = gameReducer(state, { type: 'ASSIGN_CAMP_OFFICE', campId: state.camps[0].id, agentId: follower.id, office: 'mayor' })
    expect(assigned.camps[0].offices.mayor?.id).toBe(follower.id)
    expect(assigned.agents.some((agent) => agent.id === follower.id)).toBe(false)
    expect(assigned.settlementEvents[0].kind).toBe('office')
    const recalled = gameReducer(assigned, { type: 'RECALL_CAMP_OFFICIAL', campId: state.camps[0].id, office: 'mayor' })
    expect(recalled.camps[0].offices.mayor).toBeUndefined()
    expect(recalled.agents.find((agent) => agent.id === follower.id)?.role).toBe('follower')
    expect(recalled.agents.find((agent) => agent.id === follower.id)?.loadout).toEqual(follower.loadout)
  })

  it('requires the corresponding facility before assigning specialist offices', () => {
    let state = flatState('office-lock-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    state.camps[0].housing = 8
    state.agents[0].role = 'follower'
    const blocked = gameReducer(state, { type: 'ASSIGN_CAMP_OFFICE', campId: state.camps[0].id, agentId: state.agents[0].id, office: 'guard-captain' })
    expect(blocked.camps[0].offices['guard-captain']).toBeUndefined()
    expect(blocked.chronicle[0].text).toContain('尚未')
  })

  it('connects two camps by road and auto-paths home with lower fatigue', () => {
    let state = flatState('camp-road-check')
    state.player.gold = 20
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    const homeId = state.camps[0].id
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    state = gameReducer(state, { type: 'MOVE', direction: 'right' })
    state = gameReducer(state, { type: 'FOUND_CAMP' })
    const middle = state.world.tiles[state.player.y * state.world.size + state.player.x - 1]
    expect(middle.road).toBe(true)
    state.fatigue = 0
    const returned = gameReducer(state, { type: 'RETURN_TO_CAMP', campId: homeId })
    expect(returned.player.x).toBe(returned.camps[0].x)
    expect(returned.player.y).toBe(returned.camps[0].y)
    expect(returned.fatigue).toBeCloseTo(0.7)
  })

  it('moves follower AI toward the player on each world turn', () => {
    const state = createGame('follower-ai-check', 'small')
    state.world.tiles = state.world.tiles.map((tile) => ({ ...tile, terrain: 'meadow' }))
    const follower = state.agents[0]
    follower.role = 'follower'
    follower.x = state.player.x + 4
    follower.y = state.player.y
    const before = Math.abs(follower.x - state.player.x)
    const next = gameReducer(state, { type: 'REST' })
    const moved = next.agents.find((agent) => agent.id === follower.id)!
    expect(Math.abs(moved.x - next.player.x)).toBe(before - 1)
  })

  it('supports faction oaths and breaking them with consequences', () => {
    const state = createGame('oath-check', 'small')
    state.factions[0].relation = 15
    const sworn = gameReducer(state, { type: 'PLEDGE_FACTION', factionId: state.factions[0].id })
    expect(sworn.player.factionId).toBe(state.factions[0].id)
    expect(sworn.factions[0].isOverlord).toBe(true)
    expect(sworn.player.gold).toBe(state.player.gold + 4)

    const free = gameReducer(sworn, { type: 'BREAK_OATH' })
    expect(free.player.factionId).toBe('free')
    expect(free.factions[0].isOverlord).toBe(false)
    expect(free.factions[0].relation).toBe(-5)
  })

  it('turns a trusted faction into a tribute-paying vassal', () => {
    const state = createGame('vassal-check', 'small')
    state.player.gold = 20
    state.factions[0].relation = 30
    state.agents[0].role = 'villager'
    const vassalized = gameReducer(state, { type: 'MAKE_VASSAL', factionId: state.factions[0].id })
    expect(vassalized.factions[0].isVassal).toBe(true)
    expect(vassalized.player.gold).toBe(10)

    const rested = gameReducer(vassalized, { type: 'REST' })
    expect(rested.player.gold).toBe(12)
    expect(rested.chronicle[0].text).toContain('附属贡金 2 金')
  })

  it('travels across infinite scenes and restores the previous scene state on return', () => {
    const state = createGame('scene-cache-check', 'small')
    const homeAgentId = state.agents[0].id
    const homeLoadout = state.agents[0].loadout
    const homeIndex = state.player.y * state.world.size + state.player.x
    state.world.tiles[homeIndex] = { ...state.world.tiles[homeIndex], structure: 'camp' }
    state.fog[homeIndex] = 2

    const east = gameReducer(state, { type: 'TRAVEL', direction: 'right' })
    expect(east.world.sceneX).toBe(1)
    expect(east.world.sceneY).toBe(0)
    expect(east.sceneCache['0,0'].world.tiles[homeIndex].structure).toBe('camp')
    expect(east.fatigue).toBe(25)

    const home = gameReducer(east, { type: 'TRAVEL', direction: 'left' })
    expect(home.world.sceneX).toBe(0)
    expect(home.world.sceneY).toBe(0)
    expect(home.world.tiles[homeIndex].structure).toBe('camp')
    expect(home.fog[homeIndex]).toBeGreaterThan(0)
    expect(home.agents.find((agent) => agent.id === homeAgentId)?.loadout).toEqual(homeLoadout)
  })
})
