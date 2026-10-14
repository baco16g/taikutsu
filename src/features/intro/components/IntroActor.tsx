import { useId, type Ref, type RefObject } from 'react'
import {
  TaikutsuCreature,
  type TaikutsuCreatureHandle,
} from '../../taikutsu/components/TaikutsuCreature'
import type { Hp } from '../../taikutsu/lib/shapeStates'
import { INTRO_SEEDS } from '../data/introSeeds'
import { ArrivalDust } from './ArrivalDust'
import styles from './IntroActor.module.css'

export interface IntroActorProps {
  /** The single position/size wrapper — useIntroPhase sets its transform/width every frame; also doubles as CommandMenu's `targetRef` once battle begins. */
  wrapperRef: Ref<HTMLDivElement>
  /** Group of reveal-mask circles — useIntroPhase grows these (GSAP, r: 0 → MAX_SEED_RADIUS) during formation. Left at full radius (mask removed below) for the rest of the creature's life. */
  maskCirclesRef: Ref<SVGGElement>
  creatureRef: Ref<TaikutsuCreatureHandle>
  reducedMotion: boolean
  onHpChange: (hp: Hp) => void
  /** Whether the reveal mask should still be applied at all — removed once formation completes, so there's zero ongoing mask-compositing cost for the rest of the session. */
  maskActive: boolean
  /** Mount the dust canvas only while arrival is actually playing. */
  showDust: boolean
  dustProgressRef: RefObject<number>
}

/**
 * タ・イクツ's single persistent instance, shared across the intro and
 * battle phases (see useIntroPhase) — mounted once, never remounted. Two
 * independent layers around the body:
 * - an outer position/size wrapper (plain transform/width, set externally)
 * - an inner reveal layer (CSS mask referencing the SVG mask below)
 * Neither ever touches TaikutsuCreature's own internal transforms
 * (breathing/float/squash all stay inside its own <g> elements), so there's
 * no transform collision between "where it is" and "how it's breathing".
 */
export function IntroActor({
  wrapperRef,
  maskCirclesRef,
  creatureRef,
  reducedMotion,
  onHpChange,
  maskActive,
  showDust,
  dustProgressRef,
}: IntroActorProps) {
  const idPrefix = useId().replace(/[:]/g, '')
  const maskId = `${idPrefix}-intro-reveal`
  const blurId = `${idPrefix}-intro-reveal-blur`

  return (
    <div className={styles.root} ref={wrapperRef}>
      {showDust && <ArrivalDust progressRef={dustProgressRef} />}
      <div
        className={styles.reveal}
        style={
          maskActive
            ? { maskImage: `url(#${maskId})`, WebkitMaskImage: `url(#${maskId})` }
            : undefined
        }
      >
        <TaikutsuCreature
          ref={creatureRef}
          idleEnabled
          reducedMotion={reducedMotion}
          size="100%"
          onHpChange={onHpChange}
        />
      </div>
      {/* Mask lives in its own near-zero-size SVG, not inside TaikutsuCreature's
          own <svg> — the body's own markup/mask (collapseMaskId, defeat-only)
          stays untouched by this outer reveal mask. */}
      <svg className={styles.maskDefs} aria-hidden="true">
        <defs>
          {/* Softens the seed circles' hard edges into a grainy, coalescing
              feel instead of a stamped-coin look — primitiveUnits matches
              the mask's own objectBoundingBox so stdDeviation stays a tiny
              fraction of the box regardless of its actual rendered size. */}
          <filter
            id={blurId}
            primitiveUnits="objectBoundingBox"
            x="-0.3"
            y="-0.3"
            width="1.6"
            height="1.6"
          >
            <feGaussianBlur stdDeviation="0.012" />
          </filter>
          <mask id={maskId} maskContentUnits="objectBoundingBox">
            <g ref={maskCirclesRef} filter={`url(#${blurId})`}>
              {INTRO_SEEDS.map((seed, i) => (
                <circle key={i} cx={seed.x} cy={seed.y} r={0} fill="#fff" />
              ))}
            </g>
          </mask>
        </defs>
      </svg>
    </div>
  )
}
