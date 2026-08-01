import type { GameAction, GameState } from '../game/types'
import { agentSkills, partyBonuses } from '../game/skills'
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
  const residentCount = state.residents.length + state.camps.reduce((total, camp) => total + Object.keys(camp.offices).length, 0)
  const vassals = state.factions.filter((faction) => faction.isVassal)
  const bonuses = partyBonuses(state.agents)
  const counts: Record<ExplorerTab, number> = {
    inventory: state.player.berries + state.resources.wood + state.resources.stone + Object.values(state.resources.fish).reduce((total, count) => total + count, 0),
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
            <div className="pack-material-grid">
              <button onClick={() => onFocus({ kind: 'inventory', item: 'wood' })}><i>▥</i><span>木材</span><b>×{state.resources.wood}</b></button>
              <button onClick={() => onFocus({ kind: 'inventory', item: 'stone' })}><i>◆</i><span>石材</span><b>×{state.resources.stone}</b></button>
            </div>
            <div className="fish-pouch">
              {([
                ['minnow', '小鱼', 1], ['carp', '鲤鱼', 2], ['loach', '泥鳅', 2], ['golden-koi', '金鲤', 3],
              ] as const).map(([fishId, label, recovery]) => (
                <div className="compact-item-row" key={fishId}>
                  <button className="compact-item-main" onClick={() => onFocus({ kind: 'inventory', item: fishId })}>
                    <span className="fish-glyph">≈</span><span><strong>{label}</strong><small>恢复 {recovery} 体力</small></span><b>×{state.resources.fish[fishId]}</b>
                  </button>
                  <button className="compact-row-action" onClick={() => dispatch({ type: 'EAT_FISH', fishId })} disabled={!state.resources.fish[fishId] || state.player.stamina >= state.player.maxStamina}>食用</button>
                </div>
              ))}
            </div>
            <p className="tab-note">木石用于建设；水岸抛竿可补充鱼获。</p>
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
            <div className="party-bonus-board" aria-label="随行队伍加成">
              <span><b>⚔ +{bonuses.combatPower}</b><small>伤害</small></span>
              <span><b>▣ +{bonuses.guardChance}%</b><small>格挡</small></span>
              <span><b>⌖ +{bonuses.vision}</b><small>视野</small></span>
              <span><b>❧ +{bonuses.forage}</b><small>采集</small></span>
              <span><b>✚ +{bonuses.recovery}</b><small>休整</small></span>
              <span><b>◇ +{bonuses.tradeRate}</b><small>议价</small></span>
            </div>
            <button onClick={() => onFocus({ kind: 'player' })}>
              <span>◆</span><b>{state.player.name}</b><small>队长 · 当前控制</small>
            </button>
            {followers.map((agent) => (
              <button key={agent.id} onClick={() => onFocus({ kind: 'party', agentId: agent.id })}>
                <span>{agentSkills[agent.skill].glyph}</span><b>{agent.name}</b>
                <small>{agentSkills[agent.skill].title} Lv.{agent.skillLevel} · {agentSkills[agent.skill].followerEffect}</small>
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
              <small>{state.camps.length} 营地 · {residentCount} 居民 · {vassals.length} 附属</small>
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
