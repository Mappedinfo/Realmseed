import { describe, expect, it } from 'vitest'
import { combatMoves, combatPowerSummary, equipmentDefense } from './combat'
import { createGame } from './world'

describe('combat and equipment contract', () => {
  it('covers melee, ranged, physical, magic, firearm, explosive, small, and large moves', () => {
    expect(new Set(combatMoves.map((move) => move.range))).toEqual(new Set(['melee', 'ranged']))
    expect(new Set(combatMoves.map((move) => move.kind))).toEqual(
      new Set(['physical', 'magic', 'firearm', 'explosive']),
    )
    expect(new Set(combatMoves.map((move) => move.size))).toEqual(new Set(['small', 'large']))
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
