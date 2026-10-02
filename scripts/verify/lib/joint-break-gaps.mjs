// WHAT THE JOINT BREAK ACTUALLY OPENED — as GAPS, one per break, not as a total.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// Three gates asserted K7's news the same way: count the ink pixels that became
// paper and require the total to clear **200**.
//
//     assert-hero-k7-news      "K7 IS MEASURABLY DIFFERENT FROM K1"   lost > 200
//     assert-hero-k7-intact    "the LIVE beat reaches K7"             lost > 200
//     assert-hero-flatstate    "jointBreak RENDERS"                   lost >= 200
//
// A TOTAL CANNOT SEE A BREAK. It is the same blind spot
// `assert-hero-k7-intact.mjs` was written to close one level up — *"Every one of
// those quantities is a SUM. A sum cannot see a letter come apart."* Two breaks
// drawing double while a third draws nothing sums to the same number as three
// breaks drawing correctly, and 250 px scattered as a hundred antialiasing
// specks passes a bar that 172 px of three clean over/unders fails.
//
// And the bar was unreachable. Measured on this build, 2026-09-04, at the
// shipped law and the shipped carve:
//
//     junctions published        6
//     opened                     3       (3 dropped, each by a rule
//                                         `buildJointBreaks` justifies with a
//                                         rendered frame)
//     centreline cut             28.84 stroke units
//     predicted paper            188 px
//     measured paper             172 px  ratio 0.92, which the model row PASSES
//
// So the floor sat 6 % ABOVE the total the break table can produce. `lib/flat-ink.ts`
// says so in `buildJointBreaks`'s own comment and has since 2026-08-01: *"One
// crossing is 97 px of news against `assert-hero-k7-news`'s 200 px floor… SO THE
// TWO K7 GATES CANNOT BOTH HOLD ON THIS JUNCTION SET, and that is a property of
// the SET, not of the law."* Three gates have been red on it for a month.
//
// ── AND THE PICTURE IS FINE, WHICH IS THE POINT ────────────────────────────
//
// The three gaps were rendered and looked at at 8x on 2026-09-04
// (docs/verification/hero-k7/gaps/). Every one is an unambiguous over/under:
//
//     74 px   the `e` of Desk       the eye of the `e` opens; the crossbar
//                                   visibly passes under the bowl
//     52 px   the `D` of Doodles    a clean hairline the full width of the stem;
//                                   the horizontal reads as being in front
//     46 px   the `e` of Doodles    the counter opens into a slot
//
// That is exactly what §3 K7 asks for — *"the drawing's stroke junctions come
// back OPEN, later stroke in front, and the pen order is legible in ink alone"*
// — delivered, and rejected by the ruler. The row was wrong, not the beat.
//
// ── WHAT REPLACES IT, AND WHY IT IS HARDER ─────────────────────────────────
//
// `window.__heroBreaks` already publishes `opened` and a per-break `cut` (arc
// length of the under stroke removed). The band is a slab across the stroke, so
// each break's area is its own `cut × inkWidth`, in the same px/unit the
// aggregate row already computes. So the claim becomes:
//
//   1. the removed ink forms EXACTLY `opened` regions — no break silently
//      missing, no region that belongs to no break;
//   2. each region's area matches ITS OWN break's prediction;
//   3. the crumbs are counted rather than thresholded away.
//
// Every number on both sides is measured. There is no literal left, the aggregate
// is recoverable by summing, and a run that loses one break of three now goes red
// where the total never could.
//
// ── THE COMPARISON REFUSES A SIZE CHANGE ────────────────────────────────────
//
// `assert-hero-carve.mjs` shipped a `diffFrames` that walked one index across two
// buffers of different lengths and returned ZERO — "the same picture" — in both
// directions (fixed 2026-09-04, commit 9683ebf1; the capture that found it held
// 2 of 72 frames at a different height because the hero stage resized mid-run).
// This module cannot make that mistake quietly: `gapRegions` REFUSES a mismatched
// pair and says so in its return, and every caller is expected to fail a row on
// it rather than to drop the pair.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

/** Ink threshold, the same one every hero gate uses on this page's flat mark. */
export const INK_MAX = 150

/**
 * How far apart two removed pixels may be and still count as one gap, in px.
 *
 * 2, and it is the render's own number rather than a taste: the ink silhouette
 * is antialiased over about a pixel on each side, so a single gap can arrive as
 * two runs with one intermediate pixel that never crossed the ink threshold.
 * Bridging 2 closes that and nothing else — the three gaps this word actually
 * opens are 190 px and 228 px apart, two orders of magnitude clear of it.
 */
export const BRIDGE_PX = 2

/**
 * Regions below this many px are reported as CRUMBS and never merged into the
 * count. 8 px is one antialiasing run along a 12 px stroke edge; the smallest
 * real gap measured on this word is 46. Nothing is thresholded AWAY — a crumb
 * count that grows is a finding, so it is returned and the caller asserts on it.
 */
export const CRUMB_MAX = 8

/** Decode a PNG to a luminance array. */
async function luma(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const out = new Float32Array(img.width * img.height)
  for (let i = 0, p = 0; p < out.length; p++, i += 4)
    out[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  return { l: out, W: img.width, H: img.height }
}

/**
 * The gaps one frame opened in another.
 *
 * @param {Buffer} offPng the frame with the break CLOSED (K1, or jointBreak 0)
 * @param {Buffer} onPng  the frame with the break OPEN  (K7, or jointBreak 1)
 * @returns {Promise<{
 *   refused: string|null,
 *   removed: number, added: number,
 *   regions: {area:number, cx:number, cy:number, w:number, h:number}[],
 *   crumbs: number, crumbPx: number,
 * }>}
 *
 * `refused` is non-null when the two frames are not the same geometry. It is a
 * REFUSAL and not a zero: a comparison that did not happen must never read as a
 * comparison that found nothing.
 */
export async function gapRegions(offPng, onPng) {
  const a = await luma(offPng)
  const b = await luma(onPng)
  if (a.W !== b.W || a.H !== b.H) {
    return {
      refused:
        `${a.W}x${a.H} against ${b.W}x${b.H} — the two frames are not the same picture size, ` +
        `so an index-wise comparison would report a number about nothing. Re-capture both.`,
      removed: 0,
      added: 0,
      regions: [],
      crumbs: 0,
      crumbPx: 0,
    }
  }
  const off = new Uint8Array(a.W * a.H)
  const on = new Uint8Array(a.W * a.H)
  for (let p = 0; p < off.length; p++) {
    off[p] = a.l[p] <= INK_MAX ? 1 : 0
    on[p] = b.l[p] <= INK_MAX ? 1 : 0
  }
  return gapRegionsFromMasks(off, on, a.W, a.H)
}

/**
 * The same measurement on two ink masks that are already decoded.
 *
 * This is the entry point the gates use: `lib/flat-interior.mjs` hands them
 * `{mask, W, H}` and re-decoding the PNG to get back to the same bits would be a
 * second answer to one question. Same refusal rule — a length mismatch comes
 * back as `refused`, never as a zero.
 *
 * @param {Uint8Array} offMask 1 where the CLOSED frame has ink
 * @param {Uint8Array} onMask  1 where the OPEN frame has ink
 */
export function gapRegionsFromMasks(offMask, onMask, W, H) {
  if (offMask.length !== onMask.length || offMask.length !== W * H) {
    return {
      refused:
        `masks ${offMask.length} and ${onMask.length} against ${W}x${H} = ${W * H} — the two ` +
        `frames are not the same picture. An index-wise comparison across a size change returns ` +
        `zero in both directions, which reads as "no change". Re-capture both.`,
      removed: 0,
      added: 0,
      regions: [],
      crumbs: 0,
      crumbPx: 0,
    }
  }
  const gone = new Uint8Array(W * H)
  let removed = 0
  let added = 0
  for (let p = 0; p < gone.length; p++) {
    if (offMask[p] && !onMask[p]) {
      gone[p] = 1
      removed++
    } else if (!offMask[p] && onMask[p]) added++
  }

  /* Flood fill with a BRIDGE_PX neighbourhood. Iterative, because a region of a
   * few hundred pixels is small but the recursion limit is not worth finding out
   * about on somebody else's run. */
  const seen = new Uint8Array(W * H)
  const regions = []
  let crumbs = 0
  let crumbPx = 0
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      const s = y0 * W + x0
      if (!gone[s] || seen[s]) continue
      seen[s] = 1
      const stack = [x0, y0]
      let area = 0
      let sx = 0
      let sy = 0
      let minX = W
      let maxX = -1
      let minY = H
      let maxY = -1
      while (stack.length) {
        const y = stack.pop()
        const x = stack.pop()
        area++
        sx += x
        sy += y
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        for (let dy = -BRIDGE_PX; dy <= BRIDGE_PX; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= H) continue
          for (let dx = -BRIDGE_PX; dx <= BRIDGE_PX; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= W) continue
            const q = ny * W + nx
            if (gone[q] && !seen[q]) {
              seen[q] = 1
              stack.push(nx, ny)
            }
          }
        }
      }
      if (area <= CRUMB_MAX) {
        crumbs++
        crumbPx += area
        continue
      }
      regions.push({
        area,
        cx: sx / area,
        cy: sy / area,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      })
    }
  }
  regions.sort((p, q) => q.area - p.area)
  return { refused: null, removed, added, regions, crumbs, crumbPx }
}

/**
 * Line the measured regions up against the break table, biggest to biggest.
 *
 * The pairing is by AREA and not by position, and that is deliberate: the table
 * is in stroke space and the regions are in screen space, and inventing a map
 * between them would be a second implementation of the projection this gate does
 * not own. Ranking is enough for the claim being made — every break drew, and
 * each drew its own amount — and it cannot hide a missing break, which is the
 * failure the aggregate could not see.
 *
 * @param {{area:number}[]} regions   from `gapRegions`
 * @param {{cut:number}[]}  cuts      `window.__heroBreaks.cut`
 * @param {number} inkWidth  stroke units — `window.__heroJunctions.inkWidth`
 * @param {number} scale     px per stroke unit
 * @returns {{i:number, predicted:number, measured:number, ratio:number}[]}
 */
export function matchToBreaks(regions, cuts, inkWidth, scale) {
  const pred = cuts
    .map((c, i) => ({ i, predicted: c.cut * inkWidth * scale * scale }))
    .sort((p, q) => q.predicted - p.predicted)
  return pred.map((p, k) => {
    const measured = regions[k]?.area ?? 0
    return { ...p, measured, ratio: p.predicted > 0 ? measured / p.predicted : 0 }
  })
}
