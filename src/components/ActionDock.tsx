import type { GameAction, GameState } from '../game/types'

export function ActionDock({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  const followers = state.agents.filter((agent) => agent.role === 'follower').length
  return (
    <section className="action-dock" aria-label="行动">
      <div className="dpad" aria-label="方向移动">
        <button onClick={() => dispatch({ type: 'MOVE', direction: 'up' })} aria-label="向上">▲</button>
        <button onClick={() => dispatch({ type: 'MOVE', direction: 'left' })} aria-label="向左">◀</button>
        <button onClick={() => dispatch({ type: 'MOVE', direction: 'down' })} aria-label="向下">▼</button>
        <button onClick={() => dispatch({ type: 'MOVE', direction: 'right' })} aria-label="向右">▶</button>
      </div>
      <div className="action-buttons">
        <button onClick={() => dispatch({ type: 'FOUND_CAMP' })}><span>⌂</span> 建营 <small>8 金</small></button>
        <button onClick={() => dispatch({ type: 'STATION_FOLLOWER' })} disabled={followers === 0}><span>⚑</span> 驻守</button>
        <button onClick={() => dispatch({ type: 'REST' })}><span>☾</span> 休息</button>
      </div>
      <p className="keyboard-hint">点击邻近人物的气泡进行交谈或交易 · 移动 100 步消耗 1 体力</p>
    </section>
  )
}
