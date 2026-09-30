// THE PROPOSED FIX, AS A MASK OPERATION — shared by the probe and the gate.
//
// A fragment `discard` does exactly one thing: it intersects the rendered mark
// with a mask. So the shader change specified for `components/viewport-3d.tsx`
// is reproducible offline, pixel for pixel, by rendering the nib outline from
// the SAME strokes at the SAME footprint and AND-ing it with the live frame.
//
// It lives here rather than inside either caller because it is used twice and
// for opposite purposes, and a second copy of it would be a second law:
//
//   `_probe-carve-preview.mjs`      to MEASURE what the fix buys.
//   `assert-flat-silhouette.mjs`    as the MUTATION CONTROL — the gate must go
//                                   green under exactly this operation and red
//                                   without it, or its rows cannot fail.
import { loadTs } from "../_ts-load.mjs"
import { processedHeroStrokes } from "../_hero-word.mjs"
import { maskFromRGBA } from "./medial-width.mjs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")
const { makeFlatRenderer, NIB_ANGLE_RAD, PEN_TAPER_RADII, PEN_TIP_FRACTION, NIB_ASPECT_DEFAULT } =
  loadTs("lib/flat-ink.ts")

export const RECOMMENDED_NIB = {
  aspect: NIB_ASPECT_DEFAULT,
  angle: NIB_ANGLE_RAD,
  taperRadii: PEN_TAPER_RADII,
  tip: PEN_TIP_FRACTION,
}

const strokes = processedHeroStrokes()
const polylines = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))

export function renderStrokeMask(W, H, footprint, nib, inkPx) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  makeFlatRenderer(polylines, footprint, strokes, nib, inkPx).draw(ctx, 1, "#000000")
  return maskFromRGBA(ctx.getImageData(0, 0, W, H).data, W, H, { crop: false }).mask
}

const iou = (a, b, n) => {
  let i = 0
  let u = 0
  for (let p = 0; p < n; p++) {
    if (a[p] || b[p]) u++
    if (a[p] && b[p]) i++
  }
  return u ? i / u : 0
}

/**
 * FIT THE STROKE-SPACE -> SCREEN MAP AGAINST A LIVE FRAME.
 *
 * FOUR scalars: word width, centre x, centre y, ink diameter. No depth term,
 * because under the orthographic camera the hero stage now mounts there is no
 * perspective divide to carry one — which is the specific reason this is
 * tractable at all and was not when `viewport-3d.tsx:561` rejected it.
 *
 * The fourth is the interesting one and it is not registration: the two
 * renderers' stroke WEIGHTS come from different constants and disagree by about
 * 12 %, which explainer 14 §3 already names as *"a stroke-weight mismatch of
 * about 11 % by construction."* Fitting it separates the mismatch of one scalar
 * from a mismatch of coordinate systems.
 */
export function fitFootprint(live, W, H, seedInk = 14) {
  let bx0 = 1e9
  let bx1 = -1
  let by0 = 1e9
  let by1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (live[y * W + x]) {
        if (x < bx0) bx0 = x
        if (x > bx1) bx1 = x
        if (y < by0) by0 = y
        if (y > by1) by1 = y
      }
  let best = { w: bx1 - bx0 + 1, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2, ink: seedInk, iou: 0 }
  for (const step of [8, 3, 1, 0.4]) {
    let improved = true
    while (improved) {
      improved = false
      for (const [dw, dx, dy, di] of [
        [step, 0, 0, 0], [-step, 0, 0, 0],
        [0, step, 0, 0], [0, -step, 0, 0],
        [0, 0, step, 0], [0, 0, -step, 0],
        [0, 0, 0, step], [0, 0, 0, -step],
      ]) {
        const cand = { w: best.w + dw, cx: best.cx + dx, cy: best.cy + dy, ink: best.ink + di }
        if (cand.ink <= 2 || cand.w <= 10) continue
        const v = iou(live, renderStrokeMask(W, H, cand, null, cand.ink), W * H)
        if (v > best.iou + 1e-6) {
          best = { ...cand, iou: v }
          improved = true
        }
      }
    }
  }
  return best
}

/**
 * Intersect a live frame's ink with the nib outline. SUBTRACTIVE by
 * construction: pixels the nib would have added outside the live mark are
 * counted and returned rather than drawn, because a `discard` cannot express
 * them and a control that quietly added ink would be proving the wrong thing.
 */
export function nibCarve(live, W, H, footprint, nib = RECOMMENDED_NIB) {
  const nibMask = renderStrokeMask(W, H, footprint, nib, footprint.ink)
  const carved = new Uint8Array(W * H)
  let removed = 0
  let wouldAdd = 0
  for (let p = 0; p < W * H; p++) {
    if (live[p] && nibMask[p]) carved[p] = 1
    else if (live[p]) removed++
    else if (nibMask[p]) wouldAdd++
  }
  return { carved, removed, wouldAdd, nibMask }
}
