import { useState } from 'react'
import { ownedCollectibles } from '../game/inventory'
import type { FishId, GameAction, GameState } from '../game/types'
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
  focus,
  selectedCampId,
  onTabChange,
  onFocus,
  onSelectCamp,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
  activeTab: ExplorerTab
  focus: ExplorerFocus
  selectedCampId: string | null
  onTabChange: (tab: ExplorerTab) => void
  onFocus: (focus: ExplorerFocus) => void
  onSelectCamp: (campId: string) => void
}) {
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const residentCount = state.residents.length + state.camps.reduce((total, camp) => total + Object.keys(camp.offices).length, 0)
  const vassals = state.factions.filter((faction) => faction.isVassal)
  const bonuses = partyBonuses(state.agents)
  const [selectedCollectible, setSelectedCollectible] = useState<FishId | null>(null)
  const collectibles = ownedCollectibles(state.resources)
  const selectedItem = collectibles.find((item) => item.id === selectedCollectible) ?? null
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
            <header className="inventory-section-head">
              <span><b>常用</b><small>固定快捷栏</small></span>
              <em>3 格</em>
            </header>
            <div className="inventory-common-grid">
              <button
                data-tooltip={`野果 ×${state.player.berries} · 食物与交易品`}
                onFocus={() => onFocus({ kind: 'inventory', item: 'berries' })}
                onClick={() => onFocus({ kind: 'inventory', item: 'berries' })}
              >
                <i className="berry-cluster" aria-hidden="true">●</i><span>野果</span><b>×{state.player.berries}</b>
              </button>
              <button
                data-tooltip={`木材 ×${state.resources.wood} · 营地与木制设施`}
                onFocus={() => onFocus({ kind: 'inventory', item: 'wood' })}
                onClick={() => onFocus({ kind: 'inventory', item: 'wood' })}
              >
                <i aria-hidden="true">▥</i><span>木材</span><b>×{state.resources.wood}</b>
              </button>
              <button
                data-tooltip={`石材 ×${state.resources.stone} · 地基与防御设施`}
                onFocus={() => onFocus({ kind: 'inventory', item: 'stone' })}
                onClick={() => onFocus({ kind: 'inventory', item: 'stone' })}
              >
                <i aria-hidden="true">◆</i><span>石材</span><b>×{state.resources.stone}</b>
              </button>
            </div>
            <button
              className="inventory-use-button"
              onClick={() => dispatch({ type: 'EAT_BERRY' })}
              disabled={state.player.berries <= 0 || state.player.stamina >= state.player.maxStamina}
            >
              食用野果 <small>恢复 1 体力</small>
            </button>

            <header className="inventory-section-head collection-head">
              <span><b>自定义收藏</b><small>仅显示当前持有物</small></span>
              <em>{collectibles.length}/20</em>
            </header>
            <div className="inventory-slot-grid" aria-label="自定义收藏格，4 列 5 行">
              {Array.from({ length: 20 }, (_, index) => {
                const item = collectibles[index]
                if (!item) return <span className="inventory-slot is-empty" key={`empty-${index}`} aria-hidden="true" />
                return (
                  <button
                    className={`inventory-slot item-${item.id} ${selectedItem?.id === item.id ? 'is-selected' : ''}`}
                    key={item.id}
                    aria-label={`${item.name}，持有 ${item.count}，${item.description}`}
                    data-tooltip={`${item.name} ×${item.count} · ${item.description}`}
                    onFocus={() => onFocus({ kind: 'inventory', item: item.id })}
                    onClick={() => {
                      setSelectedCollectible(item.id)
                      onFocus({ kind: 'inventory', item: item.id })
                    }}
                  >
                    <i aria-hidden="true">{item.glyph}</i>
                    <b>×{item.count}</b>
                  </button>
                )
              })}
            </div>
            <div className="collection-action-line" aria-live="polite">
              {selectedItem ? (
                <>
                  <span><b>{selectedItem.name}</b><small>{selectedItem.description}</small></span>
                  <button
                    onClick={() => dispatch({ type: 'EAT_FISH', fishId: selectedItem.id })}
                    disabled={state.player.stamina >= state.player.maxStamina}
                  >食用</button>
                </>
              ) : <p>悬浮查看详情，点击选择收藏物。</p>}
            </div>
          </div>
        ) : null}

        {activeTab === 'equipment' ? (
          <EquipmentPanel
            state={state}
            dispatch={dispatch}
            characterId={focus.kind === 'loadout' ? focus.characterId : state.player.id}
            selectedPosition={focus.kind === 'loadout' ? focus.position : undefined}
            onFocus={(characterId, position, itemId) => onFocus({ kind: 'loadout', characterId, position, itemId })}
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
