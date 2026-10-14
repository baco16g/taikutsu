import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { GalleryGame } from '../types'
import styles from './GameInfoPanel.module.css'

export interface GameInfoPanelProps {
  game: GalleryGame
  reducedMotion: boolean
  /** カルーセルの一度きりの登場演出が落ち着くとtrueになる——このパネル自身の初回revealをゲートし、タイトル/紹介文がカードより先に表示されないようにする。 */
  introSettled: boolean
}

export function GameInfoPanel({ game, reducedMotion, introSettled }: GameInfoPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [displayedGame, setDisplayedGame] = useState(game)
  const hasRevealedRef = useRef(false)

  const { contextSafe } = useGSAP({ scope: rootRef })

  const revealIn = contextSafe((reduced: boolean) => {
    const el = rootRef.current
    if (!el) return
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 })
      return
    }
    gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' })
  })

  const crossFade = contextSafe((reduced: boolean, commit: () => void) => {
    const el = rootRef.current
    if (!el || reduced) {
      commit()
      return
    }
    gsap.to(el, {
      opacity: 0,
      y: -6,
      duration: 0.16,
      ease: 'power2.in',
      onComplete: () => {
        commit()
        gsap.fromTo(
          el,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' },
        )
      },
    })
  })

  useEffect(() => {
    if (!introSettled) return
    if (!hasRevealedRef.current) {
      hasRevealedRef.current = true
      revealIn(reducedMotion)
      return
    }
    if (displayedGame.id === game.id) return
    crossFade(reducedMotion, () => setDisplayedGame(game))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introSettled, game.id])

  const isDiscovery = displayedGame.connections.length === 0

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.deco} aria-hidden="true" />

      <h3 className={styles.title}>{displayedGame.name}</h3>
      <p className={styles.catch}>{displayedGame.catchphrase}</p>
      <p className={styles.intro}>{displayedGame.intro}</p>

      {isDiscovery ? (
        <p className={styles.discovery}>
          <span className={styles.discoveryTag}>こんな遊びもどう？</span>
          選んだスキルとは少し違う体験が楽しめるゲームです。
        </p>
      ) : (
        <ul className={styles.connections}>
          {displayedGame.connections.map((c) => (
            <li key={c.moveId} className={styles.connection}>
              <p className={styles.connectionLabel}>あなたが選んだスキル</p>
              <p className={styles.connectionMove}>「{c.moveName}」</p>
              <p className={styles.connectionLabel}>このゲームで楽しめること</p>
              <p className={styles.connectionExp}>「{c.experience}」</p>
            </li>
          ))}
        </ul>
      )}

      <a
        className={styles.cta}
        href={displayedGame.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        ゲームの詳細を見る
        <ArrowSquareOutIcon size={16} weight="bold" aria-hidden="true" />
        <span className="sr-only">（販売ページを別タブで開きます）</span>
      </a>
    </div>
  )
}
