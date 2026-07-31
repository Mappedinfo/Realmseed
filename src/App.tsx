import { useEffect, useMemo, useReducer, useState } from 'react'
import { ActionDock } from './components/ActionDock'
import { AudioControl } from './components/AudioControl'
import { MiniMap } from './components/MiniMap'
import { SceneTransit } from './components/SceneTransit'
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
  const overlord = state.factions.find((faction) => faction.id === state.player.factionId)
  const vassals = state.factions.filter((faction) => faction.isVassal)
  const socialRank = overlord ? `${overlord.name}属臣` : vassals.length > 0 ? '独立领主' : '自由旅人'
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
          <span>{state.world.sceneName} [{state.world.sceneX}, {state.world.sceneY}] · {state.world.size} × {state.world.size}</span>
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
          <p className="free-banner">{socialRank}</p>

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
            <h3>领地 / 附属 <span>{villagers.length} / {vassals.length}</span></h3>
            <p className="empty-copy">
              {villagers.length
                ? `常亮村庄 ${villagers.length} 处 · 村税 +${villagers.length} 金`
                : '建立营地，再让随从驻守。'}
              {vassals.length ? ` · 贡金 +${vassals.length * 2} 金` : ''}
            </p>
          </div>
        </aside>

        <section className="map-column">
          <WorldCanvas state={state} onSelect={(position) => dispatch({ type: 'SELECT', position })} />
          <ActionDock state={state} dispatch={dispatch} />
        </section>

        <aside className="side-panel intel-panel">
          <SceneTransit state={state} dispatch={dispatch} />
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
              <div className="faction-contract" key={faction.id}>
                <div className="faction-row">
                  <i style={{ background: faction.color }} />
                  <span>
                    {faction.name}
                    {faction.isOverlord ? <small>宗主</small> : null}
                    {faction.isVassal ? <small>附属</small> : null}
                  </span>
                  <strong>{faction.relation >= 0 ? '+' : ''}{faction.relation}</strong>
                </div>
                <div className="contract-actions">
                  {faction.isOverlord ? (
                    <button onClick={() => dispatch({ type: 'BREAK_OATH' })}>解除誓约</button>
                  ) : (
                    <button
                      onClick={() => dispatch({ type: 'PLEDGE_FACTION', factionId: faction.id })}
                      disabled={state.player.factionId !== 'free' || faction.isVassal}
                      title="需要 15 声望；获得 4 金远征资助"
                    >
                      效忠
                    </button>
                  )}
                  <button
                    onClick={() => dispatch({ type: 'MAKE_VASSAL', factionId: faction.id })}
                    disabled={state.player.factionId !== 'free' || faction.isVassal}
                    title="需要 1 座村庄、30 声望和 10 金"
                  >
                    {faction.isVassal ? '已附属' : '纳为附属'}
                  </button>
                </div>
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
