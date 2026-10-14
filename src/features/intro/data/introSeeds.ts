export interface IntroSeed {
  /** アクター自身の箱に対する割合（0〜1）——revealマスクの`maskContentUnits="objectBoundingBox"`と対になる。 */
  x: number
  y: number
}

const SEED_COUNT = 18
// ラジアン。ひまわり（フィボナッチ）螺旋の間隔で、シードを偏りなく散らす。
const GOLDEN_ANGLE = 2.399963
// 各シードの中心を、余白を含むdust用canvasの箱ではなく本体のシルエット内に収める。
const MAX_RADIUS_FRAC = 0.4

/** 完全にrevealされた後、各シード円がどこまで成長するか（objectBoundingBoxに対する割合）——18個で本体を余裕を持って覆いきれる大きさ。 */
export const MAX_SEED_RADIUS = 0.3

/**
 * arrival中にタ・イクツのシルエットが「どこから収束してくるか」——
 * IntroActorのrevealマスク（円がここで成長する）とArrivalDustのcanvas
 * （パーティクルが同じ点へ向かって飛ぶ）の両方で共有される。これにより
 * dustが無関係な場所ではなく、目に見える形でマスクのブルームへ注ぎ込む
 * ように見える。配置は乱数を使わない螺旋なので、毎回同じになる。
 */
export const INTRO_SEEDS: IntroSeed[] = Array.from({ length: SEED_COUNT }, (_, i) => {
  const angle = i * GOLDEN_ANGLE
  const radius = Math.sqrt((i + 0.5) / SEED_COUNT) * MAX_RADIUS_FRAC
  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius,
  }
})
