import { useRef, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import styles from '../components/CommandMenu.module.css'

/**
 * コマンドメニューのための純粋なDOM振り付け: 行間をグライドする選択band
 * （中断に強い — 全てのband tweenが同じ要素/プロパティを対象にしているため
 * GSAPが上書きを自動で処理する）、新しい6つが現れた時のreveal、攻撃の
 * 飛翔と着弾のバースト。
 *
 * React refのrefではなくDOM要素を直接受け取る作りにすることで、
 * CommandMenuのrender状態から切り離している。CommandMenuは自身の
 * イベントハンドラやeffectからこれらを呼ぶだけ。
 */
/**
 * `ancestorEl`から見た`itemEl`のオフセットを、`offsetParent`チェーンを
 * たどって`offsetTop`を積算することで求める。`getBoundingClientRect()`と
 * 違い、メニューの-6度の回転の影響を受けない: 回転した要素のbounding
 * rectは軸に沿った「見た目上の」ボックス（回転すると横長が縦長寄りに
 * 見える）であり、それを別要素のローカルな`height`/`y`へそのまま
 * フィードバックするのは誤り。offsetTop/offsetHeightは純粋に
 * transform適用前のレイアウト空間で定義されており、これがband
 * （同じ共有ラッパーによって同様に回転している）が本当に必要とする値。
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

  // アイドル時の明滅ループは、bandEl自身ではなく専用の別要素
  // （CommandMenu.tsxのbandPulseRef、bandの子要素）だけに存在する。
  // 以前はbandEl自身の`scale`をglide/reveal/squeezeと共有しており、
  // それらは全て同じプロパティに対してoverwrite:'auto'を呼んでいた
  // ため、別の行にホバーしたり攻撃を確定したりするたびにループが
  // サイクルの途中で毎回止まっていた（報告: 「次の操作で上書きされて
  // 欲しくない」）。別のDOMノードに対する別のGSAPターゲットは、
  // それに一切触れないtweenによって上書きされようがない:
  // これにより、band自体の位置/サイズ/popを動かすだけの
  // glide/reveal/squeezeを挟んでも明滅は途切れず続く。（なお明滅層は
  // bandElのcontentとしてレイアウト・描画されるため、その位置/サイズ/
  // transformは何もせずとも自動的に継承される——独立しているのは
  // 明滅「自身」のアニメーションだけ。）
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

  // 確定タップのバウンスであり、縮小ではない: 行の名前/説明はこの要素の
  // 上に別レイヤーとして乗っており、band自体が等倍で背後にあることで
  // 初めて（淡色テキストとして）読める状態になる——高さ55%への縮小
  // squeezeは、bandをテキスト自身の上下端から引き離してしまい、
  // tweenの約90msの間、淡色テキストがページの明るい背景に直接露出して
  // 読めなくなる。opacityを1のまま保っているのも同じ理由——ここで
  // 落とすと、scaleの修正が守っているのと同じコントラストを損なう。
  //
  // ポップの前に小さく0.98まで沈み込む予備動作（duration 0.05秒）を
  // 入れることで、「押し込んでから跳ね上がる」感触を出している——
  // 単純な拡大ではなく圧縮してから解放する動き。以前の0.55の
  // squeezeとは程遠い: 0.98で50msなら露出する隙間はサブピクセルで
  // 知覚できず、「押した感触」と「テキストの可読性を一切損なわない」の
  // 間での意図的なトレードオフ。
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
   * `fromEl`の複製を`targetEl`の中心へ飛ばし、「攻撃の軌跡」として
   * 尾を引く線を伴わせ、着弾時に破片を数個弾けさせる。（後片付けの
   * バーストではなく）飛翔自体が着地した時点でresolveするので、
   * 呼び出し側はonImpact / onAttackCompleteを正しいタイミングで
   * 発火できる。
   */
  const playAttackFlight = contextSafe(
    (opts: {
      // 行全体ではなく技自身のアイコン（CommandMenu.tsxのiconElsRef）—
      // 行全体を飛ばすと「コマンドそのものがメニューから出ていく」ように
      // 読めてしまうが、本来やりたいのは技をタ・イクツへ発射すること。
      fromEl: SVGSVGElement
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
      // アイコンは置かれている場所のcurrentColorを継承する——行が選択中
      // （黒いband上）なら白になる。ページ自身の明るい背景を横切って
      // 飛ぶ間も見えるよう、行の状態に関わらずここで濃い色に固定している。
      projectile.style.color = 'var(--color-ink)'
      fxLayer.appendChild(projectile)
      // 15pxのアイコンはページを横切って飛ぶ間は小さすぎて見えない —
      // 自然な行内サイズのままにせず、出現時に拡大し（下で着弾に向けて
      // 縮小していく）読めるようにしている。
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
