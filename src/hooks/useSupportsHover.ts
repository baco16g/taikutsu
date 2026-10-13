import { useMatchMedia } from './useMatchMedia'

const QUERY = '(hover: hover) and (pointer: fine)'

/**
 * True on devices with a real mouse/trackpad (genuine hover), false on
 * touch-only devices — a capability check, not a viewport-width guess
 * (a desktop browser resized narrow still has hover; a tablet at a wide
 * width still doesn't).
 */
export function useSupportsHover(): boolean {
  return useMatchMedia(QUERY)
}
