import type { Ref } from 'react'
import clsx from 'clsx'
import styles from './BattleStatus.module.css'

export interface BattleStatusProps {
  /** IntroActorが共有タ・イクツインスタンスを計測/描画する対象のドック要素——このコンポーネント自身はクリーチャーを一切描画しない。 */
  creatureDockRef: Ref<HTMLDivElement>
  creatureKicker: string
  creatureName: string
  hpRemaining: number
  attackLimit: number
  defeated: boolean
  reducedMotion: boolean
}

/** 戦闘中のタ・イクツの名前/HP表示——`defeated`になるとフェードアウトする。直後にDefeatMessageが同じ場所を引き継ぐため。 */
export function BattleStatus({
  creatureDockRef,
  creatureKicker,
  creatureName,
  hpRemaining,
  attackLimit,
  defeated,
  reducedMotion,
}: BattleStatusProps) {
  return (
    <div
      className={clsx(
        styles.root,
        defeated && styles.isDefeated,
        reducedMotion && styles.isReducedMotion,
      )}
    >
      <div className={styles.art} ref={creatureDockRef} />
      <p className={styles.kicker}>{creatureKicker}</p>
      <p className={styles.label}>
        {creatureName}
        <span className={styles.tag}>TA • IKUTSU</span>
      </p>
      <div className={styles.hp} role="img" aria-label={`HP ${hpRemaining} / ${attackLimit}`}>
        <span className={styles.hpLabel}>HP</span>
        {Array.from({ length: attackLimit }, (_, i) => (
          <span key={i} className={clsx(styles.hpSeg, i < hpRemaining && styles.isFilled)} />
        ))}
      </div>
    </div>
  )
}
