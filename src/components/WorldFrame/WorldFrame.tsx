import type { ReactNode, Ref } from 'react'
import clsx from 'clsx'
import styles from './WorldFrame.module.css'

/**
 * The app-wide "world" chrome — App Canvas and the Broken Frame World
 * Container with its screentone/decoration. Kept as its own component
 * (rather than inlined into HomePage) because none of it — frame geometry,
 * screentone — is actually about the intro, battle, or gallery content it
 * wraps. What's NOT here: where content goes inside the World Container —
 * that's entirely the caller's own CSS via `children` and `className`,
 * since the intro, battle, and gallery phases each anchor their content
 * differently (a 2-column intro grid vs. タ・イクツ+command's absolute
 * anchors vs. a centered gallery).
 */
function WorldDecoration({ thin }: { thin: boolean }) {
  return (
    <div className={clsx(styles.worldDeco, thin && styles.worldDecoThin)} aria-hidden="true">
      <div className={styles.worldSurface} />
      <div className={styles.frameTop} />
      <div className={styles.frameLeft} />
      <div className={styles.frameRight} />
      <div className={styles.frameBottom} />
      <div className={styles.frameCut} />
      <div className={styles.frameCutSecondary} />
      <div className={clsx(styles.tone, styles.toneFine)} />
      <div className={clsx(styles.tone, styles.toneMedium)} />
      <div className={clsx(styles.tone, styles.toneDense)} />
      <div className={clsx(styles.slash, styles.slashMain)} />
      <div className={clsx(styles.slash, styles.slashEcho)} />
      <div className={styles.horizon} />
    </div>
  )
}

export interface WorldFrameProps {
  /** Bottom-left small tagline inside the frame — e.g. the intro screen's
      required "© OpenStreetMap contributors" credit for its background
      image (ODbL requires this stay visible whenever that derived imagery
      shows; see HomePage.module.css's comment on the intro background
      layer for the rest of that story). */
  note?: ReactNode
  /** Rendered outside <main>, fixed to the viewport — e.g. the sound toggle. */
  cornerExtra?: ReactNode
  /** A debug/verification sidebar, rendered as a sibling of <main> (the dark dev panel). Omit to leave it out entirely. The sidebar itself is a fixed overlay (out of flow), so its DOM presence can toggle freely (e.g. only while open) without affecting this. */
  sidebar?: ReactNode
  /** Whether this route has a debug sidebar at all — independent of whether it's currently open or closed. Reserves permanent right-side room on desktop so opening/closing `sidebar` never shifts the content, and the fixed-position panel never overlaps it. Pass `true` whenever `sidebar` may render, even while it's closed; omit if this screen never has one. */
  hasSidebar?: boolean
  /** Thins out the shared frame decoration (hides the horizon line and echo slash, shrinks the main slash, lowers the screentone opacity) for a screen whose own content should be the loudest thing visible. Default 'normal'. */
  decorationStrength?: 'normal' | 'thin'
  /** Extra class on the World Container itself, for a screen's own content-positioning CSS to hook into (e.g. a specific max-width or padding for a centered layout vs. an absolutely-positioned one). */
  className?: string
  /** Ref to the World Container itself — e.g. for a screen that needs to measure its own position/size (the battle→gallery reveal transition reads this to anchor its cover layer to the frame's current top edge). */
  worldContainerRef?: Ref<HTMLDivElement>
  children: ReactNode
}

export function WorldFrame({
  note,
  cornerExtra,
  sidebar,
  hasSidebar,
  decorationStrength = 'normal',
  className,
  worldContainerRef,
  children,
}: WorldFrameProps) {
  return (
    <div className={clsx(styles.page, hasSidebar && styles.pageHasSidebar)}>
      {cornerExtra}

      {/* data-scroll-root, not a class: RevealTransition looks up this
          element from a different component tree to lock scrolling during
          the battle→gallery transition — a structural hook, independent of
          whatever this element's own (CSS-Modules-hashed) class is. */}
      <main className={styles.outer} data-scroll-root>
        <div ref={worldContainerRef} className={clsx(styles.worldContainer, className)}>
          <WorldDecoration thin={decorationStrength === 'thin'} />

          {children}

          {note && <div className={styles.worldNote}>{note}</div>}
        </div>
      </main>

      {sidebar}
    </div>
  )
}
