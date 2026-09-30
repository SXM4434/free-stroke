// A CONTACT SHEET AT THE TIMES I NAME — for reading one shot at a time.
//
// The film's own contact sheets are dense and uniform, which is right for
// scanning the whole arc and wrong for judging a single shot: a 300px tile
// cannot tell a crisp edge from a muddy one. This cuts a sheet at explicit
// PLAYHEAD times, at whatever tile width is asked for, so a shot can be read at
// the size the defect lives at (§0.6: zoom in before you return).
//
//   node scripts/verify/_probe-film-sheet.mjs --label=shipped \
//        --times=0,0.5,1,1.5,2 --cols=5 --tw=520 --out=draw
//   ... --range=6.0:7.0:24        24 frames evenly across a playhead window
//   ... --crop=0.3,0.25,0.4,0.5   x,y,w,h as fractions of the stage — zoom in

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "shipped")
const BASE = join(ROOT, "docs", "verification", "hero-beat-film", LABEL)
const d = JSON.parse(readFileSync(join(BASE, "trace.json"), "utf8"))
const files = readdirSync(join(BASE, "frames")).filter((f) => f.endsWith(".png")).sort()

const play = (() => {
  const i0 = d.trace.findIndex((r) => r[1] > 0.001)
  return i0 >= 0 ? d.trace.slice(i0) : d.trace
})()
const t0 = play[0][0]
// playhead -> tape seconds, off the trace
const tapeOf = (t) => {
  let b = play[0]
  for (const r of play) if (Math.abs(r[1] - t) < Math.abs(b[1] - t)) b = r
  return (b[0] - t0) / 1000
}
const frameAt = (tape) => {
  let b = 0
  for (let i = 0; i < d.manifest.length; i++) {
    if (Math.abs(d.manifest[i].tSec - tape) < Math.abs(d.manifest[b].tSec - tape)) b = i
  }
  return b
}
const phaseAt = (t) => {
  let b = play[0]
  for (const r of play) if (Math.abs(r[1] - t) < Math.abs(b[1] - t)) b = r
  return b[2]
}

let times = []
const range = arg("range", null)
if (range) {
  const [a, b, n] = range.split(":").map(Number)
  for (let i = 0; i < n; i++) times.push(a + ((b - a) * i) / (n - 1))
} else {
  times = (arg("times", "0") || "").split(",").map(Number)
}
const COLS = parseInt(arg("cols", "6"), 10)
const TW = parseInt(arg("tw", "420"), 10)
const CROP = arg("crop", null)?.split(",").map(Number) ?? null
const OUTNAME = arg("out", "sheet")

const first = await loadImage(join(BASE, "frames", files[0]))
const src = CROP
  ? { x: CROP[0] * first.width, y: CROP[1] * first.height, w: CROP[2] * first.width, h: CROP[3] * first.height }
  : { x: 0, y: 0, w: first.width, h: first.height }
const TH = Math.round((TW * src.h) / src.w)
const rows = Math.ceil(times.length / COLS)
const c = createCanvas(COLS * TW, rows * (TH + 22))
const ctx = c.getContext("2d")
ctx.fillStyle = "#101010"
ctx.fillRect(0, 0, c.width, c.height)

for (let i = 0; i < times.length; i++) {
  const t = times[i]
  const fi = frameAt(tapeOf(t))
  const img = await loadImage(join(BASE, "frames", files[fi]))
  const x = (i % COLS) * TW
  const y = Math.floor(i / COLS) * (TH + 22)
  ctx.drawImage(img, src.x, src.y, src.w, src.h, x, y, TW, TH)
  ctx.fillStyle = "#f0f0f0"
  ctx.font = "15px monospace"
  ctx.fillText(`t=${t.toFixed(2)}s  ${phaseAt(t) ?? ""}  [f${fi}]`, x + 5, y + TH + 16)
  ctx.strokeStyle = "#333"
  ctx.strokeRect(x, y, TW, TH)
}
mkdirSync(join(BASE, "sheets"), { recursive: true })
const p = join(BASE, "sheets", `${OUTNAME}.png`)
writeFileSync(p, c.toBuffer("image/png"))
console.log(`${p}  ${c.width}x${c.height}  (${times.length} frames)`)
