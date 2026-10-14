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
  /** 唯一の位置/サイズ用ラッパー——useIntroPhaseが毎フレームtransform/widthを設定する。戦闘開始後はCommandMenuの`targetRef`も兼ねる。 */
  wrapperRef: Ref<HTMLDivElement>
  /** revealマスクの円のグループ——useIntroPhaseがformation中にこれらを成長させる（GSAP、r: 0 → MAX_SEED_RADIUS）。formation完了後は最大半径のまま残る（マスク自体は下で無効化）。 */
  maskCirclesRef: Ref<SVGGElement>
  creatureRef: Ref<TaikutsuCreatureHandle>
  reducedMotion: boolean
  /** アイドル時の呼吸/浮遊アニメーションを動かすかどうか——ギャラリー表示中など、タ・イクツ自身が他のコンテンツに覆われて見えていない間は、呼び出し元がfalseにして無駄な計算・DOM更新を止める。 */
  idleEnabled: boolean
  onHpChange: (hp: Hp) => void
  /** revealマスクをまだ適用すべきかどうか——formation完了後は外され、以降セッションが続く間マスク合成のコストが一切かからなくなる。 */
  maskActive: boolean
  /** arrivalが実際に再生中の間だけdust用canvasをマウントする。 */
  showDust: boolean
  dustProgressRef: RefObject<number>
}

/**
 * タ・イクツの唯一の永続インスタンス、intro/battle両フェーズで共有される
 * （useIntroPhase参照）——一度マウントされたら再マウントされることはない。
 * 本体を囲む独立した2層構造:
 * - 外側の位置/サイズ用ラッパー（素のtransform/width、外部から設定される）
 * - 内側のrevealレイヤー（下のSVGマスクを参照するCSS mask）
 * どちらもTaikutsuCreature自身の内部transform（呼吸/float/squashは全て
 * 自身の<g>要素内に留まる）には一切触れないため、「どこにいるか」と
 * 「どう呼吸しているか」の間でtransformが衝突することはない。
 */
export function IntroActor({
  wrapperRef,
  maskCirclesRef,
  creatureRef,
  reducedMotion,
  idleEnabled,
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
          idleEnabled={idleEnabled}
          reducedMotion={reducedMotion}
          size="100%"
          onHpChange={onHpChange}
        />
      </div>
      {/* マスクはTaikutsuCreature自身の<svg>の中ではなく、ほぼサイズ0の
          専用SVGに存在する——本体自身のマークアップ/マスク（collapseMaskId、
          撃破時専用）はこの外側のrevealマスクから一切影響を受けない。 */}
      <svg className={styles.maskDefs} aria-hidden="true">
        <defs>
          {/* シード円の硬い輪郭を和らげ、スタンプで押したようなコインの
              見た目ではなく粒状で集まってくる質感にする——
              primitiveUnitsはマスク自身のobjectBoundingBoxに合わせて
              あるので、実際のレンダリングサイズに関わらずstdDeviationは
              ボックスに対する小さな割合のままになる。 */}
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
