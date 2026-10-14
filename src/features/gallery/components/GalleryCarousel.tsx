import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
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
  const isMobile = useMatchMedia('(max-width: 720px)')

  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardElsRef = useRef<(HTMLDivElement | null)[]>([])

  const anim = useGalleryCarouselAnimation(rootRef)
  const lastAppliedRef = useRef<{ index: number; mobile: boolean } | null>(null)
  const [introPlaying, setIntroPlaying] = useState(true)

  // 正面と隣接（ring<=1）の画像の読み込みが成功・失敗を問わず出揃うまで、
  // 残りのカードにはsrcを与えない（理由はGalleryCardのコメント参照）。初回表示の
  // 帯域を奪わず、操作を始める頃には裏で読み込みが進んでいるようにするため。
  // マウント時点の並びで一度だけ判定するので、以降の移動では数え直さない。
  const prioritySettledCountRef = useRef(0)
  const priorityTotalRef = useRef(0)
  const [restLoadEnabled, setRestLoadEnabled] = useState(false)
  const handlePrioritySettled = () => {
    prioritySettledCountRef.current += 1
    if (prioritySettledCountRef.current >= priorityTotalRef.current) {
      setRestLoadEnabled(true)
    }
  }

  // 正面のカードはリンク、それ以外はボタンとして描くため、切り替えるとフォーカス中の
  // カードの要素が作り直されてフォーカスが外れる。カードにフォーカスがあったときは、
  // 切り替えのあと新しい正面のカードへフォーカスを移す。
  const centerLinkRef = useRef<HTMLAnchorElement>(null)
  const refocusCenterRef = useRef(false)
  const select = (index: number) => {
    refocusCenterRef.current = trackRef.current?.contains(document.activeElement) ?? false
    onSelect(index)
  }

  useEffect(() => {
    if (!refocusCenterRef.current) return
    refocusCenterRef.current = false
    centerLinkRef.current?.focus({ preventScroll: true })
  }, [selectedIndex])

  const step = (direction: -1 | 1) =>
    select((((selectedIndex + direction) % count) + count) % count)

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
    priorityTotalRef.current = transforms.filter((t) => t.ring <= 1).length
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
    select(i)
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
                      ref={centerLinkRef}
                      className={styles.link}
                      href={game.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (justDraggedRef.current || introPlaying) e.preventDefault()
                      }}
                    >
                      <GalleryCard game={game} priority load onSettled={handlePrioritySettled} />
                      <span className="sr-only">（販売ページを別タブで開きます）</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.select}
                      tabIndex={t.reachable ? 0 : -1}
                      onClick={() => handleCardActivate(i)}
                    >
                      <GalleryCard
                        game={game}
                        priority={false}
                        load={t.ring <= 1 || restLoadEnabled}
                        onSettled={t.ring <= 1 ? handlePrioritySettled : undefined}
                      />
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
  onSettled,
}: {
  game: GalleryGame
  priority: boolean
  load: boolean
  /** 正面+隣接（ring<=1）のカードにのみ渡される。成功/失敗どちらでも
   * 発火し、全員分揃った時点で呼び出し元が残りのカードのloadを解禁する。 */
  onSettled?: () => void
}) {
  return (
    <>
      <img
        className={styles.img}
        // 登場演出は全カードを一瞬中央に集めてからリングへ広げるため、その間は
        // loading="lazy"が全カードを「画面内」と判定し、奥のカードまで一斉に
        // 読み込んでしまう。そこでブラウザの判定には頼らず、呼び出し元が
        // 正面と隣接1列のカードにだけsrcを与え、それらが出揃ってから残りの
        // 読み込みを許可する。
        src={load ? game.thumbnailSrc : undefined}
        alt={game.thumbnailAlt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding="async"
        draggable={false}
        onLoad={onSettled}
        onError={(e) => {
          e.currentTarget.classList.add(styles.isBroken)
          onSettled?.()
        }}
      />
      <span className={styles.fallback} aria-hidden="true">
        {game.name}
      </span>
    </>
  )
}
