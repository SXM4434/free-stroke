// THE BOUNDARY INSTRUMENT — the statistic the shipped gates cannot have.
//
// ── WHY IT EXISTS ───────────────────────────────────────────────────────────
// `assert-hero-transition.mjs` gate 1 and every statistic derived from it read
// the ink INTERIOR: erode the mask three passes, then measure luminance. That
// is the right instrument for "is the flat state ONE VALUE", and it is
// structurally incapable of seeing the defect Sebs named — *"THE 2D AND 3D
// TRANSFORMATION IS WAY TOO SUBTLE"* — because the entire difference between a
// drawing and a solid seen head-on lives on the BOUNDARY, which erosion is
// specifically built to throw away.
//
// `components/viewport-3d.tsx`'s `FlatState` doc comment already states the
// finding and already names this statistic:
//
//     this flat state, mid-breath   half-width median 7.07px, spread 0.493
//     the settled solid, head-on    half-width median 7.07px, spread 0.493
//
//     Identical to three decimals — the flat state IS the solid.
//
// There was no code behind those numbers. This is that code.
//
// ── WHAT IT MEASURES, AND WHY EACH ROW IS THE RIGHT ONE ────────────────────
// A drawn mark and a swept tube differ on the boundary in three ways that are
// independent of shading, of the camera and of the light:
//
//  1. HALF-WIDTH SPREAD. A tube is one radius from end to end; a pen's width is
//     modulated by how fast the hand was moving. `lib/pen-kinematics.ts`'s own
//     header names this as the defect it was written to fix — *"every tube is
//     very nearly one radius from end to end. Width is the channel that carries
//     hand, and ours is empty"*.
//
//  2. TERMINAL TAPER — the sharpest of the three, and the one no amount of
//     shading can fake. A tube ends in a round cap: its medial axis stops one
//     radius short of the tip and the half-width there is still the full
//     radius. A pen leaving paper tapers: the medial axis runs all the way to
//     the tip and the half-width there goes to nothing. So the ratio
//     `half-width at the medial-axis terminal / median half-width` is ~1.0 for
//     a tube and well under 1 for real ink, with no free parameter anywhere.
//
//  3. THE DISTRIBUTIONS AS WHOLE OBJECTS. Two marks can share a median and a
//     spread and still not be the same shape, so the flat-vs-solid comparison
//     is a 1-D Wasserstein (earth-mover) distance between the two half-width
//     sample sets, normalised by the median. One number, no threshold hidden
//     inside it, and it is exactly zero when the two states are the same
//     geometry — which is what today's build is.
//
// ── THE CONSTANTS ARE NOT THIS FILE'S ──────────────────────────────────────
// The ink threshold and the chrome crop are IMPORTED from `flat-interior.mjs`,
// which grep-checks them against `assert-hero-transition.mjs` on import and
// throws if either has moved. A boundary statistic taken on a different mask
// from the interior statistic would be two marks, not two views of one.
import { INK_MAX_LUMA, HEIGHT_FRAC } from "./flat-interior.mjs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

export { INK_MAX_LUMA, HEIGHT_FRAC }

/* -------------------------------------------------------------------------- */
/*  Exact Euclidean distance transform (Felzenszwalb & Huttenlocher 2012)      */
/* -------------------------------------------------------------------------- */

const INF = 1e20

/** Squared-distance transform of one 1-D sample line, in place-ish. */
function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

/**
 * Distance, in pixels, from every FOREGROUND pixel to the nearest BACKGROUND
 * pixel. Everything outside the image counts as background, so a mark running
 * off the crop is measured honestly rather than reported as infinitely wide.
 *
 * @param {Uint8Array} mask 1 = ink
 */
export function distanceTransform(mask, W, H) {
  const f = new Float64Array(Math.max(W, H))
  const d = new Float64Array(Math.max(W, H))
  const v = new Int32Array(Math.max(W, H))
  const z = new Float64Array(Math.max(W, H) + 1)
  const out = new Float64Array(W * H)

  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = mask[y * W + x] ? INF : 0
    edt1d(f, H, d, v, z)
    for (let y = 0; y < H; y++) out[y * W + x] = d[y]
  }
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) f[x] = out[row + x]
    edt1d(f, W, d, v, z)
    for (let x = 0; x < W; x++) out[row + x] = Math.sqrt(d[x])
  }
  // Anything within one pixel of the crop edge is bounded by the edge itself.
  for (let x = 0; x < W; x++) {
    out[x] = Math.min(out[x], 1)
    out[(H - 1) * W + x] = Math.min(out[(H - 1) * W + x], 1)
  }
  for (let y = 0; y < H; y++) {
    out[y * W] = Math.min(out[y * W], 1)
    out[y * W + W - 1] = Math.min(out[y * W + W - 1], 1)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  Medial axis — Zhang-Suen thinning                                         */
/* -------------------------------------------------------------------------- */

/**
 * The mark's medial axis, as a one-pixel-wide skeleton.
 *
 * Zhang-Suen rather than a distance-transform ridge because a ridge test is a
 * local maximum and a swept tube's distance field is FLAT along its own
 * centreline to within a rounding error — a ridge detector on a constant-radius
 * band picks up a two-pixel-wide smear whose sampling is biased by which side
 * of the centreline the raster fell on. Thinning is topological and has no such
 * bias, and it is what makes the terminal statistic possible at all: thinning
 * PRESERVES endpoints, so a tapering shape's skeleton runs into its tip while a
 * round cap's stops short of it. That difference is the measurement.
 */
export function thin(mask, W, H) {
  const m = Uint8Array.from(mask)
  // Restrict the sweep to the mark's own box; the crop is mostly paper.
  let x0 = W
  let x1 = -1
  let y0 = H
  let y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x]) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return m
  x0 = Math.max(1, x0 - 1)
  y0 = Math.max(1, y0 - 1)
  x1 = Math.min(W - 2, x1 + 1)
  y1 = Math.min(H - 2, y1 + 1)

  const del = []
  for (let iter = 0; iter < 200; iter++) {
    let changed = false
    for (let step = 0; step < 2; step++) {
      del.length = 0
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const p = y * W + x
          if (!m[p]) continue
          const P2 = m[p - W]
          const P3 = m[p - W + 1]
          const P4 = m[p + 1]
          const P5 = m[p + W + 1]
          const P6 = m[p + W]
          const P7 = m[p + W - 1]
          const P8 = m[p - 1]
          const P9 = m[p - W - 1]
          const B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9
          if (B < 2 || B > 6) continue
          let A = 0
          if (!P2 && P3) A++
          if (!P3 && P4) A++
          if (!P4 && P5) A++
          if (!P5 && P6) A++
          if (!P6 && P7) A++
          if (!P7 && P8) A++
          if (!P8 && P9) A++
          if (!P9 && P2) A++
          if (A !== 1) continue
          if (step === 0) {
            if (P2 && P4 && P6) continue
            if (P4 && P6 && P8) continue
          } else {
            if (P2 && P4 && P8) continue
            if (P2 && P6 && P8) continue
          }
          del.push(p)
        }
      }
      if (del.length) {
        changed = true
        for (const p of del) m[p] = 0
      }
    }
    if (!changed) break
  }
  return m
}

const NX = [1, 1, 0, -1, -1, -1, 0, 1]
const NY = [0, -1, -1, -1, 0, 1, 1, 1]

function degreeOf(sk, W, H, p) {
  const x = p % W
  const y = (p - x) / W
  let d = 0
  for (let i = 0; i < 8; i++) {
    const nx = x + NX[i]
    const ny = y + NY[i]
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    if (sk[ny * W + nx]) d++
  }
  return d
}

function neighbours(sk, W, H, p, out) {
  const x = p % W
  const y = (p - x) / W
  let n = 0
  for (let i = 0; i < 8; i++) {
    const nx = x + NX[i]
    const ny = y + NY[i]
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    const q = ny * W + nx
    if (sk[q]) out[n++] = q
  }
  return n
}

const stepLen = (W, a, b) => {
  const dx = (a % W) - (b % W)
  const dy = (a - (a % W)) / W - (b - (b % W)) / W
  return dx && dy ? Math.SQRT2 : 1
}

/**
 * Walk inward from a skeleton endpoint, recording (arc distance, half-width) at
 * every step, and stop at the first junction.
 */
function walkFromEnd(sk, W, H, start, dt, maxArc) {
  const nb = new Int32Array(8)
  const path = [{ p: start, arc: 0, hw: dt[start] }]
  let prev = -1
  let cur = start
  let arc = 0
  for (;;) {
    const n = neighbours(sk, W, H, cur, nb)
    let next = -1
    let count = 0
    for (let i = 0; i < n; i++) {
      if (nb[i] === prev) continue
      count++
      if (next < 0) next = nb[i]
    }
    if (count !== 1) break // junction, or the end of the branch
    arc += stepLen(W, cur, next)
    path.push({ p: next, arc, hw: dt[next] })
    prev = cur
    cur = next
    if (arc >= maxArc) break
  }
  return path
}

/* -------------------------------------------------------------------------- */
/*  Statistics                                                                */
/* -------------------------------------------------------------------------- */

const quantile = (sorted, q) => {
  if (!sorted.length) return 0
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

/**
 * 1-D Wasserstein (earth-mover) distance between two sample sets, in the
 * samples' own units. Equal-mass quantile coupling, which for 1-D is exact.
 */
export function wasserstein(a, b, bins = 512) {
  if (!a.length || !b.length) return Infinity
  const A = Float64Array.from(a).sort()
  const B = Float64Array.from(b).sort()
  let s = 0
  for (let i = 0; i < bins; i++) {
    const q = (i + 0.5) / bins
    s += Math.abs(quantile(A, q) - quantile(B, q))
  }
  return s / bins
}

/**
 * Every boundary statistic, from an ink mask.
 *
 * `terminalRatio` is the load-bearing one and it deserves its definition in
 * full. Spurs — short skeleton branches thrown off by a wide junction — would
 * otherwise be counted as terminals and they are not: they are artefacts of the
 * thinning, they sit at FULL half-width, and there are more of them where more
 * strokes cross. So a branch is a real terminal only if it is longer than
 * `spurK` median half-widths. A genuine tapered terminal's branch is the whole
 * stroke, so this can never remove one; a fillet spur is at most a radius long,
 * so this always removes those.
 */
export function boundaryStats(mask, W, H, opts = {}) {
  const spurK = opts.spurK ?? 3.0
  const dt = distanceTransform(mask, W, H)
  const sk = thin(mask, W, H)

  const widths = []
  const skPix = []
  for (let p = 0; p < W * H; p++) {
    if (!sk[p]) continue
    skPix.push(p)
    widths.push(dt[p])
  }
  if (!widths.length) {
    return {
      W,
      H,
      mask,
      n: 0,
      inkPx: 0,
      median: 0,
      sd: 0,
      iqr: 0,
      p10: 0,
      p90: 0,
      widths: [],
      terminals: [],
      terminalMedian: 0,
      terminalRatio: 0,
      junctionCount: 0,
      bodyN: 0,
      bodyWidths: [],
      bodyMedian: 0,
      bodySd: 0,
      bodyRelSd: 0,
      taperProfile: [],
      skeleton: sk,
      dt,
    }
  }
  const sorted = Float64Array.from(widths).sort()
  const median = quantile(sorted, 0.5)
  let sum = 0
  let sumSq = 0
  for (const w of widths) {
    sum += w
    sumSq += w * w
  }
  const mean = sum / widths.length
  const sd = Math.sqrt(Math.max(0, sumSq / widths.length - mean * mean))

  /* ---- terminals -------------------------------------------------------- */
  const spurLen = spurK * median
  const ends = []
  for (const p of skPix) if (degreeOf(sk, W, H, p) === 1) ends.push(p)

  // The taper is read over three median half-widths inward, which is the
  // longest terminal a pen leaves and comfortably past where a round cap's
  // skeleton has already reached full radius.
  const PROFILE_AT = [0, 0.5, 1, 1.5, 2, 3]
  const profileAcc = PROFILE_AT.map(() => ({ s: 0, n: 0 }))
  const terminals = []
  for (const e of ends) {
    const path = walkFromEnd(sk, W, H, e, dt, spurLen + 1)
    const reach = path[path.length - 1].arc
    if (reach < spurLen) continue // a spur, not a terminal
    terminals.push(path[0].hw)
    for (let k = 0; k < PROFILE_AT.length; k++) {
      const want = PROFILE_AT[k] * median
      let best = null
      for (const s of path) {
        if (s.arc >= want) {
          best = s
          break
        }
      }
      if (best) {
        profileAcc[k].s += best.hw
        profileAcc[k].n++
      }
    }
  }
  const tSorted = Float64Array.from(terminals).sort()
  const terminalMedian = terminals.length ? quantile(tSorted, 0.5) : 0

  /* ---- the STROKE BODY, with every junction neighbourhood removed --------- */
  //
  // ⚠ THIS EXISTS BECAUSE THE WHOLE-AXIS SPREAD IS A ROW THAT CANNOT FAIL.
  // Measured: the 2-D register's own MONOLINE render — a constant `lineWidth`
  // with round caps, which is one radius from end to end by construction —
  // reads relative sd 0.188 on this word. So does the shipped 3-D flat state,
  // at 0.182. A statistic that reports a constant-width stroke as varying by
  // 19 % is not measuring width variation; it is measuring the bulges where
  // twenty-two strokes fuse, and there are a lot of those in this word.
  //
  // A junction bulge is real geometry and belongs in the median and in the
  // whole-axis distribution. It does NOT belong in a claim about whether the
  // pen changed width along its travel. So the body statistic drops every
  // medial sample within two median half-widths of a branch point, which is
  // where a fusion bulge's support ends.
  const junctions = []
  for (const p of skPix) if (degreeOf(sk, W, H, p) >= 3) junctions.push(p)
  const bodyR = 2 * median
  const bodyWidths = []
  for (const p of skPix) {
    const x = p % W
    const y = (p - x) / W
    let near = false
    for (const j of junctions) {
      const jx = j % W
      const jy = (j - jx) / W
      if (Math.abs(jx - x) > bodyR || Math.abs(jy - y) > bodyR) continue
      if ((jx - x) ** 2 + (jy - y) ** 2 <= bodyR * bodyR) {
        near = true
        break
      }
    }
    if (!near) bodyWidths.push(dt[p])
  }
  let bSum = 0
  let bSq = 0
  for (const w of bodyWidths) {
    bSum += w
    bSq += w * w
  }
  const bodyMean = bodyWidths.length ? bSum / bodyWidths.length : 0
  const bodySd = bodyWidths.length
    ? Math.sqrt(Math.max(0, bSq / bodyWidths.length - bodyMean * bodyMean))
    : 0
  const bodySorted = Float64Array.from(bodyWidths).sort()
  const bodyMedian = bodyWidths.length ? quantile(bodySorted, 0.5) : 0

  let inkPx = 0
  for (let p = 0; p < W * H; p++) if (mask[p]) inkPx++

  return {
    W,
    H,
    mask,
    n: widths.length,
    inkPx,
    median,
    sd,
    iqr: quantile(sorted, 0.75) - quantile(sorted, 0.25),
    p10: quantile(sorted, 0.1),
    p90: quantile(sorted, 0.9),
    widths,
    terminals,
    terminalCount: terminals.length,
    terminalMedian,
    terminalRatio: median ? terminalMedian / median : 0,
    junctionCount: junctions.length,
    bodyN: bodyWidths.length,
    bodyWidths,
    bodyMedian,
    bodySd,
    /** The one to read: width variation along the pen's travel, fillets excluded. */
    bodyRelSd: bodyMedian ? bodySd / bodyMedian : 0,
    taperProfile: PROFILE_AT.map((at, k) => ({
      atMedians: at,
      hw: profileAcc[k].n ? profileAcc[k].s / profileAcc[k].n : null,
      ratio: profileAcc[k].n && median ? profileAcc[k].s / profileAcc[k].n / median : null,
      n: profileAcc[k].n,
    })),
    skeleton: sk,
    dt,
  }
}

/** Ink mask from a decoded RGBA buffer, using gate 1's own threshold + crop. */
export function maskFromRGBA(data, W, fullH, opts = {}) {
  const H = opts.crop === false ? fullH : Math.floor(fullH * HEIGHT_FRAC)
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l <= INK_MAX_LUMA) mask[p] = 1
    }
  }
  return { mask, W, H }
}

/** @param {Buffer} png */
export async function boundaryFromPng(png, opts = {}) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const { mask, W, H } = maskFromRGBA(data, img.width, img.height, opts)
  return boundaryStats(mask, W, H, opts)
}

/**
 * The one-line comparison of two states' boundaries.
 *
 * `emd` is in PIXELS of half-width, `emdRel` is that over the median, so a
 * value of 0.10 means "the two boundaries differ by a tenth of a stroke radius
 * on average". Zero means the two states have the same silhouette, which is the
 * defect.
 */
export function compareBoundaries(a, b) {
  const emd = wasserstein(a.widths, b.widths)
  const base = Math.max(a.median, b.median, 1e-6)
  return {
    emd,
    emdRel: emd / base,
    medianShift: b.median - a.median,
    medianShiftRel: (b.median - a.median) / base,
    sdShift: b.sd - a.sd,
    terminalRatioShift: b.terminalRatio - a.terminalRatio,
    inkShiftRel: a.inkPx ? (b.inkPx - a.inkPx) / a.inkPx : 0,
  }
}

/* -------------------------------------------------------------------------- */
/*  THE MUTATION CONTROL — taper a mask's terminals without touching the build */
/* -------------------------------------------------------------------------- */

/**
 * THE TAPER LAW, in one place, so the control and the proposal are the SAME LAW.
 *
 * `u` is arc position through the taper, 0 at the tip and 1 where the stroke
 * reaches full width. The exponent is BELOW 1 so the width climbs fast off the
 * tip and flattens into the body: that is what a nib leaving paper does, and it
 * is the same shape as the shipped Inflate profile (`INFLATE_PROFILE_EXP = 0.8`,
 * lib/geometry-engines.ts). It is deliberately NOT the shipped 0.8, because
 * `docs/research/stroke-width-models.md` §3.2 measures that exponent producing
 * `|dr/ds| > 1` over the first 0.195 R — a radius growing faster than the curve
 * advances, for which no envelope exists at all. At exponent 1.0 the profile is
 * linear in arc and `|dr/ds|` is bounded by `(1 - w0)/taperK`, which for the
 * constants below is 0.30. Valid by construction rather than by luck.
 */
export const PEN_TIP_FRACTION = 0.10
export const PEN_TAPER_RADII = 3.0
export const PEN_TAPER_EXP = 1.0
export const penTaperProfile = (u) =>
  PEN_TIP_FRACTION + (1 - PEN_TIP_FRACTION) * Math.pow(Math.max(0, Math.min(1, u)), PEN_TAPER_EXP)

/**
 * Remove ink outside a tapering half-width near every medial-axis terminal.
 *
 * This is the NEGATIVE CONTROL for `assert-flat-silhouette.mjs` and it is also
 * the exact law the `viewport-3d.tsx` proposal implements as a fragment
 * `discard`. Writing it once means the gate cannot be satisfied by a renderer
 * doing something other than what the control proves is detectable.
 *
 * SUBTRACTIVE, never additive — the same constraint `FlatState.jointBreak`
 * carries: ink may only be removed, so every surviving pixel is still at
 * exactly the one value and gate 1 cannot be broken by it.
 */
export function taperTerminals(stats, opts = {}) {
  const { W, H, mask, median, skeleton: sk, dt } = stats
  const taperLen = (opts.taperRadii ?? PEN_TAPER_RADII) * median
  const spurK = opts.spurK ?? 3.0
  const spurLen = spurK * median
  const out = Uint8Array.from(mask)

  const ends = []
  for (let p = 0; p < W * H; p++) if (sk[p] && degreeOf(sk, W, H, p) === 1) ends.push(p)

  // For every terminal branch, the nearest-point field over its neighbourhood.
  const reach = Math.ceil(median * 1.6)
  for (const e of ends) {
    const path = walkFromEnd(sk, W, H, e, dt, taperLen + 1)
    if (path[path.length - 1].arc < spurLen) continue // a spur, not a terminal
    const best = new Map() // pixel -> {d, arc}
    for (const s of path) {
      if (s.arc > taperLen) break
      const sx = s.p % W
      const sy = (s.p - sx) / W
      for (let y = Math.max(0, sy - reach); y <= Math.min(H - 1, sy + reach); y++) {
        for (let x = Math.max(0, sx - reach); x <= Math.min(W - 1, sx + reach); x++) {
          const q = y * W + x
          if (!out[q]) continue
          const d = Math.hypot(x - sx, y - sy)
          if (d > reach) continue
          const prev = best.get(q)
          if (!prev || d < prev.d) best.set(q, { d, arc: s.arc })
        }
      }
    }
    for (const [q, { d, arc }] of best) {
      const w = median * penTaperProfile(arc / taperLen)
      if (d > w) out[q] = 0
    }
  }
  return out
}

/** Render a mask to a PNG buffer, for eyeing what the instrument actually saw. */
export function maskPng(mask, W, H, overlay = null) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  const img = ctx.createImageData(W, H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const on = mask[p]
    const ov = overlay && overlay[p]
    img.data[i] = ov ? 220 : on ? 20 : 250
    img.data[i + 1] = ov ? 40 : on ? 20 : 250
    img.data[i + 2] = ov ? 40 : on ? 20 : 250
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c.toBuffer("image/png")
}
