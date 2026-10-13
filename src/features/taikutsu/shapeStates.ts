import type { BlobPoint } from './shapeMath'

export type Hp = 0 | 1 | 2 | 3 | 4 | 5

export const VIEW_SIZE = 240
export const CENTER = VIEW_SIZE / 2

/**
 * Fixed angles shared by every HP state (and the idle breathing pass).
 * Only radius changes between states, so morphing is a simple per-index
 * lerp that can never twist or self-intersect.
 */
const ANGLE_JITTER = [0, -4, 6, -3, 5, -7, 3, 4, -5, 2, -3, 6, -2, 4]
export const POINT_COUNT = ANGLE_JITTER.length
const ANGLE_STEP = 360 / POINT_COUNT
export const BASE_ANGLES = ANGLE_JITTER.map((jitter, i) => i * ANGLE_STEP + jitter)

const shapeFrom = (radii: number[]): BlobPoint[] =>
  radii.map((radius, i) => ({ angle: BASE_ANGLES[i], radius }))

// HP5: undamaged silhouette. Irregular and asymmetric, but reads as one mass.
const HP5_RADII = [104, 97, 101, 93, 99, 105, 96, 100, 90, 98, 103, 94, 100, 107]

// HP4: hit 1 lands as a single small bite at index 3 (south). Neighbours
// only soften slightly so the wound reads as a chip, not a split.
const HP4_RADII = [104, 97, 95, 60, 92, 105, 96, 100, 90, 98, 103, 94, 100, 107]

// HP3: hit 2 opens a second bite at index 9 (west); hit 1 deepens and
// widens into index 4, as if the first wound is tearing further.
const HP3_RADII = [107, 97, 95, 52, 78, 105, 96, 100, 82, 55, 90, 94, 100, 107]

// HP2: hit 3 is the first real gouge — a two-point notch across the
// 13/0 seam (north) — while the earlier wounds deepen further.
const HP2_RADII = [45, 92, 95, 46, 78, 105, 96, 100, 82, 48, 90, 94, 90, 50]

// HP1: hit 4 bites index 6 (west-south-west); the whole mass also shrinks
// and turns ragged, reading as "about to come apart" without losing
// cohesion as a single silhouette.
const HP1_RADII = [41, 74, 84, 35, 69, 77, 50, 73, 73, 37, 80, 76, 80, 39]

// HP0 is never drawn as a static silhouette (see TaikutsuCreature's final
// blow sequence) but a collapsed point set is kept for completeness /
// potential reuse as a morph target.
const HP0_RADII = HP1_RADII.map((r) => r * 0.3)

export const HP_SHAPES: Record<Hp, BlobPoint[]> = {
  5: shapeFrom(HP5_RADII),
  4: shapeFrom(HP4_RADII),
  3: shapeFrom(HP3_RADII),
  2: shapeFrom(HP2_RADII),
  1: shapeFrom(HP1_RADII),
  0: shapeFrom(HP0_RADII),
}

/** Index whose dent most recently deepened going from `hp + 1` to `hp` — used to aim hit particles. */
export const HIT_INDEX_BY_HP: Partial<Record<Hp, number>> = {
  4: 3,
  3: 9,
  2: 13,
  1: 6,
  0: undefined,
}
