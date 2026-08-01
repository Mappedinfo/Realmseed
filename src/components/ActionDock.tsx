import { useEffect } from 'react'
import type { GameAction, GameState, GatheringActivity, Position } from '../game/types'
import { tileIndex } from '../game/world'
import { FISHING_SPOT_CAPACITY, fishingFatigue, fishingSignalNames, fishingSpotKey, fishingSpotProgress } from '../game/fishing'

function isAdjacent(a: Position, b: Position) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

export function ActionDock({ state, dispatch, gathering, onGather }: { state: GameState; dispatch: React.Dispatch<GameAction>; gathering: GatheringActivity | null; onGather: (position: Position) => void }) {
  const locked = Boolean(state.battle || state.fishing)
  const selectedTile = state.selected ? state.world.tiles[tileIndex(state.world, state.selected.x, state.selected.y)] : undefined
  const adjacent = Boolean(state.selected && isAdjacent(state.player, state.selected))
  const resourceReady = selectedTile?.resourceNode && (selectedTile.resourceReadyDay === undefined || selectedTile.resourceReadyDay <= state.day)
  const fishingActive = Boolean(state.fishing)
  const castDistance = state.selected ? Math.abs(state.player.x - state.selected.x) + Math.abs(state.player.y - state.selected.y) : 0
  const selectedSpot = state.selected ? fishingSpotProgress(state.fishingSpots[fishingSpotKey(state.world, state.selected)], state.day) : { uses: 0 }

  useEffect(() => {
    if (!state.fishing) return
    const timer = state.fishing.phase === 'timing' ? window.setInterval(() => dispatch({ type: 'FISH_TICK' }), 40) : undefined
    const reel = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      event.preventDefault()
      dispatch({ type: state.fishing?.phase === 'timing' ? 'REEL_FISH' : 'RECAST_FISH' })
    }
    window.addEventListener('keydown', reel)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      window.removeEventListener('keydown', reel)
    }
  }, [dispatch, fishingActive, state.fishing?.phase])

  const contexts: { key: string; glyph: string; title: string; detail: string; disabled?: boolean; action?: GameAction; run?: () => void }[] = []
  if (state.activeDungeon) {
    contexts.push({ key: 'retreat', glyph: '↥', title: state.activeDungeon.bossDefeated ? '携宝返程' : '撤退', detail: '保留已取得战利品', action: { type: 'RETREAT_DUNGEON' } })
  }
  if (state.selected && resourceReady && state.world.kind === 'overworld') {
    const kind = selectedTile!.resourceNode!
    contexts.push({
      key: 'gather',
      glyph: kind === 'wood' ? '▥' : '◆',
      title: gathering ? gathering.kind === 'wood' ? '正在自动伐木' : '正在自动采石' : kind === 'wood' ? '自动伐木' : '自动采石',
      detail: state.player.stamina <= 0 ? '体力耗尽 · 休息后才能作业' : gathering ? `${gathering.phase === 'routing' ? '前往作业区' : `敲击 ${gathering.strike}/${gathering.totalStrikes}`} · 点击其他行动取消` : `${adjacent ? '原地开工' : '自动寻路'} · ${kind === 'wood' ? '3 斧' : '5 锤'} · 疲劳 +20`,
      disabled: Boolean(gathering) || state.player.stamina <= 0,
      run: () => onGather(state.selected!),
    })
  }
  if (state.selected && adjacent && (selectedTile?.structure === 'cave' || selectedTile?.structure === 'nest')) {
    contexts.push({ key: 'enter', glyph: '▼', title: `进入${selectedTile.structure === 'cave' ? '洞穴' : '巢穴'}`, detail: '固定三层 · 次日重置', action: { type: 'ENTER_DUNGEON', position: state.selected } })
  }
  if (state.selected && adjacent && (selectedTile?.structure === 'stairs-down' || selectedTile?.structure === 'stairs-up')) {
    contexts.push({ key: 'stairs', glyph: selectedTile.structure === 'stairs-down' ? '▼' : '▲', title: selectedTile.structure === 'stairs-down' ? '前往下层' : '返回上层', detail: selectedTile.structure === 'stairs-down' ? '需击败守层精英' : '返回已探索楼层', action: { type: 'USE_DUNGEON_STAIRS', position: state.selected } })
  }
  if (state.selected && adjacent && selectedTile?.structure === 'chest' && !selectedTile.chestOpened) {
    contexts.push({ key: 'chest', glyph: '▣', title: '开启宝箱', detail: '材料 · 金币 · 遗迹装备', action: { type: 'OPEN_CHEST', position: state.selected } })
  }
  if (state.selected && castDistance >= 1 && castDistance <= 2 && selectedTile?.terrain === 'water' && state.world.kind === 'overworld') {
    contexts.push({ key: 'fish', glyph: '≈', title: selectedSpot.uses >= FISHING_SPOT_CAPACITY ? '钓位沉寂' : '抛竿', detail: selectedSpot.uses >= FISHING_SPOT_CAPACITY ? `第 ${selectedSpot.readyDay} 日恢复` : `第 ${selectedSpot.uses + 1} 杆 · 疲劳 +${fishingFatigue(selectedSpot.uses + 1)}`, disabled: selectedSpot.uses >= FISHING_SPOT_CAPACITY, action: { type: 'CAST_FISH', position: state.selected } })
  }

  return (
    <>
      {state.fishing ? (
        <section className={`fishing-panel phase-${state.fishing.phase}`} aria-label="钓鱼判定">
          <div className="fishing-copy"><span>≈ 钓位 {state.fishing.water.x},{state.fishing.water.y}</span><b>已钓 {fishingSpotProgress(state.fishingSpots[fishingSpotKey(state.world, state.fishing.water)], state.day).uses}/10</b></div>
          <div className="fishing-status-strip">
            <span>第 {state.fishing.castNumber} 杆</span><span>疲劳 +{state.fishing.fatigueCost}</span>
            <span>{state.fishing.influence ? `${fishingSignalNames[state.fishing.influence.kind]} · ${state.fishing.influence.strength === 'strong' ? '强钓讯' : '弱钓讯'}` : '普通水域'}</span>
          </div>
          {state.fishing.phase === 'timing' ? (
            <>
              <button className="fishing-meter" onClick={() => dispatch({ type: 'REEL_FISH' })} aria-label="收竿">
                <i className="success-zone" style={{ left: `${state.fishing.successStart}%`, width: `${state.fishing.successEnd - state.fishing.successStart}%` }} />
                <i className="perfect-zone" style={{ left: `${state.fishing.perfectStart}%`, width: `${state.fishing.perfectEnd - state.fishing.perfectStart}%` }} />
                <b style={{ left: `${state.fishing.cursor}%` }} />
              </button>
              <small>点击或空格收竿 · 暗绿成功 · 金色完美</small>
            </>
          ) : (
            <div className={`fishing-result tone-${state.fishing.result?.tone ?? 'plain'}`}>
              <span>{state.fishing.result?.quality === 'perfect' ? '完美收竿' : state.fishing.result?.quality === 'success' ? '成功收竿' : '本杆落空'}</span>
              <b>{state.fishing.result?.label}</b>
              <div><button onClick={() => dispatch({ type: 'RECAST_FISH' })} disabled={fishingSpotProgress(state.fishingSpots[fishingSpotKey(state.world, state.fishing.water)], state.day).uses >= FISHING_SPOT_CAPACITY}>再次抛竿 <small>SPACE</small></button><button onClick={() => dispatch({ type: 'END_FISHING' })}>结束钓鱼</button></div>
            </div>
          )}
        </section>
      ) : null}
      <section className="action-dock" aria-label="行动">
        <div className="dpad" aria-label="方向移动">
          <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'up' })} aria-label="向上">▲</button>
          <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'left' })} aria-label="向左">◀</button>
          <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'down' })} aria-label="向下">▼</button>
          <button disabled={locked} onClick={() => dispatch({ type: 'MOVE', direction: 'right' })} aria-label="向右">▶</button>
        </div>
        <div className="action-buttons">
          {contexts.map((context) => <button key={context.key} disabled={locked || context.disabled} onClick={() => context.run ? context.run() : context.action && dispatch(context.action)}><span className="action-glyph">{context.glyph}</span><span className="action-copy"><b>{context.title}</b><small>{context.detail}</small></span></button>)}
          {!state.activeDungeon ? <button disabled={locked || state.resources.wood < 8 || state.resources.stone < 5} onClick={() => dispatch({ type: 'FOUND_CAMP' })}><span className="action-glyph">⌂</span><span className="action-copy"><b>建立营地</b><small>8 木 · 5 石</small></span></button> : null}
          <button disabled={locked} onClick={() => dispatch({ type: 'REST' })}><span className="action-glyph">☾</span><span className="action-copy"><b>休息整备</b><small>恢复体力并结算</small></span></button>
        </div>
        <p className="keyboard-hint">选择资源可自动寻路作业 · 伐木 3 斧 / 采石 5 锤 · 任意手动操作取消</p>
      </section>
    </>
  )
}
