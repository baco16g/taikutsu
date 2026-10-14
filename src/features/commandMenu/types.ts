import type { Icon } from '@phosphor-icons/react'

export interface MoveEntry {
  id: string
  name: string
  shortDescription: string
  icon: Icon
}

/** 外部向けのコマンドメニューイベント全てが共有するペイロード。 */
export interface CommandMoveEvent {
  moveId: string
  moveName: string
  /** 現在表示されている6つのコマンド内での位置（0〜5）。 */
  slotIndex: number
  /** このセッションでこれまでに着弾した攻撃数（1始まり、今回分を含む）。 */
  attackNumber: number
}

export interface CommandMenuEvents {
  /** ホバーまたはキーボードフォーカスでカーソルがコマンド上に静止している間発火する。何もプレビューされていない時はnull。 */
  onPreviewMove?: (event: CommandMoveEvent | null) => void
  /** コマンドが確定した瞬間、攻撃アニメーションが再生される前に発火する。 */
  onAttackStart?: (event: CommandMoveEvent) => void
  /** 飛んでいくコマンドのグラフィックがターゲットに到達した時に発火する。ヒットリアクションとの連携用。 */
  onImpact?: (event: CommandMoveEvent) => void
  /** 攻撃タイムライン全体（次のコマンド一覧のrevealも含む）が落ち着いた時点で一度発火する。 */
  onAttackComplete?: (event: CommandMoveEvent) => void
  /** 5回目の攻撃のタイムラインが完了しセッションが終わった時点で発火する
   * ——呼び出し元ページへの「次へ進んでよい」という合図（仕様上は最終的に
   * ゲームギャラリーへ遷移する。CommandMenuはもうセッション完了画面を
   * 自前で描画しない）。 */
  onSessionComplete?: () => void
}
