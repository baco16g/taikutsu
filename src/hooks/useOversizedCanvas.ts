import { useEffect, useRef, type RefObject } from 'react'

export interface OversizedCanvasSize {
  /** The canvas's own parent box, in CSS pixels — what caller-space coordinates (e.g. xFrac/yFrac) are relative to. */
  boxW: number
  boxH: number
  /** The canvas's own (larger) drawing surface, in CSS pixels. */
  canvasW: number
  canvasH: number
  /** Where the box sits within the canvas surface — add to box-relative coordinates to recentre them onto the canvas. */
  offsetX: number
  offsetY: number
  dpr: number
}

/**
 * Sizes `canvasRef`'s canvas to `overflow`× its parent element's box,
 * centered over it, DPR-aware, and kept in sync via ResizeObserver — shared
 * setup for a canvas whose drawn content (flung debris, drifting dust) needs
 * room to move before fading, without ever being clipped by a hard
 * rectangular edge. Returns a ref with the current sizing, read fresh each
 * animation frame by the caller's own draw loop.
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
