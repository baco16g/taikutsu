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
   * このセッションでプレイヤーが実際に選んだ技（battle→galleryのreveal
   * から渡される）。実体のある推薦エンジン（recommend.ts参照）に渡され、
   * 表示するゲームを決める。省略した場合はDEFAULT_CHOSEN_MOVESに
   * フォールバックする（引ける実セッションがない呼び出し元向け、
   * 例えば手動テストなど）。
   */
  chosenMoves?: GalleryMove[]
}

/**
 * ギャラリー画面そのもの——サイト共通のヘッダーや戦闘画面由来の要素は
 * 呼び出し側の責任であり、このコンポーネントの役割ではない。ゲーム
 * データはrecommend.tsのrecommendGames()から、プレイヤーが実際に
 * 選んだ技を元に計算される。
 */
export function GameGallery({ reducedMotion, chosenMoves }: GameGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [introSettled, setIntroSettled] = useState(false)

  const effectiveChosenMoves = chosenMoves ?? DEFAULT_CHOSEN_MOVES
  // 選んだ技の入力自体が変わったときだけ再計算する。カルーセルの
  // ナビゲーションによる再レンダリングのたびには再計算しない——
  // recommendGamesは同じ入力に対して決定的なので、正しさのために
  // 再計算が必要なわけではなく、避けるのはあくまでパフォーマンス上の理由。
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
