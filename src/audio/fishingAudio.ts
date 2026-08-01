import type { FishingResult } from '../game/types'

export type AudioMode = 'explore' | 'shore' | 'battle'
export type FishingSoundTier = 'miss' | 'driftwood' | 'common' | 'uncommon' | 'rare' | 'coin' | 'treasure'

export function resolveAudioMode(battleActive: boolean, shoreActive: boolean): AudioMode {
  if (battleActive) return 'battle'
  return shoreActive ? 'shore' : 'explore'
}

export function fishingSoundTier(result: FishingResult): FishingSoundTier {
  if (result.kind === 'empty') return 'miss'
  if (result.kind === 'wood') return 'driftwood'
  if (result.kind === 'equipment') return 'treasure'
  if (result.kind === 'gold') return 'coin'
  if (result.fishId === 'golden-koi') return 'rare'
  if (result.fishId === 'carp' || result.fishId === 'loach' || (result.amount ?? 1) > 1) return 'uncommon'
  return 'common'
}

/** Original procedural score and effects: no recorded or third-party audio is used here. */
export class FishingAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private shoreBus: GainNode | null = null
  private waterSource: AudioBufferSourceNode | null = null
  private phraseTimer: number | null = null

  async resume() {
    const context = this.ensureContext()
    if (context.state === 'suspended') await context.resume()
  }

  async startShore() {
    await this.resume()
    if (this.shoreBus || !this.context || !this.master) return
    const context = this.context
    const shoreBus = context.createGain()
    shoreBus.gain.setValueAtTime(0.0001, context.currentTime)
    shoreBus.gain.exponentialRampToValueAtTime(0.42, context.currentTime + 0.8)
    shoreBus.connect(this.master)
    this.shoreBus = shoreBus

    const water = context.createBufferSource()
    water.buffer = this.waterBuffer(context)
    water.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1150
    filter.Q.value = 0.7
    const waterGain = context.createGain()
    waterGain.gain.value = 0.07
    water.connect(filter).connect(waterGain).connect(shoreBus)
    water.start()
    this.waterSource = water

    this.schedulePhrase()
    this.phraseTimer = window.setInterval(() => this.schedulePhrase(), 8000)
  }

  stopShore() {
    if (this.phraseTimer !== null) window.clearInterval(this.phraseTimer)
    this.phraseTimer = null
    const context = this.context
    const bus = this.shoreBus
    const source = this.waterSource
    this.shoreBus = null
    this.waterSource = null
    if (!context || !bus) return
    bus.gain.cancelScheduledValues(context.currentTime)
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), context.currentTime)
    bus.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35)
    source?.stop(context.currentTime + 0.4)
    window.setTimeout(() => bus.disconnect(), 450)
  }

  async playCatch(tier: FishingSoundTier) {
    await this.resume()
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const now = context.currentTime

    if (tier !== 'miss') this.splash(now, tier === 'common' ? 0.11 : tier === 'uncommon' ? 0.17 : 0.23)
    if (tier === 'miss') this.tone(185, now, 0.14, 0.025, 'sine', master)
    if (tier === 'driftwood') {
      this.tone(130, now, 0.1, 0.045, 'square', master)
      this.tone(98, now + 0.08, 0.12, 0.03, 'square', master)
    }
    if (tier === 'common') this.tone(392, now + 0.04, 0.22, 0.05, 'triangle', master)
    if (tier === 'uncommon') [440, 587].forEach((note, index) => this.tone(note, now + index * 0.1, 0.34, 0.055, 'triangle', master))
    if (tier === 'rare') [587, 740, 988].forEach((note, index) => this.tone(note, now + index * 0.1, 0.55, 0.055, 'sine', master))
    if (tier === 'coin') [880, 1175].forEach((note, index) => this.tone(note, now + index * 0.08, 0.35, 0.045, 'square', master))
    if (tier === 'treasure') {
      [294, 440, 587, 880].forEach((note, index) => this.tone(note, now + index * 0.1, 0.7, 0.05, 'triangle', master))
      this.tone(1760, now + 0.35, 0.8, 0.02, 'sine', master)
    }
  }

  destroy() {
    this.stopShore()
    void this.context?.close()
    this.context = null
    this.master = null
  }

  private ensureContext() {
    if (this.context && this.master) return this.context
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = 0.18
    master.connect(context.destination)
    this.context = context
    this.master = master
    return context
  }

  private schedulePhrase() {
    const context = this.context
    const bus = this.shoreBus
    if (!context || !bus) return
    const start = context.currentTime + 0.06
    const notes = [294, 370, 440, 494, 440, 370, 330, 247]
    notes.forEach((frequency, index) => {
      this.tone(frequency, start + index, 1.65, index % 4 === 3 ? 0.026 : 0.018, 'sine', bus)
      if (index === 2 || index === 6) this.tone(frequency * 2, start + index + 0.08, 0.7, 0.008, 'triangle', bus)
    })
  }

  private tone(frequency: number, start: number, duration: number, level: number, type: OscillatorType, destination: AudioNode) {
    const context = this.context
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private splash(start: number, level: number) {
    const context = this.context
    const master = this.master
    if (!context || !master) return
    const source = context.createBufferSource()
    source.buffer = this.noiseBurst(context, 0.32)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1450, start)
    filter.frequency.exponentialRampToValueAtTime(420, start + 0.28)
    filter.Q.value = 0.8
    const gain = context.createGain()
    gain.gain.setValueAtTime(level, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    source.connect(filter).connect(gain).connect(master)
    source.start(start)
  }

  private waterBuffer(context: AudioContext) {
    const length = context.sampleRate * 4
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let last = 0
    for (let index = 0; index < length; index += 1) {
      const white = Math.sin(index * 12.9898) * 43758.5453 % 1
      last = last * 0.97 + white * 0.03
      channel[index] = last * (0.72 + Math.sin(index / context.sampleRate * Math.PI) * 0.18)
    }
    return buffer
  }

  private noiseBurst(context: AudioContext, seconds: number) {
    const length = Math.floor(context.sampleRate * seconds)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) channel[index] = Math.sin(index * 78.233) * 43758.5453 % 1
    return buffer
  }
}
