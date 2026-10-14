import specialMovesJson from '../../data/specialMoves.json'

/** プレイヤーが戦闘で選ぶスキル（コード上の呼び名はmove）。data/specialMoves.jsonの1件。 */
export interface SpecialMove {
  id: string
  name: string
  shortDescription: string
}

/** 同梱している全スキル。並び順はJSONのまま。 */
export const SPECIAL_MOVES: readonly SpecialMove[] = specialMovesJson.moves

export const SPECIAL_MOVES_BY_ID: ReadonlyMap<string, SpecialMove> = new Map(
  SPECIAL_MOVES.map((move) => [move.id, move]),
)
