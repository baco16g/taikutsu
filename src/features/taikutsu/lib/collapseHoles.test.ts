import { describe, expect, it, vi } from 'vitest'
import { COLLAPSE_HOLES } from './collapseHoles'
import { CENTER } from './shapeStates'

describe('COLLAPSE_HOLES', () => {
  it('generates 30 holes', () => {
    expect(COLLAPSE_HOLES).toHaveLength(30)
  })

  it('is deterministic across module reloads (fixed seed)', async () => {
    vi.resetModules()
    const { COLLAPSE_HOLES: reloaded } = await import('./collapseHoles')
    expect(reloaded).toEqual(COLLAPSE_HOLES)
  })

  it('keeps every hole within comfortable reach of the body and gives it a positive target radius', () => {
    for (const hole of COLLAPSE_HOLES) {
      const dist = Math.hypot(hole.cx - CENTER, hole.cy - CENTER)
      expect(dist).toBeLessThanOrEqual(108)
      expect(hole.targetR).toBeGreaterThan(0)
    }
  })
})
