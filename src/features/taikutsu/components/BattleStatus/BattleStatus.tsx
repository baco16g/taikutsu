import type { Ref } from 'react'
import clsx from 'clsx'
import styles from './BattleStatus.module.css'

export interface BattleStatusProps {
  /** Dock element IntroActor measures/paints the shared タ・イクツ instance over — this component renders no creature of its own. */
  creatureDockRef: Ref<HTMLDivElement>
  creatureKicker: string
  creatureName: string
  hpRemaining: number
  attackLimit: number
  defeated: boolean
  reducedMotion: boolean
}

/** タ・イクツ's name/HP readout during battle — fades out once `defeated`, since DefeatMessage takes over this same spot right after. */
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
