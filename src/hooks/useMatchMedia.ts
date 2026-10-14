import { useCallback, useSyncExternalStore } from 'react'

/** useSyncExternalStore経由でメディアクエリを購読する。これにより`query`が変わっても手動のsetState-in-effect同期を正しく保つ必要がない。 */
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
