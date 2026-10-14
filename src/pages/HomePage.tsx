import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import clsx from 'clsx'
import { SpeakerHighIcon, SpeakerXIcon } from '@phosphor-icons/react'
import { WorldFrame } from '../components/WorldFrame/WorldFrame'
import { CommandMenu } from '../features/commandMenu/components/CommandMenu'
import { ATTACK_LIMIT } from '../features/commandMenu/lib/moves'
import { useCommandSound } from '../features/commandMenu/hooks/useCommandSound'
import type { CommandMenuEvents } from '../features/commandMenu/types'
import { IntroActor } from '../features/intro/components/IntroActor'
import { useIntroPhase } from '../features/intro/hooks/useIntroPhase'
import { INTRO_COPY } from '../features/intro/data/introCopy'
import type { TaikutsuCreatureHandle } from '../features/taikutsu/components/TaikutsuCreature'
import type { Hp } from '../features/taikutsu/lib/shapeStates'
import { BattleStatus } from '../features/taikutsu/components/BattleStatus/BattleStatus'
import { DefeatMessage } from '../features/reveal/components/DefeatMessage'
import { RevealTransition } from '../features/reveal/components/RevealTransition'
import { GameGallery } from '../features/gallery/components/GameGallery'
import type { GalleryMove } from '../features/gallery/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useSupportsHover } from '../hooks/useSupportsHover'
import styles from './HomePage.module.css'

/** How long the defeat message holds, fully readable, before the reveal starts covering the screen. */
const DEFEAT_MESSAGE_HOLD_MS = 800

/**
 * The app's single real screen, mounted at `/`: particles coalesce into
 * タ・イクツ, "必殺技を選ぶ" carries that same creature instance into battle,
 * then the 必殺技選択→撃破→ギャラリー flow runs to completion — all three
 * phases share one WorldFrame and one タ・イクツ for the whole session (see
 * src/features/intro/hooks/useIntroPhase.ts for why the creature can never be
 * nested inside either phase's own conditionally-rendered markup: it would
 * remount, losing its breathing phase/texture continuity, exactly what the
 * intro→battle handoff exists to avoid).
 */
export function HomePage() {
  const reducedMotion = usePrefersReducedMotion()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  // Reuses CommandMenu's own sound set (useCommandSound) and its
  // hover-capability gate (useSupportsHover) so たたかう's hover cue is the
  // same "move" blip the battle screen's command rows play on hover/focus,
  // rather than a new, separate sound — and, like those rows, only on
  // devices with real hover (a touch tap synthesizes a pointerenter right
  // before the click anyway, which would make it fire the hover sound on
  // every single tap instead of only genuine hover exploration).
  const introSound = useCommandSound(soundEnabled)
  const supportsHover = useSupportsHover()
  const handleStartHover = useCallback(() => {
    if (supportsHover) introSound.playMove()
  }, [supportsHover, introSound])

  const creatureRef = useRef<TaikutsuCreatureHandle>(null)
  const [hitSignal, setHitSignal] = useState(0)
  const [impactCount, setImpactCount] = useState(0)
  const chosenMovesRef = useRef<GalleryMove[]>([])

  // impactCount (bumped the instant CommandMenu's onImpact fires, at
  // icon-landing time) drives the visible HP bar immediately — not
  // onHpChange below, which only fires once the creature's own ~0.5s morph
  // animation finishes catching up.
  const hpRemaining = (ATTACK_LIMIT - impactCount) as Hp

  const [defeated, setDefeated] = useState(false)
  const [revealActive, setRevealActive] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const defeatHandledRef = useRef(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDefeatComplete = useCallback(() => {
    if (defeatHandledRef.current) return
    defeatHandledRef.current = true
    setDefeated(true)
    setAnnouncement('タ・イクツを倒した。退屈の向こうに、まだ知らない遊びがある。')
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null
      setRevealActive(true)
    }, DEFEAT_MESSAGE_HOLD_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  const handleCovered = useCallback(() => {
    flushSync(() => setShowGallery(true))
  }, [])

  const handleRevealComplete = useCallback(() => {
    setRevealActive(false)
    setAnnouncement('タ・イクツを撃破しました。ゲームギャラリーを表示しています。')
    requestAnimationFrame(() => {
      document.getElementById('gallery-heading-title')?.focus({ preventScroll: true })
    })
  }, [])

  const handleArrived = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById('intro-battle-title')?.focus({ preventScroll: true })
    })
    setAnnouncement('タ・イクツが現れました。スキルを選んでください。')
  }, [])

  const intro = useIntroPhase({ reducedMotion, onArrived: handleArrived })

  // Mirrors the hit-signal-to-attack() wiring a plain creature-placeholder
  // component would own internally — done by hand here since IntroActor
  // (not such a placeholder) is what actually holds the shared タ・イクツ
  // instance for this page (see the class doc comment above).
  const lastHitSignalRef = useRef(hitSignal)
  useEffect(() => {
    if (hitSignal === lastHitSignalRef.current) return
    lastHitSignalRef.current = hitSignal
    creatureRef.current?.attack()
  }, [hitSignal])

  // The real "defeat animation actually finished playing" signal — not a
  // guess from impactCount timing.
  const handleHpChange = (hp: Hp) => {
    if (hp === 0) handleDefeatComplete()
  }

  const events: CommandMenuEvents = {
    onImpact: (event) => {
      setHitSignal((n) => n + 1)
      setImpactCount((n) => n + 1)
      chosenMovesRef.current = [
        ...chosenMovesRef.current,
        { id: event.moveId, name: event.moveName },
      ]
    },
  }

  const showIntro = ['arrival', 'ready', 'depart'].includes(intro.phase)
  const showBattle = ['moving', 'settling', 'battle'].includes(intro.phase)
  const introInert = intro.phase !== 'arrival' && intro.phase !== 'ready'
  const battleInert = intro.phase !== 'battle' || revealActive

  return (
    <>
      <WorldFrame
        worldContainerRef={intro.worldRef}
        decorationStrength={showIntro ? 'thin' : 'normal'}
        className={showGallery ? styles.galleryWorld : undefined}
        note={showIntro ? '© OpenStreetMap contributors' : undefined}
        cornerExtra={
          <button
            type="button"
            className={clsx(styles.soundToggle, soundEnabled && styles.isOn)}
            onClick={() => setSoundEnabled((v) => !v)}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'サウンドをオフにする' : 'サウンドをオンにする'}
          >
            {soundEnabled ? (
              <SpeakerHighIcon size={18} weight="bold" aria-hidden="true" />
            ) : (
              <SpeakerXIcon size={18} weight="bold" aria-hidden="true" />
            )}
          </button>
        }
      >
        {showIntro && (
          <section
            className={styles.introGrid}
            ref={intro.introSectionRef}
            inert={introInert || undefined}
          >
            <div className={styles.introTitle}>
              <span className={clsx(styles.eyebrowText, styles.introEyebrow)}>
                {INTRO_COPY.eyebrow}
              </span>
              <h1>
                {INTRO_COPY.title.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </h1>
            </div>

            <div className={styles.creatureCol}>
              <div className={styles.creatureDock} ref={intro.introDockRef} />
              <p className={styles.creatureCaption}>
                {INTRO_COPY.creatureKicker}
                <strong>{INTRO_COPY.creatureName}</strong>
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
                onClick={intro.requestStart}
                onPointerEnter={handleStartHover}
                onFocus={handleStartHover}
                disabled={intro.pendingStart}
              >
                {INTRO_COPY.cta}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
        )}

        {showBattle && (
          <section
            className={styles.battleSection}
            ref={intro.battleSectionRef}
            inert={battleInert || undefined}
          >
            {!showGallery && (
              <>
                <div className={styles.battleHeading}>
                  <span className={styles.eyebrowText}>A SMALL CHANGE IN A BORING WORLD.</span>
                  <h1 id="intro-battle-title" tabIndex={-1}>
                    退屈を、たおせ！
                  </h1>
                </div>

                <section className={styles.battleStatusAnchor}>
                  <BattleStatus
                    creatureDockRef={intro.battleDockRef}
                    creatureKicker={INTRO_COPY.creatureKicker}
                    creatureName={INTRO_COPY.creatureName}
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
                    targetRef={intro.wrapperRef}
                    soundEnabled={soundEnabled}
                    reducedMotion={reducedMotion}
                    events={events}
                  />
                </section>

                {defeated && <DefeatMessage reducedMotion={reducedMotion} />}
              </>
            )}

            {showGallery && (
              <GameGallery
                reducedMotion={reducedMotion}
                chosenMoves={chosenMovesRef.current.length > 0 ? chosenMovesRef.current : undefined}
              />
            )}
          </section>
        )}

        <IntroActor
          wrapperRef={intro.wrapperRef}
          maskCirclesRef={intro.maskCirclesGroupRef}
          creatureRef={creatureRef}
          reducedMotion={reducedMotion}
          onHpChange={handleHpChange}
          maskActive={intro.maskActive}
          showDust={intro.showDust}
          dustProgressRef={intro.dustProgressRef}
        />
      </WorldFrame>

      {revealActive && (
        <RevealTransition
          reducedMotion={reducedMotion}
          worldContainerRef={intro.worldRef}
          onCovered={handleCovered}
          onComplete={handleRevealComplete}
        />
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  )
}
