import { useCallback, useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { BlobPoint } from '../lib/shapeMath'
import {
  blobPointToVec2,
  blobPointsToPath,
  cloneBlobPoints,
  lerpBlobPoints,
} from '../lib/shapeMath'
import {
  CENTER,
  HIT_INDEX_BY_HP,
  HP_AFTER_HIT,
  HP_SHAPES,
  VIEW_SIZE,
  type Hp,
} from '../lib/shapeStates'
import { COLLAPSE_HOLES } from '../lib/collapseHoles'

export interface ImpactInfo {
  /** クリーチャー自身のviewBox内での0〜1の相対位置。パーティクルcanvas側がピクセルへ変換するために使う */
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

// 攻撃で中断した後、アイドルwobbleを再び馴染ませるまでの秒数。
const WOBBLE_FADE_IN_DURATION = 0.6
// ホバー最大時のwobble振幅 = base * (1 + この値)。
const HOVER_WOBBLE_BOOST = 0.6
// ホバー最大時のfloat/drift再生速度 = base * (1 + この値)。
const HOVER_SPEED_BOOST = 0.55
// ホバー最大時の全体スケール。
const HOVER_SCALE = 1.035

/**
 * ある時刻（gsap.ticker time）における、各点ごとのアイドル半径オフセット。
 * 時間の純粋関数（離散的なfrom/toのtweenでは決してない）なので、単体で
 * サンプリングしてもループの継ぎ目がない——このモジュールが実際に管理
 * すべき継ぎ目は「アイドルwobbleが生きている」状態と「攻撃タイムラインが
 * 輪郭を所有している」状態の境界の方。
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
 * 生きている輪郭を管理する: アイドル時の呼吸/wobbleループと、攻撃時の
 * モーフタイムライン。この2つは同時には動かない——`isAttackingRef`が、
 * タイムライン実行中はアイドル側のtickerをゲートする。この境界をどちら
 * 向きに跨ぐ場合も見た目に飛んではいけない:
 * - 攻撃に入るときは、wobbleのない基準形状ではなく、その瞬間「実際に
 *   画面に表示されている」輪郭（基準形状＋生きているwobble）からモーフする。
 * - 攻撃から抜ける（アイドルへ戻る）ときは、wobbleを0から
 *   `WOBBLE_FADE_IN_DURATION`かけて馴染ませる——アイドルのsin関数群は
 *   経過時間の絶対値で駆動しているため、そうしないと再開した瞬間の
 *   位相へいきなり飛んでしまう。
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
  // アイドルwobbleが最後に再開したgsap.ticker時刻。-Infinityは「ずっと生きている」を意味する
  const wobbleResumeTimeRef = useRef(-Infinity)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const floatTweenRef = useRef<gsap.core.Tween | null>(null)
  const driftTweenARef = useRef<gsap.core.Tween | null>(null)
  const driftTweenBRef = useRef<gsap.core.Tween | null>(null)
  // 0 = 通常、1 = 完全に「気づいている」（ホバー中）— setHovered()がeaseし、
  // アイドルのtickがwobble振幅のスケールに、setHovered()自身がfloat/drift
  // tweenの再生速度のスケールに、それぞれこの値を読む。
  const hoverIntensityRef = useRef(0)
  const hoverTweenRef = useRef<gsap.core.Tween | null>(null)
  const hoverScaleTweenRef = useRef<gsap.core.Tween | null>(null)

  // --- アイドルループ -----------------------------------------------------
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
      // 攻撃後にアイドルが再開した直後なら0から馴染ませる。これにより
      // 輪郭は攻撃が止めた場所からそのまま続き、sin関数群の現在の位相へ
      // 飛んで見えることがない。
      const fade = clamp01((time - wobbleResumeTimeRef.current) / WOBBLE_FADE_IN_DURATION)
      // ホバーすると「気づいた」ように見える——同じ動きを、単に大きくするだけ。
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

  // --- 浮遊 + テクスチャのdrift（transform/opacityのみ、フィルタ再適用はしない） ---
  // 2枚のノイズレイヤー（別シード）が別々の速度/方向でdriftし、レイヤーBは
  // opacityのクロスフェードも行う——この組み合わせにより、1枚の静止画が
  // ただスライドするのではなく、柄自体が流れているように見える。
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
   * ホバーはON/OFFのトグルではなく連続的な0→1の強度: 入る時も出る時も
   * easeし、同じ値が同時に3つのことを駆動する——アイドルwobbleの振幅
   * （上のtickで読む）、float/driftの再生速度、全体のスケール膨張——
   * これによりバラバラのタイミングの3つの演出ではなく、1つの一貫した
   * 「気づいた」反応として見える。
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

  const attack = useCallback(() => {
    if (hpRef.current === 0) return false
    // 前の被弾の変形がまだ再生中なら、最後まで進めてから次の被弾を始める。
    // 被弾を捨てると、着弾数とタ・イクツの形がずれたまま撃破に届かなくなる。
    if (isAttackingRef.current) timelineRef.current?.progress(1)
    const targetHp = HP_AFTER_HIT[hpRef.current]
    isAttackingRef.current = true

    // モーフは、wobbleのない基準形状ではなく「今まさに画面に出ている」
    // もの（基準形状＋その時生きていたwobble/fade）から始める——
    // そうしないと攻撃開始の瞬間に輪郭がbaselineへ目に見えて飛んでしまう。
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

    // 最後の一撃だけはclip pathをHP0の崩壊形状へモーフさせない——
    // シルエットが縮むと「遠ざかっていく」ように見えてしまう。
    // 代わりに本体のサイズはそのままに、下のマスク穴の侵食で
    // 削られていくことで、その場で崩れ落ちるように見せている。
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
        // 着弾のsquash、短い静止（0.12〜0.24の間、何も予定されていない）、
        // その後に本体が崩れながらリリース: マスクの穴がシルエット全体に
        // 散らばって連鎖的に開き、複数の地点からパーティクルが同期して
        // 噴き出すことで、本体そのものが瓦礫に変わっていくように見える
        // （単に縮むだけではなく）。
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
  }, [onImpact, onRestingShapeChange, reducedMotion, idleEnabled])

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
  }
}
