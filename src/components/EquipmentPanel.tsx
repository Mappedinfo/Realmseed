import { combatPowerSummary, equipmentDefense } from '../game/combat'
import { allowedPositions, equipmentPositionGlyphs, equipmentPositionNames, equipmentPositions, partyCharacters, wornBy } from '../game/equipment'
import type { EquipmentPosition, GameAction, GameState } from '../game/types'

export function EquipmentPanel({ state, dispatch, characterId, selectedPosition, onFocus }: {
  state: GameState; dispatch: React.Dispatch<GameAction>; characterId: string; selectedPosition?: EquipmentPosition
  onFocus: (characterId: string, position?: EquipmentPosition, itemId?: string) => void
}) {
  const power = combatPowerSummary(state)
  const characters = partyCharacters(state)
  const filtered = selectedPosition ? state.equipment.filter((item) => allowedPositions(item).includes(selectedPosition)) : state.equipment
  return <div className="equipment-panel tab-panel-content">
    <div className="equipment-character-strip" aria-label="装备角色选择">{characters.map((character) => <button key={character.id} className={character.id === characterId ? 'is-active' : ''} onClick={() => onFocus(character.id)}><b>{character.id === 'player' ? '◆' : '♟'}</b><span>{character.name}</span></button>)}</div>
    <div className="equipment-stats" aria-label="装备加成"><span>物 +{power.physical}</span><span>法 +{power.magic}</span><span>枪 +{power.firearm}</span><span>爆 +{power.explosive}</span><span>防 +{equipmentDefense(state.equipment, characterId)}</span></div>
    <div className="equipment-position-filter"><label>筛选位置<select value={selectedPosition ?? ''} onChange={(event) => onFocus(characterId, (event.target.value || undefined) as EquipmentPosition | undefined)}><option value="">全部装备</option>{equipmentPositions.map((position) => <option key={position} value={position}>{equipmentPositionNames[position]}</option>)}</select></label></div>
    <div className="equipment-list">{filtered.map((item) => {
      const worn = wornBy(item, characterId)
      const compatible = allowedPositions(item)
      const quickPosition = compatible.find((position) => !state.equipment.some((other) => wornBy(other, characterId) && other.position === position)) ?? compatible[0]
      return <div key={item.id} className={`equipment-row ${worn ? 'is-equipped' : ''}`}>
        <button className="equipment-inspect" onClick={() => onFocus(characterId, selectedPosition, item.id)}><i aria-hidden="true">{equipmentPositionGlyphs[item.position ?? compatible[0]]}</i><span><strong>{item.name}</strong><small>{compatible.map((position) => equipmentPositionNames[position]).join(' / ')} · {item.description}</small></span></button>
        <button className="equipment-toggle" onClick={() => worn && item.position ? dispatch({ type: 'UNEQUIP_POSITION', characterId, position: item.position }) : dispatch({ type: 'EQUIP_ITEM', characterId, itemId: item.id, position: selectedPosition && compatible.includes(selectedPosition) ? selectedPosition : quickPosition })}>{worn ? '卸下' : '装备'}</button>
      </div>
    })}</div>
  </div>
}
