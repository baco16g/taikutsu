import { describe, expect, it } from 'vitest'
import { ATTACK_LIMIT } from '../commandMenu/lib/moves'
import { HP_SHAPES } from '../taikutsu/lib/shapeStates'

// 戦闘画面はHP = ATTACK_LIMIT - 着弾数として表示し、タ・イクツは着弾ごとに
// HP_SHAPESの段階を1つ進む。両者がずれると、HPゲージが0になっても撃破に届かない。
describe('battle HP', () => {
  it('gives the creature exactly ATTACK_LIMIT hit stages above 0', () => {
    const fullHp = Math.max(...Object.keys(HP_SHAPES).map(Number))
    expect(fullHp).toBe(ATTACK_LIMIT)
  })
})
