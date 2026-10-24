// DERIVE THE LEGIBILITY FLOOR FROM THE FONT'S OWN GEOMETRY.
//
// Sebs, 2026-08-02: *"the 3d text is fully distorted worse when u type ur own
// text."*
//
// Two mechanisms produce that picture and this probe measures the second one.
// (The first — the font only had seven glyphs, so 20 of the 25 characters in
// "the quick brown fox jumps" drew NOTHING — is fixed in
// `scripts/capture/letters.mjs` and is not a threshold question.)
//
// The second is the one the previous lane named: `buildFontStrokes` scaled the
// laid-out word to a FIXED target width, `k = FONT_TARGET_W / laid.width`,
// while the nib stayed at `HERO_INK_WIDTH_PX`. So the longer the text, the
// smaller every glyph got underneath a nib that never shrank. The quantity that
// actually decides whether a letterform survives is therefore not the text
// length and not `k` — it is the RATIO
//
//     R = nib diameter / cap height
//
// and everything else is a way of arriving at some value of it. Measured on the
// shipped page, R runs from 0.029 on a two-character word to 0.300 on a
// 25-character one: a 10x swing on the one number that decides whether an `e`
// has an eye.
//
// ── WHAT IS MEASURED, AND WHY IT IS THE RIGHT THING ─────────────────────────
//
// A pen laying ink along a path sweeps a disc of the nib's diameter. So the ink
// is the Minkowski sum of the centreline with that disc, and that is exactly
// what is rasterised here — the same model `stampPenClock(..., {nibDiameter})`
// and the tube builder use, not an approximation of it.
//
// Two topological facts are then read off the raster:
//
//   COUNTERS  — background components that do not touch the border: the eye of
//               the `e`, the ring of the `o`, the two holes in an `8`. A closed
//               counter is a letter that has become a blob, which is the defect
//               in one word.
//   PIECES    — ink components. A letter that comes apart, or two letters that
//               fuse into one, both show up here.
//
// Both are counted against a REFERENCE render of the same glyph at a nib so
// fine it cannot fuse anything (R = 0.01), which is the authored topology. So
// the threshold is derived from the smallest feature the designer actually
// drew, per glyph, rather than from a number that looked right on one string.
//
// Usage: node scripts/verify/_probe-font-legibility.mjs [--verbose]
import { SUPPORTED, layoutWord } from "../capture/letters.mjs"
import { loadTs } from "./_ts-load.mjs"

const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")
export const INK = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

const VERBOSE = process.argv.includes("--verbose")

/* ---------------------------------------------------------------------------
 * The rasteriser: a disc of diameter `nib` swept along every polyline.
 *
 * Only the pixels inside each segment's own bounding box (grown by the nib
 * radius) are ever visited, so the cost is proportional to the INK area rather
 * than to the frame — which is what makes a sweep over 97 glyphs x 40 ratios
 * finish in seconds instead of minutes.
 * ------------------------------------------------------------------------ */
function raster(polylines, nib, pxPerUnit) {
  const r = nib / 2
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const pl of polylines) {
    for (const p of pl) {
      if (p.x < x0) x0 = p.x
      if (p.y < y0) y0 = p.y
      if (p.x > x1) x1 = p.x
      if (p.y > y1) y1 = p.y
    }
  }
  if (!Number.isFinite(x0)) return null
  // A two-pixel margin of guaranteed paper all round, so a counter can never be
  // confused with the outside just because the ink ran to the frame edge.
  const pad = r + 3 / pxPerUnit
  x0 -= pad
  y0 -= pad
  x1 += pad
  y1 += pad
  const W = Math.max(4, Math.ceil((x1 - x0) * pxPerUnit))
  const H = Math.max(4, Math.ceil((y1 - y0) * pxPerUnit))
  const ink = new Uint8Array(W * H)
  const rPx = r * pxPerUnit
  const r2 = rPx * rPx

  for (const pl of polylines) {
    for (let i = 1; i < pl.length; i++) {
      const ax = (pl[i - 1].x - x0) * pxPerUnit
      const ay = (pl[i - 1].y - y0) * pxPerUnit
      const bx = (pl[i].x - x0) * pxPerUnit
      const by = (pl[i].y - y0) * pxPerUnit
      const lo_x = Math.max(0, Math.floor(Math.min(ax, bx) - rPx))
      const hi_x = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + rPx))
      const lo_y = Math.max(0, Math.floor(Math.min(ay, by) - rPx))
      const hi_y = Math.min(H - 1, Math.ceil(Math.max(ay, by) + rPx))
      const vx = bx - ax
      const vy = by - ay
      const dd = vx * vx + vy * vy
      for (let py = lo_y; py <= hi_y; py++) {
        const row = py * W
        for (let px = lo_x; px <= hi_x; px++) {
          if (ink[row + px]) continue
          const qx = px + 0.5 - ax
          const qy = py + 0.5 - ay
          let t = dd > 1e-12 ? (qx * vx + qy * vy) / dd : 0
          if (t < 0) t = 0
          else if (t > 1) t = 1
          const ex = qx - t * vx
          const ey = qy - t * vy
          if (ex * ex + ey * ey <= r2) ink[row + px] = 1
        }
      }
    }
  }
  return { ink, W, H }
}

/** Connected components of `want` in the mask. 8-connected for ink,
 *  4-connected for paper — the standard pairing, without which a diagonal
 *  hairline of ink both separates the paper and does not. */
function components(mask, W, H, want, eight) {
  const seen = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  let count = 0
  const touching = []
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || mask[i] !== want) continue
    let sp = 0
    stack[sp++] = i
    seen[i] = 1
    let border = false
    let size = 0
    while (sp > 0) {
      const c = stack[--sp]
      size++
      const cx = c % W
      const cy = (c - cx) / W
      if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) border = true
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (!eight && dx !== 0 && dy !== 0) continue
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const n = ny * W + nx
          if (seen[n] || mask[n] !== want) continue
          seen[n] = 1
          stack[sp++] = n
        }
      }
    }
    count++
    touching.push({ border, size })
  }
  return { count, parts: touching }
}

/**
 * The topology of one glyph at a given nib-to-cap ratio.
 *
 * `pieces` counts ink components; `counters` counts enclosed paper. A counter
 * has to be bigger than a single pixel to count, so an anti-aliasing-free
 * raster cannot report a one-pixel crack as a surviving eye — the exact way an
 * instrument in this repo has reported green while measuring nothing.
 */
export function topology(polylines, capUnits, ratio, pxPerCap = 420) {
  const pxPerUnit = pxPerCap / capUnits
  const nib = ratio * capUnits
  const r = raster(polylines, nib, pxPerUnit)
  if (!r) return { pieces: 0, counters: 0 }
  const inkC = components(r.ink, r.W, r.H, 1, true)
  const paperC = components(r.ink, r.W, r.H, 0, false)
  const MIN_COUNTER_PX = Math.max(4, Math.round(pxPerCap * pxPerCap * 2e-5))
  return {
    pieces: inkC.count,
    counters: paperC.parts.filter((p) => !p.border && p.size >= MIN_COUNTER_PX).length,
  }
}

/** Every glyph the font can draw, laid out alone. */
export function glyphPolylines(ch, size = 120, tracking = 0) {
  return layoutWord(ch, { x: 0, y: 0, size, tracking }).polylines
}

/**
 * THE SHIPPED RATIO — the nib against the cap height the hero word renders at.
 *
 * `buildFontStrokes` lays "Desk Doodles" out at cap 120 and scales it by
 * `k = 1100 / 1022.4`, so its cap height on the page is `120 · k` and the nib
 * is `HERO_INK_WIDTH_PX`. Derived here rather than written down, so it tracks
 * the page instead of restating a number that could drift out from under it.
 */
export const DD_WIDTH = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 }).width
export const SHIPPED_R = INK / (120 * (1100 / DD_WIDTH))

/**
 * ⚠ THE REFERENCE IS THE SHIPPED WEIGHT, NOT A HAIRLINE — and finding that out
 * is the most useful thing this probe did.
 *
 * The first version of this instrument took the authored topology at R → 0, on
 * the reasoning that an infinitely fine pen shows what the designer drew. It
 * reported the `e` as having ZERO counters, and it was right: the `e`'s arc
 * crosses the bar's baseline at x = 6 while the bar itself starts at x = 8, so
 * with a hairline the eye LEAKS through a 2-unit gap at the left and joins the
 * open lower half. The `e`'s eye is not closed by the outline. It is closed by
 * the ink.
 *
 * So a letterform in a single-stroke font is not a shape that ink is poured
 * into — it is a shape the ink MAKES, and it only exists inside a band of pen
 * weights. Referencing R → 0 would have gated the font against a picture that
 * has never been on screen. The reference is therefore `SHIPPED_R`: the exact
 * weight of the hero word Sebs has already approved.
 */
export function refTopology(ch) {
  const pls = glyphPolylines(ch)
  if (pls.length === 0) return null
  return topology(pls, 120, SHIPPED_R)
}

/**
 * The nib-to-cap ratio at which a glyph departs from how it renders at the
 * shipped weight — its counter closes, or its pieces merge. Bisected between
 * the shipped ratio and `hi`, so the answer is the geometry's and not a sweep
 * grid's.
 */
export function breakRatio(ch, hi = 0.6) {
  const pls = glyphPolylines(ch)
  if (pls.length === 0) return null
  const ref = topology(pls, 120, SHIPPED_R)
  const ok = (rr) => {
    const t = topology(pls, 120, rr)
    return t.counters === ref.counters && t.pieces === ref.pieces
  }
  let lo = SHIPPED_R
  if (ok(hi)) return hi
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) lo = mid
    else hi = mid
  }
  return lo
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chars = [...SUPPORTED].filter((c) => c !== " ")
  const rows = []
  for (const ch of chars) {
    rows.push({ ch, ref: refTopology(ch), br: breakRatio(ch) })
  }
  rows.sort((a, b) => a.br - b.br)
  console.log(`nib (stroke px)            ${INK.toFixed(3)}`)
  console.log(`"Desk Doodles" cap (px)    ${(120 * (1100 / DD_WIDTH)).toFixed(3)}`)
  console.log(`SHIPPED R = nib / cap      ${SHIPPED_R.toFixed(4)}   <- the reference weight\n`)
  console.log("THE SMALLEST AUTHORED FEATURE IN EACH GLYPH, as the nib/cap ratio that closes it")
  console.log("(low = tight glyph; the whole font is only as legible as its tightest one)\n")
  console.log("  char   pieces  counters   departs from shipped at R")
  for (const r of VERBOSE ? rows : rows.slice(0, 20)) {
    console.log(
      `  ${JSON.stringify(r.ch).padEnd(6)} ${String(r.ref.pieces).padStart(5)} ${String(
        r.ref.counters,
      ).padStart(9)}      ${r.br.toFixed(4)}`,
    )
  }
  const worst = rows[0]
  console.log(
    `\nFONT CEILING  R_max = ${worst.br.toFixed(4)}  (set by ${JSON.stringify(worst.ch)})`,
  )
  console.log(
    `              headroom over the shipped weight: ${(worst.br / SHIPPED_R).toFixed(2)}x`,
  )
  console.log(
    `              i.e. a cap height below ${(INK / worst.br).toFixed(1)} stroke px breaks that glyph.`,
  )
}
