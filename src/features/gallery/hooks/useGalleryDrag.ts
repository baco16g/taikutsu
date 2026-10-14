import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import styles from '../components/GalleryCarousel.module.css'

gsap.registerPlugin(Draggable)

export interface UseGalleryDragOptions {
  disabled: boolean
  reducedMotion: boolean
  /** Pixels the track must move before release counts as a page, not a tap. */
  thresholdPx: number
  onCommit: (direction: -1 | 0 | 1) => void
}

/**
 * Binds GSAP Draggable straight to the card track: dragging the track IS
 * the carousel move, so no manual offset bookkeeping is needed —
 * Draggable already sets the track's x live as the pointer moves. This
 * hook only decides, on release, whether the drag crossed the page
 * threshold and settles the track back to 0 either way.
 *
 * Returns a ref that reads true for a short window right after a real
 * drag (beyond a few px), so the card click handlers can tell a
 * drag-release apart from a genuine tap and skip opening the game's
 * sales page link by accident.
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
      // Fires on every release, drag or not — unlike onDragEnd (drags
      // only), so a plain click always clears the grabbing cursor too.
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
