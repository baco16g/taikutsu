import type { RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ResolvedSlideTransform } from '../lib/carouselLayout'

/**
 * カルーセルのリングのための純粋なDOM振り付け。位置は(selectedIndex,
 * isMobile)からcarouselLayout.tsが純粋に計算する——このhookは渡された
 * ターゲットへ各カード要素をtweenするだけで、コマンドメニューの
 * カーソルbandと同じ「GSAPにターゲットを渡し、中断処理は任せる」形
 * （contextSafe + overwrite: 'auto'により、連続したnext/prevの呼び出しが
 * 互いに競合することはない）。
 */
export function useGalleryCarouselAnimation(scopeRef: RefObject<HTMLElement | null>) {
  const { contextSafe } = useGSAP({ scope: scopeRef })

  const initCards = contextSafe((cardEls: HTMLElement[]) => {
    // x/z/rotateY/scaleのピクセル値は後でアニメーションされる。-50%の
    // 中央寄せオフセットは不変なので一度だけ設定し、以降の全てのx
    // tweenとGSAPが自動的に合成する（CSSPluginではxPercentとxは
    // 独立したtransform成分）。
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
        // cardElsとtransformsの長さがずれているケースのガード。
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!el || !t) return
        // 重なり順は移動が始まる前に即座に変える。前面へ向かうカードが
        // 近づいてくる時点で既に最前面になっているように。
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
   * 一度きりの登場演出: カードは中央で小さく/平らに/透明な状態から
   * 始まり、短いstaggerでリング上の位置へ収まり、その後中央のカードに
   * 短い強調パルスが入る。`onSettled`は一度だけ（reduced motion下では
   * 即座・同期的に）発火するので、呼び出し側は操作ロックを解除し、
   * 続けて情報パネルのrevealへ進められる。
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
          // cardElsとtransformsの長さがずれているケースのガード。
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
        // cardElsとtransformsの長さがずれているケースのガード。
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
