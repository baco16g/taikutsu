import { describe, expect, it } from 'vitest'
import { blobPointToVec2, blobPointsToPath, cloneBlobPoints, lerpBlobPoints } from './shapeMath'

describe('blobPointToVec2', () => {
  it('places a point at angle 0 directly to the right of the center', () => {
    expect(blobPointToVec2({ angle: 0, radius: 10 }, 100, 100)).toEqual({ x: 110, y: 100 })
  })

  it('places a point at angle 90 directly below the center (SVG y-down)', () => {
    const { x, y } = blobPointToVec2({ angle: 90, radius: 10 }, 100, 100)
    expect(x).toBeCloseTo(100)
    expect(y).toBeCloseTo(110)
  })
})

describe('blobPointsToPath', () => {
  it('returns an empty string for fewer than 3 points', () => {
    expect(blobPointsToPath([], 0, 0)).toBe('')
    expect(blobPointsToPath([{ angle: 0, radius: 1 }], 0, 0)).toBe('')
  })

  it('starts with M at the first point and closes with Z', () => {
    const points = [
      { angle: 0, radius: 10 },
      { angle: 120, radius: 10 },
      { angle: 240, radius: 10 },
    ]
    const d = blobPointsToPath(points, 50, 50)
    expect(d.startsWith('M 60.00 50.00')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    // 閉じたループの各点につきCセグメントが1つ。
    expect(d.match(/C /g)).toHaveLength(points.length)
  })
})

describe('lerpBlobPoints', () => {
  const a = [
    { angle: 0, radius: 10 },
    { angle: 90, radius: 20 },
  ]
  const b = [
    { angle: 10, radius: 30 },
    { angle: 100, radius: 40 },
  ]

  it('returns `a` unchanged at t=0', () => {
    expect(lerpBlobPoints(a, b, 0)).toEqual(a)
  })

  it('returns `b` at t=1', () => {
    expect(lerpBlobPoints(a, b, 1)).toEqual(b)
  })

  it('interpolates angle and radius independently at t=0.5', () => {
    expect(lerpBlobPoints(a, b, 0.5)).toEqual([
      { angle: 5, radius: 20 },
      { angle: 95, radius: 30 },
    ])
  })
})

describe('cloneBlobPoints', () => {
  it('produces an equal but distinct array and point objects', () => {
    const original = [{ angle: 0, radius: 10 }]
    const clone = cloneBlobPoints(original)
    expect(clone).toEqual(original)
    expect(clone).not.toBe(original)
    expect(clone[0]).not.toBe(original[0])
  })
})
