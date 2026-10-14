import clsx from 'clsx'
import styles from './DefeatMessage.module.css'

export interface DefeatMessageProps {
  reducedMotion: boolean
}

/** Settled fragment positions, loosely tracing where タ・イクツ broke apart
 * (left/lower area of the World Container, roughly where BattleStatus
 * sits) — reuses HitParticles' shard shape language (solid
 * square/triangle/diamond) but as a fixed decorative scatter, not a
 * continuation of that live burst: by the time this screen is readable,
 * the real particle animation has already fully decayed. */
interface Shard {
  left: number
  top: number
  size: number
  rotate: number
  opacity: number
  shape: 'sq' | 'tri' | 'dia'
}

const SHARDS: Shard[] = [
  { left: 5, top: 22, size: 10, rotate: 24, opacity: 0.55, shape: 'tri' },
  { left: 11, top: 68, size: 14, rotate: -18, opacity: 0.75, shape: 'dia' },
  { left: 3, top: 46, size: 7, rotate: 50, opacity: 0.5, shape: 'sq' },
  { left: 18, top: 15, size: 9, rotate: -40, opacity: 0.6, shape: 'dia' },
  { left: 23, top: 78, size: 12, rotate: 10, opacity: 0.65, shape: 'tri' },
  { left: 8, top: 85, size: 8, rotate: 70, opacity: 0.45, shape: 'sq' },
  { left: 28, top: 32, size: 16, rotate: -8, opacity: 0.8, shape: 'dia' },
  { left: 15, top: 55, size: 6, rotate: 35, opacity: 0.4, shape: 'sq' },
  { left: 33, top: 60, size: 10, rotate: -55, opacity: 0.55, shape: 'tri' },
  { left: 2, top: 70, size: 11, rotate: 15, opacity: 0.6, shape: 'dia' },
  { left: 38, top: 20, size: 7, rotate: 60, opacity: 0.4, shape: 'sq' },
  { left: 20, top: 90, size: 13, rotate: -22, opacity: 0.5, shape: 'tri' },
  { left: 42, top: 44, size: 8, rotate: 5, opacity: 0.35, shape: 'dia' },
  { left: 6, top: 10, size: 6, rotate: -45, opacity: 0.45, shape: 'sq' },
  { left: 25, top: 8, size: 9, rotate: 30, opacity: 0.5, shape: 'tri' },
  { left: 48, top: 72, size: 7, rotate: -15, opacity: 0.3, shape: 'sq' },
  { left: 12, top: 36, size: 5, rotate: 80, opacity: 0.4, shape: 'dia' },
  { left: 30, top: 85, size: 6, rotate: -60, opacity: 0.35, shape: 'tri' },
]

const SHARD_SHAPE_CLASS: Record<Shard['shape'], string | undefined> = {
  sq: undefined,
  tri: styles.shardTri,
  dia: styles.shardDia,
}

function DebrisField() {
  return (
    <div className={styles.debris} aria-hidden="true">
      {SHARDS.map((s, i) => (
        <span
          key={i}
          className={clsx(styles.shard, SHARD_SHAPE_CLASS[s.shape])}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            transform: `rotate(${s.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * The beat between タ・イクツ's defeat and the gallery reveal starting —
 * purely the debris scatter, no heading. The gallery screen owns the
 * "defeated/next game" copy on its own (larger) heading a moment later;
 * repeating it here would read the same sentence twice.
 */
export function DefeatMessage({ reducedMotion }: DefeatMessageProps) {
  return (
    <div className={clsx(styles.root, reducedMotion && styles.isReducedMotion)}>
      <DebrisField />
    </div>
  )
}
