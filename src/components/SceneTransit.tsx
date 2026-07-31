import type { GameAction, GameState } from '../game/types'

const routes = [
  { direction: 'up', label: '北', symbol: '▲' },
  { direction: 'left', label: '西', symbol: '◀' },
  { direction: 'right', label: '东', symbol: '▶' },
  { direction: 'down', label: '南', symbol: '▼' },
] as const

export function SceneTransit({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}) {
  return (
    <details className="scene-transit-disclosure">
      <summary>
        <span><b>场景导航</b><small>高级世界机制</small></span>
        <em>[{state.world.sceneX}, {state.world.sceneY}]</em>
        <i aria-hidden="true">＋</i>
      </summary>
      <section className="scene-transit" aria-label="场景交通">
        <div className="transit-copy">
          <p className="panel-kicker">INFINITE FRONTIER</p>
          <strong>{state.world.sceneName}</strong>
          <span>场景坐标 [{state.world.sceneX}, {state.world.sceneY}]</span>
        </div>
        <div className="transit-grid">
          {routes.map((route) => (
            <button
              key={route.direction}
              className={`route-${route.direction}`}
              onClick={() => dispatch({ type: 'TRAVEL', direction: route.direction })}
              aria-label={`向${route.label}前往相邻场景`}
              title={`累计 25 步疲劳，前往${route.label}侧相邻场景`}
            >
              <b>{route.symbol}</b>
              <small>{route.label}</small>
            </button>
          ))}
          <div className="transit-core" aria-hidden="true">◆</div>
        </div>
        <p>跨场景机制会保存迷雾、营地、人物和怪物状态。</p>
      </section>
    </details>
  )
}
