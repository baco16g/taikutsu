import { useEffect, useMemo, useRef } from 'react'
import { INTRO_SEEDS } from './introSeeds'
import styles from './ArrivalDust.module.css'

/**
 * Small dark grains flying in from around タ・イクツ's own box toward the
 * same seed points IntroActor's reveal mask grows from — purely decorative,
 * independent canvas built on the same pattern as
 * src/features/taikutsu/HitParticles.tsx (canvas sized off its own parent
 * via ResizeObserver, DPR-aware, oversized so nothing clips at a hard
 * rectangular edge — see CANVAS_OVERFLOW below), but with its own one-shot
 * "coalesce toward a point" motion instead of HitParticles' decaying
 * outward burst. Mounted only while the intro's arrival phase is live; the
 * parent unmounting it is what stops it (no internal lifecycle beyond that).
 */

const CANVAS_OVERFLOW = 1.5
const PARTICLE_COUNT = 70
const TRAVEL_SPAN = 0.7 // fraction of total progress each particle's own flight takes
const DOT_COLOR = '#202022'

interface Particle {
  angle: number
  distance: number // fraction of the box's own half-size, start radius
  targetIndex: number
  delay: number // 0..(1-TRAVEL_SPAN), when this particle's own flight begins
  size: number
  curve: number
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export interface ArrivalDustProps {
  /** 0..1 formation progress, mutated every frame by useIntroPhase's GSAP tween — polled here rather than passed as a prop so this canvas's own rAF loop (required for drawing) isn't gated behind React's render cycle. */
  progressRef: React.RefObject<number>
}

export function ArrivalDust({ progressRef }: ArrivalDustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef({ width: 0, height: 0 })
  const rafRef = useRef<number | null>(null)

  const particles = useMemo<Particle[]>(() => {
    let state = 1
    const rand = () => {
      // Local LCG, independent of introSeeds' own PRNG instance — only
      // needs to look plausibly scattered, not match any other sequence.
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return (state % 10000) / 10000
    }
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      angle: rand() * Math.PI * 2,
      distance: 0.55 + rand() * 0.5,
      targetIndex: i % INTRO_SEEDS.length,
      delay: rand() * (1 - TRAVEL_SPAN),
      size: 0.6 + rand() * 1.3,
      curve: (rand() - 0.5) * 0.22,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = rect.width * CANVAS_OVERFLOW
      const h = rect.height * CANVAS_OVERFLOW
      boxRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.style.left = `${-(w - rect.width) / 2}px`
      canvas.style.top = `${-(h - rect.height) / 2}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const { width: boxW, height: boxH } = boxRef.current
      const canvasW = canvas.width / Math.min(window.devicePixelRatio || 1, 2)
      const canvasH = canvas.height / Math.min(window.devicePixelRatio || 1, 2)
      ctx.clearRect(0, 0, canvasW, canvasH)
      const t = progressRef.current
      if (boxW === 0 || t >= 1) return
      const offsetX = (canvasW - boxW) / 2
      const offsetY = (canvasH - boxH) / 2
      const cx = offsetX + boxW / 2
      const cy = offsetY + boxH / 2
      const boxRadius = Math.min(boxW, boxH) / 2

      particles.forEach((p) => {
        const q = clamp01((t - p.delay) / TRAVEL_SPAN)
        if (q <= 0 || q >= 1) return
        const seed = INTRO_SEEDS[p.targetIndex]
        const startX = cx + Math.cos(p.angle) * boxRadius * p.distance
        const startY = cy + Math.sin(p.angle) * boxRadius * p.distance
        const targetX = offsetX + seed.x * boxW
        const targetY = offsetY + seed.y * boxH
        const travel = ease(q)
        const bend = Math.sin(q * Math.PI) * p.curve * boxRadius
        const x = mix(startX, targetX, travel) + Math.sin(p.angle) * bend
        const y = mix(startY, targetY, travel) - Math.cos(p.angle) * bend
        ctx.globalAlpha = Math.sin(q * Math.PI) * 0.75
        ctx.fillStyle = DOT_COLOR
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
    }
    draw()

    return () => {
      ro.disconnect()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [particles, progressRef])

  return <canvas ref={canvasRef} className={styles.dust} aria-hidden="true" />
}
