import type { Ref, RefObject } from 'react'
import clsx from 'clsx'
import { CommandMenu } from '../../commandMenu/components/CommandMenu'
import { ATTACK_LIMIT } from '../../commandMenu/lib/moves'
import type { LandedMove } from '../../commandMenu/types'
import { CREATURE_PROFILE } from '../../taikutsu/data/creatureProfile'
import { BattleStatus } from './BattleStatus/BattleStatus'
import { DefeatDebris } from './DefeatDebris'
import styles from './BattleScreen.module.css'

export interface BattleScreenProps {
  /** タ・イクツが立つ位置の目印。IntroActorがこの位置と大きさに合わせて描画される。 */
  creatureDockRef: Ref<HTMLDivElement>
  /** 攻撃の着弾先（タ・イクツ本体のラッパー）。 */
  creatureTargetRef: RefObject<HTMLElement | null>
  /** これまでに着弾した攻撃の数。 */
  landedCount: number
  defeated: boolean
  reducedMotion: boolean
  soundEnabled: boolean
  onImpact: (move: LandedMove) => void
}

/**
 * 戦闘画面: 見出し、タ・イクツの名前とHP、スキルのコマンドメニュー、撃破後の
 * 破片。各要素はWorld Containerを基準に絶対配置される（呼び出し側のセクションは
 * position:staticにしておく必要がある）。
 */
export function BattleScreen({
  creatureDockRef,
  creatureTargetRef,
  landedCount,
  defeated,
  reducedMotion,
  soundEnabled,
  onImpact,
}: BattleScreenProps) {
  // 攻撃回数の上限がそのまま最大HPになり、1回着弾するごとに1減る。
  // HPゲージは着弾の瞬間に減らし、タ・イクツ自身の変形（約0.5秒）の完了は待たない。
  const hpRemaining = ATTACK_LIMIT - landedCount

  return (
    <>
      <div className={styles.battleHeading}>
        <span className={styles.eyebrowText}>A SMALL CHANGE IN A BORING WORLD.</span>
        <h1 id="intro-battle-title" tabIndex={-1}>
          退屈を、たおせ！
        </h1>
      </div>

      <section className={styles.battleStatusAnchor}>
        <BattleStatus
          creatureDockRef={creatureDockRef}
          creatureKicker={CREATURE_PROFILE.kicker}
          creatureName={CREATURE_PROFILE.name}
          hpRemaining={hpRemaining}
          attackLimit={ATTACK_LIMIT}
          defeated={defeated}
          reducedMotion={reducedMotion}
        />
      </section>

      <section
        className={clsx(
          styles.commandAnchor,
          defeated && styles.isDefeated,
          reducedMotion && styles.isReducedMotion,
        )}
        aria-label="スキルコマンドメニュー"
      >
        <CommandMenu
          targetRef={creatureTargetRef}
          soundEnabled={soundEnabled}
          reducedMotion={reducedMotion}
          onImpact={onImpact}
        />
      </section>

      {defeated && <DefeatDebris reducedMotion={reducedMotion} />}
    </>
  )
}
