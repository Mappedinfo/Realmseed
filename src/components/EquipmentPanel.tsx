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
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}) {
  const power = combatPowerSummary(state)
  return (
    <div className="panel-section equipment-panel">
      <h3>装备栏 <span>{state.equipment.filter((item) => item.equipped).length}</span></h3>
      <div className="equipment-stats" aria-label="装备加成">
        <span>物 +{power.physical}</span>
        <span>法 +{power.magic}</span>
        <span>枪 +{power.firearm}</span>
        <span>爆 +{power.explosive}</span>
        <span>防 +{equipmentDefense(state.equipment)}</span>
      </div>
      <div className="equipment-list">
        {state.equipment.map((item) => (
          <button
            key={item.id}
            className={item.equipped ? 'is-equipped' : ''}
            onClick={() => dispatch({ type: 'TOGGLE_EQUIPMENT', itemId: item.id })}
            aria-pressed={item.equipped}
            title={item.description}
          >
            <i aria-hidden="true">{slotGlyph[item.slot]}</i>
            <span><strong>{item.name}</strong><small>{item.description}</small></span>
            <b>{item.equipped ? '已装备' : '收纳'}</b>
          </button>
        ))}
      </div>
      <p className="equipment-note">装备仅提供数值，不绘制在角色身体上。</p>
    </div>
  )
}
