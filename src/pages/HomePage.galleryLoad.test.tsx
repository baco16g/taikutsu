import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installBrowserStubs } from '../test/browserStubs'
import { ANNOUNCEMENTS } from './homeSession'
import { HomePage } from './HomePage'

// ギャラリーのモジュールの読み込みが失敗する状況（通信の切断や、再デプロイで
// ファイル名が変わった場合）を、モジュールの読み込み時に例外を投げて再現する。
vi.mock('../features/gallery/components/GameGallery', () => {
  throw new Error('ギャラリーを読み込めない')
})

/** タ・イクツ自身のモーフ（reduced motionで約0.2秒）が終わるのを待つ。 */
const waitForCreatureToSettle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 350)))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HomePage when the gallery cannot be loaded', () => {
  it('shows an error that asks for a page reload instead of the gallery', async () => {
    installBrowserStubs({ hover: true, reducedMotion: true })
    render(<HomePage />)
    fireEvent.click(screen.getByRole('button', { name: /たたかう/ }))

    const menu = screen.getByRole('list', { name: 'スキルコマンド' })
    for (let hit = 1; hit <= 5; hit += 1) {
      fireEvent.click(within(menu).getAllByRole('button')[0])
      await waitForCreatureToSettle()
    }

    await waitFor(
      () => expect(screen.getByRole('status').textContent).toBe(ANNOUNCEMENTS.galleryFailed),
      { timeout: 3000 },
    )
    const heading = screen.getByRole('heading', { name: 'ゲームの一覧を読み込めませんでした' })
    await waitFor(() => expect(document.activeElement).toBe(heading))

    expect(screen.getByRole('button', { name: 'ページを読み込み直す' })).toBeTruthy()
  }, 15000)
})
