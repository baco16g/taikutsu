import { useMatchMedia } from './useMatchMedia'

const QUERY = '(hover: hover) and (pointer: fine)'

/**
 * 実際のマウス/トラックパッド（本物のホバー）を持つ端末ではtrue、
 * タッチのみの端末ではfalse——ビューポート幅からの推測ではなく機能判定
 * （デスクトップブラウザを狭くリサイズしてもホバーは依然ある。幅の
 * 広いタブレットでも依然ない）。
 */
export function useSupportsHover(): boolean {
  return useMatchMedia(QUERY)
}
