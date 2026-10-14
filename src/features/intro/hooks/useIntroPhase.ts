import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import gsap from 'gsap'
import { MAX_SEED_RADIUS } from '../data/introSeeds'

export type IntroPhase = 'arrival' | 'ready' | 'depart' | 'moving' | 'settling' | 'battle'

/** formation/depart/travel/settleの各秒数は意図的に調整済み — 適当な初期値ではない。 */
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
  /** 戦闘ドックへの着地が完了した瞬間に一度だけ呼ばれる — 戦闘開始時だけの副作用（今は無い）は、このhook自身のfocus/告知とは別にページ側で配線する。 */
  onArrived?: () => void
}

/**
 * intro→battleのフェーズ状態機械を管理する: タ・イクツの実体は一度も
 * 再マウントされない（IntroActor参照）— このhookがやっているのは2つの
 * "dock"プレースホルダーを計測し、共有ラッパー1つのtransform/widthを
 * それに合わせて描き直すことだけ。連続的なアニメーション（マスクの
 * ブルーム、ダストの進捗、移動tween）は全てGSAP駆動なので、
 * requestStartの途中加速も手書きの経過時間計算ではなく
 * tween.timeScale(4)で済む。
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

  /** 「戦闘へ着地した直後」の最終的な位置/不透明度/フォーカス — 通常のsettleタイムアウトと、リサイズによって進行中の遷移を強制的に即終了させる場合の両方から使われる。 */
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

  /** 戦闘完了状態へ一足飛びに進める — 遷移の途中でのリサイズ/画面回転、または遷移途中でreduced-motionが有効化された場合用。introからのリプレイは一切行わない。 */
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

    // intro/battleのレイアウト切り替え「前」にアクターの現在のビューポート
    // 位置を記録する — 切り替えで#world自体の高さ（とスクロール）が
    // 変わり得るため、「今まさに見た目上どこにあるか」を知る方法は
    // これしかない。
    const viewportBefore = wrapper.getBoundingClientRect()
    // 切り替えを跨いで#world自身の高さを現在（intro）の値に固定する —
    // min-heightの下限だけでなく明示的なheightで。モバイル（World
    // Containerがheight:autoになる）ではbattle側のコンテンツがintro側より
    // 高くも低くもなり得るため、下限だけでは縮むのを止められても、
    // battle（コマンド一覧など）がintroより広さを必要とした瞬間の
    // 急激な拡大までは防げない。下でbattle自身の自然な高さへtweenさせ、
    // 切り替え確定の瞬間に飛ぶままにはしない。
    const fromHeight = world.getBoundingClientRect().height
    world.style.height = `${fromHeight}px`

    flushSync(() => setPhase('moving'))

    // battleセクション（とそのdock）が実際にDOMへ存在するのはここから —
    // このflushSyncが今コミットしたのと同じphaseでゲートされている。
    // それより前にbattleDockRefを読むと常にnullが返り、上のtweenなし
    // 分岐へサイレントにフォールバックしていた——アクターは最終位置へ
    // 移動するのではなく瞬間移動していた。
    const battleDock = battleDockRef.current
    if (!battleDock) {
      completeMove()
      return
    }

    // battle自身の自然な高さを、固定を一瞬だけ解除して即座に復元する形で
    // 計測する — 同期的なので間に何も描画されず、固定解除中のサイズが
    // 実際に表示されることはない。デスクトップではWorld Containerの
    // 高さがコンテンツに依存しない固定のvh/px式なので、fromHeightと
    // toHeightはそこでは同じ値になりこの先のtweenは無害なno-opになる —
    // この処理が実際に必要なのはモバイルのheight:autoブレークポイントのみ。
    world.style.height = ''
    const toHeight = world.getBoundingClientRect().height
    world.style.height = `${fromHeight}px`

    // #worldを切り替え「後」に再計測し、切り替え前のビューポート位置を
    // 切り替え後の座標系に変換する — アクターの描画位置は数値上は
    // 変わるが見た目は同一なので、何も飛ばない。
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

    // 下のアクター自身の移動tweenと同じduration/easeにし、タ・イクツが
    // 着地するのと枠のリサイズ完了が視覚的にずれないようにしている。
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
      // この時点（マウント、または明示的なリセット直後）ではまだ誰も
      // startをリクエストできていない — 下のreducedMotion切り替えeffectとは
      // 違い、こちらはセッション途中で発火し得ないのでpendingStartの
      // チェックは不要。
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

  // マウント時: ブラウザの初回描画より前にアクターをintroドックへ描く
  // （サイズ/位置が一瞬違って見えるちらつきを防ぐ）、その後formationを開始。
  useEffect(() => {
    // GSAPのformationタイムラインを開始しているだけで、render由来の
    // 状態同期ではない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startFormation()
    return () => {
      formationTimelineRef.current?.kill()
      moveTweenRef.current?.kill()
      clearSettleTimer()
    }
    // 意図的にマウント時のみ — リプレイの再入口はresetIntroが明示的に
    // 担い、reducedMotionの変化は下のeffectで扱うため、ここでformationを
    // 最初からやり直すことはしない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // introの見出しはウェブフォント（Dela Gothic One）をdisplay:swapで
  // 読み込むため、上の初回描画は既にフォールバックで行われている —
  // しかしそのswapがいつ完了しようと、見出し自身のボックス高さが
  // 変わり得て、それに伴いグリッド全体のコンテンツ高さ（introグリッドは
  // 縦中央寄せ）も変わり、dockの実際の位置がずれる。document.fonts.ready
  // はそのswap（または失敗）が確定した時点で解決するので、その時点で
  // 再計測することでswap後の最終的なdock位置とアクターのずれを静かに
  // 補正できる — startFormationの再実行ではなくあくまで静かな再描画
  // なので、パーティクルformationが再始動したり遷移途中のアクターが
  // 飛んだりすることはない。
  useEffect(() => {
    const fonts = document.fonts
    // lib.domの型では常に存在する扱いだが、古いブラウザでは欠けることがある。
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

  // prefers-reduced-motionがセッション途中でONになった場合: 長いtweenを
  // 中途半端に縮小したまま残さず、進行中のものを即座に完了させる。
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

  // リサイズ/画面回転: 待機中のフェーズは位置だけ直して乱さず、遷移途中の
  // ものは今や古くなったdockの座標に対して半端なtweenを再開させるのではなく
  // 完了状態へ強制的に進める。
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
