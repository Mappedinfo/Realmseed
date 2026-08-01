import { directionalCharacterIndex, directionalCharactersUrl, directionalRow } from '../game/art'
import { inspectPosition, type InspectionDetail } from '../game/inspection'
import { campDailyYield, campPopulation, effectiveCampStats } from '../game/camps'
import { agentSkills } from '../game/skills'
import type { Agent, EquipmentSlot, GameState } from '../game/types'
import type { ExplorerFocus } from './explorerFocus'

interface DetailView {
  category: string
  meta: string
  name: string
  icon: string
  description: string
  stats: { label: string; value: string | number }[]
  hint?: string
  tone: 'neutral' | 'good' | 'danger'
  portrait?: { role: 'player' | 'wanderer' | 'villager' | 'follower'; facing: Agent['facing'] }
}

const equipmentGlyph: Record<EquipmentSlot, string> = {
  weapon: '⚔',
  focus: '◆',
  firearm: '⌁',
  explosive: '✹',
  armor: '▣',
}

function mapDetail(detail: InspectionDetail, state: GameState): DetailView {
  const agent = state.agents.find(
    (item) =>
      item.role !== 'follower' &&
      item.x === detail.position.x &&
      item.y === detail.position.y,
  )
  const player = state.player.x === detail.position.x && state.player.y === detail.position.y
  return {
    ...detail,
    meta: `坐标 ${detail.position.x},${detail.position.y}`,
    portrait: player
      ? { role: 'player', facing: state.player.facing }
      : agent
        ? { role: agent.role === 'villager' ? 'villager' : 'wanderer', facing: agent.facing }
        : undefined,
  }
}

function personDetail(state: GameState, agent: Agent, isPlayer = false): DetailView {
  const faction = state.factions.find((item) => item.id === agent.factionId)
  const role = isPlayer ? '远征队长' : agent.role === 'follower' ? '随行队友' : agent.role === 'villager' ? '驻守村民' : '旅行者'
  const skill = agentSkills[agent.skill]
  const masteryMarks = Object.values(state.challengeMarks).reduce((total, value) => total + value, 0)
  const weapon = agent.loadout.find((item) => item.equipped && item.moveId)
  const armor = agent.loadout.find((item) => item.equipped && item.slot === 'armor')
  return {
    category: '人物',
    meta: isPlayer ? '当前控制角色' : faction?.name ?? '自由角色',
    name: agent.name,
    icon: isPlayer ? '◆' : '♟',
    description: isPlayer ? '队伍的当前领队与所有远征行动的执行者。' : `${skill.title}。${skill.description}`,
    stats: [
      { label: '身份', value: role },
      { label: '体力', value: `${agent.stamina}/${agent.maxStamina}` },
      ...(!isPlayer ? [{ label: '生命', value: `${agent.hp}/${agent.maxHp}` }] : []),
      ...(!isPlayer ? [{ label: '武器', value: weapon?.name ?? '徒手' }] : []),
      ...(!isPlayer ? [{ label: '护甲', value: armor ? `${armor.name} · 防 ${armor.defense}` : '无' }] : []),
      { label: '金币', value: agent.gold },
      { label: '野果', value: agent.berries },
      ...(isPlayer ? [{ label: '专精印记', value: masteryMarks }] : []),
      ...(!isPlayer ? [{ label: '好感', value: `${agent.affection}/5` }] : []),
      ...(!isPlayer ? [{ label: '专长', value: `${skill.name} Lv.${agent.skillLevel}` }] : []),
      ...(!isPlayer ? [{ label: '挑战', value: agent.challengeWon ? '已通过' : '未通过' }] : []),
    ],
    hint: isPlayer ? '点击地图目标可切换这个展示窗口。' : '随行队友隐藏在地图角色层中，可在队伍标签页切换查看。',
    tone: 'good',
    portrait: {
      role: isPlayer ? 'player' : agent.role === 'villager' ? 'villager' : agent.role === 'follower' ? 'follower' : 'wanderer',
      facing: agent.facing,
    },
  }
}

function focusDetail(state: GameState, focus: ExplorerFocus): DetailView {
  if (focus.kind === 'map') return mapDetail(inspectPosition(state, focus.position), state)
  if (focus.kind === 'player') return personDetail(state, state.player, true)
  if (focus.kind === 'inventory') {
    return {
      category: '物品',
      meta: '背包资源',
      name: '野果',
      icon: '●',
      description: '探索时采集的基础食物，也是各地最常见的交易品。',
      stats: [
        { label: '持有', value: state.player.berries },
        { label: '食用', value: '恢复 1 体力' },
        { label: '行情', value: '约 10 果 / 1 金' },
      ],
      hint: state.player.stamina < state.player.maxStamina ? '可在物品标签页点击“食用”。' : '当前体力充足。',
      tone: 'good',
    }
  }
  if (focus.kind === 'equipment') {
    const item = state.equipment.find((entry) => entry.id === focus.itemId)
    if (item) {
      return {
        category: '装备',
        meta: item.equipped ? '当前已装备' : '收纳于装备栏',
        name: item.name,
        icon: equipmentGlyph[item.slot],
        description: item.description,
        stats: [
          { label: '槽位', value: item.slot },
          { label: '伤害', value: item.kind ?? '—' },
          { label: '威力', value: item.power },
          { label: '防御', value: item.defense },
        ],
        hint: '装备仅改变数值，不叠加绘制到角色身体上。',
        tone: item.equipped ? 'good' : 'neutral',
      }
    }
  }
  if (focus.kind === 'party') {
    const agent = state.agents.find((item) => item.id === focus.agentId)
    if (agent) return personDetail(state, agent)
  }
  if (focus.kind === 'camp') {
    const camp = state.camps.find((item) => item.id === focus.campId)
    if (camp) {
      const daily = campDailyYield(state, camp)
      const stats = effectiveCampStats(state, camp)
      return {
        category: '营地',
        meta: `场景 ${camp.sceneX},${camp.sceneY}`,
        name: camp.name,
        icon: '⌂',
        description: '永久照亮控制范围，并作为建筑、道路与人口经营的中心。',
        stats: [
          { label: '人口', value: `${campPopulation(state, camp.id)}/${camp.housing}` },
          { label: '食物', value: stats.food },
          { label: '防御', value: stats.defense },
          { label: '经济', value: stats.economy },
          { label: '士气', value: stats.morale },
          { label: '范围', value: stats.controlRadius },
          { label: '建筑', value: camp.buildings.length },
        ],
        hint: `每日 +${daily.gold} 金/+${daily.berries} 果 · 建设 ${state.constructionSteps}/100 · 可建 ${state.buildingCredits} 格`,
        tone: 'good',
      }
    }
  }
  if (focus.kind === 'territory' && focus.factionId) {
    const faction = state.factions.find((item) => item.id === focus.factionId)
    if (faction) {
      return {
        category: '领地',
        meta: faction.isOverlord ? '效忠对象' : faction.isVassal ? '附属势力' : '外交对象',
        name: faction.name,
        icon: faction.isVassal ? '♜' : '⚑',
        description: faction.isVassal ? '承认你的宗主权，并在休息时缴纳贡金。' : '世界中的独立阵营，可通过交谈积累关系。',
        stats: [
          { label: '关系', value: `${faction.relation >= 0 ? '+' : ''}${faction.relation}` },
          { label: '状态', value: faction.isVassal ? '附属' : faction.isOverlord ? '宗主' : '独立' },
          { label: '贡金', value: faction.isVassal ? '2 金/日' : '—' },
        ],
        tone: faction.relation >= 0 ? 'good' : 'danger',
      }
    }
  }

  const villagers = state.residents.length + state.camps.reduce((total, camp) => total + Object.keys(camp.offices).length, 0)
  const vassals = state.factions.filter((faction) => faction.isVassal).length
  return {
    category: '领地',
    meta: '经营总览',
    name: state.camps.length ? '远征领地' : '尚未建立领地',
    icon: '♜',
    description: state.camps.length ? '由营地、驻守人口、建筑和附属势力组成的控制网络。' : '建立第一座营地后开始形成领地。',
    stats: [
      { label: '营地', value: state.camps.length },
      { label: '驻守', value: villagers },
      { label: '附属', value: vassals },
      { label: '日贡', value: `${vassals * 2} 金` },
    ],
    hint: '点击领地标签页中的阵营可查看关系详情。',
    tone: state.camps.length ? 'good' : 'neutral',
  }
}

export function SelectionDetails({ state, focus }: { state: GameState; focus: ExplorerFocus }) {
  const detail = focusDetail(state, focus)
  const portraitIndex = detail.portrait ? directionalCharacterIndex[detail.portrait.role] : null
  const portraitRow = detail.portrait ? directionalRow[detail.portrait.facing ?? 'down'] : 0
  return (
    <section className={`selection-details explorer-display tone-${detail.tone}`} aria-label="左上角详情展示窗口">
      <div className="selection-head">
        {portraitIndex === null ? (
          <span className="selection-icon detail-glyph" aria-hidden="true">{detail.icon}</span>
        ) : (
          <span
            className="detail-portrait"
            style={{
              backgroundImage: `url(${directionalCharactersUrl()})`,
              backgroundPosition: `${-portraitIndex * 64}px ${-portraitRow * 64}px`,
            }}
            aria-hidden="true"
          />
        )}
        <div>
          <p className="selection-eyebrow">{detail.category} · {detail.meta}</p>
          <h2>{detail.name}</h2>
        </div>
      </div>
      <p className="selection-description">{detail.description}</p>
      <dl className="selection-stats">
        {detail.stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {detail.hint ? <p className="selection-hint">{detail.hint}</p> : null}
    </section>
  )
}
