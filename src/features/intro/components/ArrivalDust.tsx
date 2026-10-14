import { useEffect, useMemo, useRef } from 'react'
import { useOversizedCanvas } from '../../../hooks/useOversizedCanvas'
import { INTRO_SEEDS } from '../data/introSeeds'
import styles from './ArrivalDust.module.css'

/**
 * タ・イクツ自身の箱の周囲からIntroActorのrevealマスクが成長していく
 * のと同じシード点へ向かって飛んでくる、小さな暗い粒——純粋に演出用で、
 * useOversizedCanvasでサイズ計算される独立したcanvas（
 * src/features/taikutsu/components/HitParticles.tsxが使うのと同じ共有セットアップ）だが、
 * HitParticlesの減衰しながら外へ広がるバーストとは違い、こちらは
 * 「1点へ収束する」一度きりの動き。introのarrivalフェーズが生きている
 * 間だけマウントされ、親がアンマウントすることで止まる（それ以外の
 * 内部ライフサイクルはない）。
 */

const CANVAS_OVERFLOW = 1.5
const PARTICLE_COUNT = 70
const TRAVEL_SPAN = 0.7 // 全体の進捗のうち、各パーティクル自身の飛行にあてる割合
const DOT_COLOR = '#202022'

interface Particle {
  angle: number
  distance: number // 箱自身の半分のサイズに対する割合、開始半径
  targetIndex: number
  delay: number // 0..(1-TRAVEL_SPAN)、このパーティクル自身の飛行がいつ始まるか
  size: number
  curve: number
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export interface ArrivalDustProps {
  /** 0〜1のformation進捗。useIntroPhaseのGSAP tweenが毎フレーム書き換える——propsとして渡すのではなくここでポーリングしているのは、このcanvas自身のrAFループ（描画に必要）がReactのレンダーサイクルにゲートされないようにするため。 */
  progressRef: React.RefObject<number>
}

export function ArrivalDust({ progressRef }: ArrivalDustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useOversizedCanvas(canvasRef, CANVAS_OVERFLOW)
  const rafRef = useRef<number | null>(null)

  const particles = useMemo<Particle[]>(() => {
    let state = 1
    const rand = () => {
      // introSeeds自身のPRNGインスタンスとは独立したローカルLCG——
      // 何か別の系列と一致させる必要はなく、もっともらしく散らばって見えればよい。
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
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      // useOversizedCanvasがリサイズ時に既にDPRのtransformを適用済み。
      const { boxW, boxH, canvasW, canvasH, offsetX, offsetY } = sizeRef.current
      ctx.clearRect(0, 0, canvasW, canvasH)
      const t = progressRef.current
      if (boxW === 0 || t >= 1) return
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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [particles, progressRef, sizeRef])

  return <canvas ref={canvasRef} className={styles.dust} aria-hidden="true" />
}
