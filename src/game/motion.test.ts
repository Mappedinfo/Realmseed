import { describe, expect, it } from 'vitest'
import { WALK_BOB_AMPLITUDE_PX, walkBobOffset } from './motion'

describe('walking motion', () => {
  it('keeps the subtle step bob at one tenth of the former two-pixel offset', () => {
    expect(WALK_BOB_AMPLITUDE_PX).toBe(0.2)
    expect(walkBobOffset(0)).toBeCloseTo(0)
    expect(walkBobOffset(0.5)).toBeCloseTo(0.2)
    expect(walkBobOffset(1)).toBeCloseTo(0)
  })

  it('clamps invalid animation progress to the settled endpoints', () => {
    expect(walkBobOffset(-1)).toBeCloseTo(0)
    expect(walkBobOffset(2)).toBeCloseTo(0)
  })
})
