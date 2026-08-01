import { useEffect } from 'react'
import type { GameAction, GameState, Position } from '../game/types'
import { tileIndex } from '../game/world'

function isAdjacent(a: Position, b: Position) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

export function ActionDock({ state, dispatch }: { state: GameState; dispatch: React.Dispatch<GameAction> }) {
  const locked = Boolean(state.battle || state.fishing)
  const selectedTile = state.selected ? state.world.tiles[tileIndex(state.world, state.selected.x, state.selected.y)] : undefined
  const adjacent = Boolean(state.selected && isAdjacent(state.player, state.selected))
  const resourceReady = selectedTile?.resourceNode && (selectedTile.resourceReadyDay === undefined || selectedTile.resourceReadyDay <= state.day)
  const fishingActive = Boolean(state.fishing)

  useEffect(() => {
    if (!state.fishing) return
    const timer = window.setInterval(() => dispatch({ type: 'FISH_TICK' }), 40)
    const reel = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      dispatch({ type: 'REEL_FISH' })
    }
    window.addEventListener('keydown', reel)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', reel)
    }
  }, [dispatch, fishingActive])

  const contexts: { key: string; glyph: string; title: string; detail: string; disabled?: boolean; action: GameAction }[] = []
  if (state.activeDungeon) {
    contexts.push({ key: 'retreat', glyph: '↥', title: state.activeDungeon.bossDefeated ? '携宝返程' : '撤退', detail: '保留已取得战利品', action: { type: 'RETREAT_DUNGEON' } })
  }
  if (state.selected && adjacent && resourceReady) {
    contexts.push({ key: 'gather', glyph: selectedTile!.resourceNode === 'wood' ? '▥' : '◆', title: selectedTile!.resourceNode === 'wood' ? '采集木材' : '开采石料', detail: '疲劳 +20 · 行程 +1', action: { type: 'GATHER_RESOURCE', position: state.selected } })
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
  if (state.selected && adjacent && selectedTile?.terrain === 'water' && state.world.kind === 'overworld') {
    contexts.push({ key: 'fish', glyph: '≈', title: '抛竿', detail: '疲劳 +10 · 行程 +1', action: { type: 'CAST_FISH', position: state.selected } })
  }

  return (
    <>
      {state.fishing ? (
        <section className="fishing-panel" aria-label="钓鱼判定">
          <div className="fishing-copy"><span>≈ 岸边浮标</span><b>点击或空格收竿</b></div>
          <button className="fishing-meter" onClick={() => dispatch({ type: 'REEL_FISH' })} aria-label="收竿">
            <i className="success-zone" style={{ left: `${state.fishing.successStart}%`, width: `${state.fishing.successEnd - state.fishing.successStart}%` }} />
            <i className="perfect-zone" style={{ left: `${state.fishing.perfectStart}%`, width: `${state.fishing.perfectEnd - state.fishing.perfectStart}%` }} />
            <b style={{ left: `${state.fishing.cursor}%` }} />
          </button>
          <small>暗绿：成功 · 金色：完美 · 其余：空钩</small>
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
          {contexts.map((context) => <button key={context.key} disabled={locked || context.disabled} onClick={() => dispatch(context.action)}><span className="action-glyph">{context.glyph}</span><span className="action-copy"><b>{context.title}</b><small>{context.detail}</small></span></button>)}
          {!state.activeDungeon ? <button disabled={locked || state.resources.wood < 8 || state.resources.stone < 5} onClick={() => dispatch({ type: 'FOUND_CAMP' })}><span className="action-glyph">⌂</span><span className="action-copy"><b>建立营地</b><small>8 木 · 5 石</small></span></button> : null}
          <button disabled={locked} onClick={() => dispatch({ type: 'REST' })}><span className="action-glyph">☾</span><span className="action-copy"><b>休息整备</b><small>恢复体力并结算</small></span></button>
        </div>
        <p className="keyboard-hint">点击相邻资源、水域或副本设施显示行动 · 移动 10 格推进 1 天 · 100 步消耗 1 体力</p>
      </section>
    </>
  )
}
