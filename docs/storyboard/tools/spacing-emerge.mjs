// WHERE THE CURRENT BEAT'S BREAKDOWN SITS — measured, both readings, four windows.
//
// reference-film-mechanics.md §6.5 places every transit in the reference set by
// two independent readings, and treats their agreement as the check that the
// metric is measuring the move rather than the metric:
//
//   value-half — the instant 50% of the total change has happened
//   extreme    — the frame maximising min(distance to start, distance to end),
//                i.e. the breakdown in the animator's sense
//
//   arrival  9-37%   |   dead band 42-58%   |   wind-up 79-93%
//
// The board's B2 puts our emerge at 42%, from a 10-sample series quoted in
// explainer 14. This re-measures it from the CHECKED-IN capture, at 31-72
// samples, with the statistic the shipped gate uses (interior ink SD), so the
// number stops depending on a series someone typed into a doc.
//
// It reads the SCRUB capture, not the film. That matters: the scrub drives the
// page's own transport to N playhead positions and screenshots each, so it shows
// the beat's DESIGNED tempo. The film `desk-doodles-hero-v2.webm` is a real-time
// recording made 2026-07-29, while the 1.1s reveal stall was still live
// (explainer 18) — its emerge got zero rendered frames, so its per-frame series
// is a record of the stall and not of the beat.
//
// Usage: node docs/storyboard/tools/spacing-emerge.mjs
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const BASE = join(ROOT, "docs", "verification", "hero-transition", "after")

// Same constants as scripts/verify/assert-hero-transition.mjs — the point is to
// measure the quantity the gate measures, not a lookalike.
const INK_MAX_LUMA = 150
const ERODE = 3

async function measure(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      luma[p] = l
      mask[p] = l <= INK_MAX_LUMA ? 1 : 0
    }
  }
  let minX = Infinity
  let maxX = -Infinity
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
  }
  if (!Number.isFinite(minX)) return null
  let cur = mask
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    }
    cur = next
  }
  let n = 0, sum = 0, sq = 0
  for (let p = 0; p < W * H; p++) {
    if (!cur[p]) continue
    const l = luma[p]
    n++; sum += l; sq += l * l
  }
  if (!n) return null
  const mean = sum / n
  return { sd: Math.sqrt(Math.max(0, sq / n - mean * mean)), w: maxX - minX + 1, cx: (minX + maxX) / 2 }
}

const man = JSON.parse(readFileSync(join(BASE, "emerge-manifest.json"), "utf8"))
const files = readdirSync(join(BASE, "emerge")).filter((f) => f.endsWith(".png")).sort()

const rows = []
for (let i = 0; i < files.length; i++) {
  const m = await measure(join(BASE, "emerge", files[i]))
  if (m) rows.push({ ...m, t: man[i].t })
}

const band = (p) =>
  p < 37 ? "ARRIVAL" : p > 79 ? "WIND-UP" : p >= 42 && p <= 58 ? "*** DEAD BAND ***" : "fade cluster"

function spacing(a, b, label) {
  const seg = rows.slice(a, b + 1).map((r) => r.sd)
  const lo = seg[0]
  const hi = seg[seg.length - 1]
  const target = lo + (hi - lo) * 0.5
  let half = null
  for (let k = 1; k < seg.length; k++) {
    if ((seg[k - 1] - target) * (seg[k] - target) <= 0 && seg[k - 1] !== seg[k]) {
      half = (k - 1 + (target - seg[k - 1]) / (seg[k] - seg[k - 1])) / (seg.length - 1)
      break
    }
  }
  let ext = 0
  let extv = -1
  for (let k = 0; k < seg.length; k++) {
    const v = Math.min(Math.abs(seg[k] - lo), Math.abs(seg[k] - hi))
    if (v > extv) { extv = v; ext = k / (seg.length - 1) }
  }
  const hp = half === null ? NaN : 100 * half
  console.log(
    `${label.padEnd(48)} t ${rows[a].t.toFixed(2)}->${rows[b].t.toFixed(2)}  span ${(hi - lo).toFixed(2)}` +
      `  value-half ${hp.toFixed(1)}%  extreme ${(100 * ext).toFixed(1)}%   ${band(hp)}`,
  )
}

let i0 = 0
while (i0 < rows.length && rows[i0].sd < 0.02) i0++
const parkedEnd = rows.findIndex((r) => r.t > rows[0].t + 0.55) - 1

console.log(`emerge scrub: ${rows.length} frames, t ${rows[0].t}..${rows[rows.length - 1].t}`)
console.log(`ink SD : ${rows.map((r) => r.sd.toFixed(2)).join(" ")}`)
console.log(`bbox w : ${rows.map((r) => r.w).join(" ")}`)
console.log()
spacing(0, parkedEnd, "gate's parked window (breath tail + emerge)")
spacing(i0 - 1, parkedEnd, "emerge only, from first tonal movement")
spacing(i0 - 1, rows.length - 1, "the whole tonal transit (runs into the tilt)")
console.log()

const parked = rows.slice(0, parkedEnd + 1)
const wSet = new Set(parked.map((r) => r.w))
const cxSet = new Set(parked.map((r) => r.cx))
console.log(
  `THE POSE, over the ${parked.length} parked frames the gate judges:\n` +
    `  bbox width takes ${wSet.size} distinct value(s): ${[...wSet].join(", ")}\n` +
    `  bbox cx    takes ${cxSet.size} distinct value(s): ${[...cxSet].join(", ")}\n` +
    `  over the whole ${rows.length}-frame capture width moves ${rows[0].w} -> ${rows[rows.length - 1].w} ` +
    `(${((100 * (rows[rows.length - 1].w - rows[0].w)) / rows[0].w).toFixed(1)}%)\n\n` +
    `  §6.5's own explanation of the dead band is "transitions with no pose to\n` +
    `  break down". This beat does not merely SPACE like an opacity fade — it IS\n` +
    `  one: there is no pose to break down, because the silhouette never changes.`,
)
