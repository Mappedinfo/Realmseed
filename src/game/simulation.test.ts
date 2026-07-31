import { describe, expect, it } from 'vitest'
import { berryExchangeRate, gameReducer } from './simulation'
import { combatMove, resolveCombatRoll } from './combat'
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
    expect(engaged.battle?.monsterId).toBe('training-slime')
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
    const unlocked = gameReducer(state, { type: 'SET_FIELD_COMBAT_ALWAYS_ON', enabled: false })
    const preferred = gameReducer(unlocked, { type: 'SET_COMBAT_PREFERENCE', mode: 'duel' })
    preferred.monsters = [{ id: 'mode-slime', species: 'slime', hp: 8, x: 21, y: 20 }]
    const engaged = gameReducer(preferred, { type: 'MOVE', direction: 'right' })
    expect(engaged.combatPreference).toBe('duel')
    expect(engaged.battle?.mode).toBe('duel')

    const overridden = gameReducer(engaged, { type: 'SET_BATTLE_MODE', mode: 'field' })
    expect(overridden.combatPreference).toBe('duel')
    expect(overridden.battle?.mode).toBe('field')
  })

  it('keeps field combat locked when the persistent always-on switch is enabled', () => {
    const state = flatState('field-lock-check')
    state.monsters = [{ id: 'locked-slime', species: 'slime', hp: 8, x: 21, y: 20 }]
    const engaged = gameReducer(state, { type: 'MOVE', direction: 'right' })
    expect(engaged.fieldCombatAlwaysOn).toBe(true)
    expect(engaged.battle?.mode).toBe('field')
    const rejected = gameReducer(engaged, { type: 'SET_BATTLE_MODE', mode: 'duel' })
    expect(rejected.battle?.mode).toBe('field')
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
    expect((state.monsters[0]?.alert ?? 0) > 0 || state.battle?.monsterId === 'watcher').toBe(true)
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
  })
})
