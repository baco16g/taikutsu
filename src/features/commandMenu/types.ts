import type { Icon } from '@phosphor-icons/react'

export interface MoveEntry {
  id: string
  name: string
  shortDescription: string
  icon: Icon
}

/** Payload shared by every outward-facing command-menu event. */
export interface CommandMoveEvent {
  moveId: string
  moveName: string
  /** Position (0-5) within the currently displayed six commands. */
  slotIndex: number
  /** 1-based count of attacks landed so far this session, including this one. */
  attackNumber: number
}

export interface CommandMenuEvents {
  /** Fired while the cursor rests on a command, via hover or keyboard focus. Null when nothing is previewed. */
  onPreviewMove?: (event: CommandMoveEvent | null) => void
  /** Fired the instant a command is confirmed, before the attack animation plays. */
  onAttackStart?: (event: CommandMoveEvent) => void
  /** Fired when the flying command graphic reaches the target, for hit-reaction integration. */
  onImpact?: (event: CommandMoveEvent) => void
  /** Fired once the full attack timeline (including the next command list reveal) has settled. */
  onAttackComplete?: (event: CommandMoveEvent) => void
  /** Fired once the 5th attack's timeline completes and the session ends —
   * the host page's cue to move on (spec: eventually navigates to the game
   * gallery; CommandMenu no longer renders a session-complete screen of its
   * own). */
  onSessionComplete?: () => void
}
