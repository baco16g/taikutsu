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
import { GameGallery } from '../features/gallery/components/GameGallery'
import type { GalleryMove } from '../features/gallery/types'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useSupportsHover } from '../hooks/useSupportsHover'
import styles from './HomePage.module.css'

/** 撃破メッセージを、はっきり読める状態で保持してからrevealが画面を覆い始めるまでの時間。 */
const DEFEAT_MESSAGE_HOLD_MS = 800

/**
 * このアプリの唯一の実画面、`/`にマウントされる: パーティクルが
 * タ・イクツへ収束し、「必殺技を選ぶ」が同じクリーチャーインスタンスを
 * そのまま戦闘へ持ち込み、必殺技選択→撃破→ギャラリーのフローが完走する
 * ——3つのフェーズはセッションを通して1つのWorldFrameと1体のタ・イクツを
 * 共有する（クリーチャーがどちらのフェーズの条件付きレンダリング
 * マークアップ内にも入れ子にできない理由はsrc/features/intro/hooks/useIntroPhase.ts
 * 参照: 入れ子にすると再マウントされ、呼吸フェーズ/テクスチャの連続性を
 * 失ってしまう——それこそがintro→battleの引き継ぎが存在する理由そのもの）。
 */
export function HomePage() {
  const reducedMotion = usePrefersReducedMotion()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  // CommandMenu自身のサウンドセット（useCommandSound）とそのホバー対応
  // ゲート（useSupportsHover）を再利用することで、「たたかう」のホバー
  // サウンドは戦闘画面のコマンド行がホバー/フォーカス時に鳴らすのと
  // 同じ「move」音になる（新規の別音ではなく）——そしてそれらの行と
  // 同様に、実ホバーを持つ端末でのみ鳴らす（タッチのタップはクリック
  // 直前にpointerenterを合成してしまうため、これをしないと本来の
  // ホバー探索ではなく全てのタップでホバー音が鳴ってしまう）。
  const introSound = useCommandSound(soundEnabled)
  const supportsHover = useSupportsHover()
  const handleStartHover = useCallback(() => {
    if (supportsHover) introSound.playMove()
  }, [supportsHover, introSound])

  const creatureRef = useRef<TaikutsuCreatureHandle>(null)
  const [hitSignal, setHitSignal] = useState(0)
  const [impactCount, setImpactCount] = useState(0)
  const chosenMovesRef = useRef<GalleryMove[]>([])

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

  const handleReplay = () => {
    creatureRef.current?.reset()
    chosenMovesRef.current = []
    setImpactCount(0)
    setDefeated(false)
    defeatHandledRef.current = false
    setShowGallery(false)
    setAnnouncement('')
    intro.resetIntro()
  }

  // 単純なクリーチャー・プレースホルダーコンポーネントなら内部で持つはずの
  // 「hitシグナル→attach()」の配線をここで手動で行っている——IntroActor
  // （そのようなプレースホルダーではない）がこのページの共有タ・イクツ
  // インスタンスを実際に保持しているため（上のコンポーネントdocコメント参照）。
  const lastHitSignalRef = useRef(hitSignal)
  useEffect(() => {
    if (hitSignal === lastHitSignalRef.current) return
    lastHitSignalRef.current = hitSignal
    creatureRef.current?.attack()
  }, [hitSignal])

  // 「撃破アニメーションが実際に再生し終わった」ことを示す本物のシグナル
  // ——impactCountのタイミングからの推測ではない。
  const handleHpChange = (hp: Hp) => {
    if (hp === 0) handleDefeatComplete()
  }

  const handleImpact = (move: LandedMove) => {
    setHitSignal((n) => n + 1)
    setImpactCount((n) => n + 1)
    chosenMovesRef.current = [...chosenMovesRef.current, move]
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
          <IntroScreen
            sectionRef={intro.introSectionRef}
            creatureDockRef={intro.introDockRef}
            inert={introInert}
            startPending={intro.pendingStart}
            onStart={intro.requestStart}
            onStartHover={handleStartHover}
          />
        )}

        {showBattle && (
          <section
            className={styles.battleSection}
            ref={intro.battleSectionRef}
            inert={battleInert || undefined}
          >
            {!showGallery && (
              <BattleScreen
                creatureDockRef={intro.battleDockRef}
                creatureTargetRef={intro.wrapperRef}
                landedCount={impactCount}
                defeated={defeated}
                reducedMotion={reducedMotion}
                soundEnabled={soundEnabled}
                onImpact={handleImpact}
              />
            )}

            {showGallery && (
              <GameGallery
                reducedMotion={reducedMotion}
                chosenMoves={chosenMovesRef.current}
                onReplay={handleReplay}
              />
            )}
          </section>
        )}

        <IntroActor
          wrapperRef={intro.wrapperRef}
          maskCirclesRef={intro.maskCirclesGroupRef}
          creatureRef={creatureRef}
          reducedMotion={reducedMotion}
          idleEnabled={!showGallery}
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
