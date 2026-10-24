// THE CROSS-SECTION OF ONE STROKE, luma by luma — flat against lit.
//
// The interior statistics in `_probe-switch-tone.mjs` erode 3 px, and 3 px is
// exactly where a fresnel rim lives. So they can under-report the one cue the
// switch is supposed to arrive with. This walks a horizontal scanline across a
// single stroke and prints every pixel, which is the only reading that can say
// whether the lit form gains a highlight, a rim, both, or neither.
//
// It picks the scanline itself: the row with the widest single run of ink in
// the settled frame, so the profile is across a stroke rather than along one,
// and the SAME row and run are then read on every frame handed to it.
//
// Usage:
//   node scripts/verify/_probe-stroke-profile.mjs --label=before --frames=0,95
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "before")
const FRAMES = arg("frames", "0,95").split(",").map((s) => s.trim())
const ROW = arg("row", null)
const DIR = join(ROOT, "docs", "verification", "switch-tone", LABEL, "frames")

async function field(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  return { luma, W, H, data }
}

async function main() {
  const files = FRAMES.map((f) => join(DIR, String(f).padStart(4, "0") + ".png"))
  for (const f of files) if (!existsSync(f)) throw new Error(`missing frame: ${f}`)

  const last = await field(files[files.length - 1])
  let row = ROW ? parseInt(ROW, 10) : -1
  let runA = 0
  let runB = 0
  if (row < 0) {
    let best = 0
    for (let y = 0; y < last.H; y++) {
      let s = -1
      for (let x = 0; x < last.W; x++) {
        const ink = last.luma[y * last.W + x] <= 150
        if (ink && s < 0) s = x
        if ((!ink || x === last.W - 1) && s >= 0) {
          const len = x - s
          // A run wide enough to have an interior, narrow enough to be ONE
          // stroke rather than two fused ones. The word's strokes are ~22 px.
          if (len > best && len < 60) {
            best = len
            row = y
            runA = s
            runB = x
          }
          s = -1
        }
      }
    }
  }
  console.log(`scanline y=${row}, widest single ink run x=${runA}..${runB} (${runB - runA} px) in ${FRAMES[FRAMES.length - 1]}`)

  const pad = 8
  const x0 = Math.max(0, runA - pad)
  const x1 = Math.min(last.W - 1, runB + pad)

  const cols = []
  for (const [i, f] of files.entries()) {
    const fl = await field(f)
    const vals = []
    for (let x = x0; x <= x1; x++) vals.push(fl.luma[row * fl.W + x])
    cols.push({ name: `f${FRAMES[i]}`, vals })
  }
  console.log("\n  x   " + cols.map((c) => c.name.padStart(8)).join(""))
  for (let i = 0; i <= x1 - x0; i++) {
    console.log(
      String(x0 + i).padStart(5) + " " + cols.map((c) => c.vals[i].toFixed(1).padStart(8)).join(""),
    )
  }
  console.log("\nPER-FRAME, across this one stroke (ink pixels only, luma <= 150):")
  for (const c of cols) {
    const ink = c.vals.filter((v) => v <= 150)
    if (!ink.length) { console.log(`  ${c.name}  no ink on this row`); continue }
    const mn = Math.min(...ink)
    const mx = Math.max(...ink)
    const mean = ink.reduce((a, b) => a + b, 0) / ink.length
    console.log(
      `  ${c.name.padEnd(6)} n ${String(ink.length).padStart(3)}   min ${mn.toFixed(1).padStart(6)}   max ${mx.toFixed(1).padStart(6)}   mean ${mean.toFixed(1).padStart(6)}   RANGE ${(mx - mn).toFixed(1).padStart(6)}`,
    )
  }
  /* THE HEADLINE: the brightest thing anywhere on the mark. A lit object that
   * never gets brighter than its own ink has no highlight, and a switch to it
   * is a switch to the same picture. */
  console.log("\nBRIGHTEST INK PIXEL ANYWHERE ON THE MARK (whole frame, luma <= 150 mask):")
  for (const [i, f] of files.entries()) {
    const fl = await field(f)
    let mx = -1
    let n = 0
    for (let p = 0; p < fl.W * fl.H; p++) {
      if (fl.luma[p] > 150) continue
      n++
      if (fl.luma[p] > mx) mx = fl.luma[p]
    }
    console.log(`  f${FRAMES[i]}  brightest ink ${mx.toFixed(1)}  over ${n} ink px`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
