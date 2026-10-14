import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installBrowserStubs } from '../test/browserStubs'
import { HomePage } from './HomePage'

const APPEARED = 'タ・イクツが現れました。スキルを選んでください。'
const DEFEATED = 'タ・イクツを倒した。退屈の向こうに、まだ知らない遊びがある。'
const GALLERY_SHOWN = 'タ・イクツを撃破しました。ゲームギャラリーを表示しています。'

/** タ・イクツ自身のモーフ（reduced motionで約0.2秒）が終わるのを待つ。 */
const waitForCreatureToSettle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 350)))

function liveRegion() {
  return screen.getByRole('status')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// 実際のGSAPタイムラインと撃破後の待ち時間（800ms）を通しで動かすため、
// 偽のタイマーではなく実時間で進める。
describe('HomePage session flow (reduced motion)', () => {
  it('goes from intro through five hits to the gallery, and replay returns to the intro', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<HomePage />)

    expect(liveRegion().textContent).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /たたかう/ }))

    expect(liveRegion().textContent).toBe(APPEARED)
    const hp = screen.getByRole('img', { name: /^HP / })
    expect(hp.getAttribute('aria-label')).toBe('HP 5 / 5')

    const menu = screen.getByRole('list', { name: 'スキルコマンド' })
    for (let hit = 1; hit <= 5; hit += 1) {
      fireEvent.click(within(menu).getAllByRole('button')[0])
      expect(hp.getAttribute('aria-label')).toBe(`HP ${5 - hit} / 5`)
      await waitForCreatureToSettle()
    }

    await waitFor(() => expect(liveRegion().textContent).toBe(DEFEATED))
    await waitFor(() => expect(liveRegion().textContent).toBe(GALLERY_SHOWN), { timeout: 3000 })
    await waitFor(() => expect(document.activeElement?.id).toBe('gallery-heading-title'))
    expect(screen.getByText(/あなたが選んだ5つのスキルから/)).toBeTruthy()
    // 奥のカードはaria-hiddenでアクセシビリティツリーから外れるため、マークアップで数える。
    expect(document.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(10)

    fireEvent.click(screen.getByRole('button', { name: /もう一度たたかう/ }))

    expect(liveRegion().textContent).toBe('')
    expect(screen.queryByRole('heading', { name: /次に遊ぶゲーム/ })).toBeNull()
    expect(screen.getByRole('button', { name: /たたかう/ }).hasAttribute('disabled')).toBe(false)
  }, 15000)

  it('still defeats the creature when the five hits land faster than its hit animation', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<HomePage />)
    fireEvent.click(screen.getByRole('button', { name: /たたかう/ }))

    // タ・イクツの被弾の変形が終わるのを待たずに、5回続けて着弾させる。
    const menu = screen.getByRole('list', { name: 'スキルコマンド' })
    for (let hit = 1; hit <= 5; hit += 1) {
      fireEvent.click(within(menu).getAllByRole('button')[0])
    }

    expect(screen.getByRole('img', { name: /^HP / }).getAttribute('aria-label')).toBe('HP 0 / 5')
    await waitFor(() => expect(liveRegion().textContent).toBe(DEFEATED))
  }, 15000)
})
