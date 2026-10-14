import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { BlobPoint } from '../lib/shapeMath'
import {
  blobPointToVec2,
  blobPointsToPath,
  cloneBlobPoints,
  lerpBlobPoints,
} from '../lib/shapeMath'
import { CENTER, HIT_INDEX_BY_HP, HP_SHAPES, VIEW_SIZE, type Hp } from '../lib/shapeStates'
import { COLLAPSE_HOLES } from '../lib/collapseHoles'

export interface ImpactInfo {
  /** fractional 0-1 position within the creature's own viewBox, for the particle canvas to map to pixels */
  xFrac: number
  yFrac: number
  big: boolean
}

interface UseCreatureAnimationOptions {
  idleEnabled: boolean
  reducedMotion: boolean
  onImpact: (impact: ImpactInfo) => void
  onRestingShapeChange?: (hp: Hp) => void
}

const applyPathD = (el: SVGPathElement | null, d: string) => {
  if (el) el.setAttribute('d', d)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const WOBBLE_FADE_IN_DURATION = 0.6 // seconds to ease idle wobble back in after it was interrupted
const HOVER_WOBBLE_BOOST = 0.6 // fully-hovered wobble amplitude = base * (1 + this)
const HOVER_SPEED_BOOST = 0.55 // fully-hovered float/drift playback speed = base * (1 + this)
const HOVER_SCALE = 1.035 // fully-hovered overall scale swell

/**
 * Per-point idle radius offset at a given gsap.ticker time. A pure function
 * of time (never a discrete from/to tween), so sampled on its own it has no
 * loop seam — the seam this module actually has to manage is the boundary
 * between "idle wobble is live" and "an attack timeline owns the contour".
 */
const computeWobbleDeltas = (shape: BlobPoint[], time: number): number[] => {
  const breathe = Math.sin(time * 0.35) * 3.2
  const sway = Math.sin(time * 0.23 + Math.PI / 3) * 2.6
  return shape.map((p, i) => {
    const freqA = 0.45 + (i % 5) * 0.07
    const freqB = 0.27 + (i % 3) * 0.05
    const amp = 3.2 + 1.8 * Math.abs(Math.sin(i * 12.9))
    const wobble =
      Math.sin(time * freqA + i * 0.9) * amp + Math.cos(time * freqB + i * 2.1) * amp * 0.55
    const directional = Math.cos((p.angle * Math.PI) / 180) * sway
    return wobble + breathe + directional
  })
}

/**
 * Owns the live contour: the idle breathing/wobble loop and the attack
 * morph timeline. The two never run at once — `isAttackingRef` gates the
 * idle ticker while a timeline is in flight. Crossing that boundary in
 * either direction must not visibly pop:
 * - entering an attack morphs from the contour's current *displayed*
 *   position (base shape + live wobble), not the unwobbled base shape;
 * - leaving an attack (resuming idle) fades the wobble back in from 0 over
 *   `WOBBLE_FADE_IN_DURATION`, since the idle sine functions are keyed off
 *   absolute elapsed time and would otherwise jump to whatever phase they
 *   happen to be at the moment they resume.
 */
export function useCreatureAnimation({
  idleEnabled,
  reducedMotion,
  onImpact,
  onRestingShapeChange,
}: UseCreatureAnimationOptions) {
  const clipPathRef = useRef<SVGPathElement>(null)
  const floatGroupRef = useRef<SVGGElement>(null)
  const visibilityGroupRef = useRef<SVGGElement>(null)
  const squashGroupRef = useRef<SVGGElement>(null)
  const collapseGroupRef = useRef<SVGGElement>(null)
  const driftRefA = useRef<SVGGElement>(null)
  const driftRefB = useRef<SVGGElement>(null)

  const hpRef = useRef<Hp>(5)
  const restShapeRef = useRef<BlobPoint[]>(cloneBlobPoints(HP_SHAPES[5]))
  const isAttackingRef = useRef(false)
  // gsap.ticker time at which idle wobble last resumed; -Infinity means "always been live"
  const wobbleResumeTimeRef = useRef(-Infinity)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const floatTweenRef = useRef<gsap.core.Tween | null>(null)
  const driftTweenARef = useRef<gsap.core.Tween | null>(null)
  const driftTweenBRef = useRef<gsap.core.Tween | null>(null)
  // 0 = resting, 1 = fully "alert" (hovered) — eased by setHovered(), read by
  // the idle tick to scale wobble amplitude and by setHovered() itself to
  // scale the float/drift tweens' playback speed.
  const hoverIntensityRef = useRef(0)
  const hoverTweenRef = useRef<gsap.core.Tween | null>(null)
  const hoverScaleTweenRef = useRef<gsap.core.Tween | null>(null)

  // --- idle loop -----------------------------------------------------
  useEffect(() => {
    if (reducedMotion) {
      applyPathD(clipPathRef.current, blobPointsToPath(restShapeRef.current, CENTER, CENTER))
      return
    }

    const tick = (time: number) => {
      if (isAttackingRef.current) return
      if (!idleEnabled) {
        applyPathD(clipPathRef.current, blobPointsToPath(restShapeRef.current, CENTER, CENTER))
        return
      }
      // Fade back in from 0 if idle just resumed after an attack, so the
      // contour continues exactly where the attack left it instead of
      // snapping to the sine functions' current phase.
      const fade = clamp01((time - wobbleResumeTimeRef.current) / WOBBLE_FADE_IN_DURATION)
      // Hovering makes it read as "noticing you" — same motion, just louder.
      const hoverMul = 1 + hoverIntensityRef.current * HOVER_WOBBLE_BOOST
      const deltas = computeWobbleDeltas(restShapeRef.current, time)
      const deformed = restShapeRef.current.map((p, i) => ({
        angle: p.angle,
        radius: p.radius + deltas[i] * fade * hoverMul,
      }))
      applyPathD(clipPathRef.current, blobPointsToPath(deformed, CENTER, CENTER))
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
    }
  }, [idleEnabled, reducedMotion])

  // --- floating + texture drift (transform/opacity only, never re-filters) ---
  // Two noise layers (different seeds) drift at different speeds/directions
  // and layer B also cross-fades its opacity — the combination reads as the
  // pattern itself flowing rather than one static image sliding around.
  useEffect(() => {
    floatTweenRef.current?.kill()
    driftTweenARef.current?.kill()
    driftTweenBRef.current?.kill()
    if (reducedMotion || !idleEnabled) {
      gsap.set(floatGroupRef.current, { y: 0 })
      gsap.set(driftRefA.current, { x: 0, y: 0 })
      gsap.set(driftRefB.current, { x: 0, y: 0, opacity: 0.35 })
      return
    }
    if (floatGroupRef.current) {
      floatTweenRef.current = gsap.to(floatGroupRef.current, {
        y: 8,
        duration: 3.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    }
    if (driftRefA.current) {
      driftTweenARef.current = gsap.to(driftRefA.current, {
        x: 7,
        y: -5,
        duration: 11,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    }
    if (driftRefB.current) {
      gsap.set(driftRefB.current, { opacity: 0.2 })
      driftTweenBRef.current = gsap.to(driftRefB.current, {
        x: -11,
        y: 8,
        opacity: 0.55,
        duration: 17,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      })
    }
    return () => {
      floatTweenRef.current?.kill()
      driftTweenARef.current?.kill()
      driftTweenBRef.current?.kill()
    }
  }, [idleEnabled, reducedMotion])

  useEffect(() => {
    return () => {
      timelineRef.current?.kill()
      floatTweenRef.current?.kill()
      driftTweenARef.current?.kill()
      driftTweenBRef.current?.kill()
      hoverTweenRef.current?.kill()
      hoverScaleTweenRef.current?.kill()
    }
  }, [])

  const setHpImmediate = useCallback(
    (hp: Hp) => {
      timelineRef.current?.kill()
      isAttackingRef.current = false
      hpRef.current = hp
      restShapeRef.current = cloneBlobPoints(HP_SHAPES[hp])
      wobbleResumeTimeRef.current = gsap.ticker.time
      gsap.set(squashGroupRef.current, { scaleX: 1, scaleY: 1 })
      gsap.set(visibilityGroupRef.current, { opacity: hp === 0 ? 0 : 1, scale: 1 })
      if (collapseGroupRef.current) gsap.set(collapseGroupRef.current.children, { attr: { r: 0 } })
      applyPathD(clipPathRef.current, blobPointsToPath(restShapeRef.current, CENTER, CENTER))
      onRestingShapeChange?.(hp)
    },
    [onRestingShapeChange],
  )

  /**
   * Hover is a continuous 0→1 intensity, not a toggle: entering/leaving both
   * ease, and the same value drives three things at once — idle wobble
   * amplitude (read in the tick above), float/drift playback speed, and an
   * overall scale swell — so it reads as one consistent "noticing you"
   * reaction rather than three independently-timed effects.
   */
  const setHovered = useCallback(
    (hovered: boolean) => {
      if (reducedMotion) return
      hoverTweenRef.current?.kill()
      hoverScaleTweenRef.current?.kill()

      const proxy = { v: hoverIntensityRef.current }
      const duration = hovered ? 0.45 : 0.6
      const ease = hovered ? 'power2.out' : 'power2.inOut'

      hoverTweenRef.current = gsap.to(proxy, {
        v: hovered ? 1 : 0,
        duration,
        ease,
        onUpdate: () => {
          hoverIntensityRef.current = proxy.v
          const speedMul = 1 + proxy.v * HOVER_SPEED_BOOST
          floatTweenRef.current?.timeScale(speedMul)
          driftTweenARef.current?.timeScale(speedMul)
          driftTweenBRef.current?.timeScale(speedMul)
        },
      })

      if (floatGroupRef.current) {
        hoverScaleTweenRef.current = gsap.to(floatGroupRef.current, {
          scale: hovered ? HOVER_SCALE : 1,
          duration,
          ease,
        })
      }
    },
    [reducedMotion],
  )

  const attack = useCallback(
    (targetHp: Hp) => {
      if (isAttackingRef.current || hpRef.current === 0) return false
      isAttackingRef.current = true

      // Start the morph from what's actually on screen right now (base rest
      // shape + whatever idle wobble/fade was live), not the unwobbled base
      // — otherwise the contour visibly snaps to baseline the instant an
      // attack begins.
      const attackStartTime = gsap.ticker.time
      const liveFade =
        !reducedMotion && idleEnabled
          ? clamp01((attackStartTime - wobbleResumeTimeRef.current) / WOBBLE_FADE_IN_DURATION)
          : 0
      const liveHoverMul = 1 + hoverIntensityRef.current * HOVER_WOBBLE_BOOST
      const liveDeltas =
        liveFade > 0 ? computeWobbleDeltas(restShapeRef.current, attackStartTime) : null
      const fromShape = restShapeRef.current.map((p, i) => ({
        angle: p.angle,
        radius: p.radius + (liveDeltas ? liveDeltas[i] * liveFade * liveHoverMul : 0),
      }))
      const toShape = HP_SHAPES[targetHp]
      const isFinalBlow = targetHp === 0
      const hitIndex = HIT_INDEX_BY_HP[targetHp] ?? 0
      const hitPoint = blobPointToVec2(fromShape[hitIndex], CENTER, CENTER)

      const proxy = { t: 0 }
      const speed = reducedMotion ? 2.4 : 1
      const tl = gsap.timeline({
        onComplete: () => {
          hpRef.current = targetHp
          restShapeRef.current = cloneBlobPoints(toShape)
          isAttackingRef.current = false
          wobbleResumeTimeRef.current = gsap.ticker.time
          timelineRef.current = null
          onRestingShapeChange?.(targetHp)
        },
      })
      timelineRef.current = tl

      const morphDuration = (isFinalBlow ? 0.42 : 0.5) / speed
      const morphEase = reducedMotion ? 'power1.out' : 'back.out(1.6)'

      tl.call(
        () => {
          onImpact({
            xFrac: hitPoint.x / VIEW_SIZE,
            yFrac: hitPoint.y / VIEW_SIZE,
            big: isFinalBlow,
          })
        },
        undefined,
        reducedMotion ? 0 : 0.03,
      )

      // The final blow never morphs the clip path toward HP0's collapsed
      // points — a shrinking silhouette reads as "retreating into the
      // distance". Instead the body stays its own size and is eaten away by
      // the mask-hole erosion below, so it reads as crumbling apart in place.
      if (!isFinalBlow) {
        tl.to(
          proxy,
          {
            t: 1,
            duration: morphDuration,
            ease: morphEase,
            onUpdate: () => {
              applyPathD(
                clipPathRef.current,
                blobPointsToPath(lerpBlobPoints(fromShape, toShape, proxy.t), CENTER, CENTER),
              )
            },
          },
          reducedMotion ? 0 : 0.03,
        )
      }

      if (!reducedMotion) {
        if (!isFinalBlow) {
          tl.to(
            squashGroupRef.current,
            { scaleX: 1.07, scaleY: 0.86, duration: 0.09, ease: 'power2.out' },
            0,
          )
          tl.to(
            squashGroupRef.current,
            { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'elastic.out(1,0.55)' },
            0.09,
          )
        } else {
          // Impact squash, a brief held stillness (0.12 -> 0.24, nothing
          // scheduled), then release while the body crumbles: mask holes pop
          // open in a scattered cascade across the whole silhouette and
          // particles erupt from several points in sync, so the mass itself
          // reads as turning into the debris rather than just shrinking.
          tl.to(
            squashGroupRef.current,
            { scaleX: 1.1, scaleY: 0.8, duration: 0.12, ease: 'power2.out' },
            0,
          )
          tl.to(
            squashGroupRef.current,
            { scaleX: 1, scaleY: 1, duration: 0.16, ease: 'power2.out' },
            0.24,
          )

          if (collapseGroupRef.current) {
            tl.to(
              Array.from(collapseGroupRef.current.children),
              {
                attr: { r: (i: number) => COLLAPSE_HOLES[i]?.targetR ?? 20 },
                duration: 0.45,
                ease: 'power2.out',
                stagger: { each: 0.006, from: 'random' },
              },
              0.26,
            )
          }

          ;[0, 10, 20].forEach((holeIndex, i) => {
            const hole = COLLAPSE_HOLES[holeIndex]
            tl.call(
              () => onImpact({ xFrac: hole.cx / VIEW_SIZE, yFrac: hole.cy / VIEW_SIZE, big: true }),
              undefined,
              0.26 + i * 0.12,
            )
          })

          tl.to(visibilityGroupRef.current, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0.56)
        }
      } else if (isFinalBlow) {
        tl.to(
          visibilityGroupRef.current,
          { opacity: 0, duration: 0.25, ease: 'power1.in' },
          morphDuration * 0.6,
        )
      }

      return true
    },
    [onImpact, onRestingShapeChange, reducedMotion, idleEnabled],
  )

  return {
    clipPathRef,
    floatGroupRef,
    visibilityGroupRef,
    squashGroupRef,
    collapseGroupRef,
    driftRefA,
    driftRefB,
    attack,
    setHpImmediate,
    setHovered,
    isAttacking: () => isAttackingRef.current,
  }
}
