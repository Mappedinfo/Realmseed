import { directionalCharacterIndex, directionalCharactersUrl, directionalRow } from '../game/art'
import { allowedPositions, equipmentPositionGlyphs, equipmentPositionNames, equipmentPositions, equipmentTotals, partyCharacters, wornBy } from '../game/equipment'
import type { EquipmentPosition, GameAction, GameState } from '../game/types'

export function LoadoutBoard({ state, characterId, selectedPosition, selectedItemId, dispatch, onFocus }: {
  state: GameState; characterId: string; selectedPosition?: EquipmentPosition; selectedItemId?: string
  dispatch: React.Dispatch<GameAction>; onFocus: (position?: EquipmentPosition, itemId?: string) => void
}) {
  const character = partyCharacters(state).find((agent) => agent.id === characterId) ?? state.player
  const selectedItem = state.equipment.find((item) => item.id === selectedItemId)
  const totals = equipmentTotals(state.equipment, character.id)
  const portraitIndex = directionalCharacterIndex[character.id === 'player' ? 'player' : 'follower']
  const portraitRow = directionalRow[character.facing ?? 'down']
  return <section className="loadout-board explorer-display" aria-label="人物全身装备盘">
    <header><span><b>FIELD LOADOUT</b><small>{character.name} · 20 槽军需登记</small></span><em>{state.equipment.filter((item) => wornBy(item, character.id)).length}/20</em></header>
    <div className="loadout-core"><span className="loadout-portrait" style={{ backgroundImage: `url(${directionalCharactersUrl()})`, backgroundPosition: `${-portraitIndex * 64}px ${-portraitRow * 64}px` }} /><div><b>{character.name}</b><small>体力 {character.stamina}/{character.maxStamina} · 防 {totals.defense} · 格挡 +{totals.block}%</small><small>命中 +{totals.accuracy}% · 暴击 +{totals.critical}% · 减耗 {totals.fatigueReduction}%</small></div></div>
    <div className="loadout-grid">{equipmentPositions.map((position) => {
      const item = state.equipment.find((candidate) => wornBy(candidate, character.id) && candidate.position === position)
      const compatible = selectedItem ? allowedPositions(selectedItem).includes(position) : false
      return <button key={position} className={`${item ? 'is-filled' : ''} ${selectedPosition === position ? 'is-selected' : ''} ${compatible ? 'is-compatible' : ''}`} title={item ? `${equipmentPositionNames[position]} · ${item.name}` : equipmentPositionNames[position]} onClick={() => {
        if (selectedItem && compatible) dispatch({ type: 'EQUIP_ITEM', characterId: character.id, itemId: selectedItem.id, position })
        onFocus(position, item?.id ?? selectedItem?.id)
      }}><i>{item ? equipmentPositionGlyphs[position] : '·'}</i><span>{equipmentPositionNames[position]}</span>{item ? <b>{item.name}</b> : <small>空位</small>}</button>
    })}</div>
    <footer>{selectedItem ? `已选择「${selectedItem.name}」；高亮木牌可装备。` : '选择空位筛选装备，或选择已穿戴物查看详情。'}</footer>
  </section>
}
