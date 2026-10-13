/** One ring of the carousel, keyed by distance from the center (0 = center). */
export interface SlideStep {
  x: number
  z: number
  rotateY: number
  scale: number
  opacity: number
  /** False once a card is far enough back that it shouldn't be reachable or announced. */
  reachable: boolean
}

/**
 * PC depth: index 0 is the selected card, 1/2 are the visible neighbors,
 * 3 is the far side of the loop (the 6th card), parked behind center at
 * opacity 0 so its presence doesn't register as a 7th visible slot — a
 * felt third dimension, not an aggressive one.
 */
export const PC_STEPS: readonly SlideStep[] = [
  { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1, reachable: true },
  { x: 300, z: -150, rotateY: 30, scale: 0.72, opacity: 0.85, reachable: true },
  { x: 500, z: -320, rotateY: 38, scale: 0.5, opacity: 0.4, reachable: true },
  { x: 560, z: -480, rotateY: 40, scale: 0.4, opacity: 0, reachable: false },
]

/** SP depth: same idea, flatter — the 3D effect is deliberately weaker on mobile. */
export const SP_STEPS: readonly SlideStep[] = [
  { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1, reachable: true },
  { x: 118, z: -70, rotateY: 10, scale: 0.68, opacity: 0.55, reachable: true },
  { x: 160, z: -130, rotateY: 12, scale: 0.48, opacity: 0, reachable: false },
  { x: 175, z: -160, rotateY: 12, scale: 0.42, opacity: 0, reachable: false },
]

export interface ResolvedSlideTransform {
  x: number
  z: number
  rotateY: number
  scale: number
  opacity: number
  zIndex: number
  reachable: boolean
}

/** Signed shortest distance from `selected` to `index` around a loop of `count` items. */
export function circularDelta(index: number, selected: number, count: number): number {
  const raw = (((index - selected) % count) + count) % count
  return raw > count / 2 ? raw - count : raw
}

export function resolveSlideTransform(
  delta: number,
  steps: readonly SlideStep[],
): ResolvedSlideTransform {
  const sign = delta === 0 ? 0 : delta > 0 ? 1 : -1
  const ring = Math.min(Math.abs(delta), steps.length - 1)
  const step = steps[ring]
  return {
    x: step.x * sign,
    z: step.z,
    rotateY: step.rotateY * -sign,
    scale: step.scale,
    opacity: step.opacity,
    reachable: step.reachable,
    zIndex: 100 - ring * 10,
  }
}
