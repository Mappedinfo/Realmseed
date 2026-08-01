import { useEffect, useMemo, useReducer, useState } from 'react'
import { ActionDock } from './components/ActionDock'
import { AudioControl } from './components/AudioControl'
import { BattlePanel } from './components/BattlePanel'
import { ExplorerTabs } from './components/ExplorerTabs'
import { FacilityEventPanel } from './components/FacilityEventPanel'
import type { ExplorerFocus, ExplorerTab } from './components/explorerFocus'
import { InteractionPanel } from './components/InteractionPanel'
import { MiniMap } from './components/MiniMap'
import { SceneTransit } from './components/SceneTransit'
import { SelectionDetails } from './components/SelectionDetails'
import { StartScreen } from './components/StartScreen'
import { WorldCanvas } from './components/WorldCanvas'
import { artThemes, type ArtTheme } from './game/art'
import { isWithinInteractionRange } from './game/geometry'
import { gameReducer, visibleCounts } from './game/simulation'
import type { BattleMode, GameState, MapSize } from './game/types'
import { createGame } from './game/world'

function GameView({
  initialState,
  theme,
  onThemeChange,
  onNewWorld,
}: {
  initialState: GameState
  theme: ArtTheme
  onThemeChange: (theme: ArtTheme) => void
  onNewWorld: () => void
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null)
  const [explorerFocus, setExplorerFocus] = useState<ExplorerFocus>({ kind: 'player' })
  const [activeExplorerTab, setActiveExplorerTab] = useState<ExplorerTab>('inventory')
  const counts = useMemo(() => visibleCounts(state), [state])
  const activeAgent = state.agents.find((agent) => agent.id === activeAgentId)
  const activeAgentNearby = Boolean(activeAgent && isWithinInteractionRange(activeAgent, state.player))
  const nearest = state.agents
    .filter((agent) => agent.role === 'wanderer')
    .map((agent) => ({ agent, distance: Math.abs(agent.x - state.player.x) + Math.abs(agent.y - state.player.y) }))
    .sort((a, b) => a.distance - b.distance)[0]
  const setCombatPreference = (mode: BattleMode) => {
    window.localStorage.setItem('realmseed-combat-mode', mode)
    dispatch({ type: 'SET_COMBAT_PREFERENCE', mode })
  }
  const setRedNameMode = (enabled: boolean) => {
    window.localStorage.setItem('realmseed-red-name-mode', String(enabled))
    dispatch({ type: 'SET_RED_NAME_MODE', enabled })
  }
  const selectAgent = (agentId: string) => {
    const agent = state.agents.find((item) => item.id === agentId)
    if (agent) {
      const position = { x: agent.x, y: agent.y }
      dispatch({ type: 'SELECT', position })
      setExplorerFocus({ kind: 'map', position })
      if (isWithinInteractionRange(agent, state.player)) setActiveAgentId(agentId)
    }
  }
  const selectPosition = (position: { x: number; y: number }) => {
    setActiveAgentId(null)
    setExplorerFocus({ kind: 'map', position })
    dispatch({ type: 'SELECT', position })
  }
  const changeExplorerTab = (tab: ExplorerTab) => {
    setActiveExplorerTab(tab)
    if (tab === 'inventory') setExplorerFocus({ kind: 'inventory', item: 'berries' })
    if (tab === 'equipment' && state.equipment[0]) setExplorerFocus({ kind: 'equipment', itemId: state.equipment[0].id })
    if (tab === 'party') setExplorerFocus({ kind: 'player' })
    if (tab === 'camps' && state.camps[0]) setExplorerFocus({ kind: 'camp', campId: state.camps[0].id })
    if (tab === 'territory') setExplorerFocus({ kind: 'territory' })
  }

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
        if (state.battle) return
        dispatch({ type: 'MOVE', direction })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state.battle])

  useEffect(() => {
    if (state.battle) {
      setActiveAgentId(null)
      return
    }
    if (!activeAgent) return
    if (!isWithinInteractionRange(activeAgent, state.player)) setActiveAgentId(null)
  }, [activeAgent, state.battle, state.player.x, state.player.y])

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="compact-brand">
          <span className="brand-glyph">◆</span>
          <div><strong>REALMSEED</strong><small>SEED: {state.world.seed}</small></div>
        </div>
        <div className="world-status">
          <span><small>第</small> {state.day} <small>日 · 行程 {state.dayProgress}/10</small></span>
          <i />
          <span>{state.weather}</span>
          <i />
          <span>{state.world.sceneName} [{state.world.sceneX}, {state.world.sceneY}] · {state.world.size} × {state.world.size}</span>
        </div>
        <div className="header-actions">
          <label className={`field-combat-toggle red-name-toggle ${state.redNameMode ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={state.redNameMode}
              onChange={(event) => setRedNameMode(event.target.checked)}
              aria-label="红名模式"
            />
            <span className="toggle-track"><i /></span>
            <span className="toggle-copy"><b>红名模式</b><small>{state.redNameMode ? '可攻击中立' : '和平探索'}</small></span>
          </label>
          <label className="art-theme-control">
            <span>美术</span>
            <select value={theme} onChange={(event) => onThemeChange(event.target.value as ArtTheme)}>
              {(Object.entries(artThemes) as [ArtTheme, (typeof artThemes)[ArtTheme]][]).map(([id, option]) => (
                <option key={id} value={id}>{option.name}</option>
              ))}
            </select>
          </label>
          <label className="art-theme-control combat-mode-control">
            <span>默认对战</span>
            <select
              value={state.combatPreference}
              onChange={(event) => setCombatPreference(event.target.value as BattleMode)}
              aria-label="默认对战模式"
            >
              <option value="field">战术条</option>
              <option value="duel">左右回合</option>
            </select>
          </label>
          <AudioControl battleActive={Boolean(state.battle)} />
          <button onClick={onNewWorld}>新世界</button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side-panel explorer-panel">
          <p className="panel-kicker explorer-heading">FIELD DOSSIER · 详情窗口</p>

          <SelectionDetails state={state} focus={explorerFocus} />

          <div className="resource-row">
            <div><span className="coin-dot">●</span><strong>{state.player.gold}</strong><small>金币</small></div>
            <div><span className="heart-dot">♥</span><strong>{state.player.stamina}/{state.player.maxStamina}</strong><small>体力</small></div>
          </div>

          <div className="stamina-track"><i style={{ width: `${(state.player.stamina / state.player.maxStamina) * 100}%` }} /></div>
          <p className="stamina-meta">
            今日行程 {state.dayProgress}/10 · 体力步数 {Math.floor(state.fatigue * 10) / 10}/100 · 战绩 {state.combatWins} · 上限 {state.player.maxStamina}
          </p>

          <ExplorerTabs
            state={state}
            dispatch={dispatch}
            activeTab={activeExplorerTab}
            selectedCampId={selectedCampId}
            onTabChange={changeExplorerTab}
            onFocus={setExplorerFocus}
            onSelectCamp={(campId) => {
              setSelectedCampId(campId)
              const camp = state.camps.find((item) => item.id === campId)
              setExplorerFocus({ kind: 'camp', campId })
              if (camp && camp.sceneX === state.world.sceneX && camp.sceneY === state.world.sceneY) {
                dispatch({ type: 'SELECT', position: { x: camp.x, y: camp.y } })
              }
            }}
          />
        </aside>

        <section className="map-column">
          <WorldCanvas
            state={state}
            theme={theme}
            dispatch={dispatch}
            activeAgentId={activeAgentId}
            onAgentClick={selectAgent}
            onSelect={selectPosition}
          />
          {!state.battle && activeAgent && activeAgentNearby ? (
            <InteractionPanel
              state={state}
              target={activeAgent}
              faction={state.factions.find((faction) => faction.id === activeAgent.factionId)}
              dispatch={dispatch}
              onClose={() => setActiveAgentId(null)}
            />
          ) : null}
          <FacilityEventPanel state={state} dispatch={dispatch} />
          <BattlePanel state={state} dispatch={dispatch} />
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
  const [theme, setTheme] = useState<ArtTheme>('verdant')
  const start = (seed: string, size: MapSize, selectedTheme: ArtTheme) => {
    setTheme(selectedTheme)
    const next = createGame(seed, size)
    const savedMode = window.localStorage.getItem('realmseed-combat-mode')
    if (savedMode === 'duel' || savedMode === 'field') next.combatPreference = savedMode
    next.redNameMode = window.localStorage.getItem('realmseed-red-name-mode') === 'true'
    setInitialState(next)
  }
  return initialState
    ? (
        <GameView
          key={initialState.gameId}
          initialState={initialState}
          theme={theme}
          onThemeChange={setTheme}
          onNewWorld={() => setInitialState(null)}
        />
      )
    : <StartScreen onStart={start} />
}
