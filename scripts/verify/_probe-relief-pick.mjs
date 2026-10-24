// THE AMPLITUDE SHEET — the rendered evidence for a call that is Sebs's, not
// this lane's.
//
// Texture relief changes how Fine Grain and every other texture preset LOOK, and
// Fine Grain is the most-used pattern in the family. A number crossing a line
// does not settle that; the picture does. So this composes the macro crops the
// REAL capture already shot (docs/verification/screen-layers/lane14-*) into one
// row per preset — layers off, the parked prior at relief 0, then 0.3 / 0.6 /
// 1.0 — at 3x nearest-neighbour so the grain is actually resolvable on a screen.
//
// It reads frames off disk rather than shooting its own, deliberately: the
// pictures Sebs judges have to be the same pictures the numbers were taken from,
// or the sheet is an illustration of the argument instead of the evidence for it.
//
// Usage: node scripts/verify/_probe-relief-pick.mjs [--mode=rod]
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const SL = join(ROOT, "docs", "verification", "screen-layers")
const OUT = join(ROOT, "docs", "verification", "texture-relief", "pick")
mkdirSync(OUT, { recursive: true })
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const MODE = arg("mode", "rod")
const ARMS = [
  { label: "relief 0 · PRIOR", dir: "lane14-park" },
  { label: "relief 0.3", dir: "lane14-b0.3" },
  { label: "relief 0.6 · REC", dir: "lane14-b0.6" },
  { label: "relief 1.0", dir: "lane14-b1.0" },
]
const PRESETS = ["fineGrain", "scanlines", "contourBands", "scratchedInk", "gelBubbles", "crosshatch",
  "inkDots", "woodgrain", "cellular", "brushedSteel", "craquelure", "interference"]

const S = 3   // nearest-neighbour magnification; a 208px crop of a 25px tube is
              // not judgeable at 1:1 on any screen, and downscaling would be worse
let missing = 0
const dOffOf = (dir, preset) => {
  const p = join(SL, dir, "report.json")
  if (!existsSync(p)) return null
  const row = JSON.parse(readFileSync(p, "utf8"))
    .find((r) => r.mode === MODE && r.rail === "texture" && r.preset === preset)
  return row ? row : null
}

for (const preset of PRESETS) {
  const cells = []
  const offP = join(SL, ARMS[0].dir, "crops", `${MODE}_OFF_macro.png`)
  if (!existsSync(offP)) { console.log(`FAIL  missing ${offP}`); missing++; continue }
  cells.push({ label: "layers OFF", sub: "", buf: offP })
  for (const a of ARMS) {
    const p = join(SL, a.dir, "crops", `${MODE}_texture_${preset}_macro.png`)
    if (!existsSync(p)) { console.log(`FAIL  missing ${p}`); missing++; continue }
    const row = dOffOf(a.dir, preset)
    cells.push({ label: a.label, sub: row ? `dOff ${row.dOff}  nn ${row.nnDist}` : "", buf: p })
  }
  const imgs = await Promise.all(cells.map((c) => loadImage(c.buf)))
  const w = imgs[0].width, h = imgs[0].height, pad = 8, lab = 46
  const cv = createCanvas(cells.length * (w * S + pad) + pad, h * S + lab + pad)
  const g = cv.getContext("2d")
  g.imageSmoothingEnabled = false
  g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
  cells.forEach((c, i) => {
    g.drawImage(imgs[i], pad + i * (w * S + pad), pad, w * S, h * S)
    g.fillStyle = "#eee"; g.font = "17px monospace"
    g.fillText(c.label, pad + i * (w * S + pad) + 2, h * S + pad + 20)
    g.fillStyle = "#9a9a9a"; g.font = "14px monospace"
    g.fillText(c.sub, pad + i * (w * S + pad) + 2, h * S + pad + 38)
  })
  writeFileSync(join(OUT, `${MODE}_${preset}.png`), cv.toBuffer("image/png"))
  console.log(`PASS  ${MODE}/${preset} — ${cells.length} arms at ${w * S}x${h * S}`)
}
console.log(missing ? `\n${missing} MISSING FRAME(S) — the sheet is incomplete` : `\nwrote ${OUT}`)
process.exit(missing ? 1 : 0)
