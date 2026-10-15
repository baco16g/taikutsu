import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import clsx from 'clsx'
import { SpeakerHighIcon, SpeakerXIcon } from '@phosphor-icons/react'
import { WorldFrame } from '../components/WorldFrame/WorldFrame'
import { BattleScreen } from '../features/battle/components/BattleScreen'
import { useCommandSound } from '../features/commandMenu/hooks/useCommandSound'
import type { LandedMove } from '../features/commandMenu/types'
import { IntroActor } from '../features/intro/components/IntroActor'
import { IntroScreen } from '../features/intro/components/IntroScreen'
import { useIntroPhase } from '../features/intro/hooks/useIntroPhase'
import type { TaikutsuCreatureHandle } from '../features/taikutsu/components/TaikutsuCreature'
import type { Hp } from '../features/taikutsu/lib/shapeStates'
import { RevealTransition } from '../features/reveal/components/RevealTransition'
import { GalleryLoadError } from '../features/gallery/components/GalleryLoadError'
import { useLazyGameGallery } from '../features/gallery/hooks/useLazyGameGallery'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useSupportsHover } from '../hooks/useSupportsHover'
import { DEFEAT_HOLD_MS, deriveSessionView, type SessionStage } from './homeSession'
import styles from './HomePage.module.css'

/**
 * このアプリの唯一の画面（`/`）。イントロ→戦闘→撃破→ギャラリー→再戦の
 * 流れを、各機能のコンポーネントをつないで進める。
 *
 * タ・イクツ（IntroActor）は各画面の中ではなく、ここで1体だけ描画する。
 * 画面ごとに入れ子にすると切り替えのたびに再マウントされ、呼吸の動きや
 * テクスチャが途切れてしまうため。各画面は「立ち位置の目印（dock）」だけを
 * 持ち、useIntroPhaseがその位置へタ・イクツを動かす。
 */
export function HomePage() {
  const reducedMotion = usePrefersReducedMotion()
  const [soundEnabled, setSoundEnabled] = useState(false)

  // 「たたかう」のホバー音は、戦闘画面のコマンド行と同じ「move」音にする。
  // タッチ端末ではタップの直前にpointerenterが合成されるため、行と同様に
  // 実際にホバーできる端末でだけ鳴らす。
  const introSound = useCommandSound(soundEnabled)
  const supportsHover = useSupportsHover()
  const handleStartHover = useCallback(() => {
    if (supportsHover) introSound.playMove()
  }, [supportsHover, introSound])

  const creatureRef = useRef<TaikutsuCreatureHandle>(null)
  /** 着弾した順の技。HP表示とギャラリーの推薦の両方の元になる。 */
  const [landedMoves, setLandedMoves] = useState<LandedMove[]>([])
  const [stage, setStage] = useState<SessionStage>('undefeated')

  const handleArrived = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById('intro-battle-title')?.focus({ preventScroll: true })
    })
  }, [])

  const intro = useIntroPhase({ reducedMotion, onArrived: handleArrived })
  const gallery = useLazyGameGallery()
  const { load: loadGallery } = gallery
  const view = deriveSessionView(intro.phase, stage, gallery.state.status === 'failed')

  // ギャラリーは最初に読み込むJSから分けてあるので、戦闘が始まったら裏で読み込んでおく。
  useEffect(() => {
    if (view.showBattleSection) void loadGallery()
  }, [view.showBattleSection, loadGallery])

  const handleImpact = (move: LandedMove) => {
    setLandedMoves((moves) => [...moves, move])
  }

  // 着弾数が増えたら、タ・イクツの被弾アニメーションを1段階進める。
  const lastLandedCountRef = useRef(0)
  useEffect(() => {
    const landedCount = landedMoves.length
    if (landedCount > lastLandedCountRef.current) creatureRef.current?.attack()
    lastLandedCountRef.current = landedCount
  }, [landedMoves.length])

  // 撃破は着弾数からではなく、タ・イクツの撃破アニメーションが実際に
  // 終わったこと（HPが0の形で静止したこと）で判定する。
  const handleHpChange = (hp: Hp) => {
    if (hp === 0) setStage((current) => (current === 'undefeated' ? 'defeated' : current))
  }

  // 破片を見せる時間が過ぎ、ギャラリーの読み込みも終わって（失敗も含む）から覆い始める。
  // 読み込みに失敗したときは、ギャラリーの代わりにエラーを表示する。
  useEffect(() => {
    if (stage !== 'defeated') return
    let cancelled = false
    let timer = 0
    const hold = new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, DEFEAT_HOLD_MS)
    })
    void Promise.all([hold, loadGallery()]).then(() => {
      if (!cancelled) setStage('covering')
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stage, loadGallery])

  // RevealTransitionはこの呼び出しが戻った直後にシートを外し始めるため、
  // ギャラリーへの差し替えをflushSyncで同期的にcommitしておく。
  const handleCovered = useCallback(() => {
    flushSync(() => setStage('uncovering'))
  }, [])

  const handleRevealComplete = useCallback(() => {
    setStage('gallery')
    requestAnimationFrame(() => {
      document.getElementById('gallery-heading-title')?.focus({ preventScroll: true })
    })
  }, [])

  const handleReplay = () => {
    creatureRef.current?.reset()
    setLandedMoves([])
    setStage('undefeated')
    intro.resetIntro()
  }

  const LoadedGameGallery = gallery.state.status === 'ready' ? gallery.state.GameGallery : null

  return (
    <>
      <WorldFrame
        worldContainerRef={intro.worldRef}
        decorationStrength={view.showIntro ? 'thin' : 'normal'}
        className={
          view.showGallery
            ? styles.galleryWorld
            : view.showBattleSection
              ? styles.battleWorld
              : undefined
        }
        note={view.showIntro ? '© OpenStreetMap contributors' : undefined}
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
        {view.showIntro && (
          <IntroScreen
            sectionRef={intro.introSectionRef}
            creatureDockRef={intro.introDockRef}
            inert={view.introInert}
            startPending={intro.pendingStart}
            onStart={intro.requestStart}
            onStartHover={handleStartHover}
          />
        )}

        {view.showBattleSection && (
          <section
            className={styles.battleSection}
            ref={intro.battleSectionRef}
            inert={view.battleInert || undefined}
          >
            {!view.showGallery && (
              <BattleScreen
                creatureDockRef={intro.battleDockRef}
                creatureTargetRef={intro.wrapperRef}
                landedCount={landedMoves.length}
                defeated={view.defeated}
                reducedMotion={reducedMotion}
                soundEnabled={soundEnabled}
                onImpact={handleImpact}
              />
            )}

            {view.showGallery &&
              (LoadedGameGallery ? (
                <LoadedGameGallery
                  reducedMotion={reducedMotion}
                  chosenMoves={landedMoves}
                  onReplay={handleReplay}
                />
              ) : (
                <GalleryLoadError />
              ))}
          </section>
        )}

        <IntroActor
          wrapperRef={intro.wrapperRef}
          maskCirclesRef={intro.maskCirclesGroupRef}
          creatureRef={creatureRef}
          reducedMotion={reducedMotion}
          idleEnabled={!view.showGallery}
          onHpChange={handleHpChange}
          maskActive={intro.maskActive}
          showDust={intro.showDust}
          dustProgressRef={intro.dustProgressRef}
        />
      </WorldFrame>

      {view.revealActive && (
        <RevealTransition
          reducedMotion={reducedMotion}
          worldContainerRef={intro.worldRef}
          onCovered={handleCovered}
          onComplete={handleRevealComplete}
        />
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {view.announcement}
      </p>
    </>
  )
}
