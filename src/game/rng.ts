export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRandom(seed: string): () => number {
  return mulberry32(hashString(seed))
}

export function randomSeed(): string {
  const left = ['amber', 'bramble', 'cedar', 'dawn', 'ember', 'fern', 'moss', 'river', 'willow']
  const right = ['atlas', 'hollow', 'meadow', 'moon', 'reach', 'song', 'vale', 'ward', 'wild']
  const random = crypto.getRandomValues(new Uint32Array(2))
  return `${left[random[0] % left.length]}-${right[random[1] % right.length]}-${(random[0] ^ random[1]).toString(36).slice(0, 4)}`
}

export function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]
}
