import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import styles from '../components/GalleryCarousel.module.css'

gsap.registerPlugin(Draggable)

export interface UseGalleryDragOptions {
  disabled: boolean
  /** リリースを「タップ」ではなく「ページ送り」とみなすために必要な、トラックの最低移動量（px）。 */
  thresholdPx: number
  onCommit: (direction: -1 | 0 | 1) => void
}

/**
 * スワイプのジェスチャー判定だけをトラックに後付けする: 実際にドラッグ
 * されるのは画面外に浮かせた不可視のプロキシ要素で、GSAP
 * Draggableの`trigger`オプション経由でトラック上のポインタ操作を拾い、
 * その位置（`this.x`）だけをしきい値判定に使う。トラック自身（＝今
 * 表示されているカード）はドラッグ中も指に追従して動かない——動くのは
 * リリース後、選択indexが変わったことで各カードがリング上の新しい
 * 位置へ遷移する、見慣れたカルーセル遷移だけ。
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

    const proxy = document.createElement('div')
    proxy.style.position = 'fixed'
    proxy.style.top = '0'
    proxy.style.left = '0'
    proxy.style.visibility = 'hidden'
    proxy.style.pointerEvents = 'none'
    document.body.appendChild(proxy)

    let maxDistance = 0
    let clearTimer: number | undefined

    const [draggable] = Draggable.create(proxy, {
      type: 'x',
      trigger: el,
      dragClickables: true,
      allowContextMenu: true,
      onPress() {
        window.clearTimeout(clearTimer)
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

        gsap.set(proxy, { x: 0 })
        optionsRef.current.onCommit(direction)
      },
    })

    return () => {
      window.clearTimeout(clearTimer)
      draggable.kill()
      proxy.remove()
    }
  }, [trackRef, options.disabled, options.thresholdPx])

  return justDraggedRef
}
