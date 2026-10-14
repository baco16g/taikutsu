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
import { useCommandMenuController } from '../hooks/useCommandMenuController'
import { useCommandMenuAnimation } from '../hooks/useCommandMenuAnimation'
import { useCommandSound } from '../hooks/useCommandSound'
import { useSupportsHover } from '../../../hooks/useSupportsHover'
import type { CommandMenuEvents, CommandMoveEvent, MoveEntry } from '../types'
import styles from './CommandMenu.module.css'

export interface CommandMenuProps {
  /** 攻撃の着弾先となる要素（タ・イクツ本体のラッパー）。 */
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
  // .band専用の、アイドル時の明滅（breathing pulse）を担う子要素。
  // useCommandMenuAnimationのstartIdlePulse/stopIdlePulseが解説している通り、
  // bandRef自体への追加tweenにはできない（glide/reveal/squeezeは
  // overwrite:'auto'でbandRef自身のtransformを動かすため、このループと
  // 衝突して毎回サイレントに止まってしまう）。
  const bandPulseRef = useRef<HTMLDivElement>(null)
  const fxLayerRef = useRef<HTMLDivElement>(null)
  const itemElsRef = useRef<(HTMLButtonElement | null)[]>([])
  // confirm時に実際に飛ぶのは行全体ではなく技アイコン単体。
  // playAttackFlightが行全体ではなくアイコンのSVGだけを複製できるよう、
  // itemElsRefとは別に保持している。
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
  // ホバー不可（タッチ）端末ではタップ一発でフォーカスとクリックが同時に発火するため、
  // 本来プレビューのはずの1タップがそのまま即confirmになってしまい、
  // bandがsqueezeBandに上書きされる一瞬しか見えていなかった。
  // 「その行が既にarm済みか」をゲートにすることで、1タップ目を「選択」、
  // 同じ行への2タップ目を「確定」に分離し、bandによるプレビューを
  // 形だけでなく実際に見える1ステップとして成立させている。
  // cursorIndex（previewIndexが動かす値）とは別管理にしているのは、
  // armedが追うべきは「今プレビュー中の行」ではなく
  // 「ユーザーが意図的にこの行を2回アクティベートしたか」だから。
  const armedIndexRef = useRef<number | null>(null)

  // 表示中の6つが変わるたび（マウント・reroll・攻撃後の次ラウンド）、
  // カーソルは先頭に戻り新しい一覧がグループとしてrevealする。
  // statusも依存配列に含めているのは、5回目の攻撃ではcurrentMovesを
  // 入れ替えずに（次の6つが存在しないため）statusだけが'complete'へ
  // 切り替わるので、保留中のonAttackComplete/onSessionCompleteを
  // 発火できるのはこのeffectしかないため。
  useLayoutEffect(() => {
    if (status === 'active') {
      // どのみち必要なDOM計測と一緒にカーソルを新しい6つ/statusに合わせて
      // リセットしている。render時点の計算に分離できる処理ではない。
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
      // このreveal tween（約0.46秒のバウンスイン）の最中にResizeObserver
      // コールバック（新しい6つの行がレイアウトされてlistWrapの高さが
      // 落ち着く等）が走ってgsap.set()で上書きされないよう、下のリサイズ
      // 同期effectをこの間だけガードする。reducedMotion下はそもそも衝突の
      // 起きない即時gsap.setなのでスキップ。
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

  // bandのy/heightはpreviewIndex（上のreveal含む）が走った瞬間の
  // itemEl.offsetHeightから決まる。reroll・カーソル移動であれば、
  // それらは常にDOMが新しい内容を反映した後に起きるので正しい。
  // しかし純粋なブラウザのリサイズ・画面回転では再計測が走らない。
  // 説明文が省略されず折り返す実装のため、currentMovesもstatusも変わらない
  // 幅で行の高さだけが変わるケースがあり、bandの最終計測値が行の実際の
  // 新しい高さとずれたままになる。listWrapにResizeObserverを張ることで、
  // GSAPのtween自体には触れずにそのズレをスナップで再同期している。
  useEffect(() => {
    const listWrap = listWrapRef.current
    if (!listWrap || status !== 'active') return
    // ResizeObserverはobserve()直後に現在サイズで1回必ず発火する。
    // その最初の1回は無視する — 上のrevealが既にbandを正しい位置に
    // 置いた直後であり、ここで反応するとgsap.set()でreveal tweenの
    // バウンスインを上書き・中断させてしまう。
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

  // コンポーネントの寿命いっぱい一度だけ開始し続ける
  // （reducedMotionがONになるまで）。行ごと・reveal・glideのたびに
  // 再トリガーする作りではない — bandPulseRef側の構造でそもそも
  // それらと独立しているため。
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
      // 新しい6つは古いボタンと同じ画面位置にマウントされる。実際のマウスが
      // 動いていなければ、ブラウザは今そこにあるものに対してmouseenterを
      // 発火してしまう。このフェイクなhoverを無視することで、revealした
      // 直後の一覧のカーソルが先頭のままでいられる（ポインタがたまたま
      // 止まっていた位置へ飛ばない）。
      if (viaPointer && performance.now() - lastPointerMoveAtRef.current > 120) return
      // 現在armされている行と違う行へプレビューが移動したらdisarmする
      // （タッチ経路）。armedが意味するのは「このまさに同じ行を連続で
      // タップした」であって「過去に一度でもarmされたことがある」では
      // ないため。
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
      // iがcurrentMovesの範囲外になるケースのガード（TSの配列型は
      // インデックスの範囲を静的に保証しないため）。
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      events?.onPreviewMove?.(move ? toEvent(move, i, attackCount + 1) : null)
    },
    [status, cursorIndex, currentMoves, anim, reducedMotion, sound, events, attackCount],
  )

  const confirmAttack = useCallback(
    (i: number) => {
      if (status !== 'active' || isAttackingRef.current) return
      const move = currentMoves[i]
      // iがcurrentMovesの範囲外になるケースのガード（previewIndex参照）。
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!move) return

      isAttackingRef.current = true
      setIsAttacking(true)
      setCursorIndex(i)

      const payload = toEvent(move, i, attackCount + 1)
      sound.playAttack(move.id)
      events?.onAttackStart?.(payload)
      // band自体のタップ確定フィードバック — この下で飛ばす演出の
      // 予備動作ではなく、無関係な独立した演出。
      anim.squeezeBand(bandRef.current, reducedMotion)

      // 飛ぶのは行全体ではなく技アイコン。
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

      // squeezeの直後ではなく少し間を置く — squeezeと飛翔は別々の
      // マイクロインタラクションであり、同時に始めると「確定してから
      // 技が発動する」ではなく1つの動きに融合して見えてしまう。
      // reducedMotion下はスキップ: playAttackFlightがそちらでは
      // 同期的に即解決するため、遅延させてもHP/reveal更新を
      // 何もないまま足止めするだけになる。
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

  // クリック/タップのゲート: 実ホバーを持つ端末ではクリックは常に
  // 即confirm（ホバーが既にプレビュー役を果たしているため）。
  // タッチ端末では、まだarmされていない行への最初のアクティベートは
  // armするだけ（この直前に同じタップでonFocusから呼ばれたpreviewIndexが
  // 既にbandをそこへ動かしている）— 同じ行への2回目のアクティベートで
  // 初めてconfirmする。
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
      // DOMフォーカスを動かすだけでよい — 対象のonFocusハンドラが
      // previewIndexを自分で呼ぶ。ここでも呼ぶと二重発火する:
      // focus()が同期的にonFocusを発火させる時点でReactはまだ新しい
      // cursorIndexをcommitしていないため、previewIndex自身の
      // i === cursorIndexガードがこの呼び出しをno-opと認識できない。
      itemElsRef.current[next]?.focus()
    },
    [status, cursorIndex, currentMoves.length],
  )

  return (
    <div className={clsx(styles.root, isAttacking && styles.isAttacking)} ref={rootRef}>
      {/* ここに攻撃回数の表示はない — タ・イクツ自身のHPゲージ
          （BattleStatus）が「残り何回の攻撃か」を示す唯一の場所。 */}
      <header className={styles.zoneHeader}>
        <h2 className={styles.zoneTitle}>SKILL</h2>
      </header>

      {/* 'complete'でもアンマウントしない（5回目のヒットは
          useCommandMenuControllerのcommitAttackが示す通りcurrentMovesを
          空にせずstatusだけ切り替えるため、ここには常に表示すべき
          実在の6つがある）。以下の各ハンドラは全てstatus !== 'active'で
          no-opになるので、最後の6つを残すのは見た目上の演出に過ぎず、
          新たに操作可能な死んだUIが残るわけではない。 */}
      <div className={styles.listWrap} ref={listWrapRef}>
        {/* 破れた紙のようなギザギザのband（clip-pathのpolygon）—
            行自体の左右端からはみ出して描画される。行ごとに1枚ではなく、
            GSAPで行間をグライドする共有要素1枚。 */}
        <div className={styles.band} ref={bandRef} aria-hidden="true">
          {/* アイドル時の明滅 — band自体とは別のGSAPターゲット。詳細は
              上のbandPulseRefのコメント参照。 */}
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
          ほかのスキルを見る
        </button>
      </div>

      <div className={styles.fxLayer} ref={fxLayerRef} aria-hidden="true" />
    </div>
  )
}
