// Builds a labelled contact sheet from a set of verification frames, so a whole
// matrix can be READ in one look instead of one PNG at a time. The standing
// rule is "verify by reading the frames at high frame counts" — that is only
// practical if the frames can be seen together.
//
// Usage:
//   node scripts/verify/contact-sheet.mjs --dir=material-craft/presets \
//        --match=^front_solid_ --cols=5 --out=sheet_front_solid --cell=340
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const DIR = join(ROOT, "docs", "verification", arg("dir", ""))
const OUTDIR = join(ROOT, "docs", "verification", arg("outdir", arg("dir", "")))
const MATCH = new RegExp(arg("match", ".*"))
const COLS = parseInt(arg("cols", "5"), 10)
const CELL = parseInt(arg("cell", "340"), 10)
const NAME = arg("out", "sheet")
// Dark checkerboard behind the alpha PNGs so a near-black surface still reads.
const BG = arg("bg", "checker")

const files = readdirSync(DIR).filter((f) => f.endsWith(".png") && MATCH.test(f)).sort()
if (!files.length) {
  console.error(`no frames matching ${MATCH} in ${DIR}`)
  process.exit(1)
}
const LABEL_H = 22
const rows = Math.ceil(files.length / COLS)
const c = createCanvas(COLS * CELL, rows * (CELL + LABEL_H))
const g = c.getContext("2d")
g.fillStyle = "#101014"
g.fillRect(0, 0, c.width, c.height)

for (const [i, f] of files.entries()) {
  const cx = (i % COLS) * CELL
  const cy = Math.floor(i / COLS) * (CELL + LABEL_H)
  if (BG === "checker") {
    const s = 16
    for (let y = 0; y < CELL; y += s)
      for (let x = 0; x < CELL; x += s) {
        g.fillStyle = ((x / s + y / s) & 1) ? "#2a2a30" : "#1c1c22"
        g.fillRect(cx + x, cy + y, s, s)
      }
  } else {
    g.fillStyle = BG
    g.fillRect(cx, cy, CELL, CELL)
  }
  const img = await loadImage(join(DIR, f))
  const k = Math.min(CELL / img.width, CELL / img.height)
  const w = img.width * k, h = img.height * k
  g.drawImage(img, cx + (CELL - w) / 2, cy + (CELL - h) / 2, w, h)
  g.fillStyle = "#000"
  g.fillRect(cx, cy + CELL, CELL, LABEL_H)
  g.fillStyle = "#e6e6ea"
  g.font = "14px monospace"
  g.fillText(f.replace(".png", "").slice(0, Math.floor(CELL / 8)), cx + 6, cy + CELL + 16)
  g.strokeStyle = "#3a3a44"
  g.strokeRect(cx + 0.5, cy + 0.5, CELL - 1, CELL + LABEL_H - 1)
}
mkdirSync(OUTDIR, { recursive: true })
writeFileSync(join(OUTDIR, `${NAME}.png`), c.toBuffer("image/png"))
console.log(`${files.length} frames -> ${join(OUTDIR, NAME + ".png")}  (${c.width}x${c.height})`)
