import { describe, expect, it } from 'vitest'
import { agentSkills, challengeChance, partyBonuses } from './skills'
import { createGame } from './world'

describe('traveler skills and party bonuses', () => {
  it('generates a readable skill and level for every traveler', () => {
    const state = createGame('skill-generation-check', 'small')
    expect(state.agents.every((agent) => agentSkills[agent.skill])).toBe(true)
    expect(state.agents.every((agent) => agent.skillLevel >= 1 && agent.skillLevel <= 3)).toBe(true)
  })

  it('converts follower specialties into six capped party bonuses', () => {
    const state = createGame('party-bonus-check', 'small')
    const skillOrder = ['scout', 'forager', 'guard', 'medic', 'trader', 'duelist'] as const
    state.agents.slice(0, 6).forEach((agent, index) => {
      agent.role = 'follower'
      agent.skill = skillOrder[index]
      agent.skillLevel = 3
    })
    expect(partyBonuses(state.agents)).toEqual({
      vision: 2,
      forage: 2,
      guardChance: 24,
      recovery: 2,
      tradeRate: 2,
      combatPower: 2,
    })
  })

  it('raises challenge odds through combat experience and matching mastery marks', () => {
    const state = createGame('challenge-odds-check', 'small')
    const agent = state.agents[0]
    const base = challengeChance(state, agent)
    state.combatWins = 4
    state.challengeMarks[agent.skill] = 2
    expect(challengeChance(state, agent)).toBeGreaterThan(base)
    expect(challengeChance(state, agent)).toBeLessThanOrEqual(85)
  })
})
