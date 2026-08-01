import { describe, expect, it } from 'vitest'
import { effectiveCampStats } from './camps'
import { hashString } from './rng'
import { gameReducer } from './simulation'
import { advanceCalendarDays } from './settlements'
import { createGame } from './world'

function settlementState(seed: string) {
  let state = createGame(seed, 'small')
  state.world.tiles = state.world.tiles.map(() => ({ terrain: 'meadow' as const, coin: 0, food: 0 }))
  state.player.x = 20
  state.player.y = 20
  state.player.gold = 20
  state.resources.wood = 40
  state.resources.stone = 40
  state.monsters = []
  state = gameReducer(state, { type: 'FOUND_CAMP' })
  state.camps[0].housing = 12
  state.camps[0].food = 7
  return state
}

describe('settlement demographics', () => {
  it('produces deterministic resident and event histories for the same seed', () => {
    const left = advanceCalendarDays(settlementState('demographic-determinism'), 180)
    const right = advanceCalendarDays(settlementState('demographic-determinism'), 180)
    expect(left.residents).toEqual(right.residents)
    expect(left.settlementEvents).toEqual(right.settlementEvents)
  })

  it('turns a child into an adult after sixty days even when the camp is off-scene', () => {
    const state = settlementState('adulthood-check')
    const camp = state.camps[0]
    state.world.sceneX = 4
    state.world.sceneY = 4
    state.residents.push({
      id: 'child-check', name: '青芽', sex: 'female', stage: 'child', birthDay: state.day - 59,
      settledDay: state.day - 59, origin: 'born', campId: camp.id, parentIds: [], aptitude: 'scout',
    })
    const next = advanceCalendarDays(state, 1)
    expect(next.residents.find((resident) => resident.id === 'child-check')?.stage).toBe('adult')
    expect(next.settlementEvents[0].kind).toBe('adulthood')
  })

  it('pairs eligible unrelated adults and records a marriage on a family checkpoint', () => {
    const state = settlementState('marriage-check')
    state.day = 29
    const woman = state.residents.find((resident) => resident.sex === 'female')!
    const man = state.residents.find((resident) => resident.sex === 'male')!
    let probe = 0
    while (hashString(`${state.gameId}:30:marry:${woman.id}:${man.id}`) % 100 >= 40) {
      state.gameId = `marriage-probe-${probe += 1}`
    }
    const next = advanceCalendarDays(state, 1)
    expect(next.residents.find((resident) => resident.id === woman.id)?.spouseId).toBe(man.id)
    expect(next.settlementEvents.some((event) => event.kind === 'marriage')).toBe(true)
  })

  it('creates a child only with housing, food surplus and an eligible couple', () => {
    const state = settlementState('birth-check')
    state.day = 29
    const mother = state.residents.find((resident) => resident.sex === 'female')!
    const father = state.residents.find((resident) => resident.sex === 'male')!
    mother.spouseId = father.id
    father.spouseId = mother.id
    let probe = 0
    while (hashString(`${state.gameId}:30:birth:${mother.id}:${father.id}`) % 100 >= 35) {
      state.gameId = `birth-probe-${probe += 1}`
    }
    const born = advanceCalendarDays(state, 1)
    expect(born.residents.some((resident) => resident.origin === 'born')).toBe(true)

    const blocked = settlementState('birth-blocked')
    blocked.day = 29
    blocked.camps[0].housing = 2
    const blockedMother = blocked.residents.find((resident) => resident.sex === 'female')!
    const blockedFather = blocked.residents.find((resident) => resident.sex === 'male')!
    blockedMother.spouseId = blockedFather.id
    blockedFather.spouseId = blockedMother.id
    expect(advanceCalendarDays(blocked, 1).residents).toHaveLength(2)
  })

  it('supports generated migrants and low-probability familiar traveler settlement', () => {
    const migrantState = settlementState('migrant-check')
    let migrantProbe = 0
    while (hashString(`${migrantState.gameId}:2:migrant:${migrantState.camps[0].id}`) % 100 >= 5) {
      migrantState.gameId = `migrant-probe-${migrantProbe += 1}`
    }
    const migrated = advanceCalendarDays(migrantState, 1)
    expect(migrated.residents.some((resident) => resident.origin === 'migrant')).toBe(true)

    const familiarState = settlementState('familiar-check')
    const familiar = familiarState.agents[0]
    familiar.x = familiarState.camps[0].x
    familiar.y = familiarState.camps[0].y
    familiar.affection = 3
    let familiarProbe = 0
    while (
      hashString(`${familiarState.gameId}:2:familiar:${familiarState.camps[0].id}:${familiar.id}`) % 100 >= 2 ||
      hashString(`${familiarState.gameId}:2:migrant:${familiarState.camps[0].id}`) % 100 < 5
    ) familiarState.gameId = `familiar-probe-${familiarProbe += 1}`
    const settled = advanceCalendarDays(familiarState, 1)
    expect(settled.residents.find((resident) => resident.origin === 'familiar')?.name).toBe(familiar.name)
    expect(settled.agents.some((agent) => agent.id === familiar.id)).toBe(false)
  })

  it('applies workforce and office bonuses without mutating base camp attributes', () => {
    const state = settlementState('effective-stats-check')
    state.residents.push({ ...state.residents[0], id: 'third-adult' })
    const baseEconomy = state.camps[0].economy
    const follower = state.agents[0]
    follower.role = 'follower'
    follower.skill = 'trader'
    follower.skillLevel = 2
    const assigned = gameReducer(state, { type: 'ASSIGN_CAMP_OFFICE', campId: state.camps[0].id, agentId: follower.id, office: 'mayor' })
    expect(effectiveCampStats(assigned, assigned.camps[0]).economy).toBe(baseEconomy + 2)
    expect(assigned.camps[0].economy).toBe(baseEconomy)
  })
})
