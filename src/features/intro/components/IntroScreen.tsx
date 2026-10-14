import { Fragment, type Ref } from 'react'
import clsx from 'clsx'
import { CREATURE_PROFILE } from '../../taikutsu/data/creatureProfile'
import { INTRO_COPY } from '../data/introCopy'
import styles from './IntroScreen.module.css'

export interface IntroScreenProps {
  /** useIntroPhaseが「たたかう」の後にフェードアウトさせる対象。 */
  sectionRef: Ref<HTMLElement>
  /** タ・イクツが立つ位置の目印。IntroActorがこの位置と大きさに合わせて描画される。 */
  creatureDockRef: Ref<HTMLDivElement>
  inert: boolean
  /** 「たたかう」が押され、戦闘画面への移動を待っている間はtrue。 */
  startPending: boolean
  onStart: () => void
  onStartHover: () => void
}

/** イントロ画面: 見出し・タ・イクツの紹介・「たたかう」ボタン。 */
export function IntroScreen({
  sectionRef,
  creatureDockRef,
  inert,
  startPending,
  onStart,
  onStartHover,
}: IntroScreenProps) {
  return (
    <section className={styles.introGrid} ref={sectionRef} inert={inert || undefined}>
      <div className={styles.introTitle}>
        <span className={clsx(styles.eyebrowText, styles.introEyebrow)}>{INTRO_COPY.eyebrow}</span>
        <h1>
          {INTRO_COPY.title.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </h1>
      </div>

      <div className={styles.creatureCol}>
        <div className={styles.creatureDock} ref={creatureDockRef} />
        <p className={styles.creatureCaption}>
          {CREATURE_PROFILE.kicker}
          <strong>{CREATURE_PROFILE.name}</strong>
        </p>
      </div>

      <div className={styles.introCopy}>
        {INTRO_COPY.body.map((lines, i) => (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        ))}
      </div>

      <div className={styles.introAction}>
        <button
          type="button"
          className={styles.startButton}
          onClick={onStart}
          onPointerEnter={onStartHover}
          onFocus={onStartHover}
          disabled={startPending}
        >
          {INTRO_COPY.cta}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  )
}
