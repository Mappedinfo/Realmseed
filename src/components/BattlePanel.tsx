import { useEffect, useRef, useState } from 'react'
import { combatMove, combatMoves } from '../game/combat'
import {
  directionalCharactersUrl,
  directionalMonsterIndex,
  directionalMonstersUrl,
} from '../game/art'
import type { CombatMoveId, GameAction, GameState } from '../game/types'

const EFFECT_DURATION = 640

function SpritePortrait({
  type,
  column,
  facing,
}: {
  type: 'character' | 'monster'
  column: number
  facing: 'west' | 'east'
}) {
  const row = facing === 'west' ? 2 : 3
  return (
    <span
      className={`battle-sprite ${type}`}
      style={{
        backgroundImage: `url("${type === 'character' ? directionalCharactersUrl() : directionalMonstersUrl()}")`,
        backgroundPosition: `${-column * 64}px ${-row * 64}px`,
      }}
      aria-hidden="true"
    />
  )
}

function CombatEffect({ moveId }: { moveId: CombatMoveId }) {
  return (
    <div className={`combat-effect effect-${moveId}`} aria-hidden="true">
      <i className="effect-core" />
      <i className="effect-trail" />
      <i className="effect-impact" />
      <i className="effect-smoke smoke-one" />
      <i className="effect-smoke smoke-two" />
      <i className="effect-spark spark-one" />
      <i className="effect-spark spark-two" />
    </div>
  )
}

export function BattlePanel({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}) {
  const [activeMoveId, setActiveMoveId] = useState<CombatMoveId | null>(null)
  const actionTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (actionTimer.current !== null) window.clearTimeout(actionTimer.current)
  }, [])

  useEffect(() => {
    setActiveMoveId(null)
    if (actionTimer.current !== null) window.clearTimeout(actionTimer.current)
    actionTimer.current = null
  }, [state.battle?.monsterId])

  if (!state.battle) return null
  const monster = state.monsters.find((item) => item.id === state.battle?.monsterId)
  if (!monster) return null
  const monsterName = monster.species === 'slime' ? '苔泥团' : monster.species === 'boar' ? '棘背兽' : '迷雾精'
  const monsterColumn = directionalMonsterIndex[monster.species]
  const hpPercent = Math.max(0, (monster.hp / state.battle.monsterMaxHp) * 100)
  const targetDistance = Math.max(1, Math.abs(monster.x - state.player.x) + Math.abs(monster.y - state.player.y))

  const performMove = (moveId: CombatMoveId) => {
    if (activeMoveId) return
    setActiveMoveId(moveId)
    actionTimer.current = window.setTimeout(() => {
      dispatch({ type: 'COMBAT_ACTION', moveId })
      setActiveMoveId(null)
      actionTimer.current = null
    }, EFFECT_DURATION)
  }

  const controls = (
    <div className="combat-move-grid">
      {combatMoves.map((move) => {
        const outOfRange = targetDistance < move.minRange || targetDistance > move.maxRange
        return (
          <button
            key={move.id}
            className={`combat-move ${move.size} ${activeMoveId === move.id ? 'is-casting' : ''}`}
            onClick={() => performMove(move.id)}
            disabled={Boolean(activeMoveId) || state.player.stamina < move.staminaCost || outOfRange}
            title={outOfRange ? `目标距离 ${targetDistance} 格，超出射程` : move.description}
          >
            <i>{move.glyph}</i>
            <span>
              <strong>{move.name}</strong>
              <small>{move.range === 'melee' ? '近战' : '远程'} · 射程 {move.minRange}–{move.maxRange} · 命中 {move.accuracy}%</small>
              <small>威力 {move.power} · 暴击 {move.criticalChance}%{move.target === 'area' ? ` · 爆炸半径 ${move.blastRadius}` : ''}{move.staminaCost ? ` · 体力 ${move.staminaCost}` : ''}</small>
            </span>
          </button>
        )
      })}
    </div>
  )

  const lastResult = state.battle.lastMoveId ? combatMove(state.battle.lastMoveId) : null

  return (
    <section className={`battle-panel ${state.battle.mode}`} aria-label={`${monsterName}战斗`} aria-live="polite">
      <div className="battle-mode-switch">
        <span>本次战斗</span>
        {state.fieldCombatAlwaysOn ? (
          <strong className="field-lock-badge">◆ 右上角已锁定地图直战</strong>
        ) : (
          <>
            <button
              className={state.battle.mode === 'duel' ? 'is-selected' : ''}
              onClick={() => dispatch({ type: 'SET_BATTLE_MODE', mode: 'duel' })}
            >
              左右回合
            </button>
            <button
              className={state.battle.mode === 'field' ? 'is-selected' : ''}
              onClick={() => dispatch({ type: 'SET_BATTLE_MODE', mode: 'field' })}
            >
              地图直战
            </button>
          </>
        )}
        {lastResult ? (
          <span className={`battle-result ${state.battle.lastHit ? 'hit' : 'miss'}`}>
            {lastResult.name} · {state.battle.lastHit ? `${state.battle.lastCritical ? '暴击 ' : '命中 '}${state.battle.lastDamage}` : '未命中'}
          </span>
        ) : null}
        <button className="flee-button" onClick={() => dispatch({ type: 'FLEE_BATTLE' })} disabled={Boolean(activeMoveId)}>撤离</button>
      </div>

      {activeMoveId ? <CombatEffect moveId={activeMoveId} /> : null}

      {state.battle.mode === 'duel' ? (
        <>
          <div className="duel-stage">
            <div className="duelist player">
              <span>{state.player.name}</span>
              <SpritePortrait type="character" column={0} facing="east" />
              <strong>体力 {state.player.stamina}/{state.player.maxStamina}</strong>
            </div>
            <div className="round-mark"><small>ROUND</small><b>{state.battle.round}</b><i>VS</i></div>
            <div className="duelist monster">
              <span>{monsterName}</span>
              <SpritePortrait type="monster" column={monsterColumn} facing="west" />
              <strong>生命 {monster.hp}/{state.battle.monsterMaxHp}</strong>
              <em><i style={{ width: `${hpPercent}%` }} /></em>
            </div>
          </div>
          {controls}
        </>
      ) : (
        <div className="field-combat-bar">
          <div className="field-target">
            <SpritePortrait type="monster" column={monsterColumn} facing="west" />
            <span><small>地图目标 · 距离 {targetDistance} · 回合 {state.battle.round}</small><strong>{monsterName}</strong><em><i style={{ width: `${hpPercent}%` }} /></em></span>
          </div>
          {controls}
        </div>
      )}
    </section>
  )
}
