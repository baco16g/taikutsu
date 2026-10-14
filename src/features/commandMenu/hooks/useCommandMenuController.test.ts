import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCommandMenuController } from './useCommandMenuController'
import { ATTACK_LIMIT, VISIBLE_COUNT } from '../lib/moves'

describe('useCommandMenuController', () => {
  it('starts active with a full six-move hand and no attacks landed', () => {
    const { result } = renderHook(() => useCommandMenuController())
    expect(result.current.status).toBe('active')
    expect(result.current.currentMoves).toHaveLength(VISIBLE_COUNT)
    expect(result.current.attackCount).toBe(0)
    expect(result.current.attackLimit).toBe(ATTACK_LIMIT)
  })

  it('reroll swaps the six without spending an attack', () => {
    const { result } = renderHook(() => useCommandMenuController())
    const before = result.current.currentMoves.map((m) => m.id)

    act(() => result.current.reroll())

    const after = result.current.currentMoves.map((m) => m.id)
    expect(result.current.attackCount).toBe(0)
    expect(after).toHaveLength(VISIBLE_COUNT)
    expect(after.some((id) => before.includes(id))).toBe(false)
  })

  it('draws a fresh six and increments attackCount after each attack below the limit', () => {
    const { result } = renderHook(() => useCommandMenuController())
    const firstSix = result.current.currentMoves.map((m) => m.id)

    act(() => result.current.commitAttack(firstSix[0]))

    expect(result.current.status).toBe('active')
    expect(result.current.attackCount).toBe(1)
    const secondSix = result.current.currentMoves.map((m) => m.id)
    expect(secondSix).toHaveLength(VISIBLE_COUNT)
    // The just-used move never reappears.
    expect(secondSix.includes(firstSix[0])).toBe(false)
  })

  it('ends the session at the attack limit without drawing a next six', () => {
    const { result } = renderHook(() => useCommandMenuController())

    for (let hit = 0; hit < ATTACK_LIMIT - 1; hit++) {
      act(() => result.current.commitAttack(result.current.currentMoves[0].id))
    }
    expect(result.current.status).toBe('active')
    expect(result.current.attackCount).toBe(ATTACK_LIMIT - 1)

    const lastSix = result.current.currentMoves
    act(() => result.current.commitAttack(lastSix[0].id))

    expect(result.current.status).toBe('complete')
    expect(result.current.attackCount).toBe(ATTACK_LIMIT)
    // No next six to draw — the final hand stays on screen as-is.
    expect(result.current.currentMoves).toBe(lastSix)
  })

  it('reset returns to a fresh active session', () => {
    const { result } = renderHook(() => useCommandMenuController())
    act(() => result.current.commitAttack(result.current.currentMoves[0].id))

    act(() => result.current.reset())

    expect(result.current.status).toBe('active')
    expect(result.current.attackCount).toBe(0)
    expect(result.current.currentMoves).toHaveLength(VISIBLE_COUNT)
  })
})
