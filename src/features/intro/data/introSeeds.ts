import { mulberry32 } from '../../../lib/prng'

export interface IntroSeed {
  /** アクター自身の箱に対する割合（0〜1）——revealマスクの`maskContentUnits="objectBoundingBox"`と対になる。 */
  x: number
  y: number
  /** formation tween自身の進捗のうち、このシードが成長し始めるまでの割合（0〜1）。 */
  delay: number
}

const SEED_COUNT = 18
const GOLDEN_ANGLE = 2.399963 // ラジアン——collapseHoles.ts自身の散布と同じひまわり/フィボナッチ螺旋の間隔
const MAX_RADIUS_FRAC = 0.4 // 各シードの「中心」を、余白を含むdust用canvasの箱ではなく本体自身のシルエット内に収める

/** 完全にrevealされた後、各シード円がどこまで成長するか（objectBoundingBoxに対する割合）——18個で本体を余裕を持って覆いきれる大きさ。 */
export const MAX_SEED_RADIUS = 0.3

/**
 * arrival中にタ・イクツのシルエットが「どこから収束してくるか」——
 * IntroActorのrevealマスク（円がここで成長する）とArrivalDustのcanvas
 * （パーティクルが同じ点へ向かって飛ぶ）の両方で共有される。これにより
 * dustが無関係な場所ではなく、目に見える形でマスクのブルームへ注ぎ込む
 * ように見える。src/features/taikutsu/lib/collapseHoles.tsと同じパターンで、
 * 固定シードを使いモジュールスコープで一度だけ計算する。
 */
export const INTRO_SEEDS: IntroSeed[] = (() => {
  const rand = mulberry32(2026)
  return Array.from({ length: SEED_COUNT }, (_, i) => {
    const angle = i * GOLDEN_ANGLE
    const radius = Math.sqrt((i + 0.5) / SEED_COUNT) * MAX_RADIUS_FRAC
    return {
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
      delay: rand() * 0.25,
    }
  })
})()
