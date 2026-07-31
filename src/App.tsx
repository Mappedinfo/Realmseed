import { useEffect, useMemo, useReducer, useState } from 'react'
import { ActionDock } from './components/ActionDock'
import { AudioControl } from './components/AudioControl'
import { BattlePanel } from './components/BattlePanel'
import { CampPanel } from './components/CampPanel'
import { EquipmentPanel } from './components/EquipmentPanel'
import { InteractionPanel } from './components/InteractionPanel'
import { MiniMap } from './components/MiniMap'
import { SceneTransit } from './components/SceneTransit'
import { StartScreen } from './components/StartScreen'
import { WorldCanvas } from './components/WorldCanvas'
import { artThemes, type ArtTheme } from './game/art'
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
  const [activePartyId, setActivePartyId] = useState('player')
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null)
  const counts = useMemo(() => visibleCounts(state), [state])
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const villagers = state.agents.filter((agent) => agent.role === 'villager')
  const overlord = state.factions.find((faction) => faction.id === state.player.factionId)
  const vassals = state.factions.filter((faction) => faction.isVassal)
  const socialRank = overlord ? `${overlord.name}属臣` : vassals.length > 0 ? '独立领主' : '自由旅人'
  const activeAgent = state.agents.find((agent) => agent.id === activeAgentId)
  const activePartyMember = activePartyId === 'player'
    ? state.player
    : followers.find((agent) => agent.id === activePartyId) ?? state.player
  const activePortraitIndex = activePartyMember.role === 'player' ? 0 : 1
  const nearest = state.agents
    .filter((agent) => agent.role === 'wanderer')
    .map((agent) => ({ agent, distance: Math.abs(agent.x - state.player.x) + Math.abs(agent.y - state.player.y) }))
    .sort((a, b) => a.distance - b.distance)[0]
  const setCombatPreference = (mode: BattleMode) => {
    window.localStorage.setItem('realmseed-combat-mode', mode)
    dispatch({ type: 'SET_COMBAT_PREFERENCE', mode })
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
    const distance = Math.abs(activeAgent.x - state.player.x) + Math.abs(activeAgent.y - state.player.y)
    if (distance > 1) setActiveAgentId(null)
  }, [activeAgent, state.battle, state.player.x, state.player.y])

  useEffect(() => {
    if (activePartyId !== 'player' && !followers.some((agent) => agent.id === activePartyId)) {
      setActivePartyId('player')
    }
  }, [activePartyId, followers])

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
          <label className="art-theme-control">
            <span>美术</span>
            <select value={theme} onChange={(event) => onThemeChange(event.target.value as ArtTheme)}>
              {(Object.entries(artThemes) as [ArtTheme, (typeof artThemes)[ArtTheme]][]).map(([id, option]) => (
                <option key={id} value={id}>{option.name}</option>
              ))}
            </select>
          </label>
          <label className="art-theme-control combat-mode-control">
            <span>默认战斗</span>
            <select
              value={state.combatPreference}
              onChange={(event) => setCombatPreference(event.target.value as BattleMode)}
              aria-label="默认战斗模式"
            >
              <option value="field">地图直战</option>
              <option value="duel">左右回合</option>
            </select>
          </label>
          <AudioControl />
          <button onClick={onNewWorld}>新世界</button>
        </div>
      </header>

      <div className="game-grid">
        <aside className="side-panel explorer-panel">
          <p className="panel-kicker">PARTY · 点击切换头像</p>
          <div
            className="portrait party-sprite"
            style={{
              backgroundImage: `url(${import.meta.env.BASE_URL}assets/art/verdant-directional-characters.png)`,
              backgroundPosition: `${-activePortraitIndex * 64}px 0`,
            }}
            role="img"
            aria-label={`${activePartyMember.name} 的队伍头像`}
          />
          <h2>{activePartyMember.name}</h2>
          <p className="free-banner">{socialRank}</p>

          <div className="resource-row">
            <div><span className="coin-dot">●</span><strong>{state.player.gold}</strong><small>金币</small></div>
            <div><span className="heart-dot">♥</span><strong>{state.player.stamina}/{state.player.maxStamina}</strong><small>体力</small></div>
          </div>

          <div className="stamina-track"><i style={{ width: `${(state.player.stamina / state.player.maxStamina) * 100}%` }} /></div>
          <p className="stamina-meta">
            步数 {Math.floor(state.fatigue * 10) / 10}/100 · 战绩 {state.combatWins} · 上限 {state.player.maxStamina}
          </p>

          <div className="panel-section inventory-panel">
            <h3>物品栏 <span>{state.player.berries}</span></h3>
            <button
              className="inventory-item"
              onClick={() => dispatch({ type: 'EAT_BERRY' })}
              disabled={state.player.berries <= 0 || state.player.stamina >= state.player.maxStamina}
              title="食用 1 枚野果，恢复 1 点体力"
            >
              <span className="berry-cluster" aria-hidden="true">●</span>
              <span><strong>野果</strong><small>食用恢复 1 体力</small></span>
              <b>×{state.player.berries}</b>
              <em>{state.player.stamina < state.player.maxStamina ? '食用' : '体力充足'}</em>
            </button>
            <p className="inventory-rate">各地行情约为 10 果 = 1 金，产量受地形与区域影响。</p>
          </div>

          <EquipmentPanel state={state} dispatch={dispatch} />

          <div className="panel-section party-panel">
            <h3>队内角色 <span>{followers.length + 1}</span></h3>
            <div className="party-roster">
              <button
                className={activePartyId === 'player' ? 'is-active' : ''}
                onClick={() => setActivePartyId('player')}
              >
                <span>◆</span><b>{state.player.name}</b><small>队长</small>
              </button>
              {followers.map((agent) => (
                <button
                  className={activePartyId === agent.id ? 'is-active' : ''}
                  key={agent.id}
                  onClick={() => setActivePartyId(agent.id)}
                >
                  <span>♟</span><b>{agent.name}</b><small>随行 · 场景中隐藏</small>
                </button>
              ))}
            </div>
            {followers.length === 0 ? <p className="empty-copy">与旅人建立 3 点好感后可招募。</p> : null}
          </div>

          <CampPanel
            state={state}
            selectedCampId={selectedCampId}
            onSelectCamp={(campId) => {
              setSelectedCampId(campId)
              const camp = state.camps.find((item) => item.id === campId)
              if (camp && camp.sceneX === state.world.sceneX && camp.sceneY === state.world.sceneY) {
                dispatch({ type: 'SELECT', position: { x: camp.x, y: camp.y } })
              }
            }}
            dispatch={dispatch}
          />

          <div className="panel-section">
            <h3>领地 / 附属 <span>{villagers.length} / {vassals.length}</span></h3>
            <p className="empty-copy">{vassals.length ? `附属贡金 +${vassals.length * 2} 金` : '尚未建立附属契约。'}</p>
          </div>
        </aside>

        <section className="map-column">
          <WorldCanvas
            state={state}
            theme={theme}
            activeAgentId={activeAgentId}
            onAgentClick={setActiveAgentId}
            onSelect={(position) => dispatch({ type: 'SELECT', position })}
          />
          {!state.battle && activeAgent ? (
            <InteractionPanel
              state={state}
              target={activeAgent}
              faction={state.factions.find((faction) => faction.id === activeAgent.factionId)}
              dispatch={dispatch}
              onClose={() => setActiveAgentId(null)}
            />
          ) : null}
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
