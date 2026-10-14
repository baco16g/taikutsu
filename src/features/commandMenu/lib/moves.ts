import specialMovesData from '../../../../data/specialMoves.json'
import { MOVE_ICONS } from '../data/moveIcons'
import type { MoveEntry } from '../types'

/** data/specialMoves.jsonにおける技の生の形——アイコンが付与される前。 */
export interface RawMove {
  id: string
  name: string
  shortDescription: string
}

/** 配信されている27個の技（data/specialMoves.json）にアイコンを付与したもの。 */
export const ALL_MOVES: MoveEntry[] = (specialMovesData.moves as RawMove[]).map((move) => {
  const icon = MOVE_ICONS[move.id]
  // Recordのインデックスシグネチャはキーが実際には欠けている可能性を隠してしまう。
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
 * `pool`から次の`count`個の技を引く。`unseenIds`に含まれるid（これまで
 * 一度も表示されていない技）を優先し、未表示分が尽きたら既に見たが
 * 未使用の技にフォールバックする。`exclude`は「ほかのスキルを見る」のreroll
 * から現在表示中の6つを除外するために使う。
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
