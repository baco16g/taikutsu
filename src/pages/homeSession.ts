import type { IntroPhase } from '../features/intro/hooks/useIntroPhase'

/**
 * イントロの後、タ・イクツを倒してからギャラリーを操作できるようになるまでの
 * 進行段階。イントロ内のフェーズ（登場〜戦闘位置への移動）はuseIntroPhaseが持つ。
 *
 * - `undefeated`: まだ倒していない（イントロ中も含む）
 * - `defeated`: 倒した。破片を見せながらDEFEAT_HOLD_MSだけ待つ
 * - `covering`: 画面遷移のシートが戦闘画面を覆っていく
 * - `uncovering`: 覆った裏でギャラリーに差し替え済み。シートが外れていく
 * - `gallery`: ギャラリーを操作できる
 */
export type SessionStage = 'undefeated' | 'defeated' | 'covering' | 'uncovering' | 'gallery'

/** 撃破の破片を見せてから、画面遷移のシートが覆い始めるまでの時間。 */
export const DEFEAT_HOLD_MS = 800

export const ANNOUNCEMENTS = {
  appeared: 'タ・イクツが現れました。スキルを選んでください。',
  defeated: 'タ・イクツを倒した。退屈の向こうに、まだ知らない遊びがある。',
  galleryShown: 'タ・イクツを撃破しました。ゲームギャラリーを表示しています。',
}

export interface SessionView {
  showIntro: boolean
  /** 戦闘画面とギャラリーを入れるセクション。イントロからの移動が始まると表示される。 */
  showBattleSection: boolean
  showGallery: boolean
  /** 操作を受け付けない（inert）状態にするか。 */
  introInert: boolean
  battleInert: boolean
  defeated: boolean
  revealActive: boolean
  /** スクリーンリーダー向けに読み上げる現在の状況。 */
  announcement: string
}

/** イントロのフェーズと進行段階から、どの画面を表示し何を読み上げるかを決める。 */
export function deriveSessionView(introPhase: IntroPhase, stage: SessionStage): SessionView {
  const revealActive = stage === 'covering' || stage === 'uncovering'
  return {
    showIntro: introPhase === 'arrival' || introPhase === 'ready' || introPhase === 'depart',
    showBattleSection:
      introPhase === 'moving' || introPhase === 'settling' || introPhase === 'battle',
    showGallery: stage === 'uncovering' || stage === 'gallery',
    introInert: introPhase !== 'arrival' && introPhase !== 'ready',
    battleInert: introPhase !== 'battle' || revealActive,
    defeated: stage !== 'undefeated',
    revealActive,
    announcement: announcementFor(introPhase, stage),
  }
}

function announcementFor(introPhase: IntroPhase, stage: SessionStage): string {
  switch (stage) {
    case 'undefeated':
      return introPhase === 'battle' ? ANNOUNCEMENTS.appeared : ''
    case 'defeated':
    case 'covering':
    case 'uncovering':
      return ANNOUNCEMENTS.defeated
    case 'gallery':
      return ANNOUNCEMENTS.galleryShown
  }
}
