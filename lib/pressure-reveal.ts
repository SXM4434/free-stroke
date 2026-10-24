/* ============================================================================
 * PRESSURE-AWARE REVEAL (DRAWIN-EXTRAS, 2026-09-30).
 *
 * His plan, PRD Layer 3: "Future: ... pressure-aware reveal". Coverage row 41:
 * pressure "Recorded at components/drawing-canvas.tsx:333 and :352. vp:14730
 * says no engine reads it."
 *
 * WHAT IT DOES. Where he pressed harder the pen moves slower, where he eased off
 * it moves quicker. Inside each stroke, each step's time is scaled by how hard
 * that step was pressed against the stroke's own average, then the stroke is
 * scaled back to its recorded length. So a stroke still starts and ends when it
 * did, the pauses between strokes are untouched, and only the pace inside a
 * stroke moves. `amount` 0..1 blends from the recording (0) to the full effect.
 *
 * FALLING BACK. A stroke with no pressure, or pressure that never varies (a
 * mouse reports one value for the whole press), has nothing to read. It is
 * handed back as THE SAME OBJECT, not re-timed by a formula that happens to
 * give the same numbers, and when no stroke changes the SAME ARRAY comes back,
 * so the clock memo in app/page.tsx sees main's arrays and main's take.
 * ========================================================================== */

export const PRESSURE_REVEAL_MAX = 1
/** A stroke whose pressure spans less than this is read as having none. */
export const PRESSURE_FLAT_SPAN = 1e-3
/** The slowest a step can be scaled down to, so a feather-light touch still moves forward. */
const FACTOR_MIN = 0.1

type P = { t: number; pressure?: number }

function gateKnock(): string | undefined {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return undefined
  return (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE
}

/** True when the stroke carries pressure that varies. */
export function strokeHasPressure(points: readonly P[]): boolean {
  let lo = Infinity
  let hi = -Infinity
  let n = 0
  for (const p of points) {
    const v = p.pressure
    if (typeof v !== "number" || !Number.isFinite(v)) continue
    n++
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return n >= 2 && hi - lo >= PRESSURE_FLAT_SPAN
}

/** One stroke, re-timed by its pressure. The same array when there is none. */
export function pressureTimedPoints<Q extends P>(points: Q[], amount: number): Q[] {
  const knock = gateKnock()
  if (!(amount > 0) || points.length < 2) return points
  if (knock !== "pressure-no-fallback" && !strokeHasPressure(points)) return points
  const n = points.length
  /* Each step's pressure: the mean of its two ends, a missing end borrowing the other. */
  const stepP = new Float64Array(n)
  let wSum = 0
  let pSum = 0
  for (let j = 1; j < n; j++) {
    const a = points[j - 1].pressure
    const b = points[j].pressure
    const fa = typeof a === "number" && Number.isFinite(a)
    const fb = typeof b === "number" && Number.isFinite(b)
    const v = fa && fb ? (a! + b!) / 2 : fa ? a! : fb ? b! : NaN
    stepP[j] = v
    const dt = points[j].t - points[j - 1].t
    if (Number.isFinite(v) && dt > 0) {
      wSum += dt
      pSum += v * dt
    }
  }
  const mean = wSum > 0 ? pSum / wSum : NaN
  if (!(mean > 0)) return points
  const inverted = knock === "pressure-inverted"
  const dts = new Float64Array(n)
  let before = 0
  let after = 0
  for (let j = 1; j < n; j++) {
    const dt = Math.max(0, points[j].t - points[j - 1].t)
    const rel = Number.isFinite(stepP[j]) ? stepP[j] / mean : 1
    const f = Math.max(FACTOR_MIN, 1 + amount * ((inverted ? 2 - rel : rel) - 1))
    dts[j] = dt * f
    before += dt
    after += dts[j]
  }
  if (!(after > 0)) return points
  const k = before / after
  const out = new Array<Q>(n)
  out[0] = points[0]
  let t = points[0].t
  for (let j = 1; j < n; j++) {
    t += dts[j] * k
    out[j] = { ...points[j], t }
  }
  /* The last point lands exactly where it was, not a rounding error away. */
  out[n - 1] = { ...points[n - 1], t: points[n - 1].t }
  return out
}

/** Every stroke. The same array when no stroke changed. */
export function pressureTimed<S extends { points: P[] }>(strokes: S[], amount: number): S[] {
  if (!(amount > 0)) return strokes
  let changed = false
  const out = strokes.map((s) => {
    const pts = pressureTimedPoints(s.points, amount)
    if (pts === s.points) return s
    changed = true
    return { ...s, points: pts }
  })
  return changed ? out : strokes
}
