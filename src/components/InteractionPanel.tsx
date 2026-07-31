import { berryExchangeRate } from '../game/simulation'
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
  const rate = berryExchangeRate(state, target.id)
  const trustLine =
    target.affection >= 3
      ? '“你走过的路，我愿意一起走。”'
      : target.affection > 0
        ? '“又见面了。今天想聊些什么？”'
        : '“迷雾里的生面孔……先说说你从哪里来。”'

  return (
    <section className="interaction-panel" aria-label={`与 ${target.name} 交谈和交易`}>
      <div className="interaction-person">
        <span className="merchant-mark" style={{ '--agent-color': faction?.color ?? '#d8deca' } as React.CSSProperties}>◆</span>
        <div>
          <p className="panel-kicker">ROADSIDE EXCHANGE</p>
          <h3>{target.name}</h3>
          <small>{faction?.name ?? '自由旅人'} · 好感 {'♥'.repeat(target.affection)}{'♡'.repeat(5 - target.affection)}</small>
        </div>
      </div>

      <div className="dialogue-copy">
        <p>{trustLine}</p>
        <button onClick={() => dispatch({ type: 'TALK', agentId: target.id })}>交谈 <small>好感 +1</small></button>
        {target.role === 'wanderer' ? (
          <button
            onClick={() => dispatch({ type: 'RECRUIT', agentId: target.id })}
            disabled={target.affection < 3 || state.player.gold < 5}
          >
            邀请同行 <small>5 金</small>
          </button>
        ) : null}
      </div>

      <div className="trade-counter">
        <div className="market-rate">
          <span>今日行情</span>
          <strong>{rate} <i>野果</i> = 1 <i>金币</i></strong>
          <small>商人库存：{target.berries} 果 / {target.gold} 金</small>
        </div>
        <button
          onClick={() => dispatch({ type: 'TRADE_BERRIES', agentId: target.id, direction: 'sell' })}
          disabled={state.player.berries < rate || target.gold < 1}
        >
          出售 {rate} 果 <span>+1 金</span>
        </button>
        <button
          onClick={() => dispatch({ type: 'TRADE_BERRIES', agentId: target.id, direction: 'buy' })}
          disabled={state.player.gold < 1 || target.berries < rate}
        >
          花 1 金购买 <span>+{rate} 果</span>
        </button>
      </div>

      <button className="close-interaction" onClick={onClose} aria-label="关闭交谈与交易">×</button>
    </section>
  )
}
