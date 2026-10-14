import { mulberry32 } from '../../../lib/prng'
import { CENTER } from './shapeStates'

export interface CollapseHole {
  cx: number
  cy: number
  targetR: number
}

const HOLE_COUNT = 30
const MAX_DIST = 108 // HP1の最大半径（約94）に余裕を持って収まる値

/**
 * 本体全体を覆う散布円。最後の一撃で成長するSVGマスクとして使う:
 * 本体が1点に向かって縮む（「遠ざかっていく」ように見える）代わりに、
 * これらがシルエット全体にわたって開いていき、塊が目に見える形で
 * パーティクルバーストへ崩れていくように見せる。
 * 一様円盤サンプリング（r = MAX_DIST * sqrt(rand())）で中心への偏りを避けている。
 */
export const COLLAPSE_HOLES: CollapseHole[] = (() => {
  const rand = mulberry32(777)
  return Array.from({ length: HOLE_COUNT }, () => {
    const angle = rand() * Math.PI * 2
    const dist = MAX_DIST * Math.sqrt(rand())
    return {
      cx: CENTER + Math.cos(angle) * dist,
      cy: CENTER + Math.sin(angle) * dist,
      targetR: 16 + rand() * 20,
    }
  })
})()
