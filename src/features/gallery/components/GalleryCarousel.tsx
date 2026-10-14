import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { useGalleryCarouselAnimation } from '../hooks/useGalleryCarouselAnimation'
import { useGalleryDrag } from '../hooks/useGalleryDrag'
import { PC_STEPS, SP_STEPS, circularDelta, resolveSlideTransform } from '../lib/carouselLayout'
import type { GalleryGame } from '../types'
import styles from './GalleryCarousel.module.css'

export interface GalleryCarouselProps {
  games: GalleryGame[]
  selectedIndex: number
  onSelect: (index: number) => void
  onIntroSettled: () => void
  reducedMotion: boolean
}

export function GalleryCarousel({
  games,
  selectedIndex,
  onSelect,
  onIntroSettled,
  reducedMotion,
}: GalleryCarouselProps) {
  const count = games.length
  const isMobile = useMediaQuery('(max-width: 720px)')

  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardElsRef = useRef<(HTMLDivElement | null)[]>([])

  const anim = useGalleryCarouselAnimation(rootRef)
  const lastAppliedRef = useRef<{ index: number; mobile: boolean } | null>(null)
  const [introPlaying, setIntroPlaying] = useState(true)

  const step = (direction: -1 | 1) =>
    onSelect((((selectedIndex + direction) % count) + count) % count)

  const justDraggedRef = useGalleryDrag(trackRef, {
    disabled: introPlaying,
    thresholdPx: isMobile ? 46 : 70,
    onCommit: (direction) => {
      if (direction !== 0) step(direction)
    },
  })

  const transforms = games.map((_, i) =>
    resolveSlideTransform(circularDelta(i, selectedIndex, count), isMobile ? SP_STEPS : PC_STEPS),
  )

  // マウント時のみ: 登場演出をちょうど1回だけ再生する。StrictModeの
  // 開発時二重実行下では、useGSAP自身のcleanupが1回目のパスの実行中
  // タイムラインを完了前に巻き戻すため、onSettledは実際に生き残った
  // 方のパスからしか発火しない——2回発火することも0回になることもない。
  useEffect(() => {
    const cardEls = cardElsRef.current.filter((el): el is HTMLDivElement => el !== null)
    anim.initCards(cardEls)
    anim.playReveal(cardEls, transforms, reducedMotion, () => {
      setIntroPlaying(false)
      onIntroSettled()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 以降のナビゲーション。単純な「初回フラグ」ではなく直前に適用した
  // (index, isMobile)と比較することで、依存配列が変わらないStrictModeの
  // 二重実行でもここが正しくno-opになる——カードの初期配置は上の
  // マウントeffectが既に担っている。
  useEffect(() => {
    const prev = lastAppliedRef.current
    lastAppliedRef.current = { index: selectedIndex, mobile: isMobile }
    if (!prev || (prev.index === selectedIndex && prev.mobile === isMobile)) return
    anim.applyTransforms(cardElsRef.current, transforms, reducedMotion, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, isMobile])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (introPlaying) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    }
  }

  const handleCardActivate = (i: number) => {
    if (justDraggedRef.current || introPlaying) return
    onSelect(i)
  }

  const current = games[selectedIndex]

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={handleKeyDown}>
      <p className="sr-only" aria-live="polite">
        {/* selectedIndexがgamesの範囲外になるケースのガード。 */}
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {`${selectedIndex + 1} / ${count}枚目: ${current?.name ?? ''} を表示中`}
      </p>

      <div
        className={styles.viewport}
        role="region"
        aria-roledescription="carousel"
        aria-label={`スキルから推薦されたゲーム、全${count}作品`}
      >
        <div className={styles.track} ref={trackRef}>
          {games.map((game, i) => {
            const t = transforms[i]
            const isCenter = i === selectedIndex
            const label = `${i + 1}枚目 / ${count}枚: ${game.name}`

            return (
              <div
                key={game.id}
                className={clsx(styles.card, isCenter && styles.isCenter)}
                ref={(el) => {
                  cardElsRef.current[i] = el
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={label}
                aria-hidden={!t.reachable || undefined}
              >
                <div className={styles.frame}>
                  {isCenter ? (
                    <a
                      className={styles.link}
                      href={game.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (justDraggedRef.current || introPlaying) e.preventDefault()
                      }}
                    >
                      <GalleryCard game={game} priority load />
                      <span className="sr-only">（販売ページを別タブで開きます）</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.select}
                      tabIndex={t.reachable ? 0 : -1}
                      onClick={() => handleCardActivate(i)}
                    >
                      <GalleryCard game={game} priority={false} load={t.ring <= 1} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.nav}
          onClick={() => step(-1)}
          disabled={introPlaying}
          aria-label="前の作品"
        >
          <CaretLeftIcon size={18} weight="bold" aria-hidden="true" />
        </button>

        <ol className={styles.dots} aria-label="作品を選ぶ">
          {games.map((game, i) => (
            <li key={game.id}>
              <button
                type="button"
                className={clsx(styles.dot, i === selectedIndex && styles.isActive)}
                onClick={() => handleCardActivate(i)}
                disabled={introPlaying}
                aria-label={`${i + 1}番目: ${game.name}`}
                aria-current={i === selectedIndex || undefined}
              />
            </li>
          ))}
        </ol>

        <button
          type="button"
          className={styles.nav}
          onClick={() => step(1)}
          disabled={introPlaying}
          aria-label="次の作品"
        >
          <CaretRightIcon size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function GalleryCard({
  game,
  priority,
  load,
}: {
  game: GalleryGame
  priority: boolean
  load: boolean
}) {
  return (
    <>
      <img
        className={styles.img}
        // 登場演出はカード全員を一瞬center(x:0)に集めてからリングへ展開する
        // ため、その間はloading="lazy"のビューポート近接判定が全カードを
        // 「画面内」と誤判定してしまい、本来読み込むべきでない奥の
        // カードまで一斉にフェッチされてしまう（GalleryGallery側で実測
        // 済み）。ブラウザの判定に頼らず、呼び出し元がring（中心からの
        // 距離）で「正面＋隣接1列」だけに絞ってsrcそのものを与えることで、
        // 読み込み自体を確実に遅延させる——さらに奥のreachableなリング
        // （PCの2列目など）は、実際にそこまでナビゲートされるまで待つ。
        src={load ? game.thumbnailSrc : undefined}
        alt={game.thumbnailAlt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding="async"
        draggable={false}
        onError={(e) => {
          e.currentTarget.classList.add(styles.isBroken)
        }}
      />
      <span className={styles.fallback} aria-hidden="true">
        {game.name}
      </span>
    </>
  )
}
