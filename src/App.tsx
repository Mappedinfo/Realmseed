import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { SaveManager } from './components/SaveManager'
import { WorldCanvas } from './components/WorldCanvas'
import { artThemes, type ArtTheme } from './game/art'
import { isWithinInteractionRange } from './game/geometry'
import { findNavigationPath, navigationGoals, navigationStopsAdjacent } from './game/navigation'
import { BrowserSaveStore, clearSavedGame, createSaveEnvelope, writeSavedGame, type SaveProblem, type SavedGame } from './game/persistence'
import { gameReducer, visibleCounts } from './game/simulation'
import type { BattleMode, GameAction, GameState, MapSize, Position } from './game/types'
import { createGame } from './game/world'

function GameView({
  initialState,
  theme,
  onThemeChange,
  onNewWorld,
  onImport,
}: {
  initialState: GameState
  theme: ArtTheme
  onThemeChange: (theme: ArtTheme) => void
  onNewWorld: () => void
  onImport: (save: SavedGame) => void
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null)
  const [explorerFocus, setExplorerFocus] = useState<ExplorerFocus>({ kind: 'player' })
  const [activeExplorerTab, setActiveExplorerTab] = useState<ExplorerTab>('inventory')
  const [navigationPath, setNavigationPath] = useState<Position[]>([])
  const [navigationTarget, setNavigationTarget] = useState<Position | null>(null)
  const saveStore = useMemo(() => new BrowserSaveStore(window.localStorage), [])
  const [saveStatus, setSaveStatus] = useState('IndexedDB 自动存档准备就绪')
  const latestSaveRef = useRef({ state, theme })
  latestSaveRef.current = { state, theme }
  const counts = useMemo(() => visibleCounts(state), [state])
  const nearWater = useMemo(() => {
    if (state.activeDungeon) return false
    const height = state.world.height ?? state.world.size
    for (let y = Math.max(0, state.player.y - 2); y <= Math.min(height - 1, state.player.y + 2); y += 1) {
      for (let x = Math.max(0, state.player.x - 2); x <= Math.min(state.world.size - 1, state.player.x + 2); x += 1) {
        if (Math.abs(x - state.player.x) + Math.abs(y - state.player.y) > 2) continue
        if (state.world.tiles[y * state.world.size + x]?.terrain === 'water') return true
      }
    }
    return false
  }, [state.activeDungeon, state.player.x, state.player.y, state.world])
  const fishingResult = state.fishing?.phase === 'result' ? state.fishing.result : undefined
  const fishingResultKey = fishingResult && state.fishing
    ? `${state.world.sceneX}:${state.world.sceneY}:${state.fishing.water.x}:${state.fishing.water.y}:${state.fishing.castNumber}:${state.turn}`
    : undefined
  const activeAgent = state.agents.find((agent) => agent.id === activeAgentId)
  const activeAgentNearby = Boolean(activeAgent && isWithinInteractionRange(activeAgent, state.player))
  const nearest = state.agents
    .filter((agent) => agent.role === 'wanderer')
    .map((agent) => ({ agent, distance: Math.abs(agent.x - state.player.x) + Math.abs(agent.y - state.player.y) }))
    .sort((a, b) => a.distance - b.distance)[0]
  const cancelNavigation = useCallback(() => {
    setNavigationPath([])
    setNavigationTarget(null)
  }, [])
  const userDispatch = useCallback((action: GameAction) => {
    if (action.type !== 'FISH_TICK') cancelNavigation()
    dispatch(action)
  }, [cancelNavigation])
  const setCombatPreference = (mode: BattleMode) => {
    window.localStorage.setItem('realmseed-combat-mode', mode)
    dispatch({ type: 'SET_COMBAT_PREFERENCE', mode })
  }
  const setRedNameMode = (enabled: boolean) => {
    window.localStorage.setItem('realmseed-red-name-mode', String(enabled))
    dispatch({ type: 'SET_RED_NAME_MODE', enabled })
  }
  const selectAgent = (agentId: string) => {
    cancelNavigation()
    const agent = state.agents.find((item) => item.id === agentId)
    if (agent) {
      const position = { x: agent.x, y: agent.y }
      dispatch({ type: 'SELECT', position })
      setExplorerFocus({ kind: 'map', position })
      if (isWithinInteractionRange(agent, state.player)) setActiveAgentId(agentId)
    }
  }
  const selectPosition = (position: { x: number; y: number }) => {
    cancelNavigation()
    setActiveAgentId(null)
    setExplorerFocus({ kind: 'map', position })
    dispatch({ type: 'SELECT', position })
  }
  const navigateTo = useCallback((position: Position) => {
    if (state.battle || state.fishing || state.player.stamina <= 0) return
    const index = position.y * state.world.size + position.x
    const tile = state.world.tiles[index]
    if (!tile || state.fog[index] === 0) return
    const stopAdjacent = navigationStopsAdjacent(tile) ||
      state.agents.some((agent) => agent.role !== 'follower' && agent.x === position.x && agent.y === position.y) ||
      state.monsters.some((monster) => monster.x === position.x && monster.y === position.y)
    const path = findNavigationPath(state.world, state.player, position, stopAdjacent)
    setActiveAgentId(null)
    setExplorerFocus({ kind: 'map', position })
    if (!path.length) {
      const alreadyThere = navigationGoals(state.world, position, stopAdjacent)
        .some((goal) => goal.x === state.player.x && goal.y === state.player.y)
      if (alreadyThere) dispatch({ type: 'SELECT', position })
      setNavigationPath([])
      setNavigationTarget(null)
      return
    }
    setNavigationTarget(position)
    setNavigationPath(path)
  }, [state.battle, state.fishing, state.fog, state.player, state.world])
  const changeExplorerTab = (tab: ExplorerTab) => {
    setActiveExplorerTab(tab)
    if (tab === 'inventory') setExplorerFocus({ kind: 'inventory', item: 'berries' })
    if (tab === 'equipment') setExplorerFocus({ kind: 'loadout', characterId: state.player.id })
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
        if (state.battle || state.fishing) return
        userDispatch({ type: 'MOVE', direction })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [state.battle, state.fishing, userDispatch])

  useEffect(() => {
    if (!navigationPath.length) return
    if (state.battle || state.fishing || state.player.stamina <= 0) {
      cancelNavigation()
      return
    }
    const next = navigationPath[0]
    const dx = next.x - state.player.x
    const dy = next.y - state.player.y
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      cancelNavigation()
      return
    }
    const direction = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up'
    const timer = window.setTimeout(() => {
      dispatch({ type: 'MOVE', direction })
      setNavigationPath((path) => path.slice(1))
    }, 150)
    return () => window.clearTimeout(timer)
  }, [cancelNavigation, navigationPath, state.battle, state.fishing, state.player.stamina, state.player.x, state.player.y])

  useEffect(() => {
    if (!navigationTarget || navigationPath.length || state.battle || state.fishing) return
    dispatch({ type: 'SELECT', position: navigationTarget })
    setNavigationTarget(null)
  }, [navigationPath.length, navigationTarget, state.battle, state.fishing])

  useEffect(() => {
    if (state.activeDungeon) {
      writeSavedGame(window.localStorage, state, theme)
      void saveStore.save(createSaveEnvelope(state, theme)).then((result) => setSaveStatus(result.degraded ? 'IndexedDB 不可用，已降级为 localStorage' : 'IndexedDB 自动存档正常')).catch(() => setSaveStatus('自动保存失败，请立即导出存档'))
      return
    }
    const timer = window.setTimeout(() => {
      writeSavedGame(window.localStorage, state, theme)
      void saveStore.save(createSaveEnvelope(state, theme)).then((result) => setSaveStatus(result.degraded ? 'IndexedDB 不可用，已降级为 localStorage' : `已保存 · ${new Date().toLocaleTimeString()}`)).catch(() => setSaveStatus('自动保存失败，请立即导出存档'))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [saveStore, state, theme])

  useEffect(() => {
    const persist = () => {
      const latest = latestSaveRef.current
      writeSavedGame(window.localStorage, latest.state, latest.theme)
    }
    window.addEventListener('pagehide', persist)
    return () => window.removeEventListener('pagehide', persist)
  }, [])

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
          <span>{state.activeDungeon ? `地下第 ${state.activeDungeon.floor}/3 层 · ${state.world.sceneName}` : `${state.world.sceneName} [${state.world.sceneX}, ${state.world.sceneY}]`} · {state.world.size} × {state.world.height ?? state.world.size}</span>
        </div>
        <div className="header-actions">
          <label className={`field-combat-toggle red-name-toggle ${state.redNameMode ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={state.redNameMode}
              disabled={Boolean(state.activeDungeon)}
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
          <SaveManager state={state} theme={theme} onImport={onImport} saveStatus={saveStatus} />
          <AudioControl
            battleActive={Boolean(state.battle)}
            shoreActive={Boolean(state.fishing) || nearWater}
            fishingResult={fishingResult}
            fishingResultKey={fishingResultKey}
          />
          <button onClick={onNewWorld}>新世界</button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side-panel explorer-panel">
          <p className="panel-kicker explorer-heading">FIELD DOSSIER · 详情窗口</p>

          <SelectionDetails state={state} focus={explorerFocus} dispatch={userDispatch} onFocus={setExplorerFocus} />

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
            dispatch={userDispatch}
            activeTab={activeExplorerTab}
            focus={explorerFocus}
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
            key={`${state.gameId}:${state.world.kind}:${state.world.sceneX}:${state.world.sceneY}:${state.activeDungeon?.floor ?? 0}`}
            state={state}
            theme={theme}
            dispatch={userDispatch}
            activeAgentId={activeAgentId}
            onAgentClick={selectAgent}
            onSelect={selectPosition}
            onNavigate={navigateTo}
            navigationPath={navigationPath}
          />
          {!state.battle && activeAgent && activeAgentNearby ? (
            <InteractionPanel
              state={state}
              target={activeAgent}
              faction={state.factions.find((faction) => faction.id === activeAgent.factionId)}
              dispatch={userDispatch}
              onClose={() => setActiveAgentId(null)}
            />
          ) : null}
          <FacilityEventPanel state={state} dispatch={userDispatch} />
          <BattlePanel state={state} dispatch={userDispatch} />
          <ActionDock state={state} dispatch={userDispatch} />
        </section>

        <aside className="side-panel intel-panel">
          {state.activeDungeon ? (
            <section className="dungeon-status-card">
              <p className="panel-kicker">UNDERGROUND RUN</p>
              <strong>地下第 {state.activeDungeon.floor}/3 层</strong>
              <div><span>守层精英</span><b>{state.monsters.some((monster) => monster.rank === 'elite') ? '未击败' : '已清除'}</b></div>
              <div><span>未开宝箱</span><b>{state.world.tiles.filter((tile) => tile.structure === 'chest' && !tile.chestOpened).length}</b></div>
              <div><span>Boss</span><b>{state.activeDungeon.floor < 3 ? '更深处' : state.monsters.some((monster) => monster.rank === 'boss') ? '战斗中' : '已击败'}</b></div>
            </section>
          ) : <SceneTransit state={state} dispatch={userDispatch} />}
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
                    {faction.autoAggro ? <small className="is-wanted">追缉中</small> : null}
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
                <span className="nearby-health">生命 {nearest.agent.hp}/{nearest.agent.maxHp}<i><b style={{ width: `${Math.max(0, (nearest.agent.hp / nearest.agent.maxHp) * 100)}%` }} /></i></span>
                <span className="nearby-weapon">⚔ {nearest.agent.loadout.find((item) => item.equipped && item.moveId)?.name ?? '徒手'}</span>
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
  const [session, setSession] = useState(0)
  const [booting, setBooting] = useState(true)
  const [saveProblem, setSaveProblem] = useState<SaveProblem | undefined>()
  const importSave = (save: SavedGame) => { setSaveProblem(undefined); setTheme(save.theme); setInitialState(save.state); setSession((value) => value + 1) }
  useEffect(() => {
    const store = new BrowserSaveStore(window.localStorage)
    void store.loadDetailed().then((result) => {
      if (result.save) importSave(result.save)
      if (result.problem) setSaveProblem(result.problem)
    }).finally(() => setBooting(false))
  }, [])
  const start = (seed: string, size: MapSize, selectedTheme: ArtTheme) => {
    clearSavedGame(window.localStorage)
    void new BrowserSaveStore(window.localStorage).clearActive()
    setTheme(selectedTheme)
    const next = createGame(seed, size)
    const savedMode = window.localStorage.getItem('realmseed-combat-mode')
    if (savedMode === 'duel' || savedMode === 'field') next.combatPreference = savedMode
    next.redNameMode = window.localStorage.getItem('realmseed-red-name-mode') === 'true'
    setInitialState(next)
  }
  if (booting) return <main className="save-bootstrap"><span>◆</span><b>正在核验远征档案…</b><small>检查 IndexedDB、备份与版本迁移</small></main>
  return initialState
    ? (
        <GameView
          key={`${initialState.gameId}-${session}`}
          initialState={initialState}
          theme={theme}
          onThemeChange={setTheme}
          onNewWorld={() => {
            clearSavedGame(window.localStorage)
            void new BrowserSaveStore(window.localStorage).clearActive()
            setInitialState(null)
          }}
          onImport={importSave}
        />
      )
    : <StartScreen onStart={start} onImport={importSave} saveProblem={saveProblem} onDiscardProblem={() => {
        clearSavedGame(window.localStorage)
        void new BrowserSaveStore(window.localStorage).clearActive()
        setSaveProblem(undefined)
      }} />
}
