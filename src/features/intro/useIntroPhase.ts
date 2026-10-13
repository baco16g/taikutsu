import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import gsap from 'gsap'
import { MAX_SEED_RADIUS } from './introSeeds'

export type IntroPhase = 'arrival' | 'ready' | 'depart' | 'moving' | 'settling' | 'battle'

/** Deliberately tuned durations for the formation/depart/travel/settle sequence — not arbitrary defaults. */
const TIMING = {
  delay: 0.22,
  formation: 1.35,
  depart: 0.23,
  travel: 0.82,
  settle: 0.22,
  pendingSpeedup: 4,
}

interface Box {
  x: number
  y: number
  size: number
}

function measureDock(dockEl: HTMLElement, worldEl: HTMLElement): Box {
  const d = dockEl.getBoundingClientRect()
  const w = worldEl.getBoundingClientRect()
  return { x: d.left - w.left, y: d.top - w.top, size: d.width }
}

export interface UseIntroPhaseOptions {
  reducedMotion: boolean
  /** Called once the actor lands at the battle dock — the page wires battle-only side effects (none here) separately from this hook's own focus/announcement. */
  onArrived?: () => void
}

/**
 * Owns the intro→battle phase state machine: the single タ・イクツ instance
 * never remounts (see IntroActor) — this hook only ever measures two "dock"
 * placeholders and repaints one shared wrapper's transform/width to match.
 * All of the continuous animation (mask bloom, dust progress, the travel
 * tween) is GSAP-driven so `requestStart`'s mid-formation speedup is just
 * `tween.timeScale(4)` instead of hand-rolled elapsed-time math.
 */
export function useIntroPhase({ reducedMotion, onArrived }: UseIntroPhaseOptions) {
  const [phase, setPhase] = useState<IntroPhase>('arrival')
  const [pendingStart, setPendingStart] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const maskCirclesGroupRef = useRef<SVGGElement>(null)
  const introDockRef = useRef<HTMLDivElement>(null)
  const battleDockRef = useRef<HTMLDivElement>(null)
  const introSectionRef = useRef<HTMLElement>(null)
  const battleSectionRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const dustProgressRef = useRef(0)

  const phaseRef = useRef<IntroPhase>('arrival')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const pendingStartRef = useRef(false)
  const moveStartedRef = useRef(false)
  const formationTimelineRef = useRef<gsap.core.Timeline | null>(null)
  const moveTweenRef = useRef<gsap.core.Tween | null>(null)
  const settleTimerRef = useRef<number | null>(null)

  const repaintToDock = useCallback((dockEl: HTMLElement | null) => {
    const wrapper = wrapperRef.current
    const world = worldRef.current
    if (!wrapper || !world || !dockEl) return
    const box = measureDock(dockEl, world)
    gsap.set(wrapper, { x: box.x, y: box.y, width: box.size })
  }, [])

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  /** Final position/opacity/focus for "just landed in battle" — used both by the normal settle timeout and by a resize that forces an in-flight transition to finish instantly. */
  const completeMove = useCallback(() => {
    repaintToDock(battleDockRef.current)
    if (battleSectionRef.current) gsap.set(battleSectionRef.current, { opacity: 1 })
    if (worldRef.current) {
      gsap.killTweensOf(worldRef.current)
      worldRef.current.style.height = ''
    }
    setPhase('battle')
    onArrived?.()
  }, [repaintToDock, onArrived])

  /** Skips straight to the finished battle state — resize/rotation mid-transition, or reduced-motion engaging mid-transition. Never replays from the intro. */
  const forceArriveAtBattle = useCallback(() => {
    gsap.killTweensOf(wrapperRef.current)
    gsap.killTweensOf(introSectionRef.current)
    gsap.killTweensOf(battleSectionRef.current)
    clearSettleTimer()
    moveStartedRef.current = true
    flushSync(() => setPhase('moving'))
    completeMove()
  }, [clearSettleTimer, completeMove])

  const beginMove = useCallback(() => {
    if (moveStartedRef.current) return
    moveStartedRef.current = true

    const wrapper = wrapperRef.current
    const world = worldRef.current
    if (!wrapper || !world) {
      flushSync(() => setPhase('moving'))
      completeMove()
      return
    }

    // Capture the actor's current viewport position *before* the intro/battle
    // layout swap — the swap can change #world's own height (and scroll),
    // so this is the only way to know "where it visually is right now".
    const viewportBefore = wrapper.getBoundingClientRect()
    // Pin #world's own height to its current (intro) value across the
    // swap — an explicit height, not just a min-height floor: on mobile
    // (.cmdproto-world-container is height:auto there) battle's own
    // content can be either taller OR shorter than intro's, and a floor
    // alone only ever stopped it shrinking, not the instant snap upward
    // the moment battle (e.g. its command list) needed more room than
    // intro did. Tweened to battle's own natural height below instead of
    // left to jump the instant the swap commits.
    const fromHeight = world.getBoundingClientRect().height
    world.style.height = `${fromHeight}px`

    flushSync(() => setPhase('moving'))

    // Only NOW does .introproto-battle (and its dock) actually exist in the
    // DOM — it's gated behind the same `phase` this flushSync just
    // committed. Reading battleDockRef any earlier always found it null,
    // which silently fell back to the no-tween branch above on every run —
    // the actor was snapping straight to its final spot instead of
    // traveling there.
    const battleDock = battleDockRef.current
    if (!battleDock) {
      completeMove()
      return
    }

    // Battle's own natural height, measured with the pin momentarily
    // lifted and immediately restored — synchronous, so nothing paints in
    // between and the unpinned size is never actually shown. On desktop
    // .cmdproto-world-container's height is a fixed vh/px formula that
    // doesn't depend on content, so fromHeight and toHeight come out
    // identical there and the tween below is a harmless no-op (this is
    // the mobile-only bug WorldFrame.css's own comment already flagged —
    // see its height:auto breakpoint rule).
    world.style.height = ''
    const toHeight = world.getBoundingClientRect().height
    world.style.height = `${fromHeight}px`

    // Re-measure #world *after* the swap committed, then convert the
    // pre-swap viewport position into the post-swap coordinate space — the
    // actor's painted position is numerically different but visually
    // identical, so nothing jumps.
    const worldAfter = world.getBoundingClientRect()
    const travelFrom: Box = {
      x: viewportBefore.left - worldAfter.left,
      y: viewportBefore.top - worldAfter.top,
      size: viewportBefore.width,
    }
    const travelTo = measureDock(battleDock, world)
    gsap.set(wrapper, { x: travelFrom.x, y: travelFrom.y, width: travelFrom.size })

    if (reducedMotion) {
      world.style.height = `${toHeight}px`
      if (battleSectionRef.current) gsap.set(battleSectionRef.current, { opacity: 1 })
      completeMove()
      return
    }

    if (battleSectionRef.current) gsap.set(battleSectionRef.current, { opacity: 0 })

    // Same duration/ease as the actor's own travel tween below, so the
    // frame finishes resizing exactly as タ・イクツ lands rather than
    // settling at a visibly different moment.
    gsap.to(world, { height: toHeight, duration: TIMING.travel, ease: 'power3.inOut' })

    moveTweenRef.current = gsap.to(wrapper, {
      x: travelTo.x,
      y: travelTo.y,
      width: travelTo.size,
      duration: TIMING.travel,
      ease: 'power3.inOut',
      onComplete: () => {
        setPhase('settling')
        settleTimerRef.current = window.setTimeout(completeMove, TIMING.settle * 1000)
      },
    })
    if (battleSectionRef.current) {
      gsap.to(battleSectionRef.current, {
        opacity: 1,
        duration: TIMING.travel * 0.45,
        delay: TIMING.travel * 0.55,
        ease: 'power1.out',
      })
    }
  }, [reducedMotion, completeMove])

  const depart = useCallback(() => {
    setPhase('depart')
    const introSection = introSectionRef.current
    if (!introSection || reducedMotion) {
      if (introSection) gsap.set(introSection, { opacity: 0 })
      beginMove()
      return
    }
    gsap.to(introSection, {
      opacity: 0,
      duration: TIMING.depart,
      ease: 'power1.out',
      onComplete: beginMove,
    })
  }, [reducedMotion, beginMove])

  const startFormation = useCallback(() => {
    moveStartedRef.current = false
    pendingStartRef.current = false
    setPendingStart(false)

    repaintToDock(introDockRef.current)

    const circles = maskCirclesGroupRef.current
      ? Array.from(maskCirclesGroupRef.current.children)
      : []

    if (reducedMotion) {
      // Nothing can have requested a start yet this early (mount, or a
      // fresh reset) — unlike the reducedMotion-toggle effect below, which
      // does need the pendingStart check since that one can fire mid-session.
      if (circles.length > 0) gsap.set(circles, { attr: { r: MAX_SEED_RADIUS } })
      dustProgressRef.current = 1
      setPhase('ready')
      return
    }

    if (circles.length > 0) gsap.set(circles, { attr: { r: 0 } })
    dustProgressRef.current = 0

    const proxy = { t: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        setPhase('ready')
        if (pendingStartRef.current) depart()
      },
    })
    tl.to(
      proxy,
      {
        t: 1,
        duration: TIMING.delay + TIMING.formation,
        ease: 'none',
        onUpdate: () => {
          dustProgressRef.current = proxy.t
        },
      },
      0,
    )
    if (circles.length > 0) {
      tl.to(
        circles,
        {
          attr: { r: MAX_SEED_RADIUS },
          duration: TIMING.formation * 0.5,
          ease: 'power2.out',
          stagger: { each: (TIMING.formation * 0.5) / circles.length, from: 'random' },
        },
        TIMING.delay + TIMING.formation * 0.25,
      )
    }
    formationTimelineRef.current = tl
  }, [reducedMotion, repaintToDock, depart])

  const requestStart = useCallback(() => {
    const current = phaseRef.current
    if (!['arrival', 'ready'].includes(current) || pendingStartRef.current) return
    pendingStartRef.current = true
    setPendingStart(true)
    if (current === 'ready') {
      depart()
    } else {
      formationTimelineRef.current?.timeScale(TIMING.pendingSpeedup)
    }
  }, [depart])

  const resetIntro = useCallback(() => {
    gsap.killTweensOf(wrapperRef.current)
    gsap.killTweensOf(introSectionRef.current)
    gsap.killTweensOf(battleSectionRef.current)
    formationTimelineRef.current?.kill()
    moveTweenRef.current?.kill()
    clearSettleTimer()
    if (introSectionRef.current) gsap.set(introSectionRef.current, { opacity: 1 })
    setPhase('arrival')
    startFormation()
  }, [clearSettleTimer, startFormation])

  // Mount: paint the actor onto the intro dock before the browser's first
  // paint (no flash-of-wrong-size/position), then kick off formation.
  useEffect(() => {
    // Starts the GSAP formation timeline; not a render-derived state sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startFormation()
    return () => {
      formationTimelineRef.current?.kill()
      moveTweenRef.current?.kill()
      clearSettleTimer()
    }
    // Deliberately mount-only — resetIntro is the explicit re-entry point
    // for replaying, and reducedMotion changes are handled by the effect
    // below rather than by re-running formation from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The intro headline now loads a webfont (Dela Gothic One). It's
  // requested with display:swap, so the very first paint above already
  // used the fallback — but the swap itself, whenever it lands, can change
  // that headline's own box height, and with it the grid's total content
  // height (.introproto-grid centers its content vertically), shifting
  // where the dock actually sits. document.fonts.ready resolves once that
  // swap (or its failure) has settled, so re-measuring then keeps the
  // actor aligned with the dock's final, post-swap position — a silent
  // repaint, not a re-run of startFormation, so it never restarts the
  // particle formation or snaps a mid-transition actor.
  useEffect(() => {
    const fonts = document.fonts
    // lib.dom types this as always present; older browsers may lack it.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!fonts) return
    let cancelled = false
    void fonts.ready.then(() => {
      if (cancelled) return
      const current = phaseRef.current
      if (current === 'battle') {
        repaintToDock(battleDockRef.current)
      } else if (current === 'arrival' || current === 'ready') {
        repaintToDock(introDockRef.current)
      }
    })
    return () => {
      cancelled = true
    }
  }, [repaintToDock])

  // prefers-reduced-motion flipping on mid-session: finish whatever's in
  // flight immediately rather than leaving a long tween half-reduced.
  useEffect(() => {
    if (!reducedMotion) return
    const current = phaseRef.current
    if (current === 'arrival') {
      formationTimelineRef.current?.kill()
      const circles = maskCirclesGroupRef.current
        ? Array.from(maskCirclesGroupRef.current.children)
        : []
      if (circles.length > 0) gsap.set(circles, { attr: { r: MAX_SEED_RADIUS } })
      dustProgressRef.current = 1
      setPhase('ready')
      if (pendingStartRef.current) depart()
    } else if (['depart', 'moving', 'settling'].includes(current)) {
      forceArriveAtBattle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  // Resize/rotation: reposition without disturbing an idle phase; force an
  // in-flight transition to its finished state rather than resuming a stale
  // tween against now-outdated dock geometry.
  useEffect(() => {
    const onResize = () => {
      const current = phaseRef.current
      if (['depart', 'moving', 'settling'].includes(current)) {
        forceArriveAtBattle()
      } else if (current === 'battle') {
        repaintToDock(battleDockRef.current)
      } else {
        repaintToDock(introDockRef.current)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [forceArriveAtBattle, repaintToDock])

  return {
    phase,
    pendingStart,
    wrapperRef,
    maskCirclesGroupRef,
    introDockRef,
    battleDockRef,
    introSectionRef,
    battleSectionRef,
    worldRef,
    dustProgressRef,
    maskActive: phase === 'arrival',
    showDust: phase === 'arrival' && !reducedMotion,
    requestStart,
    resetIntro,
  }
}
