import { combatMoves } from '../game/combat'
import {
  directionalCharactersUrl,
  directionalMonsterIndex,
  directionalMonstersUrl,
} from '../game/art'
import type { GameAction, GameState } from '../game/types'

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

export function BattlePanel({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: React.Dispatch<GameAction>
}) {
  if (!state.battle) return null
  const monster = state.monsters.find((item) => item.id === state.battle?.monsterId)
  if (!monster) return null
  const monsterName = monster.species === 'slime' ? '苔泥团' : monster.species === 'boar' ? '棘背兽' : '迷雾精'
  const monsterColumn = directionalMonsterIndex[monster.species]
  const hpPercent = Math.max(0, (monster.hp / state.battle.monsterMaxHp) * 100)

  const controls = (
    <div className="combat-move-grid">
      {combatMoves.map((move) => (
        <button
          key={move.id}
          className={`combat-move ${move.size}`}
          onClick={() => dispatch({ type: 'COMBAT_ACTION', moveId: move.id })}
          disabled={state.player.stamina < move.staminaCost}
          title={move.description}
        >
          <i>{move.glyph}</i>
          <span>
            <strong>{move.name}</strong>
            <small>{move.range === 'melee' ? '近' : '远'} · {
              move.kind === 'physical' ? '物理' : move.kind === 'magic' ? '魔法' : move.kind === 'firearm' ? '枪械' : '炸弹'
            } · 威力 {move.power}{move.staminaCost ? ` · ${move.staminaCost} 体力` : ''}</small>
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <section className={`battle-panel ${state.battle.mode}`} aria-label={`${monsterName}战斗`}>
      <div className="battle-mode-switch">
        <span>本次战斗</span>
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
        <button className="flee-button" onClick={() => dispatch({ type: 'FLEE_BATTLE' })}>撤离</button>
      </div>

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
            <span><small>地图内目标 · 回合 {state.battle.round}</small><strong>{monsterName}</strong><em><i style={{ width: `${hpPercent}%` }} /></em></span>
          </div>
          {controls}
        </div>
      )}
    </section>
  )
}
