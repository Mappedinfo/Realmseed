import { useState } from 'react'
import {
  campBuildingDefinitions,
  campBuildingKinds,
  campDailyYield,
  campFoodDemand,
  campOfficeDefinitions,
  campOfficeKinds,
  campOfficials,
  campPopulation,
  effectiveCampStats,
} from '../game/camps'
import { agentSkills } from '../game/skills'
import type { CampOffice, GameAction, GameState } from '../game/types'

type CampSection = 'overview' | 'residents' | 'families' | 'governance' | 'construction'

const sections: { id: CampSection; label: string; glyph: string }[] = [
  { id: 'overview', label: '总览', glyph: '⌂' },
  { id: 'residents', label: '居民', glyph: '♟' },
  { id: 'families', label: '家庭', glyph: '♡' },
  { id: 'governance', label: '治理', glyph: '♛' },
  { id: 'construction', label: '建设', glyph: '⚒' },
]

const originNames = { founder: '开拓者', migrant: '外来移民', familiar: '熟人定居', born: '本地出生' } as const

export function CampPanel({
  state,
  selectedCampId,
  onSelectCamp,
  dispatch,
}: {
  state: GameState
  selectedCampId: string | null
  onSelectCamp: (campId: string) => void
  dispatch: React.Dispatch<GameAction>
}) {
  const [section, setSection] = useState<CampSection>('overview')
  const [nominees, setNominees] = useState<Partial<Record<CampOffice, string>>>({})
  const selectedCamp = state.camps.find((camp) => camp.id === selectedCampId) ?? state.camps[0]
  const local = selectedCamp
    ? selectedCamp.sceneX === state.world.sceneX && selectedCamp.sceneY === state.world.sceneY
    : false
  const atCore = Boolean(local && selectedCamp && state.player.x === selectedCamp.x && state.player.y === selectedCamp.y)

  if (state.camps.length === 0) {
    return <div className="camp-panel tab-panel-content"><p className="empty-copy">花费 8 金建立营地；建营时会有两名开拓居民入住。</p></div>
  }
  if (!selectedCamp) return null

  const residents = state.residents.filter((resident) => resident.campId === selectedCamp.id)
  const adults = residents.filter((resident) => resident.stage === 'adult')
  const children = residents.filter((resident) => resident.stage === 'child')
  const officials = campOfficials(state, selectedCamp.id)
  const stats = effectiveCampStats(state, selectedCamp)
  const population = campPopulation(state, selectedCamp.id)
  const demand = campFoodDemand(state, selectedCamp.id)
  const daily = campDailyYield(state, selectedCamp)
  const events = state.settlementEvents.filter((event) => event.campId === selectedCamp.id).slice(0, 5)
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const familyCheck = state.day % 30 === 0 ? 30 : 30 - (state.day % 30)
  const families = residents.filter((resident) => resident.sex === 'female' && resident.spouseId).map((resident) => ({
    resident,
    spouse: residents.find((item) => item.id === resident.spouseId),
    children: residents.filter((child) => child.parentIds.includes(resident.id)),
  }))

  return (
    <div className="camp-panel tab-panel-content settlement-ledger">
      <div className="camp-list">
        {state.camps.map((camp) => (
          <button key={camp.id} className={camp.id === selectedCamp.id ? 'is-active' : ''} onClick={() => onSelectCamp(camp.id)}>
            <span>⌂ {camp.name}</span>
            <small>[{camp.sceneX}, {camp.sceneY}] · {campPopulation(state, camp.id)}/{camp.housing} 人</small>
          </button>
        ))}
      </div>

      <nav className="camp-section-tabs" aria-label="营地档案分页">
        {sections.map((item) => (
          <button key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => setSection(item.id)}>
            <i>{item.glyph}</i><span>{item.label}</span>
          </button>
        ))}
      </nav>

      {section === 'overview' ? (
        <div className="camp-operations camp-overview-ledger">
          <div className="camp-operation-grid">
            <span><b>{population}/{selectedCamp.housing}</b><small>人口/容量</small></span>
            <span><b>{adults.length}/{children.length}</b><small>成人/儿童</small></span>
            <span><b>{stats.food}/{demand}</b><small>食物/需求</small></span>
            <span><b>{stats.defense}</b><small>有效防御</small></span>
            <span><b>{stats.economy}</b><small>有效经济</small></span>
            <span><b>{stats.morale}</b><small>有效士气</small></span>
          </div>
          <div className="settlement-ribbon">
            <span>日程 <b>{state.dayProgress}/10</b></span>
            <span>劳动力 <b>+{stats.workforce} 经济</b></span>
            <span>日产 <b>+{daily.gold} 金 / +{daily.berries} 果</b></span>
          </div>
          <button className="return-camp" disabled={!local || Boolean(state.battle)} onClick={() => dispatch({ type: 'RETURN_TO_CAMP', campId: selectedCamp.id })}>
            {local ? '自动寻路返回' : '先前往对应场景'}
          </button>
          <div className="settlement-events">
            <h4>聚落近况</h4>
            {events.length ? events.map((event) => <p key={event.id}><small>D{event.day}</small>{event.text}</p>) : <p className="empty-copy">尚无婚育、迁入或治理事件。</p>}
          </div>
        </div>
      ) : null}

      {section === 'residents' ? (
        <div className="resident-register">
          <div className="register-band"><b>成人 {adults.length}</b><span>每 3 名成人提供 1 点经济</span></div>
          {adults.map((resident) => {
            const spouse = residents.find((item) => item.id === resident.spouseId)
            return <article key={resident.id} className="resident-slip">
              <i>{resident.sex === 'female' ? '♀' : '♂'}</i>
              <div><b>{resident.name}</b><small>{originNames[resident.origin]} · {agentSkills[resident.aptitude].title}</small></div>
              <em>{spouse ? `伴侣 ${spouse.name}` : '未婚'}</em>
            </article>
          })}
          <div className="register-band"><b>儿童 {children.length}</b><span>出生 60 天后成年</span></div>
          {children.map((resident) => <article key={resident.id} className="resident-slip child">
            <i>{resident.sex === 'female' ? '♀' : '♂'}</i>
            <div><b>{resident.name}</b><small>成长 {state.day - resident.birthDay}/60 天 · 潜质 {agentSkills[resident.aptitude].name}</small></div>
            <em>本地出生</em>
          </article>)}
          <div className="register-band"><b>驻任精英 {officials.length}</b><span>占用住房，提供治理加成</span></div>
          {officials.map((agent) => <article key={agent.id} className="resident-slip elite">
            <i>✦</i><div><b>{agent.name}</b><small>{agentSkills[agent.skill].title} Lv.{agent.skillLevel}</small></div><em>营地官员</em>
          </article>)}
        </div>
      ) : null}

      {section === 'families' ? (
        <div className="family-ledger">
          <div className="family-status">
            <span>距婚育检查 <b>{familyCheck} 天</b></span>
            <span className={population < selectedCamp.housing ? 'good' : 'blocked'}>住房 {population < selectedCamp.housing ? '可用' : '已满'}</span>
            <span className={stats.food - demand >= 2 ? 'good' : 'blocked'}>余粮 {stats.food - demand >= 2 ? '充足' : '不足'}</span>
          </div>
          {families.map(({ resident, spouse, children: familyChildren }) => <article key={resident.id} className="family-card">
            <header><b>{resident.name}</b><i>♡</i><b>{spouse?.name ?? '未知伴侣'}</b></header>
            <div className="kin-line" />
            <p>{familyChildren.length ? familyChildren.map((child) => child.name).join(' · ') : '尚无子女'}</p>
          </article>)}
          {!families.length ? <p className="empty-copy">成年未婚居民会在每 30 天一次的检查中尝试结婚。</p> : null}
        </div>
      ) : null}

      {section === 'governance' ? (
        <div className="governance-board">
          <p className="tab-note">任命和召回必须站在该营地核心。匹配专长会获得额外加成。</p>
          {campOfficeKinds.map((office) => {
            const definition = campOfficeDefinitions[office]
            const official = selectedCamp.offices[office]
            const unlocked = definition.unlocked(selectedCamp)
            const nominee = nominees[office] ?? followers[0]?.id ?? ''
            return <article className={`office-plaque ${unlocked ? '' : 'is-locked'}`} key={office}>
              <header><i>{definition.glyph}</i><div><b>{definition.name}</b><small>{unlocked ? definition.detail : '需要对应营地建筑解锁'}</small></div></header>
              {official ? <>
                <div className="office-holder"><strong>{official.name}</strong><span>{agentSkills[official.skill].title} Lv.{official.skillLevel}</span></div>
                <button disabled={!atCore || Boolean(state.battle)} onClick={() => dispatch({ type: 'RECALL_CAMP_OFFICIAL', campId: selectedCamp.id, office })}>卸任并召回</button>
              </> : <>
                <select value={nominee} disabled={!unlocked || !followers.length} onChange={(event) => setNominees({ ...nominees, [office]: event.target.value })} aria-label={`${definition.name}候选人`}>
                  {followers.map((agent) => <option value={agent.id} key={agent.id}>{agent.name} · {agentSkills[agent.skill].title} Lv.{agent.skillLevel}{definition.preferredSkills.includes(agent.skill) ? ' ★匹配' : ''}</option>)}
                </select>
                <button disabled={!atCore || !unlocked || !nominee || population >= selectedCamp.housing || Boolean(state.battle)} onClick={() => dispatch({ type: 'ASSIGN_CAMP_OFFICE', campId: selectedCamp.id, agentId: nominee, office })}>任命</button>
              </>}
            </article>
          })}
        </div>
      ) : null}

      {section === 'construction' ? (
        <div className="camp-operations">
          <p className="build-progress">建设勘察 {state.constructionSteps}/100 · 可建 {state.buildingCredits} 格</p>
          <div className="camp-buildings">
            {campBuildingKinds.map((kind) => {
              const option = campBuildingDefinitions[kind]
              return <button key={option.kind} disabled={!local || state.buildingCredits <= 0 || !state.selected || Boolean(state.battle) || state.player.gold < option.cost} onClick={() => dispatch({ type: 'BUILD_CAMP_TILE', kind: option.kind })} title={`${option.detail}；先点击地图中营地高亮范围内的空格`}>
                <i>{option.glyph}</i><b>{option.name}</b><small>{option.summary}</small><em>{option.cost} 金 · 1 格</em>
              </button>
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
