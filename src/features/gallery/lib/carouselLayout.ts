/** カルーセルの輪1段分。中心からの距離でキーされる（0 = 中心）。 */
export interface SlideStep {
  x: number
  z: number
  rotateY: number
  scale: number
  opacity: number
  /** カードが十分奥にあり、到達可能にも読み上げ対象にもすべきでなくなった時点でfalse。 */
  reachable: boolean
}

/**
 * PC用の奥行き: index 0が選択中のカード、1/2が見えている隣接カード、
 * 3はループの反対側（6枚目のカード）で、opacity 0で中心の裏に待機させ
 * 7枚目の見える枠としては認識されないようにしている——強すぎない、
 * 感じ取れる程度の3D感。
 */
export const PC_STEPS: readonly SlideStep[] = [
  { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1, reachable: true },
  { x: 300, z: -150, rotateY: 30, scale: 0.72, opacity: 0.85, reachable: true },
  { x: 500, z: -320, rotateY: 38, scale: 0.5, opacity: 0.4, reachable: true },
  { x: 560, z: -480, rotateY: 40, scale: 0.4, opacity: 0, reachable: false },
]

/** SP用の奥行き: 考え方は同じだが、より平たい——3D感はモバイルでは意図的に弱めてある。 */
export const SP_STEPS: readonly SlideStep[] = [
  { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1, reachable: true },
  { x: 118, z: -70, rotateY: 10, scale: 0.68, opacity: 0.55, reachable: true },
  { x: 160, z: -130, rotateY: 12, scale: 0.48, opacity: 0, reachable: false },
  { x: 175, z: -160, rotateY: 12, scale: 0.42, opacity: 0, reachable: false },
]

export interface ResolvedSlideTransform {
  x: number
  z: number
  rotateY: number
  scale: number
  opacity: number
  zIndex: number
  reachable: boolean
}

/** `count`個でループする並びの中で、`selected`から`index`までの符号付き最短距離。 */
export function circularDelta(index: number, selected: number, count: number): number {
  const raw = (((index - selected) % count) + count) % count
  return raw > count / 2 ? raw - count : raw
}

export function resolveSlideTransform(
  delta: number,
  steps: readonly SlideStep[],
): ResolvedSlideTransform {
  const sign = delta === 0 ? 0 : delta > 0 ? 1 : -1
  const ring = Math.min(Math.abs(delta), steps.length - 1)
  const step = steps[ring]
  return {
    x: step.x * sign,
    z: step.z,
    rotateY: step.rotateY * -sign,
    scale: step.scale,
    opacity: step.opacity,
    reachable: step.reachable,
    zIndex: 100 - ring * 10,
  }
}
