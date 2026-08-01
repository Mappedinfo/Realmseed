import type { FishId, Position, ResourceNodeKind } from '../game/types'

export type ExplorerFocus =
  | { kind: 'map'; position: Position }
  | { kind: 'player' }
  | { kind: 'inventory'; item: 'berries' | ResourceNodeKind | FishId }
  | { kind: 'equipment'; itemId: string }
  | { kind: 'party'; agentId: string }
  | { kind: 'camp'; campId: string }
  | { kind: 'territory'; factionId?: string }

export type ExplorerTab = 'inventory' | 'equipment' | 'party' | 'camps' | 'territory'
