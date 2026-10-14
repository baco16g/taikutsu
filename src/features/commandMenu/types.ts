import type { Icon } from '@phosphor-icons/react'

export interface MoveEntry {
  id: string
  name: string
  shortDescription: string
  icon: Icon
}

/** 攻撃が着弾したスキル。ページ側は「プレイヤーが選んだスキル」として記録する。 */
export interface LandedMove {
  id: string
  name: string
}
