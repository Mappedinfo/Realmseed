import type { GameAction, GameState } from '../game/types'
import { CampPanel } from './CampPanel'
import { EquipmentPanel } from './EquipmentPanel'
import type { ExplorerFocus, ExplorerTab } from './explorerFocus'

const tabs: { id: ExplorerTab; label: string; glyph: string }[] = [
  { id: 'inventory', label: '物品', glyph: '◆' },
  { id: 'equipment', label: '装备', glyph: '⚔' },
  { id: 'party', label: '队伍', glyph: '♟' },
  { id: 'camps', label: '营地', glyph: '⌂' },
  { id: 'territory', label: '领地', glyph: '♜' },
]

export function ExplorerTabs({
  state,
  dispatch,
  activeTab,
  selectedCampId,
  onTabChange,
  onFocus,
  onSelectCamp,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  activeTab: ExplorerTab
  selectedCampId: string | null
  onTabChange: (tab: ExplorerTab) => void
  onFocus: (focus: ExplorerFocus) => void
  onSelectCamp: (campId: string) => void
}) {
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const villagers = state.agents.filter((agent) => agent.role === 'villager')
  const vassals = state.factions.filter((faction) => faction.isVassal)
  const counts: Record<ExplorerTab, number> = {
    inventory: state.player.berries,
    equipment: state.equipment.filter((item) => item.equipped).length,
    party: followers.length + 1,
    camps: state.camps.length,
    territory: state.camps.length + vassals.length,
  }

  return (
    <section className="explorer-tabs">
      <nav className="explorer-tab-list" role="tablist" aria-label="左侧功能栏">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            id={`explorer-tab-${tab.id}`}
            aria-controls={`explorer-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => onTabChange(tab.id)}
          >
            <i aria-hidden="true">{tab.glyph}</i>
            <span>{tab.label}</span>
            <b>{counts[tab.id]}</b>
          </button>
        ))}
      </nav>

      <div
        className="explorer-tab-panel"
        id={`explorer-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`explorer-tab-${activeTab}`}
      >
        {activeTab === 'inventory' ? (
          <div className="tab-panel-content inventory-tab">
            <div className="compact-item-row">
              <button className="compact-item-main" onClick={() => onFocus({ kind: 'inventory', item: 'berries' })}>
                <span className="berry-cluster" aria-hidden="true">●</span>
                <span><strong>野果</strong><small>食物 · 交易品</small></span>
                <b>×{state.player.berries}</b>
              </button>
              <button
                className="compact-row-action"
                onClick={() => dispatch({ type: 'EAT_BERRY' })}
                disabled={state.player.berries <= 0 || state.player.stamina >= state.player.maxStamina}
              >
                食用
              </button>
            </div>
            <p className="tab-note">点击物品查看详情；各地行情围绕 10 果 = 1 金波动。</p>
          </div>
        ) : null}

        {activeTab === 'equipment' ? (
          <EquipmentPanel
            state={state}
            dispatch={dispatch}
            onInspect={(itemId) => onFocus({ kind: 'equipment', itemId })}
          />
        ) : null}

        {activeTab === 'party' ? (
          <div className="tab-panel-content party-roster">
            <button onClick={() => onFocus({ kind: 'player' })}>
              <span>◆</span><b>{state.player.name}</b><small>队长 · 当前控制</small>
            </button>
            {followers.map((agent) => (
              <button key={agent.id} onClick={() => onFocus({ kind: 'party', agentId: agent.id })}>
                <span>♟</span><b>{agent.name}</b><small>随行队友 · 地图中隐藏</small>
              </button>
            ))}
            {followers.length === 0 ? <p className="empty-copy">与旅人建立 3 点好感后可招募。</p> : null}
          </div>
        ) : null}

        {activeTab === 'camps' ? (
          <CampPanel
            state={state}
            selectedCampId={selectedCampId}
            onSelectCamp={onSelectCamp}
            dispatch={dispatch}
          />
        ) : null}

        {activeTab === 'territory' ? (
          <div className="tab-panel-content territory-list">
            <button className="territory-overview" onClick={() => onFocus({ kind: 'territory' })}>
              <span>♜ 领地总览</span>
              <small>{state.camps.length} 营地 · {villagers.length} 驻守 · {vassals.length} 附属</small>
            </button>
            {state.factions.map((faction) => (
              <button key={faction.id} onClick={() => onFocus({ kind: 'territory', factionId: faction.id })}>
                <i style={{ background: faction.color }} />
                <span>{faction.name}</span>
                <b>{faction.relation >= 0 ? '+' : ''}{faction.relation}</b>
                <small>{faction.isVassal ? '附属' : faction.isOverlord ? '宗主' : '独立'}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
