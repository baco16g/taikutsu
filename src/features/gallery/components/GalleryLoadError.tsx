import styles from './GalleryLoadError.module.css'

/**
 * ギャラリーを読み込めなかったときに、ギャラリーの代わりに表示する。見出しの
 * idはギャラリーと同じにして、画面遷移の後のフォーカスの移動先にする。
 *
 * ブラウザは、一度読み込みに失敗したモジュールをそのページの間は読み込み直さない。
 * そのため、通信が戻った場合も再デプロイでファイル名が変わった場合も、ページの
 * 再読み込みでしか直らない。
 */
export function GalleryLoadError() {
  return (
    <section className={styles.root} aria-labelledby="gallery-heading-title">
      <h1 className={styles.title} id="gallery-heading-title" tabIndex={-1}>
        ゲームの一覧を読み込めませんでした
      </h1>
      <p className={styles.body}>
        通信の状態を確かめて、ページを読み込み直してください。最初の画面からやり直しになります。
      </p>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          window.location.reload()
        }}
      >
        ページを読み込み直す
      </button>
    </section>
  )
}
