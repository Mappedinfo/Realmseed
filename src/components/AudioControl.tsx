import { useEffect, useRef, useState } from 'react'

export function AudioControl() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = 0.12
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  return (
    <>
      <audio ref={audioRef} loop preload="metadata" src={`${import.meta.env.BASE_URL}audio/loopcity.ogg`} />
      <button className={`audio-button ${playing ? 'is-playing' : ''}`} onClick={toggle} aria-pressed={playing}>
        <span aria-hidden="true">{playing ? '♫' : '♪'}</span>
        {playing ? '林野乐声：开' : '林野乐声：关'}
      </button>
    </>
  )
}
