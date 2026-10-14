import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { useOversizedCanvas } from '../../../hooks/useOversizedCanvas'

export interface HitParticlesHandle {
  burst: (xFrac: number, yFrac: number, big: boolean) => void
  clear: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  vrot: number
  life: number
  maxLife: number
  kind: 0 | 1 | 2
}

interface HitParticlesProps {
  ref?: React.Ref<HitParticlesHandle>
  reducedMotion: boolean
}

const SHARD_COLOR = '#141414'

// パーティクル用canvasは、飛び散った破片が移動する余地を持てるよう
// クリーチャー自身の箱より意図的に大きくしてある（下のCANVAS_OVERFLOW /
// useOversizedCanvas参照）。EDGE_FADE_START/ENDは、そのcanvasの半径に
// 対する割合として、パーティクルが溶け始める位置と完全に消える位置を
// 表す——本当のcanvas端よりも十分内側なので、箱の境界で目に見えて
// 切り取られることは決してない。
const EDGE_FADE_START = 0.55
const EDGE_FADE_END = 0.92

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle, edgeFade: number) => {
  const alpha = Math.max(0, p.life / p.maxLife) * edgeFade
  if (alpha <= 0) return
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = alpha
  ctx.fillStyle = SHARD_COLOR
  if (p.kind === 0) {
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
  } else if (p.kind === 1) {
    ctx.beginPath()
    ctx.moveTo(0, -p.size * 0.6)
    ctx.lineTo(p.size * 0.5, p.size * 0.5)
    ctx.lineTo(-p.size * 0.5, p.size * 0.5)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.fillRect(-p.size * 0.18, -p.size * 0.7, p.size * 0.36, p.size * 1.4)
  }
  ctx.restore()
}

// パーティクル用canvasがクリーチャー自身の箱よりどれだけ大きいか——
// 破片が端に達する前に飛んで消える余地を持てるように。控えめな値に
// 留めている（2倍以上などにしない）のは、狭いビューポートでも
// ステージ自身のoverflow:hidden範囲内に収まるようにするため
// （単に硬いクリップ端を外側へ動かすだけにしないため）。
const CANVAS_OVERFLOW = 1.6

export function HitParticles({ ref, reducedMotion }: HitParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  // boxW/boxH: クリーチャー自身の箱（xFrac/yFracが相対的に指す対象）。
  // canvasW/canvasH: より大きいパーティクル用の描画面。offsetX/offsetY:
  // その描画面内で箱がどこに位置するか（箱基準の座標を再中心化するため）。
  const sizeRef = useOversizedCanvas(canvasRef, CANVAS_OVERFLOW)

  const ensureLoop = useCallback(() => {
    if (rafRef.current != null) return
    const step = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) {
        rafRef.current = null
        return
      }
      // useOversizedCanvasがリサイズ時に既にDPRのtransformを適用済み。
      const { canvasW, canvasH } = sizeRef.current
      ctx.clearRect(0, 0, canvasW, canvasH)

      const centerX = canvasW / 2
      const centerY = canvasH / 2
      const maxRadius = Math.min(canvasW, canvasH) / 2
      const fadeStart = maxRadius * EDGE_FADE_START
      const fadeEnd = maxRadius * EDGE_FADE_END

      const next: Particle[] = []
      for (const p of particlesRef.current) {
        p.life -= 1 / 60
        if (p.life <= 0) continue
        p.vy += 11 * (1 / 60)
        p.vx *= 0.985
        p.x += p.vx * (1 / 60)
        p.y += p.vy * (1 / 60)
        p.rotation += p.vrot * (1 / 60)

        const dist = Math.hypot(p.x - centerX, p.y - centerY)
        const edgeFade = 1 - clamp01((dist - fadeStart) / (fadeEnd - fadeStart))
        if (edgeFade <= 0) continue // 端で切られたのではなくフェードゾーンで溶けて消えた

        drawParticle(ctx, p, edgeFade)
        next.push(p)
      }
      particlesRef.current = next

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [sizeRef])

  useImperativeHandle(
    ref,
    () => ({
      burst: (xFrac, yFrac, big) => {
        const { boxW, boxH, canvasW, canvasH, offsetX, offsetY } = sizeRef.current
        if (boxW === 0 || boxH === 0) return
        // xFrac/yFracはクリーチャー自身の箱に対する相対値。より大きい
        // canvas（その箱を中心に対称にオフセットされている）へ再中心化する。
        const originX = offsetX + xFrac * boxW
        const originY = offsetY + yFrac * boxH
        const cx = canvasW / 2
        const cy = canvasH / 2
        const baseAngle = Math.atan2(originY - cy, originX - cx)

        const originCount = reducedMotion ? 1 : big ? 5 : 1
        const perOrigin = reducedMotion ? 5 : big ? 11 : 13

        for (let o = 0; o < originCount; o++) {
          const spread = big ? (o / Math.max(1, originCount - 1) - 0.5) * Math.PI * 1.6 : 0
          const ox = big ? cx + Math.cos(baseAngle + spread) * Math.min(boxW, boxH) * 0.32 : originX
          const oy = big ? cy + Math.sin(baseAngle + spread) * Math.min(boxW, boxH) * 0.32 : originY
          const dirAngle = Math.atan2(oy - cy, ox - cx)

          for (let i = 0; i < perOrigin; i++) {
            const angle = dirAngle + (Math.random() - 0.5) * (big ? 2.6 : 1.3)
            const speed = (big ? 120 : 70) + Math.random() * (big ? 180 : 130)
            const size = (reducedMotion ? 2 : 3) + Math.random() * (big ? 9 : 6)
            const maxLife = reducedMotion
              ? 0.22
              : big
                ? 0.9 + Math.random() * 0.5
                : 0.5 + Math.random() * 0.4
            particlesRef.current.push({
              x: ox,
              y: oy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - speed * 0.25,
              size,
              rotation: Math.random() * Math.PI * 2,
              vrot: (Math.random() - 0.5) * 10,
              life: maxLife,
              maxLife,
              kind: Math.floor(Math.random() * 3) as 0 | 1 | 2,
            })
          }
        }
        ensureLoop()
      },
      clear: () => {
        particlesRef.current = []
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      },
    }),
    [reducedMotion, ensureLoop, sizeRef],
  )

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    // left/top/width/heightはuseOversizedCanvasが命令的に設定する——
    // このcanvasは意図的にこの要素自身の箱より大きく、その上に中央寄せで
    // 重ねられるので、ここではCSSのパーセンテージでサイズ指定しない。
    <canvas ref={canvasRef} style={{ position: 'absolute', pointerEvents: 'none' }} />
  )
}
