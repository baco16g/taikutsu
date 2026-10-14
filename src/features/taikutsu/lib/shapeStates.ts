import type { BlobPoint } from './shapeMath'

export type Hp = 0 | 1 | 2 | 3 | 4 | 5

export const VIEW_SIZE = 240
export const CENTER = VIEW_SIZE / 2

/**
 * 全てのHP状態（とアイドルの呼吸パス）で共有される固定角度。
 * 状態間で変わるのは半径だけなので、モーフィングはインデックスごとの
 * 単純なlerpで済み、ねじれたり自己交差したりすることが決してない。
 */
const ANGLE_JITTER = [0, -4, 6, -3, 5, -7, 3, 4, -5, 2, -3, 6, -2, 4]
export const POINT_COUNT = ANGLE_JITTER.length
const ANGLE_STEP = 360 / POINT_COUNT
export const BASE_ANGLES = ANGLE_JITTER.map((jitter, i) => i * ANGLE_STEP + jitter)

const shapeFrom = (radii: number[]): BlobPoint[] =>
  radii.map((radius, i) => ({ angle: BASE_ANGLES[i], radius }))

// HP5: 無傷のシルエット。不規則で非対称だが1つの塊として読める。
const HP5_RADII = [104, 97, 101, 93, 99, 105, 96, 100, 90, 98, 103, 94, 100, 107]

// HP4: 1発目のヒットはインデックス3（南）への小さな一噛みとして着弾。
// 隣接点はわずかに和らげるだけに留め、傷が「欠け」に見え「分裂」には見えないようにする。
const HP4_RADII = [104, 97, 95, 60, 92, 105, 96, 100, 90, 98, 103, 94, 100, 107]

// HP3: 2発目のヒットでインデックス9（西）に2つ目の噛み跡が開く。
// 1発目の傷はさらに深く・広くインデックス4へ広がり、最初の傷がさらに裂けているように見せる。
const HP3_RADII = [107, 97, 95, 52, 78, 105, 96, 100, 82, 55, 90, 94, 100, 107]

// HP2: 3発目のヒットが最初の本格的な抉れ——13/0の境目（北）をまたぐ
// 2点のノッチ——それまでの傷もさらに深まる。
const HP2_RADII = [45, 92, 95, 46, 78, 105, 96, 100, 82, 48, 90, 94, 90, 50]

// HP1: 4発目のヒットがインデックス6（西南西）に噛みつく。塊全体も
// 縮み荒くなり、1つのシルエットとしてのまとまりを失わないまま
// 「今にも崩れそう」な見た目になる。
const HP1_RADII = [41, 74, 84, 35, 69, 77, 50, 73, 73, 37, 80, 76, 80, 39]

// HP0は静的なシルエットとして描画されることは決してない
// （TaikutsuCreatureの最後の一撃シーケンス参照）が、完全性のため、
// またモーフ先として将来再利用する可能性のため、崩壊済みの点集合を保持している。
const HP0_RADII = HP1_RADII.map((r) => r * 0.3)

export const HP_SHAPES: Record<Hp, BlobPoint[]> = {
  5: shapeFrom(HP5_RADII),
  4: shapeFrom(HP4_RADII),
  3: shapeFrom(HP3_RADII),
  2: shapeFrom(HP2_RADII),
  1: shapeFrom(HP1_RADII),
  0: shapeFrom(HP0_RADII),
}

/** 1回被弾した後のHP。HP0のまま被弾しても0のまま。 */
export const HP_AFTER_HIT: Record<Hp, Hp> = { 5: 4, 4: 3, 3: 2, 2: 1, 1: 0, 0: 0 }

/** `hp + 1`から`hp`へ移る際に最も深くなった凹みのインデックス——ヒットパーティクルの着弾位置を狙うために使う。 */
export const HIT_INDEX_BY_HP: Partial<Record<Hp, number>> = {
  4: 3,
  3: 9,
  2: 13,
  1: 6,
  0: undefined,
}
