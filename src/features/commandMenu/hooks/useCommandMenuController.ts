import { useCallback, useRef, useState } from 'react'
import { ALL_MOVES, ATTACK_LIMIT, VISIBLE_COUNT, createShuffledPool, drawMoves } from '../lib/moves'
import type { MoveEntry } from '../types'

type CommandMenuStatus = 'active' | 'complete'

interface ControllerState {
  status: CommandMenuStatus
  currentMoves: MoveEntry[]
  attackCount: number
}

function freshState(): ControllerState {
  return {
    status: 'active',
    currentMoves: [],
    attackCount: 0,
  }
}

/**
 * 技プール/使用済み技の管理を担う: 27個中6個を常に画面に表示し、
 * 使用済みの技は二度と現れず、「ほかの技を見る」はまだ一度も表示して
 * いない技を優先し、5回攻撃した時点でセッションが終わる。
 */
export function useCommandMenuController() {
  const poolRef = useRef<MoveEntry[]>(createShuffledPool())
  const unseenIdsRef = useRef<Set<string>>(new Set(ALL_MOVES.map((m) => m.id)))
  const usedIdsRef = useRef<Set<string>>(new Set())

  const [state, setState] = useState<ControllerState>(() => {
    const first = drawMoves(poolRef.current, unseenIdsRef.current, VISIBLE_COUNT)
    first.forEach((m) => unseenIdsRef.current.delete(m.id))
    return { ...freshState(), currentMoves: first }
  })

  const reset = useCallback(() => {
    poolRef.current = createShuffledPool()
    unseenIdsRef.current = new Set(ALL_MOVES.map((m) => m.id))
    usedIdsRef.current = new Set()
    const first = drawMoves(poolRef.current, unseenIdsRef.current, VISIBLE_COUNT)
    first.forEach((m) => unseenIdsRef.current.delete(m.id))
    setState({ ...freshState(), currentMoves: first })
  }, [])

  /** 「ほかの技を見る」: 攻撃を消費せずに表示中の6つを入れ替える。 */
  const reroll = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'active') return prev
      const exclude = new Set(prev.currentMoves.map((m) => m.id))
      const available = poolRef.current.filter((m) => !usedIdsRef.current.has(m.id))
      const next = drawMoves(available, unseenIdsRef.current, VISIBLE_COUNT, exclude)
      next.forEach((m) => unseenIdsRef.current.delete(m.id))
      return { ...prev, currentMoves: next.length > 0 ? next : prev.currentMoves }
    })
  }, [])

  /** `moveId`を使用済みにし、次の6つを並べる（5回攻撃した場合はセッションを終える）。 */
  const commitAttack = useCallback((moveId: string) => {
    usedIdsRef.current.add(moveId)
    setState((prev) => {
      const attackCount = prev.attackCount + 1
      if (attackCount >= ATTACK_LIMIT) {
        return { ...prev, status: 'complete', attackCount }
      }
      const available = poolRef.current.filter((m) => !usedIdsRef.current.has(m.id))
      const next = drawMoves(available, unseenIdsRef.current, VISIBLE_COUNT)
      next.forEach((m) => unseenIdsRef.current.delete(m.id))
      return { ...prev, attackCount, currentMoves: next }
    })
  }, [])

  return {
    status: state.status,
    currentMoves: state.currentMoves,
    attackCount: state.attackCount,
    attackLimit: ATTACK_LIMIT,
    reroll,
    commitAttack,
    reset,
  }
}
