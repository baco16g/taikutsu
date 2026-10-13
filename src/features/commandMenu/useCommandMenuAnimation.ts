import { useRef, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import styles from './CommandMenu.module.css'

/**
 * Pure DOM choreography for the command menu: the selection band that
 * glides between rows (interruption-safe — GSAP handles the overwrite
 * automatically since every band tween targets the same
 * element/properties), the reveal when a fresh six appears, and the
 * attack flight + impact burst.
 *
 * Takes DOM elements rather than React refs-of-refs so it stays decoupled
 * from CommandMenu's render state; CommandMenu just calls these from its
 * event handlers and effects.
 */
/**
 * `itemEl`'s offset from `ancestorEl`, walking the `offsetParent` chain and
 * summing `offsetTop` along the way. Unlike `getBoundingClientRect()`, this
 * is immune to the menu's -6deg rotation: a rotated element's bounding
 * rect is its axis-aligned *visual* box (wider than tall becomes
 * taller-looking once rotated), which is the wrong number to feed back in
 * as another element's local `height`/`y`. offsetTop/offsetHeight are
 * defined purely in pre-transform layout space, which is what the band
 * (itself rotated by the same shared wrapper) actually needs.
 */
function offsetTopWithin(itemEl: HTMLElement, ancestorEl: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = itemEl
  while (node && node !== ancestorEl) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

export function useCommandMenuAnimation(scopeRef: RefObject<HTMLElement | null>) {
  const flightSeqRef = useRef(0)

  const { contextSafe } = useGSAP({ scope: scopeRef })

  // The idle breathing loop lives entirely on its own element
  // (CommandMenu.tsx's bandPulseRef, a child of the band) rather than on
  // bandEl itself. It used to share bandEl's own `scale` with
  // glide/reveal/squeeze, and every one of those called overwrite:'auto'
  // on the same property — so hovering a different row, or confirming an
  // attack, killed the loop mid-cycle every time (reported: "次の操作で
  // 上書きされて欲しくない"). A separate GSAP target for a separate DOM
  // node can't be overwritten by a tween that never touches it: this
  // keeps breathing continuously through glides/reveals/squeezes, which
  // only ever move/resize/pop the *band*, not the pulse layer riding
  // along inside it. (The pulse still visually inherits bandEl's own
  // position/size/transform for free, since it's laid out and painted as
  // bandEl's content — only its *own* animation is independent.)
  const startIdlePulse = contextSafe((pulseEl: HTMLElement | null) => {
    if (!pulseEl) return
    gsap.to(pulseEl, {
      scale: 1.03,
      opacity: 0.35,
      duration: 1.1,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      transformOrigin: '50% 50%',
    })
  })

  const stopIdlePulse = contextSafe((pulseEl: HTMLElement | null) => {
    if (!pulseEl) return
    gsap.killTweensOf(pulseEl)
    gsap.set(pulseEl, { scale: 1, opacity: 0 })
  })

  const moveCursorBand = contextSafe(
    (
      bandEl: HTMLElement | null,
      itemEl: HTMLElement | null,
      listEl: HTMLElement | null,
      reducedMotion: boolean,
      mode: 'instant' | 'reveal' | 'glide',
    ) => {
      if (!bandEl || !itemEl || !listEl) return
      const top = offsetTopWithin(itemEl, listEl)
      const height = itemEl.offsetHeight

      if (reducedMotion || mode === 'instant') {
        gsap.set(bandEl, { y: top, height, opacity: 1, scaleY: 1 })
        return
      }

      if (mode === 'reveal') {
        gsap.fromTo(
          bandEl,
          { y: top, height, opacity: 0, scaleY: 0.35, transformOrigin: '0% 0%' },
          { opacity: 1, scaleY: 1, duration: 0.46, ease: 'back.out(2.4)' },
        )
        return
      }

      gsap.to(bandEl, {
        y: top,
        height,
        opacity: 1,
        scaleY: 1,
        duration: 0.38,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    },
  )

  const revealItems = contextSafe((itemEls: HTMLElement[], reducedMotion: boolean) => {
    if (itemEls.length === 0) return
    if (reducedMotion) {
      gsap.set(itemEls, { opacity: 1, clipPath: 'inset(0 0 0 0)', x: 0 })
      return
    }
    gsap.fromTo(
      itemEls,
      { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -8 },
      {
        opacity: 1,
        clipPath: 'inset(0 0% 0 0)',
        x: 0,
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.045,
      },
    )
  })

  // A confirm-tap bounce, not a shrink: the row's name/description sit on
  // top of this element as a separate layer and only read as legible
  // (pale text) because the band is behind them at full size — a
  // shrink-to-55%-height squeeze pulled the band away from the text's own
  // top/bottom edges, exposing pale text directly against the page's
  // light background for the ~90ms of the tween. Opacity stays at 1 for
  // the same reason — a dip there reduces the same contrast the scale fix
  // is protecting.
  //
  // A small 0.98 anticipation dip before the pop (duration 0.05s) gives it
  // a "press down, then spring up" feel — a brief compress-before-release
  // instead of a pure expand. Nowhere near the old 0.55 squeeze: at 0.98
  // for 50ms the exposed sliver is sub-pixel and imperceptible, which is
  // the deliberate trade-off between "reads as a press" and "never
  // compromises the text's legibility."
  const squeezeBand = contextSafe((bandEl: HTMLElement | null, reducedMotion: boolean) => {
    if (!bandEl) return
    if (reducedMotion) return
    gsap
      .timeline({ defaults: { overwrite: 'auto', transformOrigin: '50% 50%' } })
      .to(bandEl, { scale: 0.98, duration: 0.05, ease: 'power1.out' })
      .to(bandEl, { scale: 1.05, duration: 0.12, ease: 'power2.out' })
      .to(bandEl, { scale: 1, duration: 0.12, ease: 'power2.out' })
  })

  /**
   * Flies a clone of `fromEl` toward `targetEl`'s center, with a trailing
   * line as the "attack trajectory", then bursts a few shards at impact.
   * Resolves once the flight (not the burst clean-up) has landed, so the
   * caller can fire onImpact / onAttackComplete at the right moments.
   */
  const playAttackFlight = contextSafe(
    (opts: {
      // The move's own icon (CommandMenu.tsx's iconElsRef), not the whole
      // row — flying the full row read as "the command itself leaves the
      // menu," when the point is just launching the move at タ・イクツ.
      // Falls back to a row element (HTMLElement) when icons are off.
      fromEl: HTMLElement | SVGSVGElement
      targetEl: HTMLElement | null
      fxLayer: HTMLElement
      reducedMotion: boolean
      onImpact: () => void
      onLanded: () => void
    }) => {
      const { fromEl, targetEl, fxLayer, reducedMotion, onImpact, onLanded } = opts
      const seq = (flightSeqRef.current += 1)

      const fromRect = fromEl.getBoundingClientRect()
      const targetRect = targetEl?.getBoundingClientRect() ?? {
        left: window.innerWidth / 2 - 20,
        top: window.innerHeight / 2 - 20,
        width: 40,
        height: 40,
      }
      const fromCx = fromRect.left + fromRect.width / 2
      const fromCy = fromRect.top + fromRect.height / 2
      const toCx = targetRect.left + targetRect.width / 2
      const toCy = targetRect.top + targetRect.height / 2
      const dx = toCx - fromCx
      const dy = toCy - fromCy
      const distance = Math.hypot(dx, dy)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI

      const cleanup = (nodes: HTMLElement[]) => {
        if (flightSeqRef.current !== seq) return
        nodes.forEach((n) => n.remove())
      }

      if (reducedMotion) {
        onImpact()
        onLanded()
        return
      }

      const projectile = fromEl.cloneNode(true) as HTMLElement
      projectile.classList.add(styles.fxProjectile)
      projectile.style.position = 'fixed'
      projectile.style.left = `${fromRect.left}px`
      projectile.style.top = `${fromRect.top}px`
      projectile.style.width = `${fromRect.width}px`
      projectile.style.height = `${fromRect.height}px`
      projectile.style.margin = '0'
      // The icon inherits currentColor from wherever it's sitting on the
      // row — white while the row is selected (on the black band). Pinned
      // to a fixed dark color here so it stays visible flying across the
      // page's own light background, independent of the row's state.
      projectile.style.color = 'var(--color-ink)'
      fxLayer.appendChild(projectile)
      // A 15px icon is too small to read mid-flight across the page —
      // scaled up on spawn (shrinking back down toward the target below)
      // rather than kept at its natural row size.
      gsap.set(projectile, { scale: 2.2, transformOrigin: '50% 50%' })

      const trail = document.createElement('div')
      trail.className = styles.fxTrail
      trail.style.left = `${fromCx}px`
      trail.style.top = `${fromCy}px`
      trail.style.width = `${distance}px`
      trail.style.transform = `rotate(${angle}deg) scaleX(0)`
      fxLayer.appendChild(trail)

      const tl = gsap.timeline({
        onComplete: () => {
          cleanup([trail])
          window.setTimeout(() => cleanup([projectile]), 520)
        },
      })

      tl.to(trail, { scaleX: 1, duration: 0.3, ease: 'power2.out' }, 0)
      tl.to(
        projectile,
        {
          x: dx,
          y: dy,
          scale: 1.3,
          rotate: 360,
          duration: 0.4,
          ease: 'power2.in',
          onComplete: () => {
            onImpact()
            const burstX = fromRect.left + fromRect.width / 2 + dx
            const burstY = fromRect.top + fromRect.height / 2 + dy
            spawnImpactBurst(fxLayer, burstX, burstY, cleanup)
            projectile.style.opacity = '0'
            onLanded()
          },
        },
        0,
      )
    },
  )

  return {
    moveCursorBand,
    revealItems,
    squeezeBand,
    playAttackFlight,
    startIdlePulse,
    stopIdlePulse,
  }
}

function spawnImpactBurst(
  fxLayer: HTMLElement,
  x: number,
  y: number,
  cleanup: (nodes: HTMLElement[]) => void,
) {
  const shards: HTMLElement[] = []
  const count = 7
  for (let i = 0; i < count; i += 1) {
    const shard = document.createElement('div')
    shard.className = styles.fxShard
    shard.style.left = `${x}px`
    shard.style.top = `${y}px`
    fxLayer.appendChild(shard)
    shards.push(shard)
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6
    const dist = 26 + Math.random() * 30
    gsap.fromTo(
      shard,
      { x: 0, y: 0, scale: 1, opacity: 1, rotate: Math.random() * 90 },
      {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => cleanup([shard]),
      },
    )
  }
  const ring = document.createElement('div')
  ring.className = styles.fxRing
  ring.style.left = `${x}px`
  ring.style.top = `${y}px`
  fxLayer.appendChild(ring)
  gsap.fromTo(
    ring,
    { scale: 0.2, opacity: 0.9 },
    {
      scale: 1.8,
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => cleanup([ring]),
    },
  )
}
