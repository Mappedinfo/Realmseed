export const WALK_BOB_AMPLITUDE_PX = 0.2

export function walkBobOffset(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress))
  return Math.sin(clamped * Math.PI) * WALK_BOB_AMPLITUDE_PX
}
