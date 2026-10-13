/** One of the player's chosen moves for this session. */
export interface GalleryMove {
  id: string
  name: string
}

/**
 * A real tie between a displayed game and one of the player's chosen moves.
 * `experience` is the move's own `shortDescription` from data/specialMoves.json,
 * reused verbatim — never a per-game blurb invented for this screen.
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
   * Strong ties to the fixture's chosen moves, straight from
   * data/gameIntros.json's relatedMoves. An empty array is a real result
   * (this slot has no strong tie to what the player picked) — never filled
   * in or guessed by the UI.
   */
  connections: GalleryConnection[]
}
