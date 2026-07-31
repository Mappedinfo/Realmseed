import { useEffect, useMemo, useReducer, useState } from 'react'
import { ActionDock } from './components/ActionDock'
import { AudioControl } from './components/AudioControl'
import { MiniMap } from './components/MiniMap'
import { StartScreen } from './components/StartScreen'
import { WorldCanvas } from './components/WorldCanvas'
import { gameReducer, visibleCounts } from './game/simulation'
import type { GameState, MapSize } from './game/types'
import { createGame } from './game/world'

function GameView({ initialState, onNewWorld }: { initialState: GameState; onNewWorld: () => void }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const counts = useMemo(() => visibleCounts(state), [state])
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const villagers = state.agents.filter((agent) => agent.role === 'villager')
  const nearest = state.agents
    .filter((agent) => agent.role === 'wanderer')
    .map((agent) => ({ agent, distance: Math.abs(agent.x - state.player.x) + Math.abs(agent.y - state.player.y) }))
    .sort((a, b) => a.distance - b.distance)[0]

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const direction =
        event.key === 'ArrowUp' || event.key.toLowerCase() === 'w' ? 'up'
          : event.key === 'ArrowDown' || event.key.toLowerCase() === 's' ? 'down'
            : event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a' ? 'left'
              : event.key === 'ArrowRight' || event.key.toLowerCase() === 'd' ? 'right'
                : null
      if (direction) {
        event.preventDefault()
        dispatch({ type: 'MOVE', direction })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="compact-brand">
          <span className="brand-glyph">◆</span>
          <div><strong>REALMSEED</strong><small>SEED: {state.world.seed}</small></div>
        </div>
        <div className="world-status">
          <span><small>第</small> {state.day} <small>日</small></span>
          <i />
          <span>{state.weather}</span>
          <i />
          <span>{state.world.size} × {state.world.size}</span>
        </div>
        <div className="header-actions">
          <AudioControl />
          <button onClick={onNewWorld}>新世界</button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side-panel explorer-panel">
          <p className="panel-kicker">EXPLORER</p>
          <div className="portrait" aria-hidden="true"><span>◆</span></div>
          <h2>{state.player.name}</h2>
          <p className="free-banner">自由旅人</p>

          <div className="resource-row">
            <div><span className="coin-dot">●</span><strong>{state.player.gold}</strong><small>金币</small></div>
            <div><span className="heart-dot">♥</span><strong>{state.player.stamina}/{state.player.maxStamina}</strong><small>体力</small></div>
          </div>

          <div className="stamina-track"><i style={{ width: `${(state.player.stamina / state.player.maxStamina) * 100}%` }} /></div>

          <div className="panel-section">
            <h3>同行者 <span>{followers.length}</span></h3>
            {followers.length === 0 ? <p className="empty-copy">与旅人建立 3 点好感后可招募。</p> : followers.map((agent) => <p className="person-row" key={agent.id}>♟ {agent.name}</p>)}
          </div>

          <div className="panel-section">
            <h3>领地 <span>{villagers.length}</span></h3>
            <p className="empty-copy">{villagers.length ? `常亮村庄 ${villagers.length} 处 · 每日 +${villagers.length} 金` : '建立营地，再让随从驻守。'}</p>
          </div>
        </aside>

        <section className="map-column">
          <WorldCanvas state={state} onSelect={(position) => dispatch({ type: 'SELECT', position })} />
          <ActionDock state={state} dispatch={dispatch} />
        </section>

        <aside className="side-panel intel-panel">
          <div className="map-panel-head">
            <div><p className="panel-kicker">WORLD MAP</p><strong>{Math.round((counts.explored / counts.total) * 100)}% 已探索</strong></div>
            <span>{counts.visible} 格明亮</span>
          </div>
          <MiniMap state={state} />
          <div className="fog-legend">
            <span><i className="fog-bright" /> 常亮</span>
            <span><i className="fog-known" /> 已探索</span>
            <span><i className="fog-dark" /> 迷雾</span>
          </div>

          <div className="panel-section factions">
            <h3>阵营关系</h3>
            {state.factions.map((faction) => (
              <div className="faction-row" key={faction.id}>
                <i style={{ background: faction.color }} />
                <span>{faction.name}</span>
                <strong>{faction.relation >= 0 ? '+' : ''}{faction.relation}</strong>
              </div>
            ))}
          </div>

          <div className="panel-section">
            <h3>最近的旅人</h3>
            {nearest ? (
              <div className="nearby-card">
                <strong>{nearest.agent.name}</strong>
                <span>{state.factions.find((faction) => faction.id === nearest.agent.factionId)?.name} · 距离 {nearest.distance}</span>
                <div className="affection">{'♥'.repeat(nearest.agent.affection)}{'♡'.repeat(5 - nearest.agent.affection)}</div>
              </div>
            ) : <p className="empty-copy">附近无人。</p>}
          </div>

          <div className="panel-section chronicle">
            <h3>旅途纪事</h3>
            <div className="chronicle-list">
              {state.chronicle.slice(0, 5).map((entry) => (
                <p key={entry.id} className={entry.tone}><span>D{entry.day}</span>{entry.text}</p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

export function App() {
  const [initialState, setInitialState] = useState<GameState | null>(null)
  const start = (seed: string, size: MapSize) => setInitialState(createGame(seed, size))
  return initialState
    ? <GameView key={initialState.gameId} initialState={initialState} onNewWorld={() => setInitialState(null)} />
    : <StartScreen onStart={start} />
}
