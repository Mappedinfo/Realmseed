import type { Dispatch } from 'react'
import type { GameAction, GameState } from '../game/types'

export function FacilityEventPanel({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: Dispatch<GameAction>
}) {
  if (!state.facilityEvent) return null
  return (
    <section className={`facility-event facility-event-${state.facilityEvent.kind}`} aria-live="assertive">
      <div>
        <small>FACILITY EVENT · 设施事件</small>
        <h2>{state.facilityEvent.title}</h2>
        <p>{state.facilityEvent.description}</p>
      </div>
      <button onClick={() => dispatch({ type: 'DISMISS_FACILITY_EVENT' })}>收起记录</button>
    </section>
  )
}
