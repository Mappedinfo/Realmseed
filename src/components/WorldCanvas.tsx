import { useCallback, useEffect, useRef, useState } from 'react'
import type { CampBuildingKind, CombatMoveId, Direction, GameAction, GameState, Position, Structure, Terrain } from '../game/types'
import {
  ART_CELL,
  GENERATED_CELL,
  atlasUrl,
  directionalCharacterIndex,
  directionalCharactersUrl,
  directionalMonsterIndex,
  directionalMonstersUrl,
  directionalRow,
  facilityAtlasUrl,
  facilityIndex,
  generatedCharacterIndex,
  generatedCharactersUrl,
  generatedObjectIndex,
  generatedObjectsUrl,
  generatedTerrainUrl,
  spriteIndex,
  type ArtTheme,
  type SpriteId,
} from '../game/art'
import { inspectPosition } from '../game/inspection'
import { effectiveCampStats } from '../game/camps'
import { isWithinInteractionRange } from '../game/geometry'
import { tileIndex } from '../game/world'
import { combatMoves } from '../game/combat'
import { redNameDistance, redNameTargetAt } from '../game/redName'

const TILE = 32
const VIEW_COLS = 25
const VIEW_ROWS = 17
const terrainColors: Record<Terrain, [string, string]> = {
  meadow: ['#6f9b5b', '#88ad65'],
  forest: ['#315d45', '#4a7650'],
  water: ['#32687b', '#4b8292'],
  mountain: ['#6a6964', '#858078'],
  marsh: ['#476b5f', '#5f8270'],
  sand: ['#bca96f', '#d0be82'],
}

function drawSprite(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  sprite: SpriteId,
  x: number,
  y: number,
) {
  const index = spriteIndex[sprite]
  const sourceX = (index % 8) * ART_CELL
  const sourceY = Math.floor(index / 8) * ART_CELL
  context.drawImage(atlas, sourceX, sourceY, ART_CELL, ART_CELL, x, y, TILE, TILE)
}

function drawGeneratedCell(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  index: number,
  x: number,
  y: number,
) {
  const sourceX = (index % 8) * GENERATED_CELL
  const sourceY = Math.floor(index / 8) * GENERATED_CELL
  context.drawImage(atlas, sourceX, sourceY, GENERATED_CELL, GENERATED_CELL, x, y, TILE, TILE)
}

function drawDirectionalCell(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  column: number,
  facing: Direction,
  x: number,
  y: number,
) {
  context.drawImage(
    atlas,
    column * GENERATED_CELL,
    directionalRow[facing] * GENERATED_CELL,
    GENERATED_CELL,
    GENERATED_CELL,
    x,
    y,
    TILE,
    TILE,
  )
}

function pixelRect(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = color
  context.fillRect(Math.round(x), Math.round(y), width, height)
}

function drawTile(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  generatedTerrain: HTMLImageElement | null,
  terrain: Terrain,
  x: number,
  y: number,
  worldX: number,
  worldY: number,
) {
  const variant = Math.abs((worldX * 17 + worldY * 31) % 2) as 0 | 1
  if (generatedTerrain) {
    drawGeneratedCell(context, generatedTerrain, spriteIndex[`${terrain}-${variant}`], x, y)
    return
  }
  if (atlas) {
    drawSprite(context, atlas, `${terrain}-${variant}`, x, y)
    return
  }
  const [base, accent] = terrainColors[terrain]
  pixelRect(context, base, x, y, TILE, TILE)
  const pattern = Math.abs((worldX * 17 + worldY * 31) % 5)
  if (terrain === 'water') {
    pixelRect(context, accent, x + 3 + pattern, y + 8, 13, 2)
    pixelRect(context, '#285665', x + 15, y + 20, 12, 2)
    pixelRect(context, '#5a95a3', x + 4, y + 27, 8, 1)
  } else if (terrain === 'forest') {
    pixelRect(context, '#234b38', x + 4, y + 5, 7, 8)
    pixelRect(context, accent, x + 6, y + 3, 5, 5)
    pixelRect(context, '#6f593e', x + 7, y + 13, 2, 5)
    pixelRect(context, '#294d38', x + 19, y + 13, 8, 9)
    pixelRect(context, '#4f8056', x + 21, y + 9, 5, 7)
    pixelRect(context, '#6f593e', x + 22, y + 22, 2, 5)
    if (pattern > 2) pixelRect(context, '#9ab66e', x + 14, y + 26, 3, 2)
  } else if (terrain === 'mountain') {
    pixelRect(context, '#504f4d', x + 4, y + 20, 24, 7)
    pixelRect(context, accent, x + 9, y + 8, 15, 14)
    pixelRect(context, '#d5d0bf', x + 14, y + 8, 7, 5)
    pixelRect(context, '#5d5c58', x + 7, y + 26, 18, 3)
  } else if (terrain === 'marsh') {
    pixelRect(context, '#294f4d', x + 2, y + 21, 16, 4)
    pixelRect(context, accent, x + 19, y + 8, 2, 14)
    pixelRect(context, accent, x + 25, y + 14, 2, 11)
    pixelRect(context, '#76917b', x + 7, y + 10, 5, 2)
  } else {
    pixelRect(context, accent, x + 3 + pattern * 3, y + 6 + pattern, 3, 3)
    pixelRect(context, accent, x + 23 - pattern, y + 24, 2, 2)
    if (terrain === 'meadow') {
      pixelRect(context, '#b5c66b', x + 23, y + 16, 2, 6)
      pixelRect(context, '#d6d77a', x + 21, y + 15, 2, 2)
    }
  }
}

function drawPerson(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  directionalCharacters: HTMLImageElement | null,
  generatedCharacters: HTMLImageElement | null,
  x: number,
  y: number,
  color: string,
  isPlayer = false,
  role: 'wanderer' | 'villager' | 'follower' = 'wanderer',
  facing: Direction = 'down',
  active = false,
) {
  context.save()
  const outline = isPlayer ? '#ffe676' : active ? '#ffffff' : color
  context.filter = [
    `drop-shadow(1px 0 0 ${outline})`,
    `drop-shadow(-1px 0 0 ${outline})`,
    `drop-shadow(0 1px 0 ${outline})`,
    `drop-shadow(0 -1px 0 ${outline})`,
    'drop-shadow(1px 1px 0 rgba(5, 10, 7, .9))',
  ].join(' ')
  if (directionalCharacters) {
    const id = isPlayer ? 'player' : role
    drawDirectionalCell(context, directionalCharacters, directionalCharacterIndex[id], facing, x, y)
    if (!isPlayer) {
      context.fillStyle = color
      context.fillRect(x + 27, y + 3, 3, 3)
    }
    context.restore()
    return
  }
  if (generatedCharacters) {
    const id = isPlayer ? 'player' : role
    drawGeneratedCell(context, generatedCharacters, generatedCharacterIndex[id], x, y)
    if (!isPlayer) {
      context.fillStyle = color
      context.fillRect(x + 27, y + 3, 3, 3)
    } else {
      context.strokeStyle = '#fff0a6'
      context.lineWidth = 1
      context.strokeRect(x + 2.5, y + 1.5, 27, 29)
    }
    context.restore()
    return
  }
  if (atlas) {
    drawSprite(context, atlas, isPlayer ? 'player' : role, x, y)
    if (!isPlayer) {
      context.fillStyle = color
      context.fillRect(x + 13, y + 3, 3, 3)
    }
    if (isPlayer) {
      context.strokeStyle = '#fff0a6'
      context.lineWidth = 1
      context.strokeRect(x + 4.5, y + 1.5, 23, 29)
    }
    context.restore()
    return
  }
  const ox = x + 10
  const oy = y + 6
  pixelRect(context, 'rgba(10, 17, 13, .4)', x + 7, y + 26, 19, 3)
  pixelRect(context, '#513e31', ox + 2, oy - 2, 9, 4)
  pixelRect(context, '#e7bc88', ox + 3, oy + 1, 7, 7)
  pixelRect(context, isPlayer ? '#f4d35e' : color, ox + 1, oy + 8, 11, 10)
  pixelRect(context, '#efe5c2', ox + 4, oy + 10, 5, 3)
  pixelRect(context, '#23312b', ox + 2, oy + 18, 4, 6)
  pixelRect(context, '#23312b', ox + 8, oy + 18, 4, 6)
  if (isPlayer) {
    context.strokeStyle = '#fff0a6'
    context.lineWidth = 1
    context.strokeRect(ox - 2, oy - 4, 16, 30)
  }
  context.restore()
}

function drawMonster(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  directionalMonsters: HTMLImageElement | null,
  generatedObjects: HTMLImageElement | null,
  x: number,
  y: number,
  species: 'slime' | 'boar' | 'wisp',
  facing: Direction = 'down',
) {
  if (directionalMonsters) {
    drawDirectionalCell(context, directionalMonsters, directionalMonsterIndex[species], facing, x, y)
    return
  }
  if (generatedObjects) {
    drawGeneratedCell(context, generatedObjects, generatedObjectIndex[species], x, y)
    return
  }
  if (atlas) {
    drawSprite(context, atlas, species, x, y)
    return
  }
  const colors = species === 'slime' ? ['#7e66a8', '#ab8ed2'] : species === 'boar' ? ['#714b39', '#a76b4d'] : ['#4ea0a7', '#8bd0c8']
  pixelRect(context, 'rgba(10, 17, 13, .35)', x + 6, y + 27, 21, 3)
  pixelRect(context, colors[0], x + 7, y + 14, 19, 12)
  pixelRect(context, colors[1], x + 11, y + 9, 11, 8)
  pixelRect(context, '#e9f4dc', x + 12, y + 17, 3, 3)
  pixelRect(context, '#e9f4dc', x + 20, y + 17, 3, 3)
}

function drawFood(context: CanvasRenderingContext2D, generatedObjects: HTMLImageElement | null, x: number, y: number) {
  if (generatedObjects) {
    drawGeneratedCell(context, generatedObjects, generatedObjectIndex.food, x, y)
    return
  }
  pixelRect(context, 'rgba(10, 17, 13, .35)', x + 17, y + 24, 12, 2)
  pixelRect(context, '#315d45', x + 22, y + 9, 3, 7)
  pixelRect(context, '#9fc96d', x + 19, y + 8, 4, 3)
  pixelRect(context, '#df815f', x + 18, y + 14, 9, 9)
  pixelRect(context, '#f3c16f', x + 20, y + 15, 3, 3)
  pixelRect(context, '#a84f45', x + 24, y + 19, 3, 4)
}

function drawResourceNode(context: CanvasRenderingContext2D, kind: 'wood' | 'stone', x: number, y: number) {
  pixelRect(context, 'rgba(6, 12, 8, .45)', x + 5, y + 26, 23, 3)
  if (kind === 'wood') {
    pixelRect(context, '#5b3b28', x + 7, y + 18, 19, 7)
    pixelRect(context, '#8c5b35', x + 9, y + 15, 16, 6)
    pixelRect(context, '#d0a15b', x + 21, y + 17, 4, 4)
  } else {
    pixelRect(context, '#5f6762', x + 5, y + 20, 22, 7)
    pixelRect(context, '#92998e', x + 10, y + 13, 13, 10)
    pixelRect(context, '#c3c5ae', x + 12, y + 14, 6, 3)
  }
}

function drawStructure(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  generatedObjects: HTMLImageElement | null,
  facilities: HTMLImageElement | null,
  x: number,
  y: number,
  structure: Structure,
  buildingKind?: CampBuildingKind,
) {
  if (structure === 'cave' || structure === 'nest') {
    pixelRect(context, structure === 'cave' ? '#242723' : '#263b2c', x + 3, y + 7, 26, 22)
    pixelRect(context, structure === 'cave' ? '#737066' : '#4f734d', x + 5, y + 4, 22, 8)
    pixelRect(context, '#0a0e0c', x + 10, y + 14, 13, 15)
    pixelRect(context, structure === 'cave' ? '#d29b50' : '#b9ce67', x + 14, y + 18, 5, 3)
    return
  }
  if (structure === 'stairs-down' || structure === 'stairs-up' || structure === 'dungeon-exit') {
    pixelRect(context, '#342b24', x + 4, y + 5, 24, 24)
    for (let step = 0; step < 4; step += 1) pixelRect(context, structure === 'dungeon-exit' ? '#6ba997' : '#9b8061', x + 7 + step * 3, y + 9 + step * 4, 16 - step * 3, 3)
    return
  }
  if (structure === 'chest') {
    pixelRect(context, '#2b1c14', x + 5, y + 15, 23, 13)
    pixelRect(context, '#9c5b2d', x + 7, y + 11, 19, 15)
    pixelRect(context, '#e0b44f', x + 15, y + 15, 4, 7)
    return
  }
  if (facilities && structure === 'camp') {
    drawGeneratedCell(context, facilities, facilityIndex['camp-core'], x, y)
    return
  }
  if (facilities && structure === 'camp-building' && buildingKind) {
    drawGeneratedCell(context, facilities, facilityIndex[buildingKind], x, y)
    return
  }
  if (structure === 'camp-building') {
    pixelRect(context, '#513c2e', x + 5, y + 17, 22, 11)
    pixelRect(context, '#d69a52', x + 4, y + 12, 24, 6)
    pixelRect(context, '#f0d38b', x + 14, y + 19, 5, 9)
    return
  }
  if (generatedObjects) {
    drawGeneratedCell(context, generatedObjects, generatedObjectIndex[structure], x, y)
    return
  }
  if (atlas) {
    drawSprite(context, atlas, structure as SpriteId, x, y)
    return
  }
  if (structure === 'waystone') {
    pixelRect(context, 'rgba(104, 213, 191, .18)', x + 3, y + 3, 26, 26)
    pixelRect(context, '#6f8279', x + 7, y + 6, 5, 22)
    pixelRect(context, '#6f8279', x + 20, y + 6, 5, 22)
    pixelRect(context, '#91aaa0', x + 7, y + 4, 18, 5)
    pixelRect(context, '#172a26', x + 12, y + 10, 8, 18)
    pixelRect(context, '#72d2bd', x + 14, y + 14, 4, 7)
    pixelRect(context, '#a5f0d8', x + 15, y + 15, 2, 3)
  } else if (structure === 'ruin') {
    pixelRect(context, '#756c64', x + 5, y + 11, 22, 16)
    pixelRect(context, '#9a8d7e', x + 8, y + 7, 6, 10)
    pixelRect(context, '#25332c', x + 15, y + 19, 7, 8)
    pixelRect(context, '#5d5650', x + 3, y + 27, 26, 3)
  } else {
    pixelRect(context, '#6a4331', x + 6, y + 14, 21, 14)
    pixelRect(context, '#d07b4f', x + 4, y + 9, 25, 7)
    pixelRect(context, '#f1c96c', x + 18, y + 18, 4, 10)
    pixelRect(context, '#8a593d', x + 8, y + 18, 6, 5)
    if (structure === 'village') pixelRect(context, '#f3e3a1', x + 3, y + 2, 3, 10)
  }
}

interface WorldCanvasProps {
  state: GameState
  theme: ArtTheme
  activeAgentId: string | null
  onAgentClick: (agentId: string) => void
  onSelect: (position: Position) => void
  dispatch: React.Dispatch<GameAction>
}

export function WorldCanvas({ state, theme, activeAgentId, onAgentClick, onSelect, dispatch }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const atlasRef = useRef<HTMLImageElement | null>(null)
  const generatedTerrainRef = useRef<HTMLImageElement | null>(null)
  const generatedObjectsRef = useRef<HTMLImageElement | null>(null)
  const generatedCharactersRef = useRef<HTMLImageElement | null>(null)
  const directionalCharactersRef = useRef<HTMLImageElement | null>(null)
  const directionalMonstersRef = useRef<HTMLImageElement | null>(null)
  const facilitiesRef = useRef<HTMLImageElement | null>(null)
  const [assetRevision, setAssetRevision] = useState(0)
  const origin = {
    x: Math.max(0, Math.min(state.world.size - VIEW_COLS, state.player.x - Math.floor(VIEW_COLS / 2))),
    y: Math.max(0, Math.min((state.world.height ?? state.world.size) - VIEW_ROWS, state.player.y - Math.floor(VIEW_ROWS / 2))),
  }

  useEffect(() => {
    atlasRef.current = null
    generatedTerrainRef.current = null
    generatedObjectsRef.current = null
    generatedCharactersRef.current = null
    directionalCharactersRef.current = null
    directionalMonstersRef.current = null
    facilitiesRef.current = null
    setAssetRevision((revision) => revision + 1)
    const images: HTMLImageElement[] = []
    const load = (url: string, target: { current: HTMLImageElement | null }) => {
      const image = new Image()
      images.push(image)
      image.onload = () => {
        target.current = image
        setAssetRevision((revision) => revision + 1)
      }
      image.src = url
    }
    const atlas = new Image()
    images.push(atlas)
    atlas.onload = () => {
      atlasRef.current = atlas
      setAssetRevision((revision) => revision + 1)
    }
    atlas.src = atlasUrl(theme)
    if (theme === 'verdant') {
      load(generatedTerrainUrl(), generatedTerrainRef)
      load(generatedObjectsUrl(), generatedObjectsRef)
      load(generatedCharactersUrl(), generatedCharactersRef)
      load(directionalCharactersUrl(), directionalCharactersRef)
      load(directionalMonstersUrl(), directionalMonstersRef)
      load(facilityAtlasUrl(), facilitiesRef)
    }
    return () => {
      images.forEach((image) => {
        image.onload = null
      })
    }
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, canvas.width, canvas.height)

    for (let viewY = 0; viewY < VIEW_ROWS; viewY += 1) {
      for (let viewX = 0; viewX < VIEW_COLS; viewX += 1) {
        const worldX = origin.x + viewX
        const worldY = origin.y + viewY
        const screenX = viewX * TILE
        const screenY = viewY * TILE
        if (worldX >= state.world.size || worldY >= (state.world.height ?? state.world.size)) {
          pixelRect(context, '#101613', screenX, screenY, TILE, TILE)
          continue
        }
        const index = tileIndex(state.world, worldX, worldY)
        const fog = state.fog[index]
        if (fog === 0) {
          pixelRect(context, '#111713', screenX, screenY, TILE, TILE)
          if ((worldX + worldY) % 4 === 0) pixelRect(context, '#18221d', screenX + 7, screenY + 8, 2, 2)
          continue
        }
        const tile = state.world.tiles[index]
        drawTile(context, atlasRef.current, generatedTerrainRef.current, tile.terrain, screenX, screenY, worldX, worldY)
        const controllingCamp = state.camps.find(
          (camp) =>
            camp.sceneX === state.world.sceneX &&
            camp.sceneY === state.world.sceneY &&
            Math.abs(camp.x - worldX) + Math.abs(camp.y - worldY) <= effectiveCampStats(state, camp).controlRadius,
        )
        if (controllingCamp) {
          const controlDistance = Math.abs(controllingCamp.x - worldX) + Math.abs(controllingCamp.y - worldY)
          const controlRadius = effectiveCampStats(state, controllingCamp).controlRadius
          pixelRect(context, 'rgba(126, 214, 117, .16)', screenX, screenY, TILE, TILE)
          context.lineWidth = controlDistance === controlRadius ? 1.5 : 1
          context.strokeStyle = controlDistance === controlRadius
            ? 'rgba(226, 211, 112, .68)'
            : 'rgba(151, 230, 125, .32)'
          context.strokeRect(screenX + 1.5, screenY + 1.5, TILE - 3, TILE - 3)
          context.lineWidth = 1
        }
        if (tile.road) {
          pixelRect(context, 'rgba(63, 43, 29, .78)', screenX, screenY + 13, TILE, 7)
          pixelRect(context, 'rgba(190, 150, 91, .78)', screenX, screenY + 15, TILE, 3)
        }
        if (
          tile.road &&
          !tile.structure &&
          controllingCamp &&
          Math.abs(controllingCamp.x - worldX) + Math.abs(controllingCamp.y - worldY) === effectiveCampStats(state, controllingCamp).controlRadius &&
          facilitiesRef.current
        ) {
          drawGeneratedCell(context, facilitiesRef.current, facilityIndex['road-gate'], screenX, screenY)
        }
        if (tile.structure) {
          drawStructure(
            context,
            atlasRef.current,
            generatedObjectsRef.current,
            facilitiesRef.current,
            screenX,
            screenY,
            tile.structure,
            tile.buildingKind,
          )
          if (tile.structure === 'ruin' && tile.eventResolved) {
            pixelRect(context, 'rgba(15, 22, 18, .42)', screenX, screenY, TILE, TILE)
            pixelRect(context, '#b8b092', screenX + 25, screenY + 4, 3, 3)
          }
        }
        if (tile.coin > 0 && fog === 2) {
          if (generatedObjectsRef.current) {
            drawGeneratedCell(context, generatedObjectsRef.current, generatedObjectIndex.coin, screenX, screenY)
          } else if (atlasRef.current) drawSprite(context, atlasRef.current, 'coin', screenX, screenY)
          else {
            pixelRect(context, '#f4d35e', screenX + 10, screenY + 10, 5, 5)
            pixelRect(context, '#fff1a4', screenX + 11, screenY + 10, 2, 2)
          }
        }
        if ((tile.food ?? 0) > 0 && fog === 2) drawFood(context, generatedObjectsRef.current, screenX, screenY)
        if (tile.resourceNode && (tile.resourceReadyDay === undefined || tile.resourceReadyDay <= state.day) && fog === 2) {
          drawResourceNode(context, tile.resourceNode, screenX, screenY)
        }

        if (fog === 2) {
          const monster = state.monsters.find((item) => item.x === worldX && item.y === worldY)
          if (monster) {
            context.save()
            if (monster.rank === 'boss') {
              context.filter = 'drop-shadow(2px 0 #ff7b45) drop-shadow(-2px 0 #ff7b45) drop-shadow(0 2px #ffcc66)'
              context.translate(screenX + TILE / 2, screenY + TILE / 2)
              context.scale(1.3, 1.3)
              context.translate(-(screenX + TILE / 2), -(screenY + TILE / 2))
            } else if (monster.rank === 'elite') {
              context.filter = 'drop-shadow(1px 0 #f4d35e) drop-shadow(-1px 0 #f4d35e)'
            }
            drawMonster(
              context,
              atlasRef.current,
              directionalMonstersRef.current,
              generatedObjectsRef.current,
              screenX,
              screenY,
              monster.species,
              monster.facing ?? 'down',
            )
            context.restore()
            if (monster.rank === 'boss') {
              pixelRect(context, '#25110e', screenX + 2, screenY + 1, 28, 4)
              pixelRect(context, monster.phase === 2 ? '#ff7043' : '#c44737', screenX + 3, screenY + 2, Math.round(26 * monster.hp / (monster.maxHp ?? monster.hp)), 2)
            }
          }
          const agent = state.agents.find((item) => item.role !== 'follower' && item.x === worldX && item.y === worldY)
          if (agent) {
            const color = state.factions.find((faction) => faction.id === agent.factionId)?.color ?? '#eee'
            const role = agent.role === 'villager' || agent.role === 'follower' ? agent.role : 'wanderer'
            drawPerson(
              context,
              atlasRef.current,
              directionalCharactersRef.current,
              generatedCharactersRef.current,
              screenX,
              screenY,
              color,
              false,
              role,
              agent.facing ?? 'down',
              agent.id === activeAgentId,
            )
          }
        }

        if (fog === 1) {
          pixelRect(context, 'rgba(9, 16, 14, 0.66)', screenX, screenY, TILE, TILE)
        } else {
          context.strokeStyle = 'rgba(22, 35, 28, 0.22)'
          context.strokeRect(screenX + 0.5, screenY + 0.5, TILE - 1, TILE - 1)
        }
      }
    }

    const playerX = (state.player.x - origin.x) * TILE
    const playerY = (state.player.y - origin.y) * TILE
    if (state.redNameMode) {
      for (let viewY = 0; viewY < VIEW_ROWS; viewY += 1) {
        for (let viewX = 0; viewX < VIEW_COLS; viewX += 1) {
          const worldX = origin.x + viewX
          const worldY = origin.y + viewY
          const attackDistance = Math.abs(worldX - state.player.x) + Math.abs(worldY - state.player.y)
          if (attackDistance < 1 || attackDistance > 6) continue
          const screenX = viewX * TILE
          const screenY = viewY * TILE
          pixelRect(context, attackDistance === 1 ? 'rgba(255, 68, 47, .16)' : 'rgba(172, 35, 34, .075)', screenX, screenY, TILE, TILE)
          context.strokeStyle = attackDistance === 1 ? 'rgba(255, 128, 78, .48)' : 'rgba(220, 74, 56, .18)'
          context.strokeRect(screenX + 1.5, screenY + 1.5, TILE - 3, TILE - 3)
        }
      }
    }
    drawPerson(
      context,
      atlasRef.current,
      directionalCharactersRef.current,
      generatedCharactersRef.current,
      playerX,
      playerY,
      '#f4d35e',
      true,
      'wanderer',
      state.player.facing ?? 'down',
    )
    if (state.redNameMode) {
      context.strokeStyle = '#ff4b36'
      context.lineWidth = 2
      context.strokeRect(playerX + 1, playerY + 1, TILE - 2, TILE - 2)
      pixelRect(context, '#ffdf77', playerX + 14, playerY - 2, 5, 5)
    }

    if (state.selected) {
      const sx = (state.selected.x - origin.x) * TILE
      const sy = (state.selected.y - origin.y) * TILE
      const selectedTarget = state.redNameMode ? redNameTargetAt(state, state.selected) : null
      context.strokeStyle = selectedTarget?.attackable ? '#ff4b36' : '#f4d35e'
      context.lineWidth = 2
      context.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4)
    }
  }, [activeAgentId, assetRevision, origin.x, origin.y, state])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const scaleX = event.currentTarget.width / rect.width
      const scaleY = event.currentTarget.height / rect.height
      const x = origin.x + Math.floor(((event.clientX - rect.left) * scaleX) / TILE)
      const y = origin.y + Math.floor(((event.clientY - rect.top) * scaleY) / TILE)
      if (x >= 0 && y >= 0 && x < state.world.size && y < (state.world.height ?? state.world.size)) {
        const agent = state.agents.find((item) => item.role !== 'follower' && item.x === x && item.y === y)
        const canInteract = agent && isWithinInteractionRange(agent, state.player)
        if (agent && canInteract) onAgentClick(agent.id)
        else onSelect({ x, y })
      }
    },
    [onAgentClick, onSelect, origin.x, origin.y, state.agents, state.player.x, state.player.y, state.world.size],
  )

  const nearbyAgents = state.agents.filter(
    (agent) =>
      agent.role !== 'follower' &&
      isWithinInteractionRange(agent, state.player) &&
      agent.x >= origin.x &&
      agent.x < origin.x + VIEW_COLS &&
      agent.y >= origin.y &&
      agent.y < origin.y + VIEW_ROWS,
  )
  const alertedMonsters = state.monsters.filter(
    (monster) =>
      (monster.alert ?? 0) > 0 &&
      monster.x >= origin.x &&
      monster.x < origin.x + VIEW_COLS &&
      monster.y >= origin.y &&
      monster.y < origin.y + VIEW_ROWS &&
      state.fog[tileIndex(state.world, monster.x, monster.y)] === 2,
  )
  const inspectablePositions = new Map<string, Position>()
  state.world.tiles.forEach((tile, index) => {
    const x = index % state.world.size
    const y = Math.floor(index / state.world.size)
    const adjacentWater = tile.terrain === 'water' && Math.abs(x - state.player.x) + Math.abs(y - state.player.y) === 1
    if (!tile.structure && !tile.resourceNode && !adjacentWater && !tile.road && tile.coin <= 0 && (tile.food ?? 0) <= 0) return
    const position = { x, y }
    inspectablePositions.set(`${position.x},${position.y}`, position)
  })
  state.monsters.forEach((monster) => inspectablePositions.set(`${monster.x},${monster.y}`, monster))
  state.agents
    .filter((agent) => agent.role !== 'follower')
    .forEach((agent) => inspectablePositions.set(`${agent.x},${agent.y}`, agent))
  const visibleTargets = [...inspectablePositions.values()].filter(
    (position) =>
      position.x >= origin.x &&
      position.x < origin.x + VIEW_COLS &&
      position.y >= origin.y &&
      position.y < origin.y + VIEW_ROWS &&
      state.fog[tileIndex(state.world, position.x, position.y)] > 0,
  )

  return (
    <div className="world-frame">
      <canvas
        ref={canvasRef}
        className="world-canvas"
        width={VIEW_COLS * TILE}
        height={VIEW_ROWS * TILE}
        onClick={handleClick}
        aria-label="Realmseed 像素世界地图"
      />
      {visibleTargets.map((position) => {
        const detail = inspectPosition(state, position)
        const agent = state.agents.find(
          (item) => item.role !== 'follower' && item.x === position.x && item.y === position.y,
        )
        return (
          <button
            key={`${position.x},${position.y}`}
            className="map-inspect-target"
            style={{
              left: `${((position.x - origin.x) / VIEW_COLS) * 100}%`,
              top: `${((position.y - origin.y) / VIEW_ROWS) * 100}%`,
              width: `${100 / VIEW_COLS}%`,
              height: `${100 / VIEW_ROWS}%`,
            }}
            onClick={() => agent ? onAgentClick(agent.id) : onSelect(position)}
            aria-label={`查看${detail.name}详情`}
            title={`查看${detail.name}详情`}
          />
        )
      })}
      <div className="scanlines" aria-hidden="true" />
      {nearbyAgents.map((agent) => {
        const left = (((agent.x - origin.x) * TILE + TILE / 2) / (VIEW_COLS * TILE)) * 100
        const top = (((agent.y - origin.y) * TILE + 5) / (VIEW_ROWS * TILE)) * 100
        return (
          <button
            key={agent.id}
            className={`talk-bubble ${agent.id === activeAgentId ? 'is-active' : ''}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={() => onAgentClick(agent.id)}
            aria-label={`与 ${agent.name} 交谈或交易`}
            title={`与 ${agent.name} 交谈或交易`}
          >
            <span>…</span>
          </button>
        )
      })}
      {alertedMonsters.map((monster) => {
        const left = (((monster.x - origin.x) * TILE + TILE / 2) / (VIEW_COLS * TILE)) * 100
        const top = (((monster.y - origin.y) * TILE + 4) / (VIEW_ROWS * TILE)) * 100
        return (
          <span
            key={monster.id}
            className="monster-alert"
            style={{ left: `${left}%`, top: `${top}%` }}
            aria-label="怪物发现了队伍"
            title="怪物发现了队伍"
          >
            !
          </span>
        )
      })}
      {state.agents.filter((agent) =>
        agent.role !== 'follower' && ((agent.fear ?? 0) > 0 || (agent.hostility ?? 0) > 0 || agent.autoAggro || state.factions.some((faction) => faction.id === agent.factionId && faction.autoAggro)) &&
        agent.x >= origin.x && agent.x < origin.x + VIEW_COLS &&
        agent.y >= origin.y && agent.y < origin.y + VIEW_ROWS
      ).map((agent) => {
        const left = (((agent.x - origin.x) * TILE + TILE / 2) / (VIEW_COLS * TILE)) * 100
        const top = (((agent.y - origin.y) * TILE + 4) / (VIEW_ROWS * TILE)) * 100
        return <span key={`witness-${agent.id}`} className="npc-alert" style={{ left: `${left}%`, top: `${top}%` }} aria-label={`${agent.name}对红名者保持警惕`}>!</span>
      })}
      {state.redNameMode ? <RedNameOverlay state={state} origin={origin} dispatch={dispatch} /> : null}
    </div>
  )
}

function RedNameOverlay({ state, origin, dispatch }: { state: GameState; origin: Position; dispatch: React.Dispatch<GameAction> }) {
  const [activeMoveId, setActiveMoveId] = useState<CombatMoveId | null>(null)
  const timer = useRef<number | null>(null)
  const target = state.selected ? redNameTargetAt(state, state.selected) : null
  const targetDistance = state.selected ? redNameDistance(state, state.selected) : null

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    setActiveMoveId(null)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [target?.id])

  const attack = (moveId: CombatMoveId) => {
    if (!state.selected || activeMoveId) return
    setActiveMoveId(moveId)
    timer.current = window.setTimeout(() => {
      dispatch({ type: 'RED_NAME_ATTACK', position: state.selected!, moveId })
      setActiveMoveId(null)
      timer.current = null
    }, 640)
  }

  const targetLeft = state.selected ? (((state.selected.x - origin.x) * TILE + TILE / 2) / (VIEW_COLS * TILE)) * 100 : 50
  const targetTop = state.selected ? (((state.selected.y - origin.y) * TILE + TILE / 2) / (VIEW_ROWS * TILE)) * 100 : 50
  return (
    <div className="red-name-layer" aria-label="红名地图攻击">
      <div className="red-name-state"><i>◆</i><span><b>RED NAME</b><small>以角色为中心 · 近战 1 / 远程至 6 格</small></span></div>
      {activeMoveId ? (
        <div className={`red-map-effect effect-${activeMoveId}`} style={{ left: `${targetLeft}%`, top: `${targetTop}%` }} aria-hidden="true">
          <i className="effect-core" /><i className="effect-trail" /><i className="effect-impact" /><i className="effect-smoke" />
        </div>
      ) : null}
      <div className={`red-target-dossier ${target?.attackable ? 'is-armed' : ''}`}>
        <div className="red-target-copy">
          <span>{target ? `${target.kind.toUpperCase()} · 距离 ${targetDistance}` : state.lastMapAttack ? 'LAST MAP ATTACK' : '等待目标'}</span>
          <strong>{target?.name ?? state.lastMapAttack?.targetName ?? '点击地图上的人物、建筑或怪物'}</strong>
          <small>{target
            ? target.attackable ? `耐久 ${target.hp}/${target.maxHp}` : target.reason
            : state.lastMapAttack
              ? `${state.lastMapAttack.hit ? state.lastMapAttack.critical ? '暴击' : '命中' : '未命中'} · 伤害 ${state.lastMapAttack.damage} · 目标已移动或消失`
              : '攻击人物会触发个人与阵营持续追缉；相邻追兵将自动开战。'}</small>
        </div>
        <div className="red-move-strip">
          {combatMoves.map((move) => {
            const outOfRange = targetDistance === null || targetDistance < move.minRange || targetDistance > move.maxRange
            return <button key={move.id} className={activeMoveId === move.id ? 'is-casting' : ''} disabled={!target?.attackable || outOfRange || Boolean(activeMoveId) || state.player.stamina < move.staminaCost} onClick={() => attack(move.id)} title={`${move.name} · 射程 ${move.minRange}–${move.maxRange} · 命中 ${move.accuracy}% · 威力 ${move.power}`} aria-label={`使用${move.name}攻击`}><i>{move.glyph}</i><span>{move.name}</span><small>{move.minRange}–{move.maxRange}格</small></button>
          })}
        </div>
      </div>
    </div>
  )
}
