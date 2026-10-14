import { describe, expect, it } from 'vitest'
import gameIntrosData from '../../../../data/gameIntros.json'
import specialMovesData from '../../../../data/specialMoves.json'
import { DEFAULT_CHOSEN_MOVES, TOTAL_GAME_COUNT, recommendGames } from './recommend'

interface RawRelatedMove {
  moveId: string
  relevance: 'strong' | 'medium'
}

interface RawGame {
  id: string
  thumbnail: { remoteUrl: string }
  relatedMoves: RawRelatedMove[]
}

const RAW_GAMES = gameIntrosData.games as RawGame[]
const MOVE_NAMES_BY_ID = new Map(specialMovesData.moves.map((m) => [m.id, m.name] as const))

/** `moveId`にstrongで結びついている実際のゲームid。data/gameIntros.jsonそのまま——エンジンをバンドル済みデータそのものに対して検証するためで、別に手で用意した2つ目のfixtureではない。 */
function gamesStronglyTiedTo(moveId: string): Set<string> {
  return new Set(
    RAW_GAMES.filter((g) =>
      g.relatedMoves.some((r) => r.relevance === 'strong' && r.moveId === moveId),
    ).map((g) => g.id),
  )
}

const DEFAULT_MOVE_IDS = DEFAULT_CHOSEN_MOVES.map((m) => m.id)

describe('recommendGames', () => {
  it('always returns exactly TOTAL_GAME_COUNT games', () => {
    expect(recommendGames(DEFAULT_MOVE_IDS)).toHaveLength(TOTAL_GAME_COUNT)
    expect(recommendGames([])).toHaveLength(TOTAL_GAME_COUNT)
    expect(recommendGames(['C01'])).toHaveLength(TOTAL_GAME_COUNT)
    // データセット内にstrong-tieのゲームが一つもない技id——不足分は
    // 結果を短くするのではなく、discovery枠を追加で補って埋めなければならない。
    expect(recommendGames(['NOT_A_REAL_MOVE_ID'])).toHaveLength(TOTAL_GAME_COUNT)
  })

  it('never returns a duplicate game across the slots', () => {
    const games = recommendGames(DEFAULT_MOVE_IDS)
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length)
  })

  it('surfaces strong-tie games for the chosen moves, with honest connections', () => {
    const games = recommendGames(DEFAULT_MOVE_IDS)
    const chosenSet = new Set(DEFAULT_MOVE_IDS)
    const strongTieUniverse = new Set(
      DEFAULT_MOVE_IDS.flatMap((id) => [...gamesStronglyTiedTo(id)]),
    )

    const tiedPicks = games.filter((g) => g.connections.length > 0)
    expect(tiedPicks.length).toBeGreaterThan(0)

    for (const game of tiedPicks) {
      // connectionを持つと主張する選出は、実際にこれらの技のstrong-tie宇宙に含まれている。
      expect(strongTieUniverse.has(game.id)).toBe(true)
      for (const connection of game.connections) {
        // 主張されているconnectionのmoveIdは、実際に選ばれた技のいずれかである……
        expect(chosenSet.has(connection.moveId)).toBe(true)
        // ……生データ上でもこのまさにこのゲームと本当にstrong-tieである……
        expect(gamesStronglyTiedTo(connection.moveId).has(game.id)).toBe(true)
        // ……そして作り話ではなく、その技の実際のname/shortDescriptionを運んでいる。
        expect(connection.moveName).toBe(MOVE_NAMES_BY_ID.get(connection.moveId))
      }
    }
  })

  it('gives discovery picks a real empty connections array, never guessed', () => {
    const games = recommendGames(DEFAULT_MOVE_IDS)
    const discoveryPicks = games.filter((g) => g.connections.length === 0)
    const chosenSet = new Set(DEFAULT_MOVE_IDS)
    for (const game of discoveryPicks) {
      const raw = RAW_GAMES.find((g) => g.id === game.id)
      expect(raw).toBeDefined()
      const hasAnyStrongTieToChosen = raw?.relatedMoves.some(
        (r) => r.relevance === 'strong' && chosenSet.has(r.moveId),
      )
      expect(hasAnyStrongTieToChosen).toBe(false)
    }
  })

  it('returns an all-discovery gallery when there are no chosen moves', () => {
    const games = recommendGames([])
    expect(games.every((g) => g.connections.length === 0)).toBe(true)
  })

  it('is deterministic for the same chosen-move input', () => {
    const first = recommendGames(DEFAULT_MOVE_IDS)
    const second = recommendGames(DEFAULT_MOVE_IDS)
    expect(second.map((g) => g.id)).toEqual(first.map((g) => g.id))
  })

  it('is order-independent (same set of moves, different order, same result)', () => {
    const forward = recommendGames(DEFAULT_MOVE_IDS)
    const reversed = recommendGames([...DEFAULT_MOVE_IDS].reverse())
    expect(reversed.map((g) => g.id)).toEqual(forward.map((g) => g.id))
  })

  it('varies the gallery for a different chosen-move set', () => {
    const a = recommendGames(DEFAULT_MOVE_IDS)
    const b = recommendGames(['C02', 'C05', 'C08', 'C19', 'C24'])
    expect(b.map((g) => g.id)).not.toEqual(a.map((g) => g.id))
  })

  it('builds each game from the real data/gameIntros.json fields', () => {
    const [game] = recommendGames(DEFAULT_MOVE_IDS)
    const raw = RAW_GAMES.find((g) => g.id === game.id)
    expect(raw).toBeDefined()
    expect(game.thumbnailSrc).toBe(`${raw?.thumbnail.remoteUrl}?sw=880`)
    expect(game.thumbnailAlt).toContain(game.name)
  })
})
