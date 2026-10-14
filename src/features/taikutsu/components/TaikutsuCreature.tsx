import { useId, useImperativeHandle, useMemo, useRef } from 'react'
import { blobPointsToPath } from '../lib/shapeMath'
import { CENTER, VIEW_SIZE, type Hp } from '../lib/shapeStates'
import { COLLAPSE_HOLES } from '../lib/collapseHoles'
import { useCreatureAnimation, type ImpactInfo } from '../hooks/useCreatureAnimation'
import { TextureFilters, TextureGradients, TextureLayer } from './textures'
import { HitParticles, type HitParticlesHandle } from './HitParticles'
import styles from './TaikutsuCreature.module.css'

export interface TaikutsuCreatureHandle {
  /** HPを1減らし、被弾アニメーションを再生する。前の被弾がまだ再生中なら、それを最後まで進めてから始める。撃破済みなら何もせずfalse。 */
  attack: () => boolean
  /** HP満タンの静止状態へ即座に戻す。 */
  reset: () => void
}

export interface TaikutsuCreatureProps {
  idleEnabled: boolean
  reducedMotion: boolean
  /** 固定のピクセル数、またはレスポンシブな親要素いっぱいに広がる任意のCSS幅（例: "100%"）——本体は常に正方形なので、高さは常にaspect-ratio経由で追従する。 */
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
  const particlesRef = useRef<HitParticlesHandle>(null)

  const handleImpact = (impact: ImpactInfo) => {
    particlesRef.current?.burst(impact.xFrac, impact.yFrac, impact.big)
  }

  const anim = useCreatureAnimation({
    idleEnabled,
    reducedMotion,
    onImpact: handleImpact,
    onRestingShapeChange: onHpChange,
  })

  useImperativeHandle(
    ref,
    () => ({
      attack: () => anim.attack(),
      reset: () => {
        particlesRef.current?.clear()
        anim.setHpImmediate(5)
      },
    }),
    [anim],
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
          {/* HP0の時だけでなく常に存在させておくことで、最後の一撃の
              タイムラインがすぐにこれをアニメーションできるようにしている。
              静止時は全ての円がr=0なので、攻撃が動かすまでは視覚的な影響は一切ない。 */}
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
