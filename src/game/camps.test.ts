import { describe, expect, it } from 'vitest'
import { campBuildingDefinitions, campBuildingKinds, campDailyYield, campOfficeDefinitions, campOfficeKinds, campRestRecovery } from './camps'
import type { Camp } from './types'

function camp(): Camp {
  return {
    id: 'test-camp',
    name: '试验营地',
    x: 10,
    y: 10,
    sceneX: 0,
    sceneY: 0,
    housing: 6,
    defense: 4,
    economy: 5,
    food: 7,
    morale: 6,
    controlRadius: 4,
    buildings: [],
    offices: {},
  }
}

describe('camp economy definitions', () => {
  it('defines six distinct buildable facilities with price and operational gains', () => {
    expect(campBuildingKinds).toHaveLength(6)
    expect(new Set(campBuildingKinds.map((kind) => campBuildingDefinitions[kind].name)).size).toBe(6)
    expect(campBuildingDefinitions.house.gains.housing).toBe(3)
    expect(campBuildingDefinitions.farm.gains.food).toBe(3)
    expect(campBuildingDefinitions.watchtower.gains.controlRadius).toBe(1)
    expect(campBuildingDefinitions.market.gains.economy).toBe(3)
    expect(campBuildingDefinitions.workshop.gains.defense).toBe(1)
    expect(campBuildingDefinitions.shrine.gains.morale).toBe(3)
  })

  it('unlocks four governance offices from the intended facilities', () => {
    const target = camp()
    expect(campOfficeKinds).toHaveLength(4)
    expect(campOfficeDefinitions.mayor.unlocked(target)).toBe(true)
    expect(campOfficeDefinitions['guard-captain'].unlocked(target)).toBe(false)
    target.buildings.push({ x: 11, y: 10, kind: 'watchtower' })
    expect(campOfficeDefinitions['guard-captain'].unlocked(target)).toBe(true)
  })

  it('settles economy as gold and food surplus as berries', () => {
    const target = camp()
    const state = {
      camps: [target],
      residents: [
        { id: 'r1', campId: target.id, stage: 'adult' as const },
        { id: 'r2', campId: target.id, stage: 'adult' as const },
      ],
    } as Parameters<typeof campDailyYield>[0]
    expect(campDailyYield(state, target)).toEqual({ gold: 2, berries: 5 })
  })

  it('turns morale into stronger exhausted rest recovery', () => {
    const target = camp()
    const state = { camps: [target], residents: [] } as Parameters<typeof campRestRecovery>[0]
    expect(campRestRecovery(state)).toBe(3)
    expect(campRestRecovery(state, target)).toBe(5)
  })
})
