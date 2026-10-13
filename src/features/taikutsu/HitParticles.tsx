import { useEffect, useImperativeHandle, useRef } from 'react'

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

// The particle canvas is deliberately bigger than the creature's own box
// (see resize() below) so flung debris has room to travel. EDGE_FADE_START/
// END describe, as a fraction of that canvas's half-size, where particles
// start dissolving and where they're fully gone — well inside the true
// canvas edge, so nothing is ever visibly clipped by a box boundary.
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

// How much bigger than the creature's own box the particle canvas is, so
// debris has room to fly and fade before reaching any edge. Kept modest
// (rather than e.g. 2x+) so it stays inside the stage's own overflow:hidden
// bounds on narrower viewports instead of just moving the hard clip edge
// further out.
const CANVAS_OVERFLOW = 1.6

export function HitParticles({ ref, reducedMotion }: HitParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  // boxW/boxH: the creature's own box (what xFrac/yFrac are relative to).
  // canvasW/canvasH: the larger particle surface. offsetX/offsetY: where the
  // box sits within that surface (so box-relative coords can be recentred).
  const sizeRef = useRef({
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
    if (!canvas) return
    const container = canvas.parentElement
    if (!container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const canvasW = rect.width * CANVAS_OVERFLOW
      const canvasH = rect.height * CANVAS_OVERFLOW
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
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const ensureLoop = () => {
    if (rafRef.current != null) return
    const step = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) {
        rafRef.current = null
        return
      }
      const { canvasW, canvasH, dpr } = sizeRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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
        if (edgeFade <= 0) continue // dissolved into the fade zone, not clipped by an edge

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
  }

  useImperativeHandle(
    ref,
    () => ({
      burst: (xFrac, yFrac, big) => {
        const { boxW, boxH, canvasW, canvasH, offsetX, offsetY } = sizeRef.current
        if (boxW === 0 || boxH === 0) return
        // xFrac/yFrac are relative to the creature's own box; recentre into
        // the larger canvas, which is offset symmetrically around that box.
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
    [reducedMotion],
  )

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    // left/top/width/height are set imperatively in resize() above — the
    // canvas is intentionally larger than this element's own box and
    // centred over it, so it isn't sized via CSS percentages here.
    <canvas ref={canvasRef} style={{ position: 'absolute', pointerEvents: 'none' }} />
  )
}
