import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryCarouselAnimation } from './useGalleryCarouselAnimation'
import { useGalleryDrag } from './useGalleryDrag'
import { PC_STEPS, SP_STEPS, circularDelta, resolveSlideTransform } from './carouselLayout'
import type { GalleryGame } from './types'
import styles from './GalleryCarousel.module.css'

export interface GalleryCarouselProps {
  games: GalleryGame[]
  selectedIndex: number
  onSelect: (index: number) => void
  onIntroSettled: () => void
  reducedMotion: boolean
}

/** Plays its entrance once per mount. */
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
    reducedMotion,
    thresholdPx: isMobile ? 46 : 70,
    onCommit: (direction) => {
      if (direction !== 0) step(direction)
    },
  })

  const transforms = games.map((_, i) =>
    resolveSlideTransform(circularDelta(i, selectedIndex, count), isMobile ? SP_STEPS : PC_STEPS),
  )

  // Mount-only: plays the entrance exactly once. Under StrictMode's dev
  // double-invoke, useGSAP's own cleanup reverts the first pass's
  // in-flight timeline before it completes, so onSettled only ever fires
  // from whichever pass actually survives — never twice, never zero times.
  useEffect(() => {
    const cardEls = cardElsRef.current.filter((el): el is HTMLDivElement => el !== null)
    anim.initCards(cardEls)
    anim.playReveal(cardEls, transforms, reducedMotion, () => {
      setIntroPlaying(false)
      onIntroSettled()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Subsequent navigation. Compares against the last applied (index,
  // isMobile) rather than a simple "first run" flag, so a StrictMode
  // double-invoke with unchanged deps is correctly a no-op here too —
  // the mount effect above already owns placing the cards initially.
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
        {/* Guards selectedIndex being out of range for games. */}
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
                      <GalleryCard game={game} priority />
                      <span className="sr-only">（Nintendo Store を別タブで開きます）</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.select}
                      tabIndex={t.reachable ? 0 : -1}
                      onClick={() => handleCardActivate(i)}
                    >
                      <GalleryCard game={game} priority={false} />
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

function GalleryCard({ game, priority }: { game: GalleryGame; priority: boolean }) {
  return (
    <>
      <img
        className={styles.img}
        src={game.thumbnailSrc}
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
