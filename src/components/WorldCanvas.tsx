import { useCallback, useEffect, useRef } from 'react'
import type { GameState, Position, Terrain } from '../game/types'
import { tileIndex } from '../game/world'

const TILE = 24
const VIEW_COLS = 27
const VIEW_ROWS = 19
const terrainColors: Record<Terrain, [string, string]> = {
  meadow: ['#6f9b5b', '#88ad65'],
  forest: ['#315d45', '#4a7650'],
  water: ['#32687b', '#4b8292'],
  mountain: ['#6a6964', '#858078'],
  marsh: ['#476b5f', '#5f8270'],
  sand: ['#bca96f', '#d0be82'],
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
  terrain: Terrain,
  x: number,
  y: number,
  worldX: number,
  worldY: number,
) {
  const [base, accent] = terrainColors[terrain]
  pixelRect(context, base, x, y, TILE, TILE)
  const pattern = Math.abs((worldX * 17 + worldY * 31) % 5)
  if (terrain === 'water') {
    pixelRect(context, accent, x + 3 + pattern, y + 7, 9, 2)
    pixelRect(context, '#285665', x + 12, y + 16, 8, 2)
  } else if (terrain === 'forest') {
    pixelRect(context, '#234b38', x + 4, y + 5, 7, 8)
    pixelRect(context, accent, x + 6, y + 3, 5, 5)
    pixelRect(context, '#6f593e', x + 7, y + 13, 2, 5)
    if (pattern > 2) pixelRect(context, '#294d38', x + 15, y + 10, 5, 7)
  } else if (terrain === 'mountain') {
    pixelRect(context, '#504f4d', x + 4, y + 14, 16, 5)
    pixelRect(context, accent, x + 8, y + 7, 9, 8)
    pixelRect(context, '#d5d0bf', x + 11, y + 7, 4, 3)
  } else if (terrain === 'marsh') {
    pixelRect(context, '#294f4d', x + 2, y + 16, 12, 3)
    pixelRect(context, accent, x + 15, y + 7, 2, 9)
    pixelRect(context, accent, x + 19, y + 11, 2, 7)
  } else {
    pixelRect(context, accent, x + 3 + pattern * 2, y + 6 + pattern, 3, 3)
    if (terrain === 'meadow') pixelRect(context, '#b5c66b', x + 17, y + 15, 2, 4)
  }
}

function drawPerson(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  isPlayer = false,
) {
  const ox = x + 7
  const oy = y + 4
  pixelRect(context, '#e7bc88', ox + 3, oy, 5, 5)
  pixelRect(context, isPlayer ? '#f4d35e' : color, ox + 2, oy + 5, 7, 8)
  pixelRect(context, '#23312b', ox + 2, oy + 13, 3, 5)
  pixelRect(context, '#23312b', ox + 6, oy + 13, 3, 5)
  if (isPlayer) {
    context.strokeStyle = '#fff0a6'
    context.lineWidth = 1
    context.strokeRect(ox, oy - 2, 11, 21)
  }
}

function drawMonster(context: CanvasRenderingContext2D, x: number, y: number, species: string) {
  const colors = species === 'slime' ? ['#7e66a8', '#ab8ed2'] : species === 'boar' ? ['#714b39', '#a76b4d'] : ['#4ea0a7', '#8bd0c8']
  pixelRect(context, colors[0], x + 5, y + 10, 14, 9)
  pixelRect(context, colors[1], x + 8, y + 7, 8, 6)
  pixelRect(context, '#e9f4dc', x + 9, y + 12, 2, 2)
  pixelRect(context, '#e9f4dc', x + 15, y + 12, 2, 2)
}

function drawStructure(context: CanvasRenderingContext2D, x: number, y: number, structure: string) {
  if (structure === 'ruin') {
    pixelRect(context, '#756c64', x + 4, y + 8, 15, 11)
    pixelRect(context, '#9a8d7e', x + 7, y + 5, 4, 7)
    pixelRect(context, '#25332c', x + 11, y + 13, 5, 6)
  } else {
    pixelRect(context, '#6a4331', x + 5, y + 10, 15, 10)
    pixelRect(context, '#d07b4f', x + 3, y + 7, 19, 5)
    pixelRect(context, '#f1c96c', x + 13, y + 12, 3, 7)
    if (structure === 'village') pixelRect(context, '#f3e3a1', x + 2, y + 2, 2, 7)
  }
}

interface WorldCanvasProps {
  state: GameState
  onSelect: (position: Position) => void
}

export function WorldCanvas({ state, onSelect }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const origin = {
    x: Math.max(0, Math.min(state.world.size - VIEW_COLS, state.player.x - Math.floor(VIEW_COLS / 2))),
    y: Math.max(0, Math.min(state.world.size - VIEW_ROWS, state.player.y - Math.floor(VIEW_ROWS / 2))),
  }

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
        if (worldX >= state.world.size || worldY >= state.world.size) {
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
        drawTile(context, tile.terrain, screenX, screenY, worldX, worldY)
        if (tile.structure) drawStructure(context, screenX, screenY, tile.structure)
        if (tile.coin > 0 && fog === 2) {
          pixelRect(context, '#f4d35e', screenX + 10, screenY + 10, 5, 5)
          pixelRect(context, '#fff1a4', screenX + 11, screenY + 10, 2, 2)
        }

        if (fog === 2) {
          const monster = state.monsters.find((item) => item.x === worldX && item.y === worldY)
          if (monster) drawMonster(context, screenX, screenY, monster.species)
          const agent = state.agents.find((item) => item.x === worldX && item.y === worldY)
          if (agent) {
            const color = state.factions.find((faction) => faction.id === agent.factionId)?.color ?? '#eee'
            drawPerson(context, screenX, screenY, color)
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
    drawPerson(context, playerX, playerY, '#f4d35e', true)

    if (state.selected) {
      const sx = (state.selected.x - origin.x) * TILE
      const sy = (state.selected.y - origin.y) * TILE
      context.strokeStyle = '#f4d35e'
      context.lineWidth = 2
      context.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4)
    }
  }, [origin.x, origin.y, state])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const scaleX = event.currentTarget.width / rect.width
      const scaleY = event.currentTarget.height / rect.height
      const x = origin.x + Math.floor(((event.clientX - rect.left) * scaleX) / TILE)
      const y = origin.y + Math.floor(((event.clientY - rect.top) * scaleY) / TILE)
      if (x >= 0 && y >= 0 && x < state.world.size && y < state.world.size) onSelect({ x, y })
    },
    [onSelect, origin.x, origin.y, state.world.size],
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
      <div className="scanlines" aria-hidden="true" />
    </div>
  )
}
