import { GAME_INTROS, type GameIntro } from '../../../catalog/gameIntros'
import { SPECIAL_MOVES_BY_ID } from '../../../catalog/specialMoves'
import { mulberry32 } from '../../../lib/prng'
import type { GalleryConnection, GalleryGame } from '../types'

/**
 * ギャラリーに表示するゲームの推薦。判断材料は、data/gameIntros.jsonの各ゲームに
 * 付いている`relatedMoves`（スキルとの結びつき strong/medium）のうちstrongだけ。
 * docs/research/の関連データは同じ情報の別形式なので使っていない
 * （理由はdocs/architecture.md）。
 *
 * 10作品のうち最大5件は、選んだスキルのどれかとstrongで結びつくゲーム
 * （strong-tie枠）、残りはどのスキルともstrongで結びつかないゲーム
 * （discovery枠）。strong-tie枠はスキルごとに順番に1件ずつ引くので、候補の
 * 多いスキルが枠を独占しない。候補が足りない分はdiscovery枠で埋め、返す件数は
 * 常にTOTAL_GAME_COUNTになる。
 *
 * 乱数のシードは選んだスキルidの集合から作る（重複を除きソートしてから
 * ハッシュする）。同じ組み合わせなら選んだ順番に関係なく同じ結果になり、
 * 組み合わせが変わると表示されるゲームも変わる。
 */

const GAMES_BY_ID = new Map<string, GameIntro>(GAME_INTROS.map((g) => [g.id, g]))
const ALL_GAME_IDS: string[] = Array.from(GAMES_BY_ID.keys())

/** ギャラリーに表示するゲーム数。画面上の件数表示はこの定数ではなく、返した配列の長さから作られる。 */
export const TOTAL_GAME_COUNT = 10

/** `TOTAL_GAME_COUNT`のうちstrong-tie枠の上限。1セッションで選ぶスキルの数（5）と同じにして、選んだスキルに1件ずつ行き渡るようにしている。 */
const STRONG_TIE_TARGET = 5

function buildConnections(
  game: GameIntro,
  chosenMoveIds: ReadonlySet<string>,
): GalleryConnection[] {
  return game.relatedMoves
    .filter((rel) => rel.relevance === 'strong' && chosenMoveIds.has(rel.moveId))
    .map((rel) => {
      const move = SPECIAL_MOVES_BY_ID.get(rel.moveId)
      if (!move) throw new Error(`Unknown move id in relatedMoves: ${rel.moveId}`)
      return { moveId: move.id, moveName: move.name, experience: move.shortDescription }
    })
}

/** カルーセルのカードは最大で440px幅（GalleryCarousel.module.cssの--card-w）。2倍密度のディスプレイまでをカバーしつつ、CDN原寸（1920px）はそのまま配信しない。 */
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

function hasStrongTie(game: GameIntro, chosenMoveIds: ReadonlySet<string>): boolean {
  return game.relatedMoves.some(
    (rel) => rel.relevance === 'strong' && chosenMoveIds.has(rel.moveId),
  )
}

function isStronglyTiedToMove(game: GameIntro, moveId: string): boolean {
  return game.relatedMoves.some((rel) => rel.relevance === 'strong' && rel.moveId === moveId)
}

/** ソート・重複排除済みの技idに対するFNV-1a（32bit）— mulberry32向けの、順序に依存しない安定したシード。 */
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
 * `moveIds`をラウンドロビンで回し（1周につき各技最大1件）、strong-tie枠が
 * 選ばれた技の間に分散するようにする。`count`件選び終えるか全ての技の
 * 候補キューが尽きるか、どちらか早い方で止まる。
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
 * このプレイヤーのセッションに対して表示する`TOTAL_GAME_COUNT`件のゲームを計算する。
 *
 * @param chosenMoveIds プレイヤーがこのセッションで実際に選んだ技id。
 *   順序・重複は結果に影響しない。0件なら全件discovery枠になる。
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
  // strong-tie枠とdiscovery枠の候補を合わせてもTOTAL_GAME_COUNTに届かない
  // 場合は、残りの全ゲームから補って件数を揃える。
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
