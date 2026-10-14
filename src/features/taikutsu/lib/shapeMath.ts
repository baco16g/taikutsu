export interface BlobPoint {
  /** 度数。全HP状態を通してインデックスごとに固定されており、モーフ先の点が常に対応した位置を保つ */
  angle: number
  radius: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180

export interface Vec2 {
  x: number
  y: number
}

export const blobPointToVec2 = (point: BlobPoint, cx: number, cy: number): Vec2 => ({
  x: cx + Math.cos(toRad(point.angle)) * point.radius,
  y: cy + Math.sin(toRad(point.angle)) * point.radius,
})

/**
 * 与えられた点を通る閉じたCatmull-Romスプラインを、3次ベジェに変換したもの。
 * 点の順序/角度は状態を通して固定しておく必要があり、そうしないとモーフ時にねじれてしまう。
 */
export const blobPointsToPath = (
  points: BlobPoint[],
  cx: number,
  cy: number,
  tension = 1,
): string => {
  const n = points.length
  if (n < 3) return ''
  const pts = points.map((p) => blobPointToVec2(p, cx, cy))

  const seg = (i: number) => {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    return `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} `
  for (let i = 0; i < n; i++) d += seg(i) + ' '
  return d + 'Z'
}

export const lerpBlobPoints = (a: BlobPoint[], b: BlobPoint[], t: number): BlobPoint[] =>
  a.map((pa, i) => {
    const pb = b[i]
    return {
      angle: pa.angle + (pb.angle - pa.angle) * t,
      radius: pa.radius + (pb.radius - pa.radius) * t,
    }
  })

export const cloneBlobPoints = (points: BlobPoint[]): BlobPoint[] => points.map((p) => ({ ...p }))
