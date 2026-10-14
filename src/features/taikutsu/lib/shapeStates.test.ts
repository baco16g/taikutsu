import { describe, expect, it } from 'vitest'
import {
  BASE_ANGLES,
  HIT_INDEX_BY_HP,
  HP_AFTER_HIT,
  HP_SHAPES,
  POINT_COUNT,
  type Hp,
} from './shapeStates'

describe('HP_SHAPES', () => {
  it('has an entry for every HP level from 0 to 5', () => {
    expect(Object.keys(HP_SHAPES).sort()).toEqual(['0', '1', '2', '3', '4', '5'])
  })

  it('gives every HP level the same point count and angles, so morphing never twists', () => {
    for (const hp of [0, 1, 2, 3, 4, 5] as const) {
      const shape = HP_SHAPES[hp]
      expect(shape).toHaveLength(POINT_COUNT)
      expect(shape.map((p) => p.angle)).toEqual(BASE_ANGLES)
    }
  })

  it('HP0 is a uniformly shrunk HP1 (collapsed, not a distinct silhouette)', () => {
    const hp1 = HP_SHAPES[1]
    const hp0 = HP_SHAPES[0]
    hp0.forEach((p, i) => {
      expect(p.radius).toBeCloseTo(hp1[i].radius * 0.3)
    })
  })
})

describe('HIT_INDEX_BY_HP', () => {
  it('names a hit index for every damaged state except the final blow', () => {
    expect(HIT_INDEX_BY_HP[4]).toBeTypeOf('number')
    expect(HIT_INDEX_BY_HP[3]).toBeTypeOf('number')
    expect(HIT_INDEX_BY_HP[2]).toBeTypeOf('number')
    expect(HIT_INDEX_BY_HP[1]).toBeTypeOf('number')
    expect(HIT_INDEX_BY_HP[0]).toBeUndefined()
  })
})

describe('HP_AFTER_HIT', () => {
  it('lowers HP by one per hit, from full HP down to 0, and stays at 0', () => {
    const visited: Hp[] = []
    let hp: Hp = 5
    // 表が誤っていても止まるよう、回数に上限を設ける。
    for (let hit = 0; hit < 10 && hp !== 0; hit += 1) {
      hp = HP_AFTER_HIT[hp]
      visited.push(hp)
    }
    expect(visited).toEqual([4, 3, 2, 1, 0])
    expect(HP_AFTER_HIT[0]).toBe(0)
  })
})
