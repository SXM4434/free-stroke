// SYNTHETIC TUBE vs SYNTHETIC PEN — the instrument's calibration inputs.
//
// The boundary instrument is only worth running if it can tell a swept tube
// from a drawn stroke on shapes where the answer is known by construction. So
// these two renderers exist: same centreline, same nominal radius, same
// rasteriser, differing ONLY in the width law and the terminal.
//
//   TUBE  constant half-width, round caps      — what a 3D form renders head-on
//   PEN   modulated half-width, tapered ends   — what a drawn mark is
//
// A run of the instrument in which these two come back the same is an
// instrument that is measuring nothing, and the assertion says so.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")

/** A hand-ish polyline: a couple of loops and a crossing, in canvas px. */
export function fixtureStrokes(W, H) {
  const cx = W / 2
  const cy = H / 2
  const s = Math.min(W, H) / 400
  const pts = (fn, n, a, b) => {
    const out = []
    for (let i = 0; i <= n; i++) out.push(fn(a + ((b - a) * i) / n))
    return out
  }
  return [
    // a long sweeping curve
    pts((t) => ({ x: cx + (t - 0.5) * 520 * s, y: cy + Math.sin(t * Math.PI * 2) * 70 * s }), 160, 0, 1),
    // a stroke crossing it
    pts((t) => ({ x: cx - 120 * s + t * 60 * s, y: cy - 130 * s + t * 260 * s }), 60, 0, 1),
    // a short tick
    pts((t) => ({ x: cx + 150 * s + t * 90 * s, y: cy + 60 * s - t * 40 * s }), 40, 0, 1),
  ]
}

function arcLengths(pl) {
  const cum = [0]
  let L = 0
  for (let i = 1; i < pl.length; i++) {
    L += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y)
    cum.push(L)
  }
  return { cum, L }
}

/**
 * Stamp a variable-width stroke as a run of discs. Slow and exact, which is
 * what a fixture wants: no join heuristics, no cap policy, nothing that could
 * be confused with the thing being measured.
 */
function stampVariable(ctx, pl, halfWidthAt) {
  const { cum, L } = arcLengths(pl)
  ctx.fillStyle = "#111"
  const step = 0.4
  for (let d = 0; d <= L; d += step) {
    // locate d
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const seg = cum[i] - cum[i - 1]
    const f = seg > 0 ? (d - cum[i - 1]) / seg : 0
    const x = pl[i - 1].x + (pl[i].x - pl[i - 1].x) * f
    const y = pl[i - 1].y + (pl[i].y - pl[i - 1].y) * f
    const r = halfWidthAt(d / L, d, L)
    if (r <= 0.2) continue
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** The TUBE: one radius end to end, round caps — a swept circle. */
export function renderTube(W, H, R) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#fbfaf7"
  ctx.fillRect(0, 0, W, H)
  for (const pl of fixtureStrokes(W, H)) stampVariable(ctx, pl, () => R)
  return c.toBuffer("image/png")
}

/**
 * The PEN: terminals taper and the width is modulated along the stroke.
 *
 * `taperK` is the taper length in RADII and `w0` the half-width the tip keeps.
 * The mid-stroke modulation is a slow sinusoid rather than noise, because the
 * fixture's job is to be a known shape, not a plausible one.
 */
export function renderPen(W, H, R, { taperK = 5, w0 = 0.1, mod = 0.3 } = {}) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#fbfaf7"
  ctx.fillRect(0, 0, W, H)
  const taper = taperK * R
  for (const pl of fixtureStrokes(W, H)) {
    stampVariable(ctx, pl, (u, d, L) => {
      const dEnd = Math.min(d, L - d)
      const e = taper > 0 ? Math.min(1, dEnd / taper) : 1
      const ramp = w0 + (1 - w0) * Math.pow(e, 0.6)
      const m = 1 + mod * Math.sin(u * Math.PI * 3.3)
      return R * ramp * m
    })
  }
  return c.toBuffer("image/png")
}
