import { useEffect, useRef, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import styles from '../components/CommandMenu.module.css'

type BandMove = 'instant' | 'reveal' | 'glide'

export interface AttackFlightCallbacks {
  /** 飛んだアイコンがタ・イクツに届いた瞬間。 */
  onImpact: () => void
  /** 着弾処理まで終わり、次の6つへ進んでよい時点。 */
  onLanded: () => void
}

/**
 * `ancestorEl`から見た`itemEl`のオフセットを、`offsetParent`チェーンを
 * たどって`offsetTop`を積算することで求める。`getBoundingClientRect()`は
 * メニューの-6度の回転を含んだ見た目上の箱を返すため、同じく回転して
 * いるbandのローカルな`y`/`height`へは使えない。offsetTop/offsetHeightは
 * transform適用前のレイアウト空間の値なので、そのまま使える。
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

/**
 * コマンドメニューのDOM振り付け: 行間をグライドする選択band、新しい6つの
 * reveal、攻撃アイコンの飛翔と着弾のバースト、bandのアイドル明滅。
 *
 * 振り付けが直接操作するDOM要素のrefはこのhookが所有し、CommandMenuは
 * それをJSXに結び付けるだけ。操作側（useCommandMenuInteraction）は行番号で
 * 指示し、DOM要素には触れない。
 */
export function useCommandMenuAnimation({ idlePulseActive }: { idlePulseActive: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listWrapRef = useRef<HTMLDivElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  // アイドル明滅はband自身ではなくこの子要素で動かす。band自身のtransformは
  // glide/reveal/squeezeがoverwrite:'auto'で動かすため、同じ要素で明滅させると
  // 操作のたびにループが止まってしまう。子要素はbandの位置/サイズを
  // そのまま継承するので、独立しているのは明滅のアニメーションだけ。
  const bandPulseRef = useRef<HTMLDivElement>(null)
  const fxLayerRef = useRef<HTMLDivElement>(null)
  const itemElsRef = useRef<(HTMLButtonElement | null)[]>([])
  // 飛ばすのは行全体ではなく技アイコン（行全体だと「コマンドがメニューから
  // 出ていく」ように読めてしまう）。
  const iconElsRef = useRef<(SVGSVGElement | null)[]>([])
  const flightSeqRef = useRef(0)
  const revealInFlightRef = useRef(false)

  const { contextSafe } = useGSAP({ scope: rootRef })

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

  // contextSafe()は毎レンダー新しい関数を返すため、このeffectは
  // レンダーのたびに再実行され、明滅もそのたびに最初からやり直しになる
  // （リファクタ前からの挙動。docs/architecture.mdの既知の課題を参照）。
  useEffect(() => {
    const pulseEl = bandPulseRef.current
    if (!idlePulseActive) {
      stopIdlePulse(pulseEl)
      return
    }
    startIdlePulse(pulseEl)
    return () => {
      stopIdlePulse(pulseEl)
    }
  }, [idlePulseActive, startIdlePulse, stopIdlePulse])

  const moveBand = contextSafe(
    (itemEl: HTMLElement | null, reducedMotion: boolean, mode: BandMove) => {
      const bandEl = bandRef.current
      const listEl = listWrapRef.current
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

  /** 新しい6つを順に表示し、bandを先頭行に置く。 */
  const revealList = contextSafe((reducedMotion: boolean) => {
    const itemEls = itemElsRef.current.filter((el): el is HTMLButtonElement => el !== null)
    if (itemEls.length > 0) {
      if (reducedMotion) {
        gsap.set(itemEls, { opacity: 1, clipPath: 'inset(0 0 0 0)', x: 0 })
      } else {
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
      }
    }
    moveBand(itemEls[0] ?? null, reducedMotion, 'reveal')
    // revealのバウンスイン（約0.46秒）の途中で、リサイズ同期のgsap.set()が
    // それを上書きしないよう、この間はobserveListResizeの通知を止める。
    if (!reducedMotion) {
      revealInFlightRef.current = true
      window.setTimeout(() => {
        revealInFlightRef.current = false
      }, 500)
    }
  })

  const glideBandTo = (index: number, reducedMotion: boolean) =>
    moveBand(itemElsRef.current[index], reducedMotion, 'glide')

  const snapBandTo = (index: number) => moveBand(itemElsRef.current[index], true, 'instant')

  const focusItem = (index: number) => itemElsRef.current[index]?.focus()

  /**
   * 一覧の高さが変わったときに`onResize`を呼ぶ。bandの位置は計測した瞬間の
   * 行の高さで決まるため、ウィンドウのリサイズで説明文の折り返しが
   * 変わると、そのままではずれてしまう。戻り値で購読を解除する。
   */
  const observeListResize = (onResize: () => void): (() => void) | undefined => {
    const listWrap = listWrapRef.current
    if (!listWrap) return undefined
    // ResizeObserverはobserve()直後に現在のサイズで必ず1回発火する。
    // その時点ではrevealがbandを正しく置いた直後なので、最初の1回は無視する。
    let isFirstCallback = true
    const ro = new ResizeObserver(() => {
      if (isFirstCallback) {
        isFirstCallback = false
        return
      }
      if (revealInFlightRef.current) return
      onResize()
    })
    ro.observe(listWrap)
    return () => ro.disconnect()
  }

  // 確定時のbandのバウンス。縮めるのではなく、0.98へ一瞬沈んでから
  // 1.05へ跳ね返す。行の文字（淡色）はbandの上に乗っており、bandが
  // 文字の上下端から離れると明るい背景に直接のって読めなくなるため、
  // 沈み込みは知覚できない程度に留め、opacityも1のまま保つ。
  const squeezeBand = contextSafe((reducedMotion: boolean) => {
    const bandEl = bandRef.current
    if (!bandEl) return
    if (reducedMotion) return
    gsap
      .timeline({ defaults: { overwrite: 'auto', transformOrigin: '50% 50%' } })
      .to(bandEl, { scale: 0.98, duration: 0.05, ease: 'power1.out' })
      .to(bandEl, { scale: 1.05, duration: 0.12, ease: 'power2.out' })
      .to(bandEl, { scale: 1, duration: 0.12, ease: 'power2.out' })
  })

  /**
   * `fromEl`の複製を`targetEl`の中心へ飛ばし、尾を引く線と着弾時の
   * 破片を添える。飛翔自体が着地した時点でonImpact→onLandedを呼ぶ
   * （後片付けのバーストの終了は待たない）。
   */
  const playAttackFlight = contextSafe(
    (
      fromEl: SVGSVGElement,
      fxLayer: HTMLElement,
      targetEl: HTMLElement | null,
      reducedMotion: boolean,
      { onImpact, onLanded }: AttackFlightCallbacks,
    ) => {
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
      // アイコンは行の状態によって白（選択中の黒いband上）になるため、
      // 明るい背景を横切って飛ぶ間も見えるよう濃い色に固定する。
      projectile.style.color = 'var(--color-ink)'
      fxLayer.appendChild(projectile)
      // 行内の15pxのままでは飛んでいる間に見えないため、出現時に拡大し、
      // 着弾に向けて縮めていく。
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

  /**
   * `index`行の攻撃演出: bandのバウンスの後、その行の技アイコンを
   * `targetRef`の要素へ飛ばす。アイコンかfxレイヤーが見つからない場合は
   * 飛翔も着弾も起こさず、onLandedだけを即座に呼ぶ。
   */
  const playAttack = contextSafe(
    (
      index: number,
      targetRef: RefObject<HTMLElement | null>,
      reducedMotion: boolean,
      callbacks: AttackFlightCallbacks,
    ) => {
      squeezeBand(reducedMotion)

      const fromEl = iconElsRef.current[index]
      const fxLayer = fxLayerRef.current
      if (!fromEl || !fxLayer) {
        callbacks.onLanded()
        return
      }

      // バウンスと飛翔を同時に始めると1つの動きに融合して見え、「確定して
      // から技が発動する」と読めなくなるため、少し間を置く。reduced motion
      // では飛翔が即座に完了するので、待たせる意味がない。
      const launchFlight = () =>
        playAttackFlight(fromEl, fxLayer, targetRef.current, reducedMotion, callbacks)
      if (reducedMotion) {
        launchFlight()
      } else {
        window.setTimeout(launchFlight, 90)
      }
    },
  )

  return {
    rootRef,
    listWrapRef,
    bandRef,
    bandPulseRef,
    fxLayerRef,
    itemElsRef,
    iconElsRef,
    revealList,
    glideBandTo,
    snapBandTo,
    focusItem,
    observeListResize,
    playAttack,
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
