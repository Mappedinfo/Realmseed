import { combatPowerSummary, equipmentDefense } from '../game/combat'
import type { EquipmentSlot, GameAction, GameState } from '../game/types'

const slotGlyph: Record<EquipmentSlot, string> = {
  weapon: '⚔',
  focus: '◆',
  firearm: '⌁',
  explosive: '✹',
  armor: '▣',
}

export function EquipmentPanel({
  state,
  dispatch,
  onInspect,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  onInspect: (itemId: string) => void
}) {
  const power = combatPowerSummary(state)
  return (
    <div className="equipment-panel tab-panel-content">
      <div className="equipment-stats" aria-label="装备加成">
        <span>物 +{power.physical}</span>
        <span>法 +{power.magic}</span>
        <span>枪 +{power.firearm}</span>
        <span>爆 +{power.explosive}</span>
        <span>防 +{equipmentDefense(state.equipment)}</span>
      </div>
      <div className="equipment-list">
        {state.equipment.map((item) => (
          <div key={item.id} className={`equipment-row ${item.equipped ? 'is-equipped' : ''}`}>
            <button className="equipment-inspect" onClick={() => onInspect(item.id)}>
              <i aria-hidden="true">{slotGlyph[item.slot]}</i>
              <span><strong>{item.name}</strong><small>{item.kind ?? item.slot} · +{item.power || item.defense}</small></span>
            </button>
            <button
              className="equipment-toggle"
              onClick={() => dispatch({ type: 'TOGGLE_EQUIPMENT', itemId: item.id })}
              aria-pressed={item.equipped}
              title={item.equipped ? `卸下${item.name}` : `装备${item.name}`}
            >
              {item.equipped ? '卸下' : '装备'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
