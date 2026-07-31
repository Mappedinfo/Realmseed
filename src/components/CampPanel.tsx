import { campBuildingDefinitions, campBuildingKinds, campDailyYield } from '../game/camps'
import type { GameAction, GameState } from '../game/types'

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
  const selectedCamp = state.camps.find((camp) => camp.id === selectedCampId) ?? state.camps[0]
  const local = selectedCamp
    ? selectedCamp.sceneX === state.world.sceneX && selectedCamp.sceneY === state.world.sceneY
    : false

  return (
    <div className="camp-panel tab-panel-content">
      {state.camps.length === 0 ? (
        <p className="empty-copy">花费 8 金建立营地，随后移动 100 步可获得 1 格建筑额度。</p>
      ) : (
        <>
          <div className="camp-list">
            {state.camps.map((camp) => (
              <button
                key={camp.id}
                className={camp.id === selectedCamp?.id ? 'is-active' : ''}
                onClick={() => onSelectCamp(camp.id)}
              >
                <span>⌂ {camp.name}</span>
                <small>[{camp.sceneX}, {camp.sceneY}] · {camp.buildings.length} 建筑</small>
              </button>
            ))}
          </div>
          {selectedCamp ? (
            <div className="camp-operations">
              <div className="camp-operation-grid">
                <span><b>{selectedCamp.population}/{selectedCamp.housing}</b><small>人口/容量</small></span>
                <span><b>{selectedCamp.food}</b><small>食物</small></span>
                <span><b>{selectedCamp.defense}</b><small>防御</small></span>
                <span><b>{selectedCamp.economy}</b><small>经济</small></span>
                <span><b>{selectedCamp.morale}</b><small>士气</small></span>
                <span><b>{selectedCamp.controlRadius}</b><small>控制范围</small></span>
              </div>
              <p className="camp-yield-line">
                每日结算：+{campDailyYield(selectedCamp).gold} 金 · +{campDailyYield(selectedCamp).berries} 果
              </p>
              <button
                className="return-camp"
                disabled={!local || Boolean(state.battle)}
                onClick={() => dispatch({ type: 'RETURN_TO_CAMP', campId: selectedCamp.id })}
              >
                {local ? '自动寻路返回' : '先前往对应场景'}
              </button>
              <p className="build-progress">建设勘察 {state.constructionSteps}/100 · 可建 {state.buildingCredits} 格</p>
              <div className="camp-buildings">
                {campBuildingKinds.map((kind) => {
                  const option = campBuildingDefinitions[kind]
                  return (
                  <button
                    key={option.kind}
                    disabled={!local || state.buildingCredits <= 0 || !state.selected || Boolean(state.battle) || state.player.gold < option.cost}
                    onClick={() => dispatch({ type: 'BUILD_CAMP_TILE', kind: option.kind })}
                    title={`${option.detail}；先点击地图中营地高亮范围内的空格`}
                  >
                    <i>{option.glyph}</i>
                    <b>{option.name}</b>
                    <small>{option.summary}</small>
                    <em>{option.cost} 金 · 1 格</em>
                  </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
