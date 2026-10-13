import { useCallback, useSyncExternalStore } from 'react'

/** Subscribes to a media query via useSyncExternalStore, so there's no manual setState-in-effect sync to keep correct as `query` changes. */
export function useMatchMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot)
}
