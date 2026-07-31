import { useEffect, useRef, useState } from 'react'

export function AudioControl({ battleActive }: { battleActive: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [enabled, setEnabled] = useState(false)
  const track = battleActive ? 'audio/battle-music-01.ogg' : 'audio/loopcity.ogg'

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = battleActive ? 0.16 : 0.12
    audio.currentTime = 0
    if (enabled) void audio.play().catch(() => {
      // Keep the user's preference enabled; the same element may resume once
      // the newly swapped source reaches a playable state.
    })
  }, [battleActive, enabled])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!enabled) {
      try {
        await audio.play()
        setEnabled(true)
      } catch {
        setEnabled(false)
      }
    } else {
      audio.pause()
      setEnabled(false)
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        loop
        preload="metadata"
        src={`${import.meta.env.BASE_URL}${track}`}
      />
      <button className={`audio-button ${enabled ? 'is-playing' : ''} ${battleActive ? 'is-battle' : ''}`} onClick={toggle} aria-pressed={enabled}>
        <span aria-hidden="true">{enabled ? '♫' : '♪'}</span>
        {enabled ? (battleActive ? '战斗乐声：开' : '林野乐声：开') : '游戏音乐：关'}
      </button>
    </>
  )
}
