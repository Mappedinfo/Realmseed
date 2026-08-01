import { AUTO_AGGRO_REPAIR_COST, berryExchangeRate } from '../game/simulation'
import { agentSkills, challengeChance } from '../game/skills'
import type { Agent, Faction, GameAction, GameState } from '../game/types'

export function InteractionPanel({
  state,
  target,
  faction,
  dispatch,
  onClose,
}: {
  state: GameState
  target: Agent
  faction?: Faction
  dispatch: React.Dispatch<GameAction>
  onClose: () => void
}) {
  const buyRate = berryExchangeRate(state, target.id, 'buy')
  const sellRate = berryExchangeRate(state, target.id, 'sell')
  const skill = agentSkills[target.skill]
  const chance = challengeChance(state, target)
  const pursuit = Boolean(target.autoAggro || faction?.autoAggro)
  const hostile = (target.hostility ?? 0) > 0 || pursuit
  const trustLine =
    hostile
      ? pursuit
        ? `“${faction?.name ?? '我们'}的追缉令还在。交出赎偿金，否则就拔剑。”`
        : '“别再靠近。大家都看见你拔出了武器。”'
      : target.affection >= 3
      ? '“你走过的路，我愿意一起走。”'
      : target.affection > 0
        ? '“又见面了。今天想聊些什么？”'
        : '“迷雾里的生面孔……先说说你从哪里来。”'

  return (
    <section className={`interaction-panel ${hostile ? 'is-hostile' : ''}`} aria-label={`与 ${target.name} 交谈和交易`}>
      <div className="interaction-person">
        <span className="merchant-mark" style={{ '--agent-color': faction?.color ?? '#d8deca' } as React.CSSProperties}>◆</span>
        <div>
          <p className="panel-kicker">{pursuit ? 'FACTION WANTED NOTICE' : 'ROADSIDE EXCHANGE'}</p>
          <h3>{target.name}</h3>
          <small>{faction?.name ?? '自由旅人'} · {pursuit ? '阵营追缉中' : hostile ? `敌意 ${target.hostility ?? 0}/5` : `好感 ${'♥'.repeat(target.affection)}${'♡'.repeat(5 - target.affection)}`}</small>
        </div>
      </div>

      <div className="dialogue-copy">
        <p>{trustLine}</p>
        <button onClick={() => dispatch({ type: 'TALK', agentId: target.id })}>{hostile ? '尝试交涉' : '交谈'} <small>{hostile ? '可能直接开战' : '好感 +1'}</small></button>
        {target.role === 'wanderer' ? (
          <button
            onClick={() => dispatch({ type: 'RECRUIT', agentId: target.id })}
            disabled={hostile || target.affection < 3 || state.player.gold < 5}
          >
            邀请同行 <small>5 金</small>
          </button>
        ) : null}
      </div>

      {target.role === 'wanderer' ? (
        <div className="roadside-challenge">
          <div className="challenge-glyph" aria-hidden="true">{skill.glyph}</div>
          <div>
            <span>{skill.title} · 等级 {target.skillLevel}</span>
            <strong>{skill.challenge}</strong>
            <small>{skill.description}</small>
            <em>胜率 {chance}% · 胜利：好感 +2 / {skill.name}印记 +1 / {target.skillLevel} 金</em>
          </div>
          <button
            onClick={() => dispatch({ type: 'CHALLENGE_AGENT', agentId: target.id })}
            disabled={hostile || target.challengeWon || target.lastChallengeDay === state.day || state.player.stamina <= 0}
          >
            {target.challengeWon ? '已通过' : target.lastChallengeDay === state.day ? '今日已试' : '发起挑战'}
            <small>消耗 1 体力</small>
          </button>
        </div>
      ) : null}

      <div className="trade-counter">
        {pursuit && faction ? (
          <div className="pursuit-ransom">
            <span>悬赏赎偿</span>
            <strong>{faction.name} · 全境撤令</strong>
            <small>这是唯一的修复方式，会同时清除该阵营所有成员的主动攻击。</small>
            <button
              onClick={() => dispatch({ type: 'REPAIR_FACTION_AGGRO', factionId: faction.id, agentId: target.id })}
              disabled={state.player.gold < AUTO_AGGRO_REPAIR_COST}
            >
              支付 {AUTO_AGGRO_REPAIR_COST} 金 <span>{state.player.gold < AUTO_AGGRO_REPAIR_COST ? `还差 ${AUTO_AGGRO_REPAIR_COST - state.player.gold}` : '撤销追缉'}</span>
            </button>
          </div>
        ) : null}
        <div className="market-rate">
          <span>今日行情</span>
          <strong>买入 {buyRate} / 卖出 {sellRate} <i>果/金</i></strong>
          <small>商人库存：{target.berries} 果 / {target.gold} 金</small>
        </div>
        <button
          onClick={() => dispatch({ type: 'TRADE_BERRIES', agentId: target.id, direction: 'sell' })}
          disabled={hostile || state.player.berries < sellRate || target.gold < 1}
        >
          出售 {sellRate} 果 <span>+1 金</span>
        </button>
        <button
          onClick={() => dispatch({ type: 'TRADE_BERRIES', agentId: target.id, direction: 'buy' })}
          disabled={hostile || state.player.gold < 1 || target.berries < buyRate}
        >
          花 1 金购买 <span>+{buyRate} 果</span>
        </button>
      </div>

      <button className="close-interaction" onClick={onClose} aria-label="关闭交谈与交易">×</button>
    </section>
  )
}
