import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { useCommandMenuAnimation } from './useCommandMenuAnimation'
import type { CommandMenuController } from './useCommandMenuController'
import type { useCommandSound } from './useCommandSound'
import type { LandedMove } from '../types'

export interface UseCommandMenuInteractionOptions {
  controller: CommandMenuController
  anim: ReturnType<typeof useCommandMenuAnimation>
  sound: ReturnType<typeof useCommandSound>
  reducedMotion: boolean
  supportsHover: boolean
  /** 攻撃の着弾先となる要素（タ・イクツ本体のラッパー）。 */
  targetRef: RefObject<HTMLElement | null>
  onImpact: (move: LandedMove) => void
}

/**
 * コマンドメニューの操作ルール: どの行にカーソルがあるか、攻撃中は入力を
 * 受け付けないこと、タッチ端末では同じ行の2回目のタップで確定すること、
 * 矢印キーでの移動。技プールの状態はuseCommandMenuController、DOMの
 * 振り付けはuseCommandMenuAnimationが持ち、このhookは行番号で指示を出す。
 */
export function useCommandMenuInteraction({
  controller,
  anim,
  sound,
  reducedMotion,
  supportsHover,
  targetRef,
  onImpact,
}: UseCommandMenuInteractionOptions) {
  const { status, currentMoves, attackCount, commitAttack } = controller
  const [cursorIndex, setCursorIndex] = useState(0)
  const [isAttacking, setIsAttacking] = useState(false)
  // 攻撃開始と同じイベント内で次の入力を弾くため、stateとは別にrefでも持つ。
  const isAttackingRef = useRef(false)
  const lastPointerMoveAtRef = useRef(0)
  const cursorIndexRef = useRef(cursorIndex)
  cursorIndexRef.current = cursorIndex
  // タッチ端末では1回のタップでfocusとclickが同時に発火するため、そのままでは
  // プレビューのつもりのタップが即確定になってしまう。「この行は既に1回
  // タップされたか」を覚えておき、1回目を選択、同じ行への2回目を確定にする。
  // 追うのは「今プレビュー中の行」ではなく「同じ行が続けてタップされたか」
  // なので、cursorIndexとは別に持つ。
  const armedIndexRef = useRef<number | null>(null)
  // 攻撃を確定したときにフォーカスが一覧の中にあったか。攻撃中は行のボタンが
  // 無効になり、次の6つは新しい要素として描画されるので、そのままでは
  // フォーカスが外れてキーボードで続けて選べなくなる。
  const restoreFocusRef = useRef(false)

  // 表示中の6つが変わるたび（マウント・reroll・攻撃後の次ラウンド）、
  // カーソルは先頭に戻り新しい一覧がrevealする。statusも依存配列に
  // 含めているのは、5回目の攻撃ではcurrentMovesを入れ替えずにstatusだけが
  // 'complete'へ切り替わり、そのときも攻撃中のロックを解除する必要があるため。
  useLayoutEffect(() => {
    if (status === 'active') {
      // 新しい6つのDOM計測（reveal）と同じタイミングでカーソルを戻す必要があり、
      // render中の計算には置き換えられない。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCursorIndex(0)
      armedIndexRef.current = null
      anim.revealList(reducedMotion)
    } else {
      restoreFocusRef.current = false
    }

    isAttackingRef.current = false
    setIsAttacking(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMoves, status])

  // 攻撃中のロックが解けて行のボタンが有効に戻ってから、フォーカスを先頭の行へ
  // 戻す（無効なボタンにはフォーカスできない）。カーソルは上のeffectで先頭に
  // 戻っているので、移動先のonFocusはプレビューの移動や効果音を起こさない。
  useEffect(() => {
    if (isAttacking || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    anim.focusItem(0)
  }, [isAttacking, anim])

  // ウィンドウのリサイズで行の高さが変わったら、bandを現在の行へ合わせ直す。
  useEffect(() => {
    if (status !== 'active') return
    return anim.observeListResize(() => {
      if (isAttackingRef.current) return
      anim.snapBandTo(cursorIndexRef.current)
    })
  }, [status, anim])

  const previewIndex = (i: number, viaPointer = false) => {
    if (status !== 'active' || isAttackingRef.current || i === cursorIndex) return
    // 新しい6つは古いボタンと同じ位置にマウントされるため、マウスが
    // 止まったままでもブラウザはmouseenterを発火する。直前にポインタが
    // 動いていないhoverは無視し、reveal直後のカーソルを先頭のままにする。
    if (viaPointer && performance.now() - lastPointerMoveAtRef.current > 120) return
    // 別の行へカーソルが移ったら、タッチの1回目のタップの選択は解除する。
    if (armedIndexRef.current !== i) armedIndexRef.current = null
    setCursorIndex(i)
    anim.glideBandTo(i, reducedMotion)
    sound.playMove()
  }

  const confirmAttack = (i: number) => {
    if (status !== 'active' || isAttackingRef.current) return
    const move = currentMoves[i]
    // iがcurrentMovesの範囲外になるケースのガード（TSの配列型は
    // インデックスの範囲を静的に保証しないため）。
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!move) return

    restoreFocusRef.current = anim.listHasFocus()
    isAttackingRef.current = true
    setIsAttacking(true)
    setCursorIndex(i)

    const attackNumber = attackCount + 1
    sound.playAttack(move.id)
    anim.playAttack(i, targetRef, reducedMotion, {
      onImpact: () => {
        sound.playHit(attackNumber)
        onImpact({ id: move.id, name: move.name })
      },
      onLanded: () => commitAttack(move.id),
    })
  }

  // マウス端末ではhoverがプレビューを担うので、クリックは即確定。
  // タッチ端末では、同じタップのfocusでpreviewIndexが既にbandを動かして
  // いるので、1回目は選択だけにし、同じ行への2回目で確定する。
  const handleRowActivate = (i: number) => {
    if (status !== 'active' || isAttackingRef.current) return
    if (!supportsHover && armedIndexRef.current !== i) {
      armedIndexRef.current = i
      return
    }
    armedIndexRef.current = null
    confirmAttack(i)
  }

  const handleListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (status !== 'active' || isAttackingRef.current) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const delta = e.key === 'ArrowDown' ? 1 : -1
    const next = (cursorIndex + delta + currentMoves.length) % currentMoves.length
    // フォーカスを動かすだけにする。移動先のonFocusがpreviewIndexを呼ぶので、
    // ここでも呼ぶと二重に発火する（focus()が同期的にonFocusを発火する時点では
    // 新しいcursorIndexがまだcommitされておらず、ガードが効かない）。
    anim.focusItem(next)
  }

  const handleListPointerMove = () => {
    lastPointerMoveAtRef.current = performance.now()
  }

  return {
    cursorIndex,
    isAttacking,
    previewIndex,
    handleRowActivate,
    handleListKeyDown,
    handleListPointerMove,
  }
}
