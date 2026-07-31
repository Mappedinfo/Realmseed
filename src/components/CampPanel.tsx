import type { CampBuildingKind, GameAction, GameState } from '../game/types'

const buildingOptions: { kind: CampBuildingKind; name: string; effect: string }[] = [
  { kind: 'house', name: '居所', effect: '人口 +2' },
  { kind: 'watchtower', name: '哨塔', effect: '防御 +2 · 范围 +1' },
  { kind: 'market', name: '集市', effect: '经济 +2' },
]

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
              <button
                className="return-camp"
                disabled={!local || Boolean(state.battle)}
                onClick={() => dispatch({ type: 'RETURN_TO_CAMP', campId: selectedCamp.id })}
              >
                {local ? '自动寻路返回' : '先前往对应场景'}
              </button>
              <p className="build-progress">建设勘察 {state.constructionSteps}/100 · 可建 {state.buildingCredits} 格</p>
              <div className="camp-buildings">
                {buildingOptions.map((option) => (
                  <button
                    key={option.kind}
                    disabled={!local || state.buildingCredits <= 0 || !state.selected || Boolean(state.battle)}
                    onClick={() => dispatch({ type: 'BUILD_CAMP_TILE', kind: option.kind })}
                    title="先点击地图中营地高亮范围内的空格"
                  >
                    <b>{option.name}</b><small>{option.effect}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
