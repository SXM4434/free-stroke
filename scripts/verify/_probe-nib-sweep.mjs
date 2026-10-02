/**
 * THE NIB'S TWO DIALS, RENDERED AND MEASURED — the sweep the default rests on.
 *
 * N6, 2026-08-28. `docs/DISPATCH.md` §2.8: *"Open picks stay open. Sebs-only
 * calls are kept as dials and surfaced in prose with a recommendation. Never
 * silently defaulted."* The nib's aspect and angle are exactly that — they
 * change what the mark IS — so this renders the silhouette at each setting and
 * measures it, and the recommendation is made against the sheet rather than
 * against the research doc's table.
 *
 * It measures with `_nib-measure.mjs`, the same ruler `assert-nib-contrast.mjs`
 * uses, so the number that argues for the default is the number the gate reads.
 *
 * Usage:  node scripts/verify/_probe-nib-sweep.mjs
 * Out:    docs/verification/nib-2026-08-28/sweep/
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { arm } from "./_nib-measure.mjs"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "verification",
  "nib-2026-08-28",
  "sweep",
)
mkdirSync(OUT, { recursive: true })

/** The silhouette, downscaled, so the sheet is lookable at 1×. */
function writeMask(a, name) {
  const S = 3
  const W = Math.ceil(a.mask.W / S)
  const H = Math.ceil(a.mask.H / S)
  const cv = createCanvas(W, H)
  const ctx = cv.getContext("2d")
  const img = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Box filter, so a hairline never disappears between two texels.
      let hit = 0
      let n = 0
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const sxp = x * S + dx
          const syp = y * S + dy
          if (sxp >= a.mask.W || syp >= a.mask.H) continue
          n++
          hit += a.mask.mask[syp * a.mask.W + sxp]
        }
      }
      const v = n ? 255 - Math.round((hit / n) * 255) : 255
      const p = (y * W + x) * 4
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  writeFileSync(join(OUT, name), cv.toBuffer("image/png"))
  return { W, H }
}

const rows = []
function run(label, overrides, file) {
  const a = arm(overrides)
  const size = writeMask(a, file)
  const r = {
    label,
    ...overrides,
    contrastMesh: +a.contrast.toFixed(3),
    contrastFormula: +a.dbg.nibContrastBuilt.toFixed(3),
    thinnestR: +a.lo.toFixed(3),
    thickestR: +a.hi.toFixed(3),
    fittedAngleWorld: a.fittedAngleWorldDeg,
    meanWidthR: +a.dbg.nibMeanWidth.toFixed(3),
    hairlinePctTravel: +(a.dbg.nibHairlineFrac * 100).toFixed(1),
    inkPx: a.ink,
    counters: a.counters.length,
    counterTotal: a.counterTotal,
    counterMin: a.counterMin,
    file,
    size,
  }
  rows.push(r)
  console.log(
    `${label.padEnd(22)} contrast ${String(r.contrastMesh).padStart(6)} : 1  ` +
      `ink ${String(r.inkPx).padStart(7)}  counters ${String(r.counters).padStart(2)} / ${String(r.counterTotal).padStart(6)} ` +
      `(min ${String(r.counterMin).padStart(5)})  mean ${r.meanWidthR} R  hairline ${r.hairlinePctTravel} %`,
  )
  return r
}

console.log("\n=== ASPECT SWEEP, nib angle 30° ===")
for (const aspect of [1.0, 1.4, 1.8, 2.4, 3.0]) {
  run(`aspect ${aspect} @ 30°`, { nibAspect: aspect, nibAngleDeg: 30 }, `aspect-${aspect}-ang30.png`)
}

console.log("\n=== ANGLE SWEEP, aspect 1.8 ===")
for (const deg of [0, 15, 45, 60]) {
  run(`aspect 1.8 @ ${deg}°`, { nibAspect: 1.8, nibAngleDeg: deg }, `aspect-1.8-ang${deg}.png`)
}

console.log("\n=== ANGLE SWEEP, aspect 2.4 ===")
for (const deg of [0, 30]) {
  run(`aspect 2.4 @ ${deg}°`, { nibAspect: 2.4, nibAngleDeg: deg }, `aspect-2.4-ang${deg}.png`)
}

writeFileSync(join(OUT, "sweep.json"), JSON.stringify(rows, null, 2))
console.log(`\nsheet: ${OUT}`)
