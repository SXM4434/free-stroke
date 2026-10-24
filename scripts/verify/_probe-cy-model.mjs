// IS THE cy WALK THE SQUASH RELEASE? — a PREDICTION with no free parameters.
//
// `_probe-cy-step.mjs` locates the 2 px `cy` step at the capture's f22->f23 and
// shows what actually moved: the bbox TOP edge walks 351 -> 347 while the BOTTOM
// edge is 495 on every one of the 72 frames. That is a one-sided dilation, not a
// displacement. This asks the model whether it PREDICTED that, before looking:
//
//   `squashAt()` (hero-motion.ts) applies the wind-up as a non-uniform scale
//   PINNED AT THE CONTACT, and its own diagram says the release deliberately
//   outlives the anticipation clip and unwinds INSIDE the turn:
//
//       [ wait ][ compress ][ hold ] | [ release ] .......... the turn
//       |------ anticipation ------- | ---------- emerge ---------------
//
//   So predicted height h(t) = H0 * squashY(t) with the bottom pinned, i.e.
//   y0(t) = y1 - h(t) + 1, where H0 and y1 are read off the SETTLED frames of
//   the same capture and nothing else is fitted.
//
// Run:  node scripts/verify/_probe-cy-model.mjs --label=k7final
//
// Prints predicted vs measured y0/h/cy per frame, the rms, and the null model.

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "k7final")

const hm = loadTs("lib/hero-motion.ts")
const P = hm.DEFAULT_HERO_MOTION

const INK_MAX_LUMA = 150
async function bboxOf(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > INK_MAX_LUMA) continue
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
  return Number.isFinite(minY) ? { y0: minY, y1: maxY, h: maxY - minY + 1, w: maxX - minX + 1 } : null
}

const base = join(ROOT, "docs", "verification", "hero-transition", LABEL)
const man = JSON.parse(readFileSync(join(base, "emerge-manifest.json"), "utf8"))
const dir = join(base, "emerge")
const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()

const rows = []
for (let i = 0; i < files.length; i++) {
  const b = await bboxOf(join(dir, files[i]))
  const s = hm.sampleHeroMotion(P, man[i].t)
  rows.push({ i, t: man[i].t, phase: man[i].phase, ...b, sy: s.squashY, sx: s.squashX, yaw: s.yaw })
}

// H0 and the contact are read off the capture's own SETTLED frames — the tail,
// where squashY is exactly 1. Nothing is fitted to the frames being predicted.
const settledRows = rows.filter((r) => Math.abs(r.sy - 1) < 1e-9).slice(-10)
const H0 = Math.round(settledRows.reduce((a, r) => a + r.h, 0) / settledRows.length)
const Y1 = Math.round(settledRows.reduce((a, r) => a + r.y1, 0) / settledRows.length)
const off = hm.phaseOffsets(P)
const turnOut = Math.max(0, (P.beats.emerge - Math.max(0, P.emerge.dwellSec)) / 2)
console.log(`model: releaseLaw=${P.releaseLaw ?? "(default)"} scaleY=${P.anticipation.scaleY} scaleX=${P.anticipation.scaleX}`)
console.log(`       releaseSec=${P.anticipation.releaseSec} turnOut=${turnOut.toFixed(4)} -> release=${Math.min(P.anticipation.releaseSec, turnOut).toFixed(4)}s`)
console.log(`       off.anticipation=${off.anticipation.toFixed(3)} off.emerge=${off.emerge.toFixed(3)} beats.emerge=${P.beats.emerge.toFixed(4)}`)
console.log(`read off the capture's settled tail: H0=${H0}px  contact y1=${Y1}px  (nothing else fitted)\n`)

console.log("  f      t   phase        squashY   pred h  meas h   pred y0  meas y0   pred cy  meas cy")
let se = 0, sn = 0, seNull = 0, worst = 0
for (const r of rows) {
  const ph = H0 * r.sy
  const py0 = Y1 - ph + 1
  const pcy = (py0 + Y1) / 2
  const mcy = (r.y0 + r.y1) / 2
  const e = pcy - mcy
  se += e * e
  seNull += (mcy - (Y1 - H0 + 1 + Y1) / 2) ** 2 // null: never squashed
  sn++
  worst = Math.max(worst, Math.abs(e))
  console.log(
    [
      String(r.i).padStart(3),
      r.t.toFixed(3).padStart(7),
      String(r.phase ?? "-").padEnd(13),
      r.sy.toFixed(4).padStart(7),
      ph.toFixed(1).padStart(8),
      String(r.h).padStart(7),
      py0.toFixed(1).padStart(10),
      String(r.y0).padStart(8),
      pcy.toFixed(1).padStart(10),
      mcy.toFixed(1).padStart(8),
    ].join(" "),
  )
}
console.log(
  `\nPREDICTED cy   rms ${Math.sqrt(se / sn).toFixed(3)} px, worst ${worst.toFixed(2)} px` +
    `\nNULL (no squash) rms ${Math.sqrt(seNull / sn).toFixed(3)} px`,
)
const contact = new Set(rows.map((r) => r.y1))
console.log(`\ncontact edge y1 across all ${rows.length} frames: {${[...contact].join(", ")}}`)
