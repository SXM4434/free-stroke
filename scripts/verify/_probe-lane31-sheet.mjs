// WATCH IT BACK — a contact sheet from a captured film, so the beat can be read
// frame by frame rather than trusted.
//
// A still cannot show crawl, strobing or judder, and a video file cannot be
// read by anything that only takes pictures. This lays every Nth frame of a
// capture out in reading order at a chosen scale, with the frame index burnt
// in, which is the form a motion defect actually shows up in.
//
// Usage: node scripts/verify/_probe-lane31-sheet.mjs --dir=<frames dir> [--every=6] [--scale=0.5] [--cols=6] [--crop=x,y,w,h]
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const DIR = join(ROOT, arg("dir", "docs/verification/hero-transition/lane31/scrub"))
const EVERY = Number(arg("every", "6"))
const SCALE = Number(arg("scale", "0.5"))
const COLS = Number(arg("cols", "6"))
const CROP = arg("crop", null)
const OUT = join(ROOT, "docs", "verification", "hero-k7", "lane31")
const TAG = arg("tag", "sheet")
mkdirSync(OUT, { recursive: true })

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".png"))
  .sort()
  .filter((_, i) => i % EVERY === 0)
const first = await loadImage(join(DIR, files[0]))
const src = CROP
  ? (([x, y, w, h]) => ({ x, y, w, h }))(CROP.split(",").map(Number))
  : { x: 0, y: 0, w: first.width, h: first.height }
const cw = Math.round(src.w * SCALE)
const ch = Math.round(src.h * SCALE)
const rows = Math.ceil(files.length / COLS)
const sheet = createCanvas(COLS * (cw + 4) + 4, rows * (ch + 16) + 4)
const g = sheet.getContext("2d")
g.fillStyle = "#d9d9d9"
g.fillRect(0, 0, sheet.width, sheet.height)
for (let i = 0; i < files.length; i++) {
  const img = await loadImage(join(DIR, files[i]))
  const cx = 4 + (i % COLS) * (cw + 4)
  const cy = 4 + Math.floor(i / COLS) * (ch + 16)
  g.fillStyle = "#fff"
  g.fillRect(cx, cy, cw, ch)
  g.drawImage(img, src.x, src.y, src.w, src.h, cx, cy, cw, ch)
  g.fillStyle = "#000"
  g.font = "11px monospace"
  g.fillText(files[i].replace(".png", ""), cx + 2, cy + ch + 12)
}
const p = join(OUT, `${TAG}.png`)
writeFileSync(p, sheet.toBuffer("image/png"))
console.log(`${files.length} frames of ${DIR} -> ${p} (${sheet.width}x${sheet.height})`)
