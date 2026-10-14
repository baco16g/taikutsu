import specialMovesData from '../../../../data/specialMoves.json'
import gameIntrosData from '../../../../data/gameIntros.json'
import type { RawMove } from '../../commandMenu/lib/moves'
import { mulberry32 } from '../../taikutsu/lib/prng'
import type { GalleryConnection, GalleryGame, GalleryMove } from '../types'

/**
 * The real recommendation engine: computes which games to show from the
 * player's actual chosen move ids, using data/gameIntros.json's embedded
 * `relatedMoves` (strong/medium per move) as the only signal.
 *
 * `docs/research/gameMoveAssociations.json` (1080 associations, the
 * research artifact whose own `note` field names `src/recommend.ts` as its
 * intended consumer) was considered and deliberately NOT used. Checked
 * against data/gameIntros.json directly:
 * - Its `confidence` field is 1:1 derived from `relevance` (strong→high,
 *   medium→medium per that same note) — no extra ranking signal.
 * - Its `grounds` field is evidentiary quote text, not a score.
 * - For every game gameIntros.json actually ships, the two files'
 *   moveId/relevance pairs are identical (verified programmatically). The
 *   1080 vs. ~1009 count difference is entirely associations for ~70 games
 *   that aren't in the runtime-bundled gameIntros.json at all (no
 *   thumbnail/intro/catchphrase to render them with anyway).
 * So it's the same strong/medium data in a different shape plus
 * un-actionable provenance text — not a superset with real extra signal.
 * Wiring it in would mean shipping a 644KB research file (or the even
 * larger docs/research/gameIntros.full.json, to cover those extra games)
 * for zero decision-relevant benefit. gameIntros.json alone — already
 * bundled, already the fixture's own data source — is the better call.
 *
 * Algorithm (preserves the retired fixture's split concept): of the 6
 * games returned, up to 4 have a confirmed strong tie to one of the
 * player's chosen moves ("strong-tie" picks); the rest are "discovery"
 * picks with no strong tie to anything chosen, for serendipity. Strong-tie
 * candidates are drawn round-robin across the distinct chosen moves (each
 * move's own candidate list seeded-shuffled first) so the 4 slots spread
 * across different moves instead of piling onto whichever move happens to
 * have the most strongly-tied games. If fewer than 4 strong-tie candidates
 * exist for the given moves, the shortfall is simply filled with more
 * discovery picks — the total returned is always exactly
 * `TOTAL_GAME_COUNT`.
 *
 * The whole thing is seeded from the chosen move ids themselves (via
 * mulberry32, the project's existing PRNG at src/features/taikutsu/lib/prng.ts)
 * so the same set of chosen moves always reproduces the same gallery
 * (deterministic for tests/snapshots), while a different set varies which
 * games surface. The seed is order-independent (ids are deduped and sorted
 * first) — which moves you chose matters, not the order you clicked them.
 */

interface RawRelatedMove {
  moveId: string
  relevance: 'strong' | 'medium'
}

interface RawGame {
  id: string
  name: string
  sourceUrl: string
  thumbnail: { remoteUrl: string }
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
const ALL_GAME_IDS: string[] = Array.from(GAMES_BY_ID.keys())

/** Exactly how many games the gallery always shows — GalleryCarousel's own aria-label count stays in sync with this via `games.length`, not a second hardcoded number. */
export const TOTAL_GAME_COUNT = 6

/** The upper bound on strong-tie picks among the `TOTAL_GAME_COUNT`; the rest are discovery picks (see module doc comment). */
const STRONG_TIE_TARGET = 4

/** A reasonable demo/default chosen-move set, used when no real session exists (see recommendGames's `chosenMoveIds` param doc). */
const DEFAULT_CHOSEN_MOVE_IDS = ['C01', 'C13', 'C17', 'C21', 'C27']

export const DEFAULT_CHOSEN_MOVES: GalleryMove[] = DEFAULT_CHOSEN_MOVE_IDS.map((id) => {
  const move = MOVES_BY_ID.get(id)
  if (!move) throw new Error(`Unknown move id in DEFAULT_CHOSEN_MOVE_IDS: ${id}`)
  return { id: move.id, name: move.name }
})

function buildConnections(game: RawGame, chosenMoveIds: ReadonlySet<string>): GalleryConnection[] {
  return game.relatedMoves
    .filter((rel) => rel.relevance === 'strong' && chosenMoveIds.has(rel.moveId))
    .map((rel) => {
      const move = MOVES_BY_ID.get(rel.moveId)
      if (!move) throw new Error(`Unknown move id in relatedMoves: ${rel.moveId}`)
      return { moveId: move.id, moveName: move.name, experience: move.shortDescription }
    })
}

/** The carousel's card is 440px wide at its largest (GalleryCarousel.module.css's --card-w), so this covers up to 2x pixel density without shipping the CDN's full-res (1920px) source. */
const THUMBNAIL_WIDTH_PX = 880

function buildGame(gameId: string, chosenMoveIds: ReadonlySet<string>): GalleryGame {
  const game = GAMES_BY_ID.get(gameId)
  if (!game) throw new Error(`Unknown game id: ${gameId}`)
  return {
    id: game.id,
    name: game.name,
    catchphrase: game.catchphrase,
    intro: game.intro,
    thumbnailSrc: `${game.thumbnail.remoteUrl}?sw=${THUMBNAIL_WIDTH_PX}`,
    thumbnailAlt: `「${game.name}」のキービジュアル`,
    sourceUrl: game.sourceUrl,
    connections: buildConnections(game, chosenMoveIds),
  }
}

function hasStrongTie(game: RawGame, chosenMoveIds: ReadonlySet<string>): boolean {
  return game.relatedMoves.some(
    (rel) => rel.relevance === 'strong' && chosenMoveIds.has(rel.moveId),
  )
}

function isStronglyTiedToMove(game: RawGame, moveId: string): boolean {
  return game.relatedMoves.some((rel) => rel.relevance === 'strong' && rel.moveId === moveId)
}

/** FNV-1a (32-bit) over the sorted, deduped move ids — a stable, order-independent seed for mulberry32. */
function seedFromMoveIds(moveIds: readonly string[]): number {
  let hash = 0x811c9dc5
  for (const id of moveIds) {
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return hash >>> 0
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Round-robins across `moveIds` (each pass picks at most one new game per
 * move) to spread the strong-tie picks across different chosen moves,
 * stopping once `count` games are picked or every move's candidate queue
 * is exhausted — whichever comes first.
 */
function pickStrongTieGameIds(
  moveIds: readonly string[],
  count: number,
  rand: () => number,
): string[] {
  const queues = new Map<string, string[]>(
    moveIds.map((moveId) => {
      const tied = ALL_GAME_IDS.filter((gameId) => {
        const game = GAMES_BY_ID.get(gameId)
        return game !== undefined && isStronglyTiedToMove(game, moveId)
      })
      return [moveId, shuffled(tied, rand)]
    }),
  )
  const moveOrder = shuffled(moveIds, rand)

  const picked: string[] = []
  const pickedSet = new Set<string>()

  let advanced = true
  while (picked.length < count && advanced) {
    advanced = false
    for (const moveId of moveOrder) {
      if (picked.length >= count) break
      const queue = queues.get(moveId)
      if (!queue) continue
      while (queue.length > 0 && pickedSet.has(queue[0])) queue.shift()
      const candidate = queue.shift()
      if (candidate === undefined) continue
      picked.push(candidate)
      pickedSet.add(candidate)
      advanced = true
    }
  }

  return picked
}

/**
 * Computes the `TOTAL_GAME_COUNT` games to show for this player's session.
 *
 * @param chosenMoveIds The player's actual chosen move ids for this
 *   session (from battle→gallery), in any order and any count — handles 0
 *   (no real session: falls back to an all-discovery gallery), as well as
 *   counts other than the game's current 5-per-session rule should that
 *   ever change. Pass `DEFAULT_CHOSEN_MOVE_IDS`-derived ids (see
 *   `DEFAULT_CHOSEN_MOVES`) for a sensible demo/no-session result.
 */
export function recommendGames(chosenMoveIds: readonly string[]): GalleryGame[] {
  const uniqueMoveIds = Array.from(new Set(chosenMoveIds)).sort()
  const chosenSet = new Set(uniqueMoveIds)
  const rand = mulberry32(seedFromMoveIds(uniqueMoveIds))

  const strongTarget = uniqueMoveIds.length === 0 ? 0 : STRONG_TIE_TARGET
  const strongPicks = pickStrongTieGameIds(uniqueMoveIds, strongTarget, rand)
  const strongSet = new Set(strongPicks)

  const discoveryPool = ALL_GAME_IDS.filter((gameId) => {
    if (strongSet.has(gameId)) return false
    const game = GAMES_BY_ID.get(gameId)
    return game !== undefined && !hasStrongTie(game, chosenSet)
  })
  const discoveryNeeded = TOTAL_GAME_COUNT - strongPicks.length
  const discoveryPicks = shuffled(discoveryPool, rand).slice(0, discoveryNeeded)

  const selected = [...strongPicks, ...discoveryPicks]
  // Only reachable if the dataset ever shrinks below TOTAL_GAME_COUNT —
  // keeps the "always exactly 6" contract GalleryCarousel's aria-label
  // relies on even in that degenerate case.
  if (selected.length < TOTAL_GAME_COUNT) {
    const usedSet = new Set(selected)
    const filler = shuffled(
      ALL_GAME_IDS.filter((id) => !usedSet.has(id)),
      rand,
    )
    selected.push(...filler.slice(0, TOTAL_GAME_COUNT - selected.length))
  }

  return selected.slice(0, TOTAL_GAME_COUNT).map((gameId) => buildGame(gameId, chosenSet))
}
