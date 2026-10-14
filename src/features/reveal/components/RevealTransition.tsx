import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import styles from './RevealTransition.module.css'

/**
 * 右下→左上へ斜めに掃く3枚のシートで戦闘画面全体（フレーム自身の
 * ヘッダー周りも含む）を覆い尽くし、同じ3枚が逆向きに掃いて下の
 * ギャラリーを現す。
 *
 * このコンポーネントが持つのは覆い隠すレイヤーそのものだけ。「その下に
 * 何があるか」は呼び出し側（HomePage）の責任: `onCovered`の中で
 * 戦闘コンテンツからギャラリーコンテンツへ同期的に差し替える必要がある
 * （理想的には`flushSync`経由で——このコンポーネントは`onCovered`が
 * 戻った直後に非表示化アニメーションを開始するため、Reactが実際に
 * 差し替えをcommitしたかを知る他の手段がない）。
 */

const CLOSED = 'polygon(0 200%, 100% 100%, 100% 100%, 0 100%)'
const FILLED = 'polygon(0 0%, 100% -100%, 100% 100%, 0 100%)'
const FULL_EXIT = 'polygon(0 0, 100% 0, 100% 100%, 0 200%)'
const EXITED = 'polygon(0 0, 100% 0, 100% -100%, 0 0%)'

const COVER_MS = 440
const UNCOVER_MS = 440
const STAGGER_MS = 65
const REDUCED_FADE_MS = 100
/** 覆い隠した状態でのコンテンツ差し替え後、非表示化アニメーションを始めるまでの落ち着き時間 — Reactの差し替え（とそれに伴うreflow、シートの裏で見えない）を先に描画させ切る。 */
const SWAP_SETTLE_MS = 50
const EASE = 'cubic-bezier(.65,0,.35,1)'

export interface RevealTransitionProps {
  reducedMotion: boolean
  worldContainerRef: RefObject<HTMLDivElement | null>
  /** 完全に覆い終わった — 今すぐ（同期的に。上のコンポーネントdocコメント参照）戦闘コンテンツをギャラリーコンテンツへ差し替える。 */
  onCovered: () => void
  /** 完全に覆いが外れた — ギャラリーが表示されているので、フォーカス/有効化してよい。 */
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

    // Step 1: cover用のシートは常にビューポート自身の最上部まで届く —
    // ヘッダー周りを含むフレーム全体が、ギャラリーへの差し替え前に
    // シートの下へ入る。
    wrap.style.top = '0px'

    // Step 2: 入力を止め、レイヤーを挿入する。シート自身
    // （pointer-events: auto、不透明、全面）が入力ブロックの実体 —
    // 覆われた後は背後に何も操作可能なものが残らず、この時点で
    // 戦闘コンテンツ側にもクリックできるものはそもそも残っていない
    // （撃破時点でコマンドメニューは無効化され、フェードアウトしている）。
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
      // Step 4: 隠れている間にコンテンツを差し替え、ギャラリーを
      // その自身の最上部へ着地させる。
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

    // 遷移途中でのリサイズ/画面回転/バックグラウンド化: 戦闘結果は
    // 既に確定している（5回目のヒットが着弾し、撃破演出も再生済み）ので
    // 戦闘画面へ戻すことは絶対にしない。進行中のものを止め、完了済みの
    // ギャラリー状態へ直接ジャンプする。
    const fastForward = () => {
      if (abandoned) return
      abandoned = true
      gsap.killTweensOf([...sheets, wrap])
      callCovered()
      // どちらの分岐の非表示方法もカバーする: 通常の掃引ならclip-path、
      // reduced-motionのフェードならラッパーのopacity——今回の実行が
      // 実際にどちらを使っていたとしても、ここでシートはtween途中で
      // 凍結されるのではなく完全に不可視になっていなければならない。
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

    // `abandoned`はfastForward()によってセットされ、これはこの関数が
    // `await`で中断している間にイベントリスナーから呼ばれる——TSの
    // 制御フロー解析には見えない実際のミューテーションなので、下の
    // `if (abandoned)`は実際には中断ガードとして機能しているにも
    // かかわらず、全て到達不能と報告されてしまう。
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    async function run() {
      if (reducedMotion) {
        // prefers-reduced-motion: 斜めの掃引はせず、短いフェードのみ —
        // 「撃破完了」の文言はそのまま、大きな動きだけを取り除く。
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

      // Step 2（続き）: cover-in、奥のシートが先行し手前のシートが追従する。
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

      // Step 3: 完全に覆われた — タイマーからの推測ではなく、
      // cover用アニメーション自身の完了で確定させる。
      callCovered()

      await wait(SWAP_SETTLE_MS)
      if (abandoned) return

      // Step 5/6: uncover、今度は手前のシートが先行する（上のcover-inとは
      // 逆順のstagger）。まずgsap.setでFULL_EXITへ——FILLEDと同じ
      // 「完全に覆われた」見た目だが、EXITEDへのtweenが逆再生ではなく
      // 同じ斜め方向の動きを継続するようパラメータだけ再定義している。
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
    // マウントごとに正確に1回だけ走る — このコンポーネントは1回の遷移の
    // 間だけマウントされる（HomePage参照）。
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
