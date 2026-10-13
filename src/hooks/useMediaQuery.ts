import { useMatchMedia } from './useMatchMedia'

export function useMediaQuery(query: string): boolean {
  return useMatchMedia(query)
}
