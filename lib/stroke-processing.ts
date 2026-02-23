interface Point {
  x: number
  y: number
  t: number
  pressure?: number
}

interface Stroke {
  points: Point[]
}

/* ------------------------------------------------------------------ */
/*  Arc-length resample: walk the polyline and emit a point every     */
/*  `spacing` pixels.                                                 */
/* ------------------------------------------------------------------ */
function resampleStroke(points: Point[], spacing: number): Point[] {
  if (points.length < 2) return [...points]

  const out: Point[] = [points[0]]
  let carry = 0 // leftover distance from previous segment

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const segLen = Math.sqrt(dx * dx + dy * dy)

    if (segLen === 0) continue

    let walked = carry > 0 ? spacing - carry : 0
    // if we hadn't accumulated enough from prior segment, keep walking
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

  // Always include the last point
  const last = points[points.length - 1]
  const tail = out[out.length - 1]
  if (tail.x !== last.x || tail.y !== last.y) {
    out.push(last)
  }

  return out
}

/* ------------------------------------------------------------------ */
/*  Chaikin-like smoothing: each interior point is replaced by the    */
/*  average of itself and its neighbors. Endpoints are preserved.     */
/* ------------------------------------------------------------------ */
function smoothStroke(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 3) return [...points]

  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [pts[0]] // preserve first
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
    next.push(pts[pts.length - 1]) // preserve last
    pts = next
  }

  return pts
}

/* ------------------------------------------------------------------ */
/*  Combined pipeline                                                 */
/* ------------------------------------------------------------------ */
export function processStroke(
  stroke: Stroke,
  spacing: number,
  smooth: boolean
): Stroke {
  if (stroke.points.length < 2) return { points: [...stroke.points] }

  const resampled = resampleStroke(stroke.points, spacing)
  const final = smooth ? smoothStroke(resampled, 2) : resampled
  return { points: final }
}

export function processAllStrokes(
  strokes: Stroke[],
  spacing: number,
  smooth: boolean
): Stroke[] {
  return strokes.map((s) => processStroke(s, spacing, smooth))
}
