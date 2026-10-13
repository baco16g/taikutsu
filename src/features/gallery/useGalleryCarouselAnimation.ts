import type { RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ResolvedSlideTransform } from './carouselLayout'

/**
 * Pure DOM choreography for the carousel ring. Position is computed purely
 * from (selectedIndex, isMobile) by carouselLayout.ts — this hook only
 * tweens each card element toward whatever target it's handed, the same
 * "feed GSAP a target, let it handle interruption" shape as the command
 * menu's cursor band (contextSafe + overwrite: 'auto' means rapid
 * next/prev calls never fight each other).
 */
export function useGalleryCarouselAnimation(scopeRef: RefObject<HTMLElement | null>) {
  const { contextSafe } = useGSAP({ scope: scopeRef })

  const initCards = contextSafe((cardEls: HTMLElement[]) => {
    // Pixel x/z/rotateY/scale are animated later; the -50% centering offset
    // is constant, so it's set once and GSAP composes it with every
    // subsequent x tween automatically (xPercent and x are independent
    // transform components in CSSPlugin).
    gsap.set(cardEls, { xPercent: -50, yPercent: -50 })
  })

  const applyTransforms = contextSafe(
    (
      cardEls: ReadonlyArray<HTMLElement | null>,
      transforms: ReadonlyArray<ResolvedSlideTransform>,
      reducedMotion: boolean,
      instant: boolean,
    ) => {
      cardEls.forEach((el, i) => {
        const t = transforms[i]
        // Guards cardEls/transforms being out of sync in length.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!el || !t) return
        // Stacking order changes instantly, before the move starts, so the
        // card headed to the front is already on top as it approaches.
        gsap.set(el, { zIndex: t.zIndex })
        const vars = { x: t.x, z: t.z, rotateY: t.rotateY, scale: t.scale, opacity: t.opacity }
        if (reducedMotion || instant) {
          gsap.set(el, vars)
        } else {
          gsap.to(el, { ...vars, duration: 0.55, ease: 'power3.out', overwrite: 'auto' })
        }
      })
    },
  )

  /**
   * The one-time entrance: cards start small/flat/transparent at
   * the center and settle into their ring positions with a short stagger,
   * then the centered one gets a brief emphasis pulse. `onSettled` fires
   * once (immediately, synchronously, under reduced motion) so the caller
   * can unlock interaction and let the info panel reveal follow.
   */
  const playReveal = contextSafe(
    (
      cardEls: ReadonlyArray<HTMLElement | null>,
      transforms: ReadonlyArray<ResolvedSlideTransform>,
      reducedMotion: boolean,
      onSettled: () => void,
    ) => {
      const presentEls = cardEls.filter((el): el is HTMLElement => el !== null)
      gsap.killTweensOf(presentEls)

      if (reducedMotion) {
        cardEls.forEach((el, i) => {
          const t = transforms[i]
          // Guards cardEls/transforms being out of sync in length.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!el || !t) return
          gsap.set(el, {
            x: t.x,
            z: t.z,
            rotateY: t.rotateY,
            scale: t.scale,
            opacity: t.opacity,
            zIndex: t.zIndex,
          })
        })
        onSettled()
        return
      }

      gsap.set(presentEls, { x: 0, z: -620, rotateY: 0, scale: 0.3, opacity: 0 })

      const tl = gsap.timeline({ onComplete: onSettled })
      let centerIndex = -1
      cardEls.forEach((el, i) => {
        const t = transforms[i]
        // Guards cardEls/transforms being out of sync in length.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!el || !t) return
        if (t.x === 0 && t.z === 0) centerIndex = i
        gsap.set(el, { zIndex: t.zIndex })
        tl.to(
          el,
          {
            x: t.x,
            z: t.z,
            rotateY: t.rotateY,
            scale: t.scale,
            opacity: t.opacity,
            duration: 0.75,
            ease: 'power3.out',
          },
          i * 0.07,
        )
      })

      const centerEl = centerIndex >= 0 ? cardEls[centerIndex] : null
      if (centerEl) {
        const finalScale = transforms[centerIndex].scale
        tl.to(centerEl, { scale: finalScale * 1.06, duration: 0.16, ease: 'power2.out' }, '+=0.05')
        tl.to(centerEl, { scale: finalScale, duration: 0.22, ease: 'power2.inOut' })
      }
    },
  )

  return { initCards, applyTransforms, playReveal }
}
