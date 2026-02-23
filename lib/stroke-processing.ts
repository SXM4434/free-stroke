export interface Point {
  x: number
  y: number
  t: number
  pressure?: number
}

export interface Stroke {
  points: Point[]
}

/* ------------------------------------------------------------------ */
/*  Arc-length resample: walk the polyline and emit a point every     */
/*  `spacing` pixels.                                                 */
/* ------------------------------------------------------------------ */
function resampleStroke(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return [...points]

  const out: Point[] = [points[0]]
  let carry = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const segLen = Math.sqrt(dx * dx + dy * dy)

    if (segLen === 0) continue

    let walked = carry > 0 ? spacing - carry : 0

    if (carry > 0 && carry + segLen < spacing) {
      carry += segLen
      continue
    }

    while (walked <= segLen) {
      const ratio = walked / segLen
      out.push({
        x: prev.x + dx * ratio,
        y: prev.y + dy * ratio,
        t: prev.t + (curr.t - prev.t) * ratio,
        pressure:
          prev.pressure !== undefined && curr.pressure !== undefined
            ? prev.pressure + (curr.pressure - prev.pressure) * ratio
            : undefined,
      })
      walked += spacing
    }

    carry = segLen - (walked - spacing)
  }

  const last = points[points.length - 1]
  const tail = out[out.length - 1]
  if (tail.x !== last.x || tail.y !== last.y) {
    out.push(last)
  }

  return out
}

/* ------------------------------------------------------------------ */
/*  Corner detection: return indices where the angle between          */
/*  consecutive segments exceeds a threshold (in degrees).            */
/* ------------------------------------------------------------------ */
function detectCorners(
  points: Point[],
  angleThresholdDeg: number = 45
): number[] {
  if (points.length < 3) return []

  const threshold = (angleThresholdDeg * Math.PI) / 180
  const corners: number[] = []

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1]
    const c = points[i]
    const n = points[i + 1]

    const ax = c.x - p.x
    const ay = c.y - p.y
    const bx = n.x - c.x
    const by = n.y - c.y

    const magA = Math.sqrt(ax * ax + ay * ay)
    const magB = Math.sqrt(bx * bx + by * by)

    if (magA < 0.001 || magB < 0.001) continue

    const dot = ax * bx + ay * by
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
    const angle = Math.acos(cosAngle)

    // angle is the deviation from straight (PI = straight line)
    // A sharp corner has a small angle (close to 0)
    if (Math.PI - angle > threshold) {
      corners.push(i)
    }
  }

  return corners
}

/* ------------------------------------------------------------------ */
/*  Chaikin-like smoothing: each interior point is replaced by the    */
/*  average of itself and its neighbors. Endpoints are preserved.     */
/* ------------------------------------------------------------------ */
function smoothPoints(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 3) return [...points]

  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1]
      const c = pts[i]
      const n = pts[i + 1]
      next.push({
        x: c.x * 0.5 + (p.x + n.x) * 0.25,
        y: c.y * 0.5 + (p.y + n.y) * 0.25,
        t: c.t,
        pressure:
          c.pressure !== undefined &&
          p.pressure !== undefined &&
          n.pressure !== undefined
            ? c.pressure * 0.5 + (p.pressure + n.pressure) * 0.25
            : c.pressure,
      })
    }
    next.push(pts[pts.length - 1])
    pts = next
  }

  return pts
}

/* ------------------------------------------------------------------ */
/*  Smooth while preserving corners: split at corner indices,         */
/*  smooth each segment independently, then rejoin.                   */
/* ------------------------------------------------------------------ */
function smoothPreservingCorners(
  points: Point[],
  iterations: number,
  angleThresholdDeg: number
): Point[] {
  if (points.length < 3) return [...points]

  const corners = detectCorners(points, angleThresholdDeg)
  if (corners.length === 0) return smoothPoints(points, iterations)

  // Build segments: [0..corner0], [corner0..corner1], ... [cornerN..end]
  const splitIndices = [0, ...corners, points.length - 1]
  const result: Point[] = []

  for (let s = 0; s < splitIndices.length - 1; s++) {
    const start = splitIndices[s]
    const end = splitIndices[s + 1]
    const segment = points.slice(start, end + 1)

    const smoothed = smoothPoints(segment, iterations)

    // Avoid duplicating junction points
    if (s === 0) {
      result.push(...smoothed)
    } else {
      result.push(...smoothed.slice(1))
    }
  }

  return result
}

/* ------------------------------------------------------------------ */
/*  Combined pipeline                                                 */
/* ------------------------------------------------------------------ */
export function processStroke(
  stroke: Stroke,
  spacing: number,
  smooth: boolean,
  preserveCorners: boolean = true,
  angleThresholdDeg: number = 45
): Stroke {
  if (stroke.points.length < 2) return { points: [...stroke.points] }

  const resampled = resampleStroke(stroke.points, spacing)

  if (!smooth) return { points: resampled }

  const final = preserveCorners
    ? smoothPreservingCorners(resampled, 2, angleThresholdDeg)
    : smoothPoints(resampled, 2)

  return { points: final }
}

export function processAllStrokes(
  strokes: Stroke[],
  spacing: number,
  smooth: boolean,
  preserveCorners: boolean = true
): Stroke[] {
  return strokes.map((s) => processStroke(s, spacing, smooth, preserveCorners))
}
