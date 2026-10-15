import { useCallback, useState, type ComponentType } from 'react'
import type { GameGalleryProps } from '../components/GameGallery'

type GameGalleryComponent = ComponentType<GameGalleryProps>

// ギャラリーは推薦用のゲームのデータを含み、撃破の後にしか使わない。最初に
// 読み込むJSから分けておき、必要になる前に裏で読み込む。
let loadedGallery: GameGalleryComponent | null = null
let loadingGallery: Promise<GameGalleryComponent | null> | null = null

function loadGameGallery(): Promise<GameGalleryComponent | null> {
  loadingGallery ??= import('../components/GameGallery').then(
    ({ GameGallery }) => {
      loadedGallery = GameGallery
      return GameGallery
    },
    // 失敗の結果は覚えておく。ブラウザは一度失敗したモジュールをそのページの間は
    // 読み込み直さないので、呼び直しても結果は変わらない。
    () => null,
  )
  return loadingGallery
}

export type GalleryLoadState =
  | { status: 'pending' }
  | { status: 'ready'; GameGallery: GameGalleryComponent }
  | { status: 'failed' }

/**
 * ギャラリーのコンポーネントを読み込み、その状態を返す。`load`は何度呼んでも
 * 読み込みは1回だけで、読み込みが終わる（失敗も含む）と解決する。
 */
export function useLazyGameGallery() {
  const [state, setState] = useState<GalleryLoadState>(() =>
    loadedGallery ? { status: 'ready', GameGallery: loadedGallery } : { status: 'pending' },
  )

  const load = useCallback(async () => {
    const GameGallery = await loadGameGallery()
    setState(GameGallery ? { status: 'ready', GameGallery } : { status: 'failed' })
  }, [])

  return { state, load }
}
