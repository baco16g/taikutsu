import type { RefObject } from 'react'
import clsx from 'clsx'
import { ArrowUpRightIcon } from '@phosphor-icons/react'
import { useCommandMenuController } from '../hooks/useCommandMenuController'
import { useCommandMenuAnimation } from '../hooks/useCommandMenuAnimation'
import { useCommandMenuInteraction } from '../hooks/useCommandMenuInteraction'
import { useCommandSound } from '../hooks/useCommandSound'
import { useSupportsHover } from '../../../hooks/useSupportsHover'
import type { LandedMove } from '../types'
import styles from './CommandMenu.module.css'

export interface CommandMenuProps {
  /** 攻撃の着弾先となる要素（タ・イクツ本体のラッパー）。 */
  targetRef: RefObject<HTMLElement | null>
  soundEnabled: boolean
  reducedMotion: boolean
  /** 攻撃のアイコンがタ・イクツに届いた瞬間に、使ったスキルとともに呼ばれる。 */
  onImpact: (move: LandedMove) => void
}

export function CommandMenu({
  targetRef,
  soundEnabled,
  reducedMotion,
  onImpact,
}: CommandMenuProps) {
  const controller = useCommandMenuController()
  const { status, currentMoves, reroll } = controller
  const sound = useCommandSound(soundEnabled)
  const supportsHover = useSupportsHover()
  const anim = useCommandMenuAnimation({ idlePulseActive: status === 'active' && !reducedMotion })
  const {
    cursorIndex,
    isAttacking,
    previewIndex,
    handleRowActivate,
    handleListKeyDown,
    handleListPointerMove,
  } = useCommandMenuInteraction({
    controller,
    anim,
    sound,
    reducedMotion,
    supportsHover,
    targetRef,
    onImpact,
  })

  return (
    <div className={clsx(styles.root, isAttacking && styles.isAttacking)} ref={anim.rootRef}>
      {/* ここに攻撃回数の表示はない — タ・イクツ自身のHPゲージ
          （BattleStatus）が「残り何回の攻撃か」を示す唯一の場所。 */}
      <header className={styles.zoneHeader}>
        <h2 className={styles.zoneTitle}>SKILL</h2>
      </header>

      {/* 'complete'でもアンマウントしない（5回目のヒットは
          useCommandMenuControllerのcommitAttackが示す通りcurrentMovesを
          空にせずstatusだけ切り替えるため、ここには常に表示すべき
          実在の6つがある）。以下の各ハンドラは全てstatus !== 'active'で
          no-opになるので、最後の6つを残すのは見た目上の演出に過ぎず、
          新たに操作可能な死んだUIが残るわけではない。 */}
      <div className={styles.listWrap} ref={anim.listWrapRef}>
        {/* 破れた紙のようなギザギザのband（clip-pathのpolygon）—
            行自体の左右端からはみ出して描画される。行ごとに1枚ではなく、
            GSAPで行間をグライドする共有要素1枚。 */}
        <div className={styles.band} ref={anim.bandRef} aria-hidden="true">
          {/* アイドル時の明滅。band自体とは別のGSAPターゲットにしている理由は
              useCommandMenuAnimationのbandPulseRefを参照。 */}
          <div className={styles.bandPulse} ref={anim.bandPulseRef} />
        </div>

        <ul
          className={styles.list}
          aria-label="スキルコマンド"
          onKeyDown={handleListKeyDown}
          onPointerMove={handleListPointerMove}
        >
          {currentMoves.map((move, i) => {
            const MoveIcon = move.icon
            const isActive = cursorIndex === i
            return (
              <li key={move.id} className={styles.item}>
                <span className={styles.divider} aria-hidden="true" />
                <button
                  type="button"
                  ref={(el) => {
                    anim.itemElsRef.current[i] = el
                  }}
                  className={clsx(styles.cmd, isActive && styles.isActive)}
                  tabIndex={isActive ? 0 : -1}
                  aria-current={isActive || undefined}
                  disabled={isAttacking || status !== 'active'}
                  onMouseEnter={() => previewIndex(i, true)}
                  onFocus={() => previewIndex(i)}
                  onClick={() => handleRowActivate(i)}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <MoveIcon
                    ref={(el) => {
                      anim.iconElsRef.current[i] = el
                    }}
                    className={styles.icon}
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                  />
                  <span className={styles.text}>
                    <span className={styles.name}>{move.name}</span>
                    <span className={styles.desc}>{move.shortDescription}</span>
                  </span>
                  <ArrowUpRightIcon
                    className={styles.caret}
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.reroll}
          onClick={reroll}
          disabled={isAttacking || status !== 'active'}
        >
          ほかのスキルを見る
        </button>
      </div>

      <div className={styles.fxLayer} ref={anim.fxLayerRef} aria-hidden="true" />
    </div>
  )
}
