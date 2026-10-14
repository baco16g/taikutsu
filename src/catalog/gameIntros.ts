import gameIntrosJson from '../../data/gameIntros.json'

export interface RelatedMove {
  moveId: string
  /** データ上は'strong'か'medium'。推薦で使うのは'strong'だけ。 */
  relevance: string
}

/** 推薦候補のゲーム1件。data/gameIntros.jsonの1件。 */
export interface GameIntro {
  id: string
  name: string
  /** 販売ページのURL。 */
  sourceUrl: string
  thumbnail: { remoteUrl: string }
  catchphrase: string
  intro: string
  relatedMoves: RelatedMove[]
}

/** 同梱している全ゲーム。並び順はJSONのまま。 */
export const GAME_INTROS: readonly GameIntro[] = gameIntrosJson.games
