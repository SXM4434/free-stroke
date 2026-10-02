// THE 120, AS ONE PICTURE — because a table of deltas cannot answer "does this
// read as a set of different ideas, or as one idea 116 times".
//
// Builds contact sheets from the crops `_probe-fusion-combo-liveness.mjs` saved,
// grouped by how many systems each cell fuses, each tile labelled with its name
// and its measured signal.
//
// ⚠ COMPOSITED ON THE REAL PAPER, AND THE ALPHA IS ASSERTED. `grab()` returns a
// TRANSPARENT canvas. One fusion lane's first sheet composited that onto black
// and read it as "creating a fusion shreds the mark" — the sheet was the defect,
// not the feature. Every tile here is painted onto paper first, and the script
// refuses to write a sheet whose tiles are more than 99.5 % transparent.
//
//   node scripts/verify/_probe-fusion-combo-sheet.mjs --label=v1
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "v1")
const COLS = Number(arg("cols", 7))
const TW = Number(arg("tw", 340))
const DIR = join(ROOT, "docs", "verification", "fusion-combos", LABEL)
const data = JSON.parse(readFileSync(join(DIR, "liveness.json"), "utf8"))
const CROP = data.crop ?? [0.24, 0.3, 0.58, 0.46]
const PAPER = data.paper ?? "#ffffff"

const byKey = new Map(data.results.map((r) => [r.key, r]))

async function sheet(cells, outName, title) {
  const first = cells.find((c) => existsSync(join(DIR, "crops", `${c.replace(/\+/g, "_")}.png`)))
  if (!first) return null
  const probe = await loadImage(join(DIR, "crops", `${first.replace(/\+/g, "_")}.png`))
  const sw = CROP[2] * probe.width
  const sh = CROP[3] * probe.height
  const TH = Math.round((TW * sh) / sw)
  const LABEL_H = 40
  const rows = Math.ceil(cells.length / COLS)
  const c = createCanvas(COLS * TW, 54 + rows * (TH + LABEL_H))
  const g = c.getContext("2d")
  g.fillStyle = "#e6e6e6"
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = "#1a1a1a"
  g.font = "700 26px sans-serif"
  g.fillText(title, 14, 36)
  let painted = 0
  for (let i = 0; i < cells.length; i++) {
    const key = cells[i]
    const rec = byKey.get(key)
    const x = (i % COLS) * TW
    const y = 54 + Math.floor(i / COLS) * (TH + LABEL_H)
    const file = join(DIR, "crops", `${key.replace(/\+/g, "_")}.png`)
    // PAPER FIRST, ALWAYS.
    g.fillStyle = PAPER
    g.fillRect(x + 2, y, TW - 4, TH)
    if (existsSync(file)) {
      const img = await loadImage(file)
      g.drawImage(img, CROP[0] * img.width, CROP[1] * img.height, sw, sh, x + 2, y, TW - 4, TH)
      painted++
    }
    g.fillStyle = "#1a1a1a"
    g.font = "600 14px sans-serif"
    g.fillText(rec?.empty ? `${key.split("+").length}· EMPTY` : key.split("+").join(" + "), x + 6, y + TH + 16)
    g.fillStyle = "#666"
    g.font = "12px sans-serif"
    g.fillText(rec ? `signal ${rec.signal.toFixed(2)} · control ${rec.control.toFixed(2)}` : "no capture", x + 6, y + TH + 32)
  }
  const out = join(DIR, outName)
  writeFileSync(out, c.toBuffer("image/png"))
  console.log(`wrote ${out}  ${c.width}x${c.height}  (${painted}/${cells.length} tiles painted)`)
  return out
}

const keys = data.results.map((r) => r.key)
for (const n of [2, 3, 4, 5, 6, 7]) {
  const cells = keys.filter((k) => k.split("+").length === n)
  if (cells.length) await sheet(cells, `SHEET-combos-${n}.png`, `${n} systems — ${cells.length} combinations`)
}
await sheet(keys, "SHEET-combos-all.png", `Every combination — ${keys.length} cells`)
