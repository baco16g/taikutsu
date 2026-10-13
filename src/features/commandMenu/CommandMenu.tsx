import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import { ArrowUpRightIcon } from '@phosphor-icons/react'
import { useCommandMenuController } from './useCommandMenuController'
import { useCommandMenuAnimation } from './useCommandMenuAnimation'
import { useCommandSound } from './useCommandSound'
import { useSupportsHover } from '../../hooks/useSupportsHover'
import type { CommandMenuEvents, CommandMoveEvent, MoveEntry } from './types'
import styles from './CommandMenu.module.css'

export interface CommandMenuProps {
  /** Element the attack flies toward — the タ・イクツ placeholder (or later, the real creature). */
  targetRef: RefObject<HTMLElement | null>
  soundEnabled: boolean
  reducedMotion: boolean
  events?: CommandMenuEvents
}

function toEvent(move: MoveEntry, slotIndex: number, attackNumber: number): CommandMoveEvent {
  return { moveId: move.id, moveName: move.name, slotIndex, attackNumber }
}

export function CommandMenu({ targetRef, soundEnabled, reducedMotion, events }: CommandMenuProps) {
  const { status, currentMoves, attackCount, reroll, commitAttack } = useCommandMenuController()
  const sound = useCommandSound(soundEnabled)

  const rootRef = useRef<HTMLDivElement>(null)
  const listWrapRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  // A child of .band dedicated to the idle breathing pulse — see
  // useCommandMenuAnimation's startIdlePulse/stopIdlePulse for why this
  // has to be a separate element and not another tween on bandRef itself
  // (glide/reveal/squeeze all animate bandRef's own transform via
  // overwrite:'auto', which would silently kill the loop every time any
  // of them ran).
  const bandPulseRef = useRef<HTMLDivElement>(null)
  const fxLayerRef = useRef<HTMLDivElement>(null)
  const itemElsRef = useRef<(HTMLButtonElement | null)[]>([])
  // What actually flies at confirm is the move's own icon, not the whole
  // row — tracked separately from itemElsRef so playAttackFlight can
  // clone just the icon's small SVG instead of the full row.
  const iconElsRef = useRef<(SVGSVGElement | null)[]>([])

  const anim = useCommandMenuAnimation(rootRef)
  const supportsHover = useSupportsHover()

  const [cursorIndex, setCursorIndex] = useState(0)
  const [isAttacking, setIsAttacking] = useState(false)
  const isAttackingRef = useRef(false)
  const attackContextRef = useRef<CommandMoveEvent | null>(null)
  const lastPointerMoveAtRef = useRef(0)
  const cursorIndexRef = useRef(cursorIndex)
  cursorIndexRef.current = cursorIndex
  const revealInFlightRef = useRef(false)
  // Touch-only (no hover): a tap both focuses and clicks a button at once,
  // so a single tap used to preview *and* immediately confirm — the band
  // was only ever visible for the instant before squeezeBand overwrote it.
  // Gating the attack on "was this row already armed" turns one tap into
  // "select" and a second tap on that same row into "confirm", so the
  // preview the band represents is an actual, visible step again instead
  // of a formality. Kept separate from cursorIndex (which previewIndex
  // still drives) so arming tracks "did the user deliberately activate
  // this row twice," not just "which row is currently previewed."
  const armedIndexRef = useRef<number | null>(null)

  // Whenever the visible six changes (mount, reroll, or the round after an
  // attack lands) the cursor returns to the first command and the new list
  // reveals as one group. `status` is also a dependency: the 5th attack
  // flips status to 'complete' without swapping currentMoves (there's no
  // next six to draw), so it's the only signal this effect gets to fire
  // the pending onAttackComplete/onSessionComplete.
  useLayoutEffect(() => {
    if (status === 'active') {
      // Resets the cursor in response to a new six/status, alongside the
      // DOM measurement below it needs anyway — not splittable into a
      // render-time computation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCursorIndex(0)
      armedIndexRef.current = null
      const itemEls = itemElsRef.current.filter((el): el is HTMLButtonElement => el !== null)
      anim.revealItems(itemEls, reducedMotion)
      anim.moveCursorBand(
        bandRef.current,
        itemEls[0] ?? null,
        listWrapRef.current,
        reducedMotion,
        'reveal',
      )
      // Guards the resize-sync effect below from gsap.set()-ing over this
      // reveal tween's bounce-in mid-flight if a ResizeObserver callback
      // (e.g. the list wrapper's own height settling as the new six's
      // rows lay out) lands inside its ~0.46s window. Skipped entirely
      // under reducedMotion since that path is already an instant
      // gsap.set with nothing to collide with.
      if (!reducedMotion) {
        revealInFlightRef.current = true
        window.setTimeout(() => {
          revealInFlightRef.current = false
        }, 500)
      }
    }

    if (attackContextRef.current) {
      const ctx = attackContextRef.current
      attackContextRef.current = null
      events?.onAttackComplete?.(ctx)
      if (status === 'complete') events?.onSessionComplete?.()
    }
    isAttackingRef.current = false
    setIsAttacking(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMoves, status])

  // The band's y/height are set from itemEl.offsetHeight at the moment
  // previewIndex/the reveal above runs — correct for a reroll or a cursor
  // move, since those happen after the DOM already reflects the new
  // content. But nothing re-measures on a pure browser resize/orientation
  // change: with descriptions wrapping instead of truncating, a row's
  // height can change at a width where neither currentMoves nor status
  // changes, leaving the band's last measured height stale against the
  // row's actual new height. A ResizeObserver on the list wrapper
  // re-syncs it (snapping, not re-gliding) whenever that happens,
  // independent of the GSAP tweens themselves, which stay untouched.
  useEffect(() => {
    const listWrap = listWrapRef.current
    if (!listWrap || status !== 'active') return
    // ResizeObserver fires once immediately on observe() with the current
    // size — skip that first call, since the reveal tween above has
    // already placed the band correctly; acting on it would gsap.set()
    // over the reveal's in-flight animation and cancel its bounce-in.
    let isFirstCallback = true
    const ro = new ResizeObserver(() => {
      if (isFirstCallback) {
        isFirstCallback = false
        return
      }
      if (isAttackingRef.current || revealInFlightRef.current) return
      anim.moveCursorBand(
        bandRef.current,
        itemElsRef.current[cursorIndexRef.current],
        listWrapRef.current,
        true,
        'instant',
      )
    })
    ro.observe(listWrap)
    return () => ro.disconnect()
  }, [status, anim])

  // Starts once and runs for the component's lifetime (or until
  // reducedMotion flips on) — not re-triggered per row/reveal/glide, since
  // it's independent of all of that by construction (see bandPulseRef).
  useEffect(() => {
    const pulseEl = bandPulseRef.current
    if (status !== 'active' || reducedMotion) {
      anim.stopIdlePulse(pulseEl)
      return
    }
    anim.startIdlePulse(pulseEl)
    return () => {
      anim.stopIdlePulse(pulseEl)
    }
  }, [status, reducedMotion, anim])

  const previewIndex = useCallback(
    (i: number, viaPointer = false) => {
      if (status !== 'active' || isAttackingRef.current || i === cursorIndex) return
      // A fresh six mounts new buttons in the same screen positions as the
      // old ones; if the real mouse hasn't moved since, the browser still
      // fires mouseenter on whatever now sits under it. Ignore that phantom
      // hover so a just-revealed list keeps its cursor on the first command
      // instead of jumping to wherever the pointer happened to be resting.
      if (viaPointer && performance.now() - lastPointerMoveAtRef.current > 120) return
      // Moving the preview to a different row than the one currently
      // armed (touch path) disarms it — arming means "the user tapped
      // this exact row twice in a row," not "this row was ever armed."
      if (armedIndexRef.current !== i) armedIndexRef.current = null
      const move = currentMoves[i]
      setCursorIndex(i)
      anim.moveCursorBand(
        bandRef.current,
        itemElsRef.current[i],
        listWrapRef.current,
        reducedMotion,
        'glide',
      )
      sound.playMove()
      // Guards `i` being out of range for currentMoves (TS's array typing
      // doesn't require this, but the index isn't statically guaranteed).
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      events?.onPreviewMove?.(move ? toEvent(move, i, attackCount + 1) : null)
    },
    [status, cursorIndex, currentMoves, anim, reducedMotion, sound, events, attackCount],
  )

  const confirmAttack = useCallback(
    (i: number) => {
      if (status !== 'active' || isAttackingRef.current) return
      const move = currentMoves[i]
      // Guards `i` being out of range for currentMoves (see previewIndex above).
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!move) return

      isAttackingRef.current = true
      setIsAttacking(true)
      setCursorIndex(i)

      const payload = toEvent(move, i, attackCount + 1)
      sound.playAttack(move.id)
      events?.onAttackStart?.(payload)
      // The band's own tap-confirm feedback — unrelated to whatever flies
      // below, not a wind-up for it.
      anim.squeezeBand(bandRef.current, reducedMotion)

      // What flies is the move's icon, not the whole row.
      const fromEl = iconElsRef.current[i]
      const fxLayer = fxLayerRef.current
      if (!fromEl || !fxLayer) {
        attackContextRef.current = payload
        commitAttack(move.id)
        return
      }

      const launchFlight = () => {
        anim.playAttackFlight({
          fromEl,
          targetEl: targetRef.current,
          fxLayer,
          reducedMotion,
          onImpact: () => {
            sound.playHit(payload.attackNumber)
            events?.onImpact?.(payload)
          },
          onLanded: () => {
            attackContextRef.current = payload
            commitAttack(move.id)
          },
        })
      }

      // A short beat after the squeeze, not the same instant — squeeze and
      // flight are two separate micro-interactions, and starting them
      // together read as one fused motion rather than "confirm, then the
      // move launches." Skipped under reducedMotion: playAttackFlight
      // already resolves synchronously there, so a delay would only stall
      // the HP/reveal update with nothing to show for it.
      if (reducedMotion) {
        launchFlight()
      } else {
        window.setTimeout(launchFlight, 90)
      }
    },
    [
      status,
      currentMoves,
      attackCount,
      sound,
      events,
      anim,
      reducedMotion,
      targetRef,
      commitAttack,
    ],
  )

  // The click/tap gate: on a device with real hover, a click always
  // confirms immediately (hover already served as the preview step). On
  // touch, the first activation of a row that isn't already armed just
  // arms it (previewIndex, called from onFocus just before this fires on
  // the same tap, has already moved the band there) — only a second
  // activation of that same row confirms.
  const handleRowActivate = useCallback(
    (i: number) => {
      if (status !== 'active' || isAttackingRef.current) return
      if (!supportsHover && armedIndexRef.current !== i) {
        armedIndexRef.current = i
        return
      }
      armedIndexRef.current = null
      confirmAttack(i)
    },
    [status, supportsHover, confirmAttack],
  )

  const handleListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLUListElement>) => {
      if (status !== 'active' || isAttackingRef.current) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = (cursorIndex + delta + currentMoves.length) % currentMoves.length
      // Moving DOM focus is enough — the target's onFocus handler calls
      // previewIndex itself. Calling previewIndex here too would double-fire
      // it: React hasn't committed the new cursorIndex yet when focus()
      // synchronously triggers onFocus, so its own i === cursorIndex guard
      // wouldn't see this call as a no-op.
      itemElsRef.current[next]?.focus()
    },
    [status, cursorIndex, currentMoves.length],
  )

  return (
    <div className={clsx(styles.root, isAttacking && styles.isAttacking)} ref={rootRef}>
      {/* No attack-count display here — タ・イクツ's own HP gauge
          (BattleStatus) is the single place that shows "how many of 5
          attacks remain" now. */}
      <header className={styles.zoneHeader}>
        <h2 className={styles.zoneTitle}>SKILL</h2>
      </header>

      {/* Rendered through 'complete' too (not unmounted) — the 5th hit
          flips status without emptying currentMoves (see
          useCommandMenuController's commitAttack), so there's always a
          real six to show here. Every handler below already no-ops once
          status !== 'active', so leaving the last six in place is purely
          cosmetic (a frozen final state, not newly-interactive dead
          weight). */}
      <div className={styles.listWrap} ref={listWrapRef}>
        {/* Jagged torn-paper band (clip-path polygon) — bleeds past the
            row's own left/right edges rather than sitting as a clean
            rectangle. A single shared element GSAP glides between rows
            via y/height, not one band per row. */}
        <div className={styles.band} ref={bandRef} aria-hidden="true">
          {/* Idle breathing glow — a separate GSAP target from the band
              itself, see bandPulseRef's comment above. */}
          <div className={styles.bandPulse} ref={bandPulseRef} />
        </div>

        <ul
          className={styles.list}
          aria-label="スキルコマンド"
          onKeyDown={handleListKeyDown}
          onPointerMove={() => {
            lastPointerMoveAtRef.current = performance.now()
          }}
        >
          {currentMoves.map((move, i) => {
            const MoveIcon = move.icon
            const isActive = cursorIndex === i
            return (
              <li key={move.id} className={styles.item}>
                <span className={styles.divider} aria-hidden="true" />
                <button
                  type="button"
                  ref={(el) => {
                    itemElsRef.current[i] = el
                  }}
                  className={clsx(styles.cmd, isActive && styles.isActive)}
                  tabIndex={isActive ? 0 : -1}
                  aria-current={isActive || undefined}
                  disabled={isAttacking || status !== 'active'}
                  onMouseEnter={() => previewIndex(i, true)}
                  onFocus={() => previewIndex(i)}
                  onClick={() => handleRowActivate(i)}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <MoveIcon
                    ref={(el) => {
                      iconElsRef.current[i] = el
                    }}
                    className={styles.icon}
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                  />
                  <span className={styles.text}>
                    <span className={styles.name}>{move.name}</span>
                    <span className={styles.desc}>{move.shortDescription}</span>
                  </span>
                  <ArrowUpRightIcon
                    className={styles.caret}
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.reroll}
          onClick={reroll}
          disabled={isAttacking || status !== 'active'}
        >
          ほかの技を見る
        </button>
      </div>

      <div className={styles.fxLayer} ref={fxLayerRef} aria-hidden="true" />
    </div>
  )
}
