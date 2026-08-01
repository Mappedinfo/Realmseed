import { useEffect, useMemo, useRef, useState } from 'react'
import { FishingAudioEngine, fishingSoundTier, resolveAudioMode } from '../audio/fishingAudio'
import type { FishingResult } from '../game/types'

interface AudioControlProps {
  battleActive: boolean
  shoreActive: boolean
  fishingResult?: FishingResult
  fishingResultKey?: string
}

export function AudioControl({ battleActive, shoreActive, fishingResult, fishingResultKey }: AudioControlProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const engineRef = useRef<FishingAudioEngine | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [lastFishingSound, setLastFishingSound] = useState<string>('none')
  const mode = resolveAudioMode(battleActive, shoreActive)
  const track = mode === 'battle' ? 'audio/battle-music-01.ogg' : 'audio/loopcity.ogg'
  const label = useMemo(() => {
    if (!enabled) return '游戏音乐：关'
    if (mode === 'battle') return '战斗乐声：开'
    if (mode === 'shore') return '水岸乐声：开'
    return '林野乐声：开'
  }, [enabled, mode])

  const engine = () => {
    if (!engineRef.current) engineRef.current = new FishingAudioEngine()
    return engineRef.current
  }

  useEffect(() => () => engineRef.current?.destroy(), [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled) {
      audio.pause()
      engineRef.current?.stopShore()
      return
    }
    if (mode === 'shore') {
      audio.pause()
      void engine().startShore()
      return
    }
    engineRef.current?.stopShore()
    audio.volume = mode === 'battle' ? 0.16 : 0.12
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  }, [enabled, mode, track])

  useEffect(() => {
    if (!enabled || !fishingResult || !fishingResultKey) return
    const tier = fishingSoundTier(fishingResult)
    setLastFishingSound(tier)
    void engine().playCatch(tier)
  }, [enabled, fishingResult, fishingResultKey])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled) {
      try {
        if (mode === 'shore') await engine().startShore()
        else await audio.play()
        setEnabled(true)
      } catch {
        setEnabled(false)
      }
    } else {
      audio.pause()
      engineRef.current?.stopShore()
      setEnabled(false)
    }
  }

  return (
    <>
      <audio ref={audioRef} loop preload="metadata" src={`${import.meta.env.BASE_URL}${track}`} />
      <button
        className={`audio-button ${enabled ? 'is-playing' : ''} ${mode === 'battle' ? 'is-battle' : ''} ${mode === 'shore' ? 'is-shore' : ''}`}
        onClick={toggle}
        aria-pressed={enabled}
        data-audio-mode={mode}
        data-last-fishing-sound={lastFishingSound}
      >
        <span aria-hidden="true">{enabled ? (mode === 'shore' ? '≋' : '♫') : '♪'}</span>
        {label}
      </button>
    </>
  )
}
