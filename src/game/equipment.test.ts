import { describe, expect, it } from 'vitest'
import { allowedPositions, equipmentPositions, migrateEquipment } from './equipment'
import { gameReducer } from './simulation'
import { createGame } from './world'

describe('twenty-slot party equipment', () => {
  it('defines twenty distinct positions including four ring slots', () => {
    expect(equipmentPositions).toHaveLength(20)
    expect(equipmentPositions.filter((position) => position.startsWith('ring-'))).toHaveLength(4)
  })

  it('replaces a mutually exclusive position and preserves the displaced item', () => {
    let state = createGame('slot-replace', 'small')
    state.equipment.push({ id: 'second-blade', name: '第二把刀', slot: 'weapon', kind: 'physical', power: 3, defense: 0, equipped: false, allowedPositions: ['main-hand'], description: '测试' })
    state = gameReducer(state, { type: 'EQUIP_ITEM', characterId: 'player', itemId: 'second-blade', position: 'main-hand' })
    expect(state.equipment.find((item) => item.id === 'second-blade')).toMatchObject({ equippedBy: 'player', position: 'main-hand' })
    expect(state.equipment.find((item) => item.id === 'field-knife')?.equippedBy).toBeUndefined()
  })

  it('migrates legacy categories and resolves same-position conflicts by value', () => {
    const migrated = migrateEquipment([
      { id: 'weak', name: '旧刀', slot: 'weapon', power: 1, defense: 0, equipped: true, description: '' },
      { id: 'strong', name: '好刀', slot: 'weapon', power: 3, defense: 0, equipped: true, description: '' },
    ])
    expect(migrated.find((item) => item.id === 'strong')).toMatchObject({ equippedBy: 'player', position: 'main-hand' })
    expect(migrated.find((item) => item.id === 'weak')?.equippedBy).toBeUndefined()
    expect(allowedPositions(migrated[0])).toContain('main-hand')
  })
})
