import type { ReactNode, Ref } from 'react'
import clsx from 'clsx'
import styles from './WorldFrame.module.css'

/**
 * アプリ全体の「世界」の枠組み——App Canvasと、スクリーントーン/装飾を
 * 伴うBroken Frame World Container。HomePageへ直接埋め込まずに独立した
 * コンポーネントにしているのは、枠のジオメトリやスクリーントーンの
 * どれも、実際には包んでいるintro/battle/galleryのコンテンツ自体とは
 * 無関係だから。ここに「ない」もの: World Container内でコンテンツを
 * どう配置するか——それは`children`と`className`を通して完全に
 * 呼び出し側のCSSの責任になっている。intro/battle/galleryの各フェーズは
 * それぞれ異なる形でコンテンツをアンカーするため（introの2カラムグリッド、
 * タ・イクツ+コマンドの絶対配置アンカー、中央寄せのギャラリー）。
 */
function WorldDecoration({ thin }: { thin: boolean }) {
  return (
    <div className={clsx(styles.worldDeco, thin && styles.worldDecoThin)} aria-hidden="true">
      <div className={styles.worldSurface} />
      <div className={styles.frameTop} />
      <div className={styles.frameLeft} />
      <div className={styles.frameRight} />
      <div className={styles.frameBottom} />
      <div className={clsx(styles.tone, styles.toneFine)} />
      <div className={clsx(styles.tone, styles.toneMedium)} />
      <div className={clsx(styles.tone, styles.toneDense)} />
      <div className={clsx(styles.slash, styles.slashMain)} />
    </div>
  )
}

export interface WorldFrameProps {
  /** 枠内左下の小さなタグライン——例: intro画面の背景画像に必要な
      「© OpenStreetMap contributors」のクレジット表示（ODbLの要求で、
      この派生画像を表示している間は常に見える状態を保つ必要がある。
      残りの経緯はIntroScreen.module.cssのintro背景レイヤーに関する
      コメント参照）。 */
  note?: ReactNode
  /** <main>の外側、ビューポートに固定して描画される——例: サウンドトグル。 */
  cornerExtra?: ReactNode
  /** 自分自身のコンテンツこそが最も目立つべき画面向けに、共通の枠装飾を控えめにする（mainのslashを縮小し、スクリーントーンの不透明度を下げる）。デフォルトは'normal'。 */
  decorationStrength?: 'normal' | 'thin'
  /** World Container自体に付与する追加クラス。画面ごとのコンテンツ配置CSSが使うフック用（例: 中央寄せレイアウトか絶対配置レイアウトかで異なる最大幅・paddingを指定する等）。 */
  className?: string
  /** World Container自体へのref——例えば自身の位置/サイズを計測する必要がある画面向け（battle→galleryのreveal遷移はこれを読み、覆い隠すレイヤーを枠の現在の上端にアンカーする）。 */
  worldContainerRef?: Ref<HTMLDivElement>
  children: ReactNode
}

export function WorldFrame({
  note,
  cornerExtra,
  decorationStrength = 'normal',
  className,
  worldContainerRef,
  children,
}: WorldFrameProps) {
  return (
    <div className={styles.page}>
      {cornerExtra}

      {/* クラスではなくdata-scroll-root: RevealTransitionは別の
          コンポーネントツリーからこの要素を探し、battle→gallery遷移中に
          スクロールをロックする——この要素自身の（CSS Modulesで
          ハッシュ化された）クラスとは独立した構造的なフック。 */}
      <main className={styles.outer} data-scroll-root>
        <div ref={worldContainerRef} className={clsx(styles.worldContainer, className)}>
          <WorldDecoration thin={decorationStrength === 'thin'} />

          {children}

          {note && <div className={styles.worldNote}>{note}</div>}
        </div>
      </main>
    </div>
  )
}
