// _PROBE-CARVE-VS-FIELD — the field's own verdict beside the GPU's, same width.
//
// `_probe-carve-render.mjs` rasterises `mix(envelope, pen, c) <= 0` straight off
// the real bake, on the CPU, with no GPU involved. At c = 1.000 it reads a
// complete, connected "Desk Doodles". The GPU frame at the same amplitude does
// not. Both cannot be right about the same field.
//
// Each mask is cropped to its own ink and scaled to one common width, so the
// comparison needs no camera and no calibration — only the shapes.
//
// Usage: node scripts/verify/_probe-carve-vs-field.mjs [--label=fix-fs] [--env=2.60]
import { writeFileSync, existsSync } from "node:fs"
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
const LABEL = arg("label", "fix-fs")
const ENV = arg("env", "2.60")
const GPU = join(ROOT, "docs", "verification", "drawin-holes", LABEL)
const CPU = join(ROOT, "docs", "verification", "drawin-holes", "field-render")
const AMPS = ["0", "0p3", "0p5", "0p7", "0p85", "1"]

function inkBox(img) {
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  /* THE BOX IS THE MAIN RUN OF INK, not every dark pixel. A single stray
   * antialiased speck 400 px below the baseline would otherwise set the crop and
   * silently shrink the subject — which has already put one wrong number in this
   * lane's notes today. Rows are kept only if they carry >= 0.2 % of the ink. */
  const rows = new Uint32Array(img.height)
  const cols = new Uint32Array(img.width)
  let ink = 0
  for (let p = 0; p < luma.length; p++)
    if (luma[p] < cut) { rows[(p / img.width) | 0]++; cols[p % img.width]++; ink++ }
  const thr = Math.max(1, ink * 0.002)
  let y0 = 0, y1 = img.height - 1, x0 = 0, x1 = img.width - 1
  while (y0 < y1 && rows[y0] < thr) y0++
  while (y1 > y0 && rows[y1] < thr) y1--
  while (x0 < x1 && cols[x0] < thr) x0++
  while (x1 > x0 && cols[x1] < thr) x1--
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ink }
}

async function main() {
  const W = 1500
  const rows = []
  for (const a of AMPS) {
    const gp = join(GPU, `carve-${a}.png`)
    const cp = join(CPU, `env${ENV}-carve-${a}.png`)
    if (!existsSync(gp) || !existsSync(cp)) continue
    const gi = await loadImage(gp)
    const ci = await loadImage(cp)
    rows.push({ a, gi, ci, gb: inkBox(gi), cb: inkBox(ci) })
  }
  const PAD = 12
  const HEAD = 40
  const cellH = (r) => Math.round((W * r.gb.h) / r.gb.w)
  const cellH2 = (r) => Math.round((W * r.cb.h) / r.cb.w)
  let H = HEAD
  for (const r of rows) H += 22 + cellH(r) + 4 + cellH2(r) + PAD
  const cv = createCanvas(W + PAD * 2, H)
  const cx = cv.getContext("2d")
  cx.fillStyle = "#101014"
  cx.fillRect(0, 0, cv.width, cv.height)
  cx.fillStyle = "#e8e8f0"
  cx.font = "600 20px sans-serif"
  cx.fillText(`${LABEL} — TOP of each pair: the GPU.  BOTTOM: the same field rasterised on the CPU.`, PAD, 27)
  let y = HEAD
  for (const r of rows) {
    cx.fillStyle = "#9aa0b4"
    cx.font = "500 15px sans-serif"
    cx.fillText(`penCarve ${r.a.replace("p", ".")}`, PAD, y + 15)
    y += 22
    const h1 = cellH(r)
    cx.drawImage(r.gi, r.gb.x0, r.gb.y0, r.gb.w, r.gb.h, PAD, y, W, h1)
    y += h1 + 4
    const h2 = cellH2(r)
    cx.drawImage(r.ci, r.cb.x0, r.cb.y0, r.cb.w, r.cb.h, PAD, y, W, h2)
    y += h2 + PAD
  }
  {
    const { data } = cx.getImageData(0, 0, cv.width, cv.height)
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
    console.log(`  ${clear === 0 ? "PASS" : "FAIL"}  the sheet is OPAQUE — ${clear} px below alpha 255`)
    if (clear !== 0) process.exit(1)
  }
  const out = join(GPU, `SHEET-gpu-vs-field.png`)
  writeFileSync(out, cv.toBuffer("image/png"))
  console.log(`sheet: ${out}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
