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
            title={`消耗 2 体力，前往${route.label}侧相邻场景`}
          >
            <b>{route.symbol}</b>
            <small>{route.label}</small>
          </button>
        ))}
        <div className="transit-core" aria-hidden="true">◆</div>
      </div>
      <p>四向场景由同一总种子确定；离开后保存迷雾、村庄与怪物状态。</p>
    </section>
  )
}
