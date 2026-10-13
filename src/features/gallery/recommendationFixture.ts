import specialMovesData from '../../../data/specialMoves.json'
import gameIntrosData from '../../../data/gameIntros.json'
import type { GalleryConnection, GalleryGame, GalleryMove } from './types'

/**
 * There is no real recommendation engine yet — this fixture stands in for
 * one: 5 fixed chosen moves + the 6 games a real recommendation would
 * return, hand-picked from specialMoves.json / gameIntros.json's relation
 * data. The actual player's chosen moves (`chosenMoves` in GameGalleryProps)
 * only affect the heading's move count here; which games appear does not
 * depend on them. `docs/research/gameMoveAssociations.json` holds the full
 * move↔game association data a real engine would consume as input;
 * `GalleryGame`/`GalleryMove` are shaped to match what it should return.
 */

interface RawMove {
  id: string
  name: string
  shortDescription: string
}

interface RawRelatedMove {
  moveId: string
  relevance: 'strong' | 'medium'
}

interface RawGame {
  id: string
  name: string
  sourceUrl: string
  thumbnail: { localFile: string }
  catchphrase: string
  intro: string
  relatedMoves: RawRelatedMove[]
}

const MOVES_BY_ID = new Map<string, RawMove>(
  (specialMovesData.moves as RawMove[]).map((m) => [m.id, m]),
)
const GAMES_BY_ID = new Map<string, RawGame>(
  (gameIntrosData.games as RawGame[]).map((g) => [g.id, g]),
)

/** The 5 moves this fixture assumes the player chose. */
const CHOSEN_MOVE_IDS = ['C01', 'C13', 'C17', 'C21', 'C27']

/**
 * 6 real games: 4 with a strong tie to one of CHOSEN_MOVE_IDS (confirmed
 * against gameIntros.json's relatedMoves below), 2 with none — games that
 * offer a slightly different experience from what the player picked. The
 * 4/2 split falls out of each game's real relatedMoves data, not a label
 * chosen to attach.
 */
const SELECTED_GAME_IDS = [
  'D70010000095784', // Little Nightmares — strong C01, C13
  'D70010000122314', // ダークオークション — strong C13, C21
  'D70010000096867', // ゼルダ無双 封印戦記 — strong C17
  'D70010000106252', // Overcooked 2 — strong C27
  'D70010000115147', // Fit Boxing 3 — no tie to the chosen 5 (discovery)
  'D70010000114426', // Wanderstop — no tie to the chosen 5 (discovery)
]

function buildConnections(game: RawGame): GalleryConnection[] {
  return game.relatedMoves
    .filter((rel) => rel.relevance === 'strong' && CHOSEN_MOVE_IDS.includes(rel.moveId))
    .map((rel) => {
      const move = MOVES_BY_ID.get(rel.moveId)
      if (!move) throw new Error(`Unknown move id in relatedMoves: ${rel.moveId}`)
      return { moveId: move.id, moveName: move.name, experience: move.shortDescription }
    })
}

function buildGame(gameId: string): GalleryGame {
  const game = GAMES_BY_ID.get(gameId)
  if (!game) throw new Error(`Unknown game id in gallery fixture: ${gameId}`)
  return {
    id: game.id,
    name: game.name,
    catchphrase: game.catchphrase,
    intro: game.intro,
    thumbnailSrc: `/thumbnails/${game.thumbnail.localFile}`,
    thumbnailAlt: `「${game.name}」のキービジュアル`,
    sourceUrl: game.sourceUrl,
    connections: buildConnections(game),
  }
}

export const FIXTURE_CHOSEN_MOVES: GalleryMove[] = CHOSEN_MOVE_IDS.map((id) => {
  const move = MOVES_BY_ID.get(id)
  if (!move) throw new Error(`Unknown move id in CHOSEN_MOVE_IDS: ${id}`)
  return { id: move.id, name: move.name }
})

export const FIXTURE_GAMES: GalleryGame[] = SELECTED_GAME_IDS.map(buildGame)
