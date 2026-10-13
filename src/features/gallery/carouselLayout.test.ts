import { describe, expect, it } from 'vitest'
import { PC_STEPS, SP_STEPS, circularDelta, resolveSlideTransform } from './carouselLayout'

describe('circularDelta', () => {
  it('is 0 for the selected index itself', () => {
    expect(circularDelta(2, 2, 6)).toBe(0)
  })

  it('returns a positive delta for a nearby index ahead', () => {
    expect(circularDelta(3, 2, 6)).toBe(1)
  })

  it('returns a negative delta for a nearby index behind', () => {
    expect(circularDelta(1, 2, 6)).toBe(-1)
  })

  it('wraps around the loop by the shortest path', () => {
    // 6 items, selected=0: index 5 is 1 step behind (-1), not 5 steps ahead.
    expect(circularDelta(5, 0, 6)).toBe(-1)
  })
})

describe('resolveSlideTransform', () => {
  it('returns the centered, fully visible step for delta 0', () => {
    const t = resolveSlideTransform(0, PC_STEPS)
    expect(t).toMatchObject({ x: 0, z: 0, scale: 1, opacity: 1, reachable: true })
    expect(t.rotateY).toBeCloseTo(0) // -0 * sign(0) is -0, equivalent to 0 for CSS rotation
  })

  it('mirrors x/rotateY sign with the delta sign', () => {
    const ahead = resolveSlideTransform(1, PC_STEPS)
    const behind = resolveSlideTransform(-1, PC_STEPS)
    expect(ahead.x).toBe(-behind.x)
    expect(ahead.rotateY).toBe(-behind.rotateY)
  })

  it('clamps a delta beyond the last step to the last (farthest, unreachable) step', () => {
    const farAhead = resolveSlideTransform(10, PC_STEPS)
    const lastStep = PC_STEPS[PC_STEPS.length - 1]
    expect(farAhead.scale).toBe(lastStep.scale)
    expect(farAhead.reachable).toBe(false)
  })

  it('ranks zIndex so nearer rings stack above farther ones', () => {
    const near = resolveSlideTransform(1, SP_STEPS)
    const far = resolveSlideTransform(2, SP_STEPS)
    expect(near.zIndex).toBeGreaterThan(far.zIndex)
  })
})
