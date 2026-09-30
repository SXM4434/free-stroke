// PER-FRAME INK / EXTENT / REGISTRATION over a captured hero window.
//
// The gates say pass or fail; this says WHAT THE SERIES LOOKS LIKE, which is
// what a diagnosis needs. It is how the registration defect was read off the
// beat rather than guessed at: `cx` starts on the optical axis (559.5), runs
// out to 502 near 45deg of yaw, returns to 559.5 at the sliver, and does the
// whole excursion again on the way back. Both ends sit on the axis, so nothing
// is off-centre — which is what falsified the wrong-pivot reading.
//
// `mean` is the INTERIOR mean (eroded), the same statistic the value-wash gate
// judges, so a peak seen here is the peak that gate sees.
//
// Usage: node scripts/verify/_probe-hero-emerge.mjs [--label=turn4] [--dir=emerge]
import { readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "turn4")
const SUB = arg("dir", "emerge")
const DIR = join(ROOT, "docs", "verification", "hero-transition", LABEL, SUB)
if (!existsSync(DIR)) {
  console.error(`no such window: ${DIR}`)
  process.exit(1)
}

const INK_MAX = 150
/** Matches `assert-hero-transition.mjs`: drop the antialiased boundary ramp so
 *  `mean` is the surface's value and not the edge's. */
const ERODE = 3

console.log(`${LABEL}/${SUB}`)
console.log("frame     ink     w    cx     h    cy    mean(interior)")
let prevCx = null
let maxStep = 0
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".png")).sort()) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const H = Math.floor(img.height * 0.75)
  const W = img.width
  const mask = new Uint8Array(W * H)
  const luma = new Float32Array(W * H)
  let n = 0
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      luma[y * W + px] = l
      if (l <= INK_MAX) {
        mask[y * W + px] = 1
        n++
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  // Erode by ERODE with a square structuring element, the cheap way: a pixel
  // survives only if the whole (2E+1)^2 neighbourhood is ink.
  let sum = 0
  let cnt = 0
  for (let y = ERODE; y < H - ERODE; y++) {
    for (let px = ERODE; px < W - ERODE; px++) {
      if (!mask[y * W + px]) continue
      let ok = true
      for (let dy = -ERODE; dy <= ERODE && ok; dy++)
        for (let dx = -ERODE; dx <= ERODE; dx++)
          if (!mask[(y + dy) * W + px + dx]) {
            ok = false
            break
          }
      if (ok) {
        sum += luma[y * W + px]
        cnt++
      }
    }
  }
  const w = maxX < 0 ? 0 : maxX - minX + 1
  const cx = n ? (minX + maxX) / 2 : null
  if (cx !== null && prevCx !== null) maxStep = Math.max(maxStep, Math.abs(cx - prevCx))
  if (cx !== null) prevCx = cx
  console.log(
    f.replace(".png", ""),
    String(n).padStart(7),
    String(w).padStart(5),
    (cx === null ? "-" : cx.toFixed(1)).padStart(6),
    String(maxY < 0 ? 0 : maxY - minY + 1).padStart(5),
    (n ? ((minY + maxY) / 2).toFixed(1) : "-").padStart(6),
    cnt ? (sum / cnt).toFixed(1).padStart(6) : "     -",
    cnt ? `(${cnt}px)` : "",
  )
}
console.log(`max |cx| step across the window: ${maxStep.toFixed(2)} px`)
