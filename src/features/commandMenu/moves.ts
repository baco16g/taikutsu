import specialMovesData from '../../../data/specialMoves.json'
import { MOVE_ICONS } from './moveIcons'
import type { MoveEntry } from './types'

interface RawMove {
  id: string
  name: string
  shortDescription: string
}

/** The 27 shipped moves (data/specialMoves.json), with an icon attached. */
export const ALL_MOVES: MoveEntry[] = (specialMovesData.moves as RawMove[]).map((move) => {
  const icon = MOVE_ICONS[move.id]
  // Record's index signature hides the real possibility of a missing key.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!icon) throw new Error(`No icon mapped for move ${move.id}`)
  return { id: move.id, name: move.name, shortDescription: move.shortDescription, icon }
})

export const VISIBLE_COUNT = 6
export const ATTACK_LIMIT = 5

function shuffled<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Draws the next `count` moves from `pool`, preferring ids in `unseenIds`
 * (moves never shown before) and falling back to previously-seen-but-unused
 * ones once the unseen supply runs out. `exclude` keeps the currently
 * displayed six out of a "show me something else" reroll.
 */
export function drawMoves(
  pool: MoveEntry[],
  unseenIds: ReadonlySet<string>,
  count: number,
  exclude: ReadonlySet<string> = new Set(),
): MoveEntry[] {
  const unseen = pool.filter((m) => unseenIds.has(m.id) && !exclude.has(m.id))
  const seen = pool.filter((m) => !unseenIds.has(m.id) && !exclude.has(m.id))
  return [...unseen, ...seen].slice(0, count)
}

export function createShuffledPool(): MoveEntry[] {
  return shuffled(ALL_MOVES)
}
