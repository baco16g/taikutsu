import { useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { blobPointsToPath } from './shapeMath'
import { CENTER, VIEW_SIZE, type Hp } from './shapeStates'
import { COLLAPSE_HOLES } from './collapseHoles'
import { TextureFilters, TextureGradients, TextureLayer } from './textures'
import { useCreatureAnimation, type ImpactInfo } from './useCreatureAnimation'
import { HitParticles, type HitParticlesHandle } from './HitParticles'
import styles from './TaikutsuCreature.module.css'

export interface TaikutsuCreatureHandle {
  attack: () => boolean
  reset: () => void
  setHp: (hp: Hp) => void
  getHp: () => Hp
  isAttacking: () => boolean
}

export interface TaikutsuCreatureProps {
  idleEnabled: boolean
  reducedMotion: boolean
  /** A fixed pixel number, or any CSS width (e.g. "100%") to fill a responsively-sized parent — height always follows via aspect-ratio, since the body is always square. */
  size?: number | string
  onHpChange?: (hp: Hp) => void
  ref?: React.Ref<TaikutsuCreatureHandle>
}

export function TaikutsuCreature({
  idleEnabled,
  reducedMotion,
  size = 320,
  onHpChange,
  ref,
}: TaikutsuCreatureProps) {
  const idPrefix = useId().replace(/[:]/g, '')
  const [hp, setHp] = useState<Hp>(5)
  const particlesRef = useRef<HitParticlesHandle>(null)

  const handleImpact = (impact: ImpactInfo) => {
    particlesRef.current?.burst(impact.xFrac, impact.yFrac, impact.big)
  }

  const handleRestingShapeChange = (nextHp: Hp) => {
    setHp(nextHp)
    onHpChange?.(nextHp)
  }

  const anim = useCreatureAnimation({
    idleEnabled,
    reducedMotion,
    onImpact: handleImpact,
    onRestingShapeChange: handleRestingShapeChange,
  })

  useImperativeHandle(
    ref,
    () => ({
      attack: () => {
        if (hp === 0) return false
        return anim.attack((hp - 1) as Hp)
      },
      reset: () => {
        particlesRef.current?.clear()
        anim.setHpImmediate(5)
      },
      setHp: (nextHp: Hp) => {
        particlesRef.current?.clear()
        anim.setHpImmediate(nextHp)
      },
      getHp: () => hp,
      isAttacking: () => anim.isAttacking(),
    }),
    [anim, hp],
  )

  const initialPathD = useMemo(
    () =>
      blobPointsToPath(
        Array.from({ length: 14 }, (_, i) => ({ angle: (i / 14) * 360, radius: 98 })),
        CENTER,
        CENTER,
      ),
    [],
  )

  const clipId = `${idPrefix}-clip`
  const collapseMaskId = `${idPrefix}-collapse-mask`

  return (
    <div
      className={styles.root}
      style={{ width: size, aspectRatio: '1' }}
      onPointerEnter={() => anim.setHovered(true)}
      onPointerLeave={() => anim.setHovered(false)}
    >
      <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className={styles.svg} aria-hidden="true">
        <defs>
          <TextureFilters idPrefix={idPrefix} />
          <TextureGradients idPrefix={idPrefix} size={VIEW_SIZE} />
          <clipPath id={clipId}>
            <path ref={anim.clipPathRef} d={initialPathD} />
          </clipPath>
          {/* Always present (not just at HP0) so the final-blow timeline can
              animate it straight away. At rest every circle has r=0, so it
              has no visual effect until an attack drives it. */}
          <mask
            id={collapseMaskId}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={VIEW_SIZE}
            height={VIEW_SIZE}
          >
            <rect x={0} y={0} width={VIEW_SIZE} height={VIEW_SIZE} fill="#fff" />
            <g ref={anim.collapseGroupRef}>
              {COLLAPSE_HOLES.map((h, i) => (
                <circle key={i} cx={h.cx} cy={h.cy} r={0} fill="#000" />
              ))}
            </g>
          </mask>
        </defs>

        <g ref={anim.floatGroupRef} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          <g ref={anim.visibilityGroupRef} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
            <ellipse className={styles.shadow} cx={CENTER} cy={VIEW_SIZE - 28} rx={64} ry={14} />
            <g ref={anim.squashGroupRef} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
              <g clipPath={`url(#${clipId})`}>
                <g mask={`url(#${collapseMaskId})`}>
                  <TextureLayer
                    idPrefix={idPrefix}
                    size={VIEW_SIZE}
                    driftRefA={anim.driftRefA}
                    driftRefB={anim.driftRefB}
                  />
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
      <HitParticles ref={particlesRef} reducedMotion={reducedMotion} />
    </div>
  )
}
