import type { GameState, Position, Structure, Tile } from './types'
import { tileIndex } from './world'

export type RedNameTargetKind = 'agent' | 'monster' | 'structure'

export interface RedNameTarget {
  id: string
  kind: RedNameTargetKind
  name: string
  position: Position
  hp: number
  maxHp: number
  attackable: boolean
  reason?: string
}

const monsterNames = { slime: '苔泥团', boar: '棘背兽', wisp: '迷雾精' } as const
const structureNames: Record<Structure, string> = {
  camp: '营地核心',
  village: '中立村庄',
  ruin: '古代遗迹',
  waystone: '古道界碑',
  'camp-building': '营地建筑',
  cave: '深岩洞穴',
  nest: '腐根巢穴',
  'stairs-down': '下层阶梯',
  'stairs-up': '上层阶梯',
  chest: '地下宝箱',
  'dungeon-exit': '返程出口',
}

export function structureMaxHp(tile: Tile): number {
  if (tile.structure === 'camp') return 24
  if (tile.structure === 'village') return 18
  if (tile.structure === 'camp-building') return 14
  if (tile.structure === 'waystone') return 20
  return 12
}

export function redNameTargetAt(state: GameState, position: Position): RedNameTarget | null {
  const agent = state.agents.find(
    (item) => item.role !== 'follower' && item.x === position.x && item.y === position.y,
  )
  if (agent) {
    const sameFaction = state.player.factionId !== 'free' && agent.factionId === state.player.factionId
    return {
      id: agent.id,
      kind: 'agent',
      name: agent.name,
      position,
      hp: agent.hp,
      maxHp: agent.maxHp,
      attackable: !sameFaction,
      reason: sameFaction ? '同阵营角色不是红名目标。' : undefined,
    }
  }
  const monster = state.monsters.find((item) => item.x === position.x && item.y === position.y)
  if (monster) {
    return {
      id: monster.id,
      kind: 'monster',
      name: monsterNames[monster.species],
      position,
      hp: monster.hp,
      maxHp: Math.max(monster.hp, 10),
      attackable: true,
    }
  }
  const tile = state.world.tiles[tileIndex(state.world, position.x, position.y)]
  if (!tile?.structure) return null
  const ownStructure = Boolean(tile.campId && state.camps.some((camp) => camp.id === tile.campId))
  const maxHp = tile.structureMaxHp ?? structureMaxHp(tile)
  return {
    id: `structure-${position.x}-${position.y}`,
    kind: 'structure',
    name: tile.structure === 'camp-building' && tile.buildingKind
      ? `${structureNames[tile.structure]} · ${tile.buildingKind}`
      : structureNames[tile.structure],
    position,
    hp: tile.structureHp ?? maxHp,
    maxHp,
    attackable: !ownStructure,
    reason: ownStructure ? '自己的营地设施不属于红名目标。' : undefined,
  }
}

export function redNameDistance(state: GameState, position: Position): number {
  return Math.max(1, Math.abs(state.player.x - position.x) + Math.abs(state.player.y - position.y))
}
