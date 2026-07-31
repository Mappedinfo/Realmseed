import { inspectPosition } from '../game/inspection'
import type { GameState } from '../game/types'

export function SelectionDetails({ state }: { state: GameState }) {
  if (!state.selected) {
    return (
      <section className="selection-details is-empty" aria-label="地图元素详情">
        <p className="selection-eyebrow">INSPECT</p>
        <div className="selection-empty-icon">⌖</div>
        <strong>点击地图元素</strong>
        <span>人物、怪物、建筑、资源、道路与地形都会在这里显示详情。</span>
      </section>
    )
  }

  const detail = inspectPosition(state, state.selected)
  return (
    <section className={`selection-details tone-${detail.tone}`} aria-label="地图元素详情">
      <div className="selection-head">
        <span className="selection-icon" aria-hidden="true">{detail.icon}</span>
        <div>
          <p className="selection-eyebrow">{detail.category} · {detail.position.x},{detail.position.y}</p>
          <h3>{detail.name}</h3>
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
