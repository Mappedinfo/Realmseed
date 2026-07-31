import { describe, expect, it } from 'vitest'
import { combatMove, combatMoves, combatPowerSummary, equipmentDefense, resolveCombatRoll } from './combat'
import { createGame } from './world'

describe('combat and equipment contract', () => {
  it('covers melee, ranged, physical, magic, firearm, explosive, small, and large moves', () => {
    expect(new Set(combatMoves.map((move) => move.range))).toEqual(new Set(['melee', 'ranged']))
    expect(new Set(combatMoves.map((move) => move.kind))).toEqual(
      new Set(['physical', 'magic', 'firearm', 'explosive']),
    )
    expect(new Set(combatMoves.map((move) => move.size))).toEqual(new Set(['small', 'large']))
    expect(combatMoves.filter((move) => move.range === 'melee').every((move) => move.maxRange === 1)).toBe(true)
    expect(combatMoves.filter((move) => move.range === 'ranged').every((move) => move.maxRange > 1)).toBe(true)
    expect(combatMoves.every((move) => move.accuracy > 0 && move.accuracy <= 100)).toBe(true)
    expect(combatMove('field-bomb')).toMatchObject({ target: 'area', blastRadius: 1, splashRatio: 0.5 })
  })

  it('replays deterministic hit and critical rolls from game, target, round, and move ids', () => {
    const move = combatMove('rifle-shot')
    const first = resolveCombatRoll('replay-world', 'replay-boar', 4, move)
    expect(resolveCombatRoll('replay-world', 'replay-boar', 4, move)).toEqual(first)
    expect(first.multiplier).toBe(first.critical ? 1.5 : first.hit ? 1 : 0)
  })

  it('derives attack and defense bonuses only from equipped inventory items', () => {
    const state = createGame('equipment-summary', 'small')
    expect(combatPowerSummary(state)).toEqual({
      physical: 1,
      magic: 1,
      firearm: 2,
      explosive: 2,
    })
    expect(equipmentDefense(state.equipment)).toBe(1)
    state.equipment.forEach((item) => {
      item.equipped = false
    })
    expect(combatPowerSummary(state)).toEqual({
      physical: 0,
      magic: 0,
      firearm: 0,
      explosive: 0,
    })
    expect(equipmentDefense(state.equipment)).toBe(0)
  })
})
