import { mulberry32 } from '../../taikutsu/lib/prng'

export interface IntroSeed {
  /** Fraction (0-1) of the actor's own box — paired with `maskContentUnits="objectBoundingBox"` on the reveal mask. */
  x: number
  y: number
  /** Fraction (0-1) of the formation tween's own progress before this seed starts growing. */
  delay: number
}

const SEED_COUNT = 18
const GOLDEN_ANGLE = 2.399963 // radians — same sunflower/Fibonacci spiral spacing used for collapseHoles.ts's own scatter
const MAX_RADIUS_FRAC = 0.4 // keeps every seed *center* within the body's own silhouette, not the padded dust-canvas box

/** How large each seed circle grows (objectBoundingBox fraction) once fully revealed — generous enough that 18 of them fully cover the body between them. */
export const MAX_SEED_RADIUS = 0.3

/**
 * Where タ・イクツ's silhouette "resolves from" during arrival — shared by
 * IntroActor's reveal mask (circles grow here) and ArrivalDust's canvas
 * (particles fly toward these same points), so the dust visibly feeds the
 * mask bloom instead of landing on unrelated spots. Computed once at module
 * scope with a fixed seed, same pattern as src/features/taikutsu/lib/collapseHoles.ts.
 */
export const INTRO_SEEDS: IntroSeed[] = (() => {
  const rand = mulberry32(2026)
  return Array.from({ length: SEED_COUNT }, (_, i) => {
    const angle = i * GOLDEN_ANGLE
    const radius = Math.sqrt((i + 0.5) / SEED_COUNT) * MAX_RADIUS_FRAC
    return {
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
      delay: rand() * 0.25,
    }
  })
})()
