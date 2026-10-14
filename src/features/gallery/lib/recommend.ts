import specialMovesData from '../../../../data/specialMoves.json'
import gameIntrosData from '../../../../data/gameIntros.json'
import type { RawMove } from '../../commandMenu/lib/moves'
import { mulberry32 } from '../../taikutsu/lib/prng'
import type { GalleryConnection, GalleryGame, GalleryMove } from '../types'

/**
 * 実体のある推薦エンジン: プレイヤーが実際に選んだ技idから、
 * data/gameIntros.jsonに埋め込まれた`relatedMoves`（技ごとのstrong/medium）
 * のみを信号として表示するゲームを決める。
 *
 * `docs/research/gameMoveAssociations.json`（1080件の関連データで、その
 * `note`フィールド自身が`src/recommend.ts`を想定利用者としている研究成果物）
 * は検討した上で意図的に使わなかった。data/gameIntros.jsonと直接突き合わせた結果:
 * - `confidence`フィールドは`relevance`から1対1で導出されている
 *   （同じnoteによればstrong→high、medium→medium）— 追加のランキング信号はない。
 * - `grounds`フィールドは根拠となる引用テキストであり、スコアではない。
 * - gameIntros.jsonが実際に配信する全ゲームについて、両ファイルの
 *   moveId/relevanceの組は完全に一致する（プログラムで検証済み）。
 *   1080件と約1009件の差は、ランタイムにバンドルされるgameIntros.jsonに
 *   そもそも存在しない約70ゲーム分の関連データに過ぎない
 *   （どのみちthumbnail/intro/catchphraseがなく表示できない）。
 * つまり同じstrong/mediumデータを別の形で持っているだけで、かつ
 * 実行時には使いようのない出典テキストが付いているだけ——実質的に
 * 追加の判断材料を持つ上位互換ではない。組み込むと644KBの研究用
 * ファイル（あるいはその約70ゲーム分も含めるならさらに大きい
 * docs/research/gameIntros.full.json）を配信することになり、判断に
 * 寄与する効果はゼロ。既にバンドル済みでfixtureのデータ源でもある
 * gameIntros.json単体の方が良い選択。
 *
 * アルゴリズム（廃止済みfixtureが持っていた分割の考え方を踏襲）:
 * 返す10作品のうち最大5件（選んだ技の数と同じ）はプレイヤーが選んだ技との
 * 確実なstrongな結びつき（「strong-tie」枠）、残り5件は何の技とも強い
 * 結びつきを持たない「discovery」枠（セレンディピティ用）。strong-tie候補は
 * 選ばれた技ごとにラウンドロビンで引く（各技ごとの候補一覧は事前に
 * シード付きシャッフル済み）ことで、技ごとにちょうど1件ずつ割り当たり、
 * 特定の技が持つstrong-tieゲームの多さに引きずられて他の技が埋もれる
 * ことがない。対象の技に対するstrong-tie候補が足りない場合は、不足分を
 * discovery枠で単純に埋める——返却数は常にちょうど`TOTAL_GAME_COUNT`になる。
 *
 * 全体は選ばれた技id自体からシードする（本プロジェクト既存のPRNGである
 * src/features/taikutsu/lib/prng.tsのmulberry32経由）ため、同じ技の組み合わせは
 * 常に同じギャラリーを再現し（テスト/スナップショット向けに決定的）、
 * 違う組み合わせでは表示されるゲームが変わる。シードは順序に依存しない
 * （idは重複排除とソートを先に行う）——選んだ技の「組み合わせ」が結果を
 * 左右し、クリックした「順番」は影響しない。
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

/** ギャラリーが常に表示するゲーム数 — GalleryCarousel側のaria-labelの件数は`games.length`経由でこれと同期しており、別途ハードコードされた数値ではない。 */
export const TOTAL_GAME_COUNT = 10

/** `TOTAL_GAME_COUNT`のうちstrong-tie枠の上限。1セッションで選ぶ技の数（5）と一致させ、選んだ技それぞれに必ず1件ずつ割り当たるようにしている。残りはdiscovery枠（モジュール先頭のdocコメント参照）。 */
const STRONG_TIE_TARGET = 5

/** 実セッションが存在しない場合に使う、デモ/デフォルト用の選択技セット（recommendGamesの`chosenMoveIds`パラメータ解説を参照）。 */
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

function hasStrongTie(game: RawGame, chosenMoveIds: ReadonlySet<string>): boolean {
  return game.relatedMoves.some(
    (rel) => rel.relevance === 'strong' && chosenMoveIds.has(rel.moveId),
  )
}

function isStronglyTiedToMove(game: RawGame, moveId: string): boolean {
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
 * @param chosenMoveIds プレイヤーがこのセッション（battle→gallery）で
 *   実際に選んだ技id。順序・件数は問わない——0件（実セッションなしの場合:
 *   全件discoveryのギャラリーにフォールバック）や、現状の「1セッション5件」
 *   というルールが将来変わった場合の別件数にも対応する。実セッションが
 *   ない場合のデモ用には`DEFAULT_CHOSEN_MOVE_IDS`由来のid
 *   （`DEFAULT_CHOSEN_MOVES`参照）を渡す。
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
  // データセットがTOTAL_GAME_COUNTを下回った場合にのみ到達する分岐 —
  // その縮退したケースでも、GalleryCarouselのaria-labelが前提とする
  // 「常にちょうど6件」という契約を守る。
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
