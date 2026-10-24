// THE CASCADE, LAID OUT AS A STRIP — every painted frame of a playhead window,
// tiled in reading order, so a flip can be watched back one frame at a time.
//
// The film's manifest is TAPE time and the complaint is about PLAYHEAD time, so
// the two are joined through the rAF trace ([perf.now, playhead, phase]) rather
// than assumed proportional — the tape ran at 0.912x and a strip built on that
// assumption would be looking at the wrong frames.
//
//   node scripts/verify/_probe-cascade-strip.mjs --label=X --from=6.0 --to=10.5
//        [--stride=1] [--cols=8] [--crop=0.30,0.5,300,120] [--zoom=2] [--name=cascade]
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d }
const LABEL = arg("label", "o5-before-traced")
const FROM = parseFloat(arg("from", "0")), TO = parseFloat(arg("to", "99"))
const STRIDE = parseInt(arg("stride", "1"), 10)
const COLS = parseInt(arg("cols", "8"), 10)
const ZOOM = parseFloat(arg("zoom", "1"))
const NAME = arg("name", "strip")
const CROP = arg("crop", null)
const DIR = join(ROOT, "docs/verification/hero-beat-film", LABEL)
const t = JSON.parse(readFileSync(join(DIR, "trace.json"), "utf8"))

/* tape seconds -> playhead seconds, by interpolating the rAF trace. */
const tr = t.trace, t0 = tr[0][0]
const tape = tr.map((r) => (r[0] - t0) / 1000), head = tr.map((r) => r[1]), ph = tr.map((r) => r[2])
function headAt(s) {
  if (s <= tape[0]) return { h: head[0], p: ph[0] }
  for (let i = 1; i < tape.length; i++)
    if (tape[i] >= s) {
      const f = (s - tape[i - 1]) / Math.max(1e-9, tape[i] - tape[i - 1])
      return { h: head[i - 1] + f * (head[i] - head[i - 1]), p: ph[i] }
    }
  return { h: head[head.length - 1], p: ph[ph.length - 1] }
}
const picked = []
for (const m of t.manifest) {
  const { h, p } = headAt(m.tSec)
  if (h >= FROM && h <= TO) picked.push({ i: m.i, h, p })
}
const sel = picked.filter((_, k) => k % STRIDE === 0)
if (sel.length === 0) { console.log("no frames in window"); process.exit(1) }
console.log(`${sel.length} frames, playhead ${sel[0].h.toFixed(2)}..${sel[sel.length - 1].h.toFixed(2)}, phases ${[...new Set(sel.map((s) => s.p))].join(",")}`)

const first = await loadImage(join(DIR, "frames", `${String(sel[0].i).padStart(4, "0")}.png`))
let sx = 0, sy = 0, W = first.width, H = first.height
if (CROP) { const [cx, cy, w, h] = CROP.split(",").map(Number); W = w; H = h; sx = Math.round(first.width * cx - w / 2); sy = Math.round(first.height * cy - h / 2) }
const TW = Math.round(W * ZOOM), TH = Math.round(H * ZOOM), LBL = 16
const rows = Math.ceil(sel.length / COLS)
const c = createCanvas(COLS * TW, rows * (TH + LBL))
const ctx = c.getContext("2d")
ctx.imageSmoothingEnabled = ZOOM < 1
ctx.fillStyle = "#101010"; ctx.fillRect(0, 0, c.width, c.height)
for (let k = 0; k < sel.length; k++) {
  const img = await loadImage(join(DIR, "frames", `${String(sel[k].i).padStart(4, "0")}.png`))
  const x = (k % COLS) * TW, y = Math.floor(k / COLS) * (TH + LBL)
  ctx.drawImage(img, sx, sy, W, H, x, y, TW, TH)
  ctx.fillStyle = "#eee"; ctx.font = "12px monospace"
  ctx.fillText(`${sel[k].h.toFixed(3)}s #${sel[k].i}`, x + 4, y + TH + 12)
  ctx.strokeStyle = "#333"; ctx.strokeRect(x + 0.5, y + 0.5, TW - 1, TH - 1)
}
mkdirSync(join(DIR, "strips"), { recursive: true })
const out = join(DIR, "strips", `${NAME}.png`)
writeFileSync(out, c.toBuffer("image/png"))
console.log(out)
