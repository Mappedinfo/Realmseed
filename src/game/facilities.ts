import { hashString } from './rng'
import type { FacilityEventKind, GameState, Position } from './types'

export const facilityEventDefinitions: Record<
  FacilityEventKind,
  { title: string; icon: string; description: string }
> = {
  monster: { title: '巢穴惊醒', icon: '!', description: '遗迹中的响动唤醒了一只怪物。' },
  coins: { title: '旧币暗格', icon: '●', description: '碎石下藏着一小袋旧金币。' },
  food: { title: '密封粮仓', icon: '◆', description: '尚未腐坏的野果与干粮被收入行囊。' },
  restoration: { title: '复苏泉眼', icon: '♥', description: '微光泉水让队伍的体力完全恢复。' },
  equipment: { title: '失落装备', icon: '✦', description: '一件旧时代装备仍可继续使用。' },
  companion: { title: '受困旅人', icon: '♟', description: '获救的旅人决定加入队伍。' },
}

// Percentile bands: monster 28, coins 20, food 18, restoration 12,
// equipment 12, companion 10. The result is stable for a world and ruin.
export function facilityEventKind(
  state: Pick<GameState, 'gameId' | 'world'>,
  position: Position,
): FacilityEventKind {
  const roll = hashString(
    `${state.gameId}:facility:${state.world.sceneX}:${state.world.sceneY}:${position.x}:${position.y}`,
  ) % 100
  if (roll < 28) return 'monster'
  if (roll < 48) return 'coins'
  if (roll < 66) return 'food'
  if (roll < 78) return 'restoration'
  if (roll < 90) return 'equipment'
  return 'companion'
}
