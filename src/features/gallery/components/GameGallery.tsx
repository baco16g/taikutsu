import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { GalleryCarousel } from './GalleryCarousel'
import { GameInfoPanel } from './GameInfoPanel'
import { DEFAULT_CHOSEN_MOVES, recommendGames } from '../lib/recommend'
import type { GalleryMove } from '../types'
import styles from './GameGallery.module.css'

export interface GameGalleryProps {
  reducedMotion: boolean
  /**
   * The player's actual chosen moves for this session (from the
   * battle→gallery reveal), fed into the real recommendation engine (see
   * recommend.ts) to pick which games appear. Omit to fall back to
   * DEFAULT_CHOSEN_MOVES instead (for any caller with no real session to
   * pull from, e.g. manual testing).
   */
  chosenMoves?: GalleryMove[]
}

/**
 * The gallery screen itself — the shared site header and anything from
 * the battle screen are the caller's job, not this component's. Game data
 * comes from recommend.ts's recommendGames(), computed from the player's
 * actual chosen moves.
 */
export function GameGallery({ reducedMotion, chosenMoves }: GameGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [introSettled, setIntroSettled] = useState(false)

  const effectiveChosenMoves = chosenMoves ?? DEFAULT_CHOSEN_MOVES
  // Recomputed only when the chosen-moves input itself changes, not on
  // every carousel navigation re-render — recommendGames is deterministic
  // for a given input, so there's no correctness need to recompute, only
  // a performance reason to avoid it.
  const games = useMemo(
    () => recommendGames(effectiveChosenMoves.map((m) => m.id)),
    [effectiveChosenMoves],
  )
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
