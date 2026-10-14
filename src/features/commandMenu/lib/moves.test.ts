import { describe, expect, it } from 'vitest'
import { drawMoves } from './moves'
import type { MoveEntry } from '../types'

function move(id: string): MoveEntry {
  return { id, name: id, shortDescription: id, icon: (() => null) as unknown as MoveEntry['icon'] }
}

const pool = ['a', 'b', 'c', 'd', 'e'].map(move)

describe('drawMoves', () => {
  it('prefers unseen moves over seen ones', () => {
    const unseen = new Set(['c', 'd'])
    const drawn = drawMoves(pool, unseen, 2)
    expect(drawn.map((m) => m.id)).toEqual(['c', 'd'])
  })

  it('falls back to seen moves once the unseen supply runs out', () => {
    const unseen = new Set(['c'])
    const drawn = drawMoves(pool, unseen, 3)
    expect(drawn.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })

  it('excludes the given ids (e.g. the currently displayed six on reroll)', () => {
    const unseen = new Set(['a', 'b', 'c', 'd', 'e'])
    const drawn = drawMoves(pool, unseen, 2, new Set(['a', 'b']))
    expect(drawn.map((m) => m.id)).toEqual(['c', 'd'])
  })

  it('returns fewer than `count` moves once the pool itself runs out', () => {
    const unseen = new Set(['a', 'b', 'c', 'd', 'e'])
    const drawn = drawMoves(pool, unseen, 10)
    expect(drawn).toHaveLength(pool.length)
  })
})
