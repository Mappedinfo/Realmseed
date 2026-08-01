import { describe, expect, it } from 'vitest'
import { ownedCollectibles } from './inventory'

describe('inventory collection grid', () => {
  it('only exposes collectible icons that the player currently owns', () => {
    const items = ownedCollectibles({
      wood: 8,
      stone: 5,
      fish: { minnow: 0, carp: 2, loach: 0, 'golden-koi': 1 },
    })
    expect(items.map((item) => item.id)).toEqual(['carp', 'golden-koi'])
    expect(items.map((item) => item.count)).toEqual([2, 1])
  })

  it('leaves the collection empty before any special item is acquired', () => {
    expect(ownedCollectibles({
      wood: 0,
      stone: 0,
      fish: { minnow: 0, carp: 0, loach: 0, 'golden-koi': 0 },
    })).toEqual([])
  })
})
