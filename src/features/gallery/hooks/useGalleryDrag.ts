import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import styles from '../components/GalleryCarousel.module.css'

gsap.registerPlugin(Draggable)

export interface UseGalleryDragOptions {
  disabled: boolean
  reducedMotion: boolean
  /** リリースを「タップ」ではなく「ページ送り」とみなすために必要な、トラックの最低移動量（px）。 */
  thresholdPx: number
  onCommit: (direction: -1 | 0 | 1) => void
}

/**
 * GSAP Draggableをカードトラックへ直接バインドする: トラックをドラッグ
 * すること自体がカルーセルの移動なので、手動のオフセット管理は不要——
 * Draggableがポインタの動きに合わせてトラックのxをライブに設定して
 * くれる。このhookが決めているのは、リリース時にドラッグがページ送りの
 * しきい値を超えたかどうかと、どちらの場合もトラックを0へ戻すことだけ。
 *
 * 実際のドラッグ（数px以上）の直後だけ短い間trueを返すrefを返す。これに
 * より、カードのクリックハンドラがドラッグのリリースと本物のタップを
 * 区別でき、誤って販売ページのリンクを開いてしまうことを防げる。
 */
export function useGalleryDrag(
  trackRef: RefObject<HTMLElement | null>,
  options: UseGalleryDragOptions,
) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const justDraggedRef = useRef(false)

  useEffect(() => {
    const el = trackRef.current
    if (!el || options.disabled) return

    let maxDistance = 0
    let clearTimer: number | undefined

    const [draggable] = Draggable.create(el, {
      type: 'x',
      dragClickables: true,
      allowContextMenu: true,
      onPress() {
        window.clearTimeout(clearTimer)
        gsap.killTweensOf(el)
        maxDistance = 0
        el.classList.add(styles.isDragging)
      },
      onDrag(this: Draggable) {
        maxDistance = Math.max(maxDistance, Math.abs(this.x))
      },
      // ドラッグかどうかに関わらずリリースのたびに発火する——drag時のみの
      // onDragEndとは違い、これにより単なるクリックでもgrabbingカーソルが必ず解除される。
      onRelease() {
        el.classList.remove(styles.isDragging)
      },
      onDragEnd(this: Draggable) {
        const finalX = this.x
        const threshold = optionsRef.current.thresholdPx
        const direction: -1 | 0 | 1 = finalX <= -threshold ? 1 : finalX >= threshold ? -1 : 0

        justDraggedRef.current = maxDistance > 4
        if (justDraggedRef.current) {
          clearTimer = window.setTimeout(() => {
            justDraggedRef.current = false
          }, 300)
        }

        if (optionsRef.current.reducedMotion) {
          gsap.set(el, { x: 0 })
        } else {
          gsap.to(el, { x: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
        }
        optionsRef.current.onCommit(direction)
      },
    })

    return () => {
      window.clearTimeout(clearTimer)
      draggable.kill()
    }
  }, [trackRef, options.disabled, options.thresholdPx])

  return justDraggedRef
}
