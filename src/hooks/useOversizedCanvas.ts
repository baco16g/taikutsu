import { useEffect, useRef, type RefObject } from 'react'

export interface OversizedCanvasSize {
  /** canvas自身の親要素の箱（CSSピクセル）——呼び出し側の座標（例: xFrac/yFrac）が相対的に指す対象。 */
  boxW: number
  boxH: number
  /** canvas自身の（より大きい）描画面（CSSピクセル）。 */
  canvasW: number
  canvasH: number
  /** canvasの描画面内で箱がどこに位置するか——箱基準の座標にこれを足すとcanvas上の座標に再中心化できる。 */
  offsetX: number
  offsetY: number
  dpr: number
}

/**
 * `canvasRef`のcanvasを親要素の箱の`overflow`倍のサイズにし、中央寄せで
 * 重ね、DPRを考慮し、ResizeObserverで同期を保つ——描画内容（飛び散る
 * 破片、漂うdust）が硬い矩形の端で切られることなく消える前に動き回る
 * 余地を必要とするcanvas向けの共有セットアップ。現在のサイズを持つrefを
 * 返し、呼び出し側自身の描画ループが毎フレーム最新値を読む。
 */
export function useOversizedCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  overflow: number,
): RefObject<OversizedCanvasSize> {
  const sizeRef = useRef<OversizedCanvasSize>({
    boxW: 0,
    boxH: 0,
    canvasW: 0,
    canvasH: 0,
    offsetX: 0,
    offsetY: 0,
    dpr: 1,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const canvasW = rect.width * overflow
      const canvasH = rect.height * overflow
      const offsetX = (canvasW - rect.width) / 2
      const offsetY = (canvasH - rect.height) / 2
      sizeRef.current = {
        boxW: rect.width,
        boxH: rect.height,
        canvasW,
        canvasH,
        offsetX,
        offsetY,
        dpr,
      }
      canvas.width = Math.max(1, Math.round(canvasW * dpr))
      canvas.height = Math.max(1, Math.round(canvasH * dpr))
      canvas.style.width = `${canvasW}px`
      canvas.style.height = `${canvasH}px`
      canvas.style.left = `${-offsetX}px`
      canvas.style.top = `${-offsetY}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [canvasRef, overflow])

  return sizeRef
}
