import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { GalleryCarousel } from './GalleryCarousel'
import { GameInfoPanel } from './GameInfoPanel'
import { recommendGames } from '../lib/recommend'
import type { GalleryMove } from '../types'
import styles from './GameGallery.module.css'

export interface GameGalleryProps {
  reducedMotion: boolean
  /** このセッションでプレイヤーが実際に選んだ技。推薦（recommend.ts）の入力になる。 */
  chosenMoves: GalleryMove[]
  /** 「もう一度たたかう」の選択を呼び出し元へ伝える。セッション全体のリセットは呼び出し元の責任。 */
  onReplay: () => void
}

/**
 * ギャラリー画面そのもの——サイト共通のヘッダーや戦闘画面由来の要素は
 * 呼び出し側の責任であり、このコンポーネントの役割ではない。ゲーム
 * データはrecommend.tsのrecommendGames()から、プレイヤーが実際に
 * 選んだ技を元に計算される。
 */
export function GameGallery({ reducedMotion, chosenMoves, onReplay }: GameGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [introSettled, setIntroSettled] = useState(false)
  const isMobile = useMatchMedia('(max-width: 720px)')

  // 選んだ技の入力自体が変わったときだけ再計算する。カルーセルの
  // ナビゲーションによる再レンダリングのたびには再計算しない——
  // recommendGamesは同じ入力に対して決定的なので、正しさのために
  // 再計算が必要なわけではなく、避けるのはあくまでパフォーマンス上の理由。
  const games = useMemo(() => recommendGames(chosenMoves.map((m) => m.id)), [chosenMoves])
  const game = games[selectedIndex]

  return (
    <section className={styles.root} aria-labelledby="gallery-heading-title">
      <header className={clsx(styles.heading, !reducedMotion && styles.isAnimated)}>
        <p className={styles.kicker}>YOUR NEXT PLAY.</p>
        <h1 className={styles.title} id="gallery-heading-title" tabIndex={-1}>
          退屈はもう終わり。
          <br />
          次に遊ぶゲームを、
          <br />
          見つけにいこう！
        </h1>
        <p className={styles.sub}>
          あなたが選んだ{chosenMoves.length}つのスキルから、
          {isMobile && <br />}
          {games.length}作品を推薦しました。
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

      <button type="button" className={styles.replay} onClick={onReplay}>
        もう一度たたかう
        <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
      </button>
    </section>
  )
}
