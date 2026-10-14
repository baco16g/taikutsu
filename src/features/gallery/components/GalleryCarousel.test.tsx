import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installBrowserStubs } from '../../../test/browserStubs'
import type { GalleryGame } from '../types'
import { GalleryCarousel } from './GalleryCarousel'

const GAMES: GalleryGame[] = Array.from({ length: 5 }, (_, i) => ({
  id: `game-${i}`,
  name: `ゲーム${i}`,
  catchphrase: '',
  intro: '',
  thumbnailSrc: '',
  thumbnailAlt: `ゲーム${i}の画像`,
  sourceUrl: `https://example.com/game-${i}`,
  connections: [],
}))

function Carousel() {
  const [selectedIndex, setSelectedIndex] = useState(0)
  return (
    <GalleryCarousel
      games={GAMES}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      onIntroSettled={() => undefined}
      reducedMotion
    />
  )
}

/** 正面のカード（販売ページへのリンク）。 */
function centerLink() {
  return screen.getByRole('link')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GalleryCarousel', () => {
  it('keeps keyboard focus on the front card while switching with the arrow keys', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<Carousel />)
    // 登場演出が終わるまで、切り替えの操作は受け付けない。
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '次の作品' })).toHaveProperty('disabled', false),
    )

    centerLink().focus()
    fireEvent.keyDown(centerLink(), { key: 'ArrowRight' })
    // 正面のカードはリンク、それ以外はボタンとして描き直されるが、フォーカスは
    // 新しい正面のカードへ移る。
    expect(centerLink().getAttribute('href')).toBe(GAMES[1].sourceUrl)
    expect(document.activeElement).toBe(centerLink())

    fireEvent.keyDown(centerLink(), { key: 'ArrowLeft' })
    expect(centerLink().getAttribute('href')).toBe(GAMES[0].sourceUrl)
    expect(document.activeElement).toBe(centerLink())
  })

  it('moves focus to the front card after a side card is chosen', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<Carousel />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '次の作品' })).toHaveProperty('disabled', false),
    )

    const sideCard = screen.getByRole('button', { name: /ゲーム1の画像/ })
    sideCard.focus()
    fireEvent.click(sideCard)
    expect(centerLink().getAttribute('href')).toBe(GAMES[1].sourceUrl)
    expect(document.activeElement).toBe(centerLink())
  })

  it('leaves focus on the arrow button when it is used', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<Carousel />)
    const next = screen.getByRole('button', { name: '次の作品' })
    await waitFor(() => expect(next).toHaveProperty('disabled', false))

    next.focus()
    fireEvent.click(next)
    expect(centerLink().getAttribute('href')).toBe(GAMES[1].sourceUrl)
    expect(document.activeElement).toBe(next)
  })
})
