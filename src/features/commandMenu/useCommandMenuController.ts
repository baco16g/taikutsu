import { useCallback, useRef, useState } from 'react'
import { ALL_MOVES, ATTACK_LIMIT, VISIBLE_COUNT, createShuffledPool, drawMoves } from './moves'
import type { MoveEntry } from './types'

export type CommandMenuStatus = 'active' | 'complete'

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
 * Owns the move pool / used-move bookkeeping: 6 of 27 moves on screen at a
 * time, a used move never reappears, "show me something else" prefers
 * never-shown moves first, and the session ends after 5 attacks.
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

  /** "ほかの技を見る": swap the visible six without consuming an attack. */
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

  /** Marks `moveId` as used and lines up the next six (or ends the session at 5 attacks). */
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
