import { describe, expect, it } from 'vitest'
import { fishingSoundTier, resolveAudioMode } from './fishingAudio'
import type { FishingResult } from '../game/types'

const result = (overrides: Partial<FishingResult>): FishingResult => ({
  quality: 'success', kind: 'fish', fishId: 'minnow', amount: 1,
  label: '渔获', tone: 'good', ...overrides,
})

describe('fishing audio', () => {
  it('prioritizes battle over the shoreline score', () => {
    expect(resolveAudioMode(false, false)).toBe('explore')
    expect(resolveAudioMode(false, true)).toBe('shore')
    expect(resolveAudioMode(true, true)).toBe('battle')
  })

  it('assigns progressively richer landing sounds by catch class', () => {
    expect(fishingSoundTier(result({ kind: 'empty' }))).toBe('miss')
    expect(fishingSoundTier(result({ kind: 'wood' }))).toBe('driftwood')
    expect(fishingSoundTier(result({ fishId: 'minnow' }))).toBe('common')
    expect(fishingSoundTier(result({ fishId: 'carp' }))).toBe('uncommon')
    expect(fishingSoundTier(result({ fishId: 'golden-koi' }))).toBe('rare')
    expect(fishingSoundTier(result({ kind: 'gold' }))).toBe('coin')
    expect(fishingSoundTier(result({ kind: 'equipment' }))).toBe('treasure')
  })
})
