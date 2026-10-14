import { mulberry32 } from './prng'
import { CENTER } from './shapeStates'

export interface CollapseHole {
  cx: number
  cy: number
  targetR: number
}

const HOLE_COUNT = 30
const MAX_DIST = 108 // comfortably covers HP1's largest radius (~94) plus margin

/**
 * Scattered circles covering the whole body, used as a growing SVG mask at
 * the final blow: instead of the body shrinking toward a point (which reads
 * as "retreating into the distance"), these pop open across the silhouette
 * so the mass visibly crumbles into the particle burst instead.
 * Uniform-disk sampling (r = MAX_DIST * sqrt(rand())) avoids center bias.
 */
export const COLLAPSE_HOLES: CollapseHole[] = (() => {
  const rand = mulberry32(777)
  return Array.from({ length: HOLE_COUNT }, () => {
    const angle = rand() * Math.PI * 2
    const dist = MAX_DIST * Math.sqrt(rand())
    return {
      cx: CENTER + Math.cos(angle) * dist,
      cy: CENTER + Math.sin(angle) * dist,
      targetR: 16 + rand() * 20,
    }
  })
})()
