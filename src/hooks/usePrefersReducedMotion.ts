import { useMatchMedia } from './useMatchMedia'

export function usePrefersReducedMotion(): boolean {
  return useMatchMedia('(prefers-reduced-motion: reduce)')
}
