import type { Agent, EquipmentItem, EquipmentPosition, GameState } from './types'

export const equipmentPositions: EquipmentPosition[] = [
  'main-hand', 'off-hand', 'ranged', 'focus', 'utility',
  'hat', 'pendant', 'inner', 'coat', 'cloak',
  'belt', 'bracers', 'gloves', 'pants', 'boots',
  'mount', 'ring-1', 'ring-2', 'ring-3', 'ring-4',
]

export const equipmentPositionNames: Record<EquipmentPosition, string> = {
  'main-hand': '主手', 'off-hand': '副手', ranged: '远程', focus: '法器', utility: '挂具',
  hat: '帽子', pendant: '挂坠', inner: '内衬', coat: '外套', cloak: '披风',
  belt: '腰带', bracers: '护臂', gloves: '手套', pants: '裤子', boots: '靴子',
  mount: '坐骑', 'ring-1': '戒指Ⅰ', 'ring-2': '戒指Ⅱ', 'ring-3': '戒指Ⅲ', 'ring-4': '戒指Ⅳ',
}

export const equipmentPositionGlyphs: Record<EquipmentPosition, string> = {
  'main-hand': '⚔', 'off-hand': '◩', ranged: '➶', focus: '◆', utility: '✹',
  hat: '⌃', pendant: '◇', inner: '╫', coat: '▣', cloak: '◢',
  belt: '═', bracers: '▤', gloves: '✦', pants: 'Ⅱ', boots: '∟',
  mount: '♞', 'ring-1': '○', 'ring-2': '○', 'ring-3': '○', 'ring-4': '○',
}

export const legacyPosition = (item: EquipmentItem): EquipmentPosition => {
  if (item.position) return item.position
  if (item.slot === 'weapon') return 'main-hand'
  if (item.slot === 'focus') return 'focus'
  if (item.slot === 'firearm') return 'ranged'
  if (item.slot === 'explosive') return 'utility'
  return item.id.includes('mantle') ? 'cloak' : 'coat'
}

export function allowedPositions(item: EquipmentItem): EquipmentPosition[] {
  if (item.allowedPositions?.length) return item.allowedPositions
  const position = legacyPosition(item)
  return position === 'main-hand' ? ['main-hand', 'off-hand'] : [position]
}

export function wornBy(item: EquipmentItem, characterId = 'player'): boolean {
  return item.equippedBy === characterId && Boolean(item.position)
}

export function characterEquipment(state: Pick<GameState, 'equipment'>, characterId: string): EquipmentItem[] {
  return state.equipment.filter((item) => wornBy(item, characterId))
}

export function partyCharacters(state: GameState): Agent[] {
  const followers = state.agents.filter((agent) => agent.role === 'follower')
  const officials = state.camps.flatMap((camp) => Object.values(camp.offices).filter(Boolean) as Agent[])
  return [state.player, ...followers, ...officials]
}

export function canManageEquipment(state: GameState, characterId: string): boolean {
  if (characterId === 'player') return true
  if (state.agents.some((agent) => agent.id === characterId && agent.role === 'follower')) return true
  return state.camps.some((camp) => Object.values(camp.offices).some((agent) => agent?.id === characterId) &&
    camp.sceneX === state.world.sceneX && camp.sceneY === state.world.sceneY && camp.x === state.player.x && camp.y === state.player.y)
}

export interface EquipmentTotals {
  defense: number; accuracy: number; critical: number; block: number
  stamina: number; vision: number; fatigueReduction: number
}

export function equipmentTotals(items: EquipmentItem[], characterId = 'player'): EquipmentTotals {
  return items.filter((item) => wornBy(item, characterId)).reduce((sum, item) => ({
    defense: sum.defense + item.defense,
    accuracy: sum.accuracy + (item.accuracy ?? 0),
    critical: sum.critical + (item.critical ?? 0),
    block: sum.block + (item.block ?? 0),
    stamina: sum.stamina + (item.stamina ?? 0),
    vision: sum.vision + (item.vision ?? 0),
    fatigueReduction: sum.fatigueReduction + (item.fatigueReduction ?? 0),
  }), { defense: 0, accuracy: 0, critical: 0, block: 0, stamina: 0, vision: 0, fatigueReduction: 0 })
}

export function migrateEquipment(items: EquipmentItem[], playerId = 'player'): EquipmentItem[] {
  const migrated = items.map((item) => ({ ...item, allowedPositions: allowedPositions(item), equippedBy: item.equipped ? playerId : item.equippedBy, position: item.equipped ? legacyPosition(item) : item.position, equipped: false }))
  const winners = new Map<string, EquipmentItem>()
  for (const item of migrated.filter((candidate) => candidate.equippedBy && candidate.position)) {
    const key = `${item.equippedBy}:${item.position}`
    const current = winners.get(key)
    if (!current || item.power + item.defense > current.power + current.defense) winners.set(key, item)
  }
  return migrated.map((item) => item.equippedBy && item.position && winners.get(`${item.equippedBy}:${item.position}`)?.id !== item.id
    ? { ...item, equippedBy: undefined, position: undefined }
    : item)
}
