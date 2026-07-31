import { describe, expect, it } from 'vitest'
import { campBuildingDefinitions, campBuildingKinds, campDailyYield, campRestRecovery } from './camps'
import type { Camp } from './types'

function camp(): Camp {
  return {
    id: 'test-camp',
    name: '试验营地',
    x: 10,
    y: 10,
    sceneX: 0,
    sceneY: 0,
    population: 2,
    housing: 6,
    defense: 4,
    economy: 5,
    food: 7,
    morale: 6,
    controlRadius: 4,
    buildings: [],
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

  it('settles economy as gold and food surplus as berries', () => {
    expect(campDailyYield(camp())).toEqual({ gold: 2, berries: 5 })
  })

  it('turns morale into stronger exhausted rest recovery', () => {
    expect(campRestRecovery()).toBe(3)
    expect(campRestRecovery(camp())).toBe(5)
  })
})
