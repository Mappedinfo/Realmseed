import type { GameAction, GameState } from '../game/types'

export function ActionDock({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  const locked = Boolean(state.battle)
  return (
    <section className="action-dock" aria-label="行动">
      <div className="dpad" aria-label="方向移动">
        <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'up' })} aria-label="向上">▲</button>
        <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'left' })} aria-label="向左">◀</button>
        <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'down' })} aria-label="向下">▼</button>
        <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'right' })} aria-label="向右">▶</button>
      </div>
      <div className="action-buttons">
        <button disabled={locked} onClick={() => dispatch({ type: 'FOUND_CAMP' })}>
          <span className="action-glyph">⌂</span>
          <span className="action-copy"><b>建立营地</b><small>消耗 8 金币</small></span>
        </button>
        <button disabled={locked} onClick={() => dispatch({ type: 'REST' })}>
          <span className="action-glyph">☾</span>
          <span className="action-copy"><b>休息整备</b><small>恢复体力并结算</small></span>
        </button>
      </div>
      <p className="keyboard-hint">周围八方向 1 格的人物会出现对话气泡 · 移动 10 格推进 1 天 · 100 步消耗 1 体力</p>
    </section>
  )
}
