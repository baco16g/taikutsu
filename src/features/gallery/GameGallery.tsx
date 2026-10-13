import { useState } from 'react'
import clsx from 'clsx'
import { GalleryCarousel } from './GalleryCarousel'
import { GameInfoPanel } from './GameInfoPanel'
import { FIXTURE_CHOSEN_MOVES, FIXTURE_GAMES } from './recommendationFixture'
import type { GalleryMove } from './types'
import styles from './GameGallery.module.css'

export interface GameGalleryProps {
  reducedMotion: boolean
  /**
   * The player's actual 5 chosen moves for this session (from the
   * battle→gallery reveal). There is no real recommendation engine yet
   * (see recommendationFixture.ts), so only their count feeds the
   * heading today. Omit to keep using the fixture's own moves instead (a
   * fallback for any caller that has no real session to pull from).
   */
  chosenMoves?: GalleryMove[]
}

/**
 * The gallery screen itself — the shared site header and anything from
 * the battle screen are the caller's job, not this component's. Game data
 * comes from recommendationFixture.ts, which stands in for a real
 * recommendation engine.
 */
export function GameGallery({ reducedMotion, chosenMoves }: GameGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [introSettled, setIntroSettled] = useState(false)

  const games = FIXTURE_GAMES
  const effectiveChosenMoves = chosenMoves ?? FIXTURE_CHOSEN_MOVES
  const game = games[selectedIndex]

  return (
    <section className={styles.root} aria-labelledby="gallery-heading-title">
      <header className={clsx(styles.heading, !reducedMotion && styles.isAnimated)}>
        <p className={styles.kicker}>YOUR NEXT PLAY.</p>
        <h2 className={styles.title} id="gallery-heading-title" tabIndex={-1}>
          退屈はもう終わり。
          <br />
          次に遊ぶゲームを、
          <br />
          見つけにいこう！
        </h2>
        <p className={styles.sub}>
          あなたが選んだ{effectiveChosenMoves.length}つのスキルから、{games.length}
          作品を推薦しました。
        </p>
      </header>

      <GalleryCarousel
        games={games}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onIntroSettled={() => setIntroSettled(true)}
        reducedMotion={reducedMotion}
      />

      <GameInfoPanel game={game} reducedMotion={reducedMotion} introSettled={introSettled} />
    </section>
  )
}
