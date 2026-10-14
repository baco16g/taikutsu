import { vi } from 'vitest'

export interface MediaFeatures {
  /** `(hover: hover) and (pointer: fine)` に一致するか（マウス操作の端末か）。 */
  hover: boolean
  /** `(prefers-reduced-motion: reduce)` に一致するか。 */
  reducedMotion: boolean
}

/**
 * jsdomに存在しないブラウザAPIを、コンポーネントテスト用の最小限の
 * スタブで補う。`matchMedia`は与えたメディア特性に応じて結果を返し、
 * それ以外のクエリ（画面幅など）は常に不一致とする。
 */
export function installBrowserStubs({ hover, reducedMotion }: MediaFeatures) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (query.includes('hover: hover') && hover) ||
      (query.includes('prefers-reduced-motion') && reducedMotion),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // jsdomはcanvasの描画コンテキストを実装していない。null を返すと、
  // パーティクル系のコンポーネントは描画をスキップする。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
}
