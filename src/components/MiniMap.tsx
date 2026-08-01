import { useEffect, useRef } from 'react'
import type { GameState, Terrain } from '../game/types'

const colors: Record<Terrain, string> = {
  meadow: '#7fa45f',
  forest: '#315d45',
  water: '#32687b',
  mountain: '#74716a',
  marsh: '#496c61',
  sand: '#c4b279',
}

export function MiniMap({ state }: { state: GameState }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const scaleX = canvas.width / state.world.size
    const scaleY = canvas.height / (state.world.height ?? state.world.size)
    context.clearRect(0, 0, canvas.width, canvas.height)
    state.world.tiles.forEach((tile, index) => {
      const x = index % state.world.size
      const y = Math.floor(index / state.world.size)
      const fog = state.fog[index]
      context.fillStyle = fog === 0 ? '#111713' : fog === 1 ? '#29322c' : colors[tile.terrain]
      context.fillRect(Math.floor(x * scaleX), Math.floor(y * scaleY), Math.ceil(scaleX), Math.ceil(scaleY))
    })
    context.fillStyle = '#ffe27a'
    context.fillRect(Math.floor(state.player.x * scaleX) - 1, Math.floor(state.player.y * scaleY) - 1, 4, 4)
  }, [state])

  return <canvas ref={ref} width={144} height={144} className="mini-map" aria-label="世界缩略图" />
}
