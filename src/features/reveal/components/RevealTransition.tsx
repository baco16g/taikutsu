import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import styles from './RevealTransition.module.css'

/**
 * Three diagonal sheets that sweep bottom-right → top-left to fully cover
 * the battle screen — including the frame's own header chrome — then the
 * same three sweep back out to reveal the gallery underneath.
 *
 * This component owns only the cover layer itself. The caller (HomePage)
 * owns *what's underneath*: it must synchronously swap battle content for
 * gallery content inside `onCovered` (ideally via `flushSync`, since this
 * component starts the uncover animation shortly after `onCovered` returns
 * and has no other way to know React has actually committed the swap).
 */

const CLOSED = 'polygon(0 200%, 100% 100%, 100% 100%, 0 100%)'
const FILLED = 'polygon(0 0%, 100% -100%, 100% 100%, 0 100%)'
const FULL_EXIT = 'polygon(0 0, 100% 0, 100% 100%, 0 200%)'
const EXITED = 'polygon(0 0, 100% 0, 100% -100%, 0 0%)'

const COVER_MS = 440
const UNCOVER_MS = 440
const STAGGER_MS = 65
const REDUCED_FADE_MS = 100
/** Settle time after the covered content-swap before the uncover animation starts — lets React's swap (and any resulting reflow, invisible behind the sheets) finish painting first. */
const SWAP_SETTLE_MS = 50
const EASE = 'cubic-bezier(.65,0,.35,1)'

export interface RevealTransitionProps {
  reducedMotion: boolean
  worldContainerRef: RefObject<HTMLDivElement | null>
  /** Fully covered — swap battle content for gallery content now (synchronously; see class comment). */
  onCovered: () => void
  /** Fully uncovered — gallery is live, safe to focus/enable it. */
  onComplete: () => void
}

function tweenTo(target: gsap.TweenTarget, vars: gsap.TweenVars): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, { ...vars, onComplete: resolve })
  })
}

export function RevealTransition({
  reducedMotion,
  worldContainerRef,
  onCovered,
  onComplete,
}: RevealTransitionProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetRefs = useRef<(HTMLDivElement | null)[]>([])
  const coveredCalledRef = useRef(false)
  const doneCalledRef = useRef(false)
  const outerElRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const sheets = sheetRefs.current.filter((el): el is HTMLDivElement => el !== null)
    const worldEl = worldContainerRef.current
    if (!wrap || sheets.length === 0 || !worldEl) {
      onCovered()
      onComplete()
      return
    }

    const outer = worldEl.closest<HTMLElement>('[data-scroll-root]')
    outerElRef.current = outer

    // Step 1: cover sheets always reach the viewport's own top — the whole
    // frame, including its header chrome, goes under the sheets before the
    // gallery swap.
    wrap.style.top = '0px'

    // Step 2: stop input, insert the layer. The sheets themselves
    // (pointer-events: auto, opaque, full-bleed) are the input block —
    // nothing interactive survives behind them once covered, and there's
    // nothing left to click in the battle content at this point anyway
    // (CommandMenu already hid its move list at the 5th hit).
    const prevOuterOverflow = outer?.style.overflow ?? ''
    const prevHtmlOverflow = document.documentElement.style.overflow
    if (outer) outer.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const restoreScroll = () => {
      if (outer) outer.style.overflow = prevOuterOverflow
      document.documentElement.style.overflow = prevHtmlOverflow
    }

    const callCovered = () => {
      if (coveredCalledRef.current) return
      coveredCalledRef.current = true
      // Step 4: swap content while hidden, then land the gallery at its own top.
      onCovered()
      if (outer) outer.scrollTop = 0
    }
    const callComplete = () => {
      if (doneCalledRef.current) return
      doneCalledRef.current = true
      restoreScroll()
      onComplete()
    }

    let abandoned = false

    // Resize/rotation/backgrounding mid-transition: the battle result is
    // already final (5th hit landed, defeat already played) — never revert
    // to the battle view. Kill whatever's in flight and jump straight to
    // the finished gallery state instead.
    const fastForward = () => {
      if (abandoned) return
      abandoned = true
      gsap.killTweensOf([...sheets, wrap])
      callCovered()
      // Covers both branches' own way of hiding the sheets: clip-path for
      // the normal sweep, the wrapper's opacity for the reduced-motion
      // fade — whichever this run actually used, the sheets must end up
      // fully invisible here, not frozen mid-tween.
      gsap.set(sheets, { clipPath: EXITED, opacity: 0 })
      gsap.set(wrap, { opacity: 0 })
      callComplete()
    }
    const handleResize = () => fastForward()
    const handleVisibility = () => {
      if (document.hidden) fastForward()
    }
    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibility)

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    // `abandoned` is set by fastForward(), called from event listeners while
    // this function is suspended at an `await` — real mutation TS's
    // control-flow analysis can't see, so it reports every `if (abandoned)`
    // check below as unreachable even though it's the actual abort guard.
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    async function run() {
      if (reducedMotion) {
        // prefers-reduced-motion: no diagonal sweep, just a short fade —
        // the defeat-complete wording stays, only the big movement goes.
        gsap.set(sheets, { clipPath: FILLED, opacity: 1 })
        gsap.set(wrap, { opacity: 0 })
        await tweenTo(wrap, { opacity: 1, duration: REDUCED_FADE_MS / 1000 })
        if (abandoned) return
        callCovered()
        await wait(SWAP_SETTLE_MS)
        if (abandoned) return
        await tweenTo(wrap, { opacity: 0, duration: REDUCED_FADE_MS / 1000 })
        if (abandoned) return
        callComplete()
        return
      }

      // Step 2 (cont'd): cover-in, back sheet leading, front sheet trailing.
      gsap.set(sheets, { clipPath: CLOSED })
      await Promise.all(
        sheets.map((sheet, i) =>
          tweenTo(sheet, {
            clipPath: FILLED,
            duration: COVER_MS / 1000,
            delay: (i * STAGGER_MS) / 1000,
            ease: EASE,
          }),
        ),
      )
      if (abandoned) return

      // Step 3: fully covered — confirmed by the cover animation's own
      // completion, not guessed from a timer.
      callCovered()

      await wait(SWAP_SETTLE_MS)
      if (abandoned) return

      // Step 5/6: uncover, front sheet leading this time (reversed stagger
      // order from the cover-in above). gsap.set to FULL_EXIT first — same
      // "fully covering" look as FILLED, just re-parameterized so the tween
      // to EXITED continues the same diagonal motion instead of reversing it.
      gsap.set(sheets, { clipPath: FULL_EXIT })
      await Promise.all(
        sheets.map((sheet, i) =>
          tweenTo(sheet, {
            clipPath: EXITED,
            duration: UNCOVER_MS / 1000,
            delay: ((sheets.length - 1 - i) * STAGGER_MS) / 1000,
            ease: EASE,
          }),
        ),
      )
      if (abandoned) return
      callComplete()
    }
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    void run()

    return () => {
      abandoned = true
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)
      gsap.killTweensOf([...sheets, wrap])
      restoreScroll()
    }
    // Runs exactly once per mount — this component is only ever mounted
    // for the duration of a single transition (see HomePage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.sheets} ref={wrapRef} aria-hidden="true">
      <div
        className={styles.sheet}
        ref={(el) => {
          sheetRefs.current[0] = el
        }}
      />
      <div
        className={styles.sheet}
        ref={(el) => {
          sheetRefs.current[1] = el
        }}
      />
      <div
        className={styles.sheet}
        ref={(el) => {
          sheetRefs.current[2] = el
        }}
      />
    </div>
  )
}
