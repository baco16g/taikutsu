export interface GalleryMove {
  id: string
  name: string
}

/**
 * 表示中のゲームとプレイヤーが選んだ技の実際の結びつき。
 * `experience`はdata/specialMoves.jsonにあるその技自身の`shortDescription`を
 * そのまま流用している——この画面向けにゲームごとの文章を新たに考えることは決してない。
 */
export interface GalleryConnection {
  moveId: string
  moveName: string
  experience: string
}

export interface GalleryGame {
  id: string
  name: string
  catchphrase: string
  intro: string
  thumbnailSrc: string
  thumbnailAlt: string
  sourceUrl: string
  /**
   * 選ばれた技への強い結びつき。data/gameIntros.jsonのrelatedMovesから
   * そのまま。空配列も実際の結果の一つ（この枠はプレイヤーが選んだものと
   * 強い結びつきがない）——UI側が埋めたり推測したりすることはない。
   */
  connections: GalleryConnection[]
}
