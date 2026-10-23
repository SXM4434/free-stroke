export interface Point {
  x: number
  y: number
  t: number
  pressure?: number
}

export interface Stroke {
  points: Point[]
}

export interface ProcessedStroke {
  points: Point[]
  cornerCount: number
}

/* ------------------------------------------------------------------ */
/*  Utility: arc-length between two indices                           */
/* ------------------------------------------------------------------ */
function arcLength(points: Point[], from: number, to: number): number {
  let len = 0
  for (let i = from + 1; i <= to; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

/* ------------------------------------------------------------------ */
/*  Utility: cumulative arc-length array                              */
/* ------------------------------------------------------------------ */
function cumulativeArcLength(points: Point[]): number[] {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  return cum
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
/*  Corner detection (robust)                                         */
/*                                                                    */
/*  1. Window-based angle: look k points back and forward instead     */
/*     of immediate neighbors, so fast/coarse strokes aren't noisy.   */
/*  2. Minimum arm length: skip corners too close to stroke ends.     */
/*  3. Merge pass: if two corners are within MERGE_DISTANCE of each   */
/*     other (arc-length), keep only the strongest.                   */
/* ------------------------------------------------------------------ */

const MIN_CORNER_ARM_LENGTH = 16 // px arc-length from stroke ends
const MERGE_DISTANCE = 12 // px arc-length between corners

interface CornerCandidate {
  index: number
  strength: number // deviation angle in radians (higher = sharper)
}

export function detectCorners(
  points: Point[],
  angleThresholdDeg: number = 45,
  spacing: number = 4
): number[] {
  if (points.length < 5) return []

  const threshold = (angleThresholdDeg * Math.PI) / 180
  const cum = cumulativeArcLength(points)
  const totalLen = cum[cum.length - 1]

  // Adaptive window: use at least 2, scale up with spacing so we look
  // across a meaningful arc (~12-20px worth of points)
  const k = Math.max(2, Math.min(Math.ceil(12 / Math.max(spacing, 1)), 5))

  const candidates: CornerCandidate[] = []

  for (let i = k; i < points.length - k; i++) {
    // Gate: must be at least MIN_CORNER_ARM_LENGTH from each end
    if (cum[i] < MIN_CORNER_ARM_LENGTH) continue
    if (totalLen - cum[i] < MIN_CORNER_ARM_LENGTH) continue

    const p = points[i - k]
    const c = points[i]
    const n = points[i + k]

    const ax = c.x - p.x
    const ay = c.y - p.y
    const bx = n.x - c.x
    const by = n.y - c.y

    const magA = Math.sqrt(ax * ax + ay * ay)
    const magB = Math.sqrt(bx * bx + by * by)

    if (magA < 0.5 || magB < 0.5) continue

    const dot = ax * bx + ay * by
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
    const angle = Math.acos(cosAngle)

    // angle = 0 means full reversal, PI means straight
    const deviation = Math.PI - angle
    if (deviation > threshold) {
      candidates.push({ index: i, strength: deviation })
    }
  }

  if (candidates.length === 0) return []

  // Merge pass: walk candidates, group those within MERGE_DISTANCE,
  // keep the one with the highest strength in each group
  const merged: CornerCandidate[] = []
  let group: CornerCandidate[] = [candidates[0]]

  for (let i = 1; i < candidates.length; i++) {
    const prev = group[group.length - 1]
    const curr = candidates[i]
    const dist = cum[curr.index] - cum[prev.index]

    if (dist <= MERGE_DISTANCE) {
      group.push(curr)
    } else {
      // Flush group: keep the strongest
      group.sort((a, b) => b.strength - a.strength)
      merged.push(group[0])
      group = [curr]
    }
  }
  // Flush last group
  group.sort((a, b) => b.strength - a.strength)
  merged.push(group[0])

  return merged.map((c) => c.index)
}

/* ------------------------------------------------------------------ */
/*  Taubin (lambda|mu) smoothing — smooths WITHOUT shrinking.         */
/*                                                                    */
/*  The previous kernel was c*0.5 + (p+n)*0.25, i.e. a plain          */
/*  Laplacian pass with lambda = 0.5. Laplacian smoothing always      */
/*  pulls each point toward the chord between its neighbours, so      */
/*  every iteration SHRINKS the curve: arcs flatten, loops close up,  */
/*  and a tight curl drawn by hand comes out visibly smaller than     */
/*  what the user drew. Two iterations of it were measurably eating   */
/*  the gesture.                                                      */
/*                                                                    */
/*  Taubin's fix is to alternate a positive smoothing pass with a     */
/*  slightly larger NEGATIVE one, which re-inflates the shape:        */
/*                                                                    */
/*      p += lambda * L(p)     (smooth, shrinks)                      */
/*      p += mu     * L(p)     (un-shrink, mu < -lambda)              */
/*                                                                    */
/*  where L(p) = (prev + next)/2 - p. High-frequency tremor is        */
/*  removed by both passes; low-frequency shape survives because the  */
/*  two passes cancel there. The stability condition is               */
/*  1/lambda + 1/mu > 0, which mu = -0.53 against lambda = 0.5        */
/*  satisfies.                                                        */
/*                                                                    */
/*  Endpoints are always preserved — a stroke must start and end      */
/*  exactly where the hand did.                                       */
/* ------------------------------------------------------------------ */
const TAUBIN_LAMBDA = 0.5
const TAUBIN_MU = -0.53

function laplacianPass(pts: Point[], factor: number): Point[] {
  const next: Point[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]
    const c = pts[i]
    const n = pts[i + 1]
    // L = midpoint of neighbours minus this point.
    const lx = (p.x + n.x) * 0.5 - c.x
    const ly = (p.y + n.y) * 0.5 - c.y
    const hasPressure =
      c.pressure !== undefined && p.pressure !== undefined && n.pressure !== undefined
    next.push({
      x: c.x + factor * lx,
      y: c.y + factor * ly,
      t: c.t,
      pressure: hasPressure
        ? c.pressure! + factor * ((p.pressure! + n.pressure!) * 0.5 - c.pressure!)
        : c.pressure,
    })
  }
  next.push(pts[pts.length - 1])
  return next
}

function smoothPoints(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 3) return [...points]

  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    pts = laplacianPass(pts, TAUBIN_LAMBDA)
    pts = laplacianPass(pts, TAUBIN_MU)
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
  angleThresholdDeg: number,
  spacing: number
): { smoothed: Point[]; cornerCount: number } {
  if (points.length < 3) return { smoothed: [...points], cornerCount: 0 }

  const corners = detectCorners(points, angleThresholdDeg, spacing)
  if (corners.length === 0) {
    return { smoothed: smoothPoints(points, iterations), cornerCount: 0 }
  }

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

  return { smoothed: result, cornerCount: corners.length }
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
): ProcessedStroke {
  if (stroke.points.length < 2)
    return { points: [...stroke.points], cornerCount: 0 }

  const resampled = resampleStroke(stroke.points, spacing)

  if (!smooth) return { points: resampled, cornerCount: 0 }

  // Smoothing moves points off the arc-length grid the resample just built.
  // Every downstream engine assumes roughly even spacing — Rod's tube
  // cross-sections, Solid's rasteriser, and Inflate's loft all sample the
  // point list directly — so uneven spacing shows up as wobbling tube radius
  // and stair-stepped contours. Re-resampling AFTER smoothing restores the
  // even grid while keeping the smoothed shape.
  if (preserveCorners) {
    const { smoothed, cornerCount } = smoothPreservingCorners(
      resampled,
      2,
      angleThresholdDeg,
      spacing
    )
    return { points: resampleStroke(smoothed, spacing), cornerCount }
  }

  return { points: resampleStroke(smoothPoints(resampled, 2), spacing), cornerCount: 0 }
}

export function processAllStrokes(
  strokes: Stroke[],
  spacing: number,
  smooth: boolean,
  preserveCorners: boolean = true
): ProcessedStroke[] {
  return strokes.map((s) => processStroke(s, spacing, smooth, preserveCorners))
}
