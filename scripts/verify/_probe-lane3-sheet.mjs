// _PROBE-LANE3-SHEET — the blank tail, before and after, on the real paper.
//
// Builds a labelled contact sheet from two sweeps of `_probe-drawin-vanish.mjs`
// at the same playheads, so the fix is a picture and not a number.
//
// ⚠ IT ASSERTS ITS OWN CROPS ARE OPAQUE. A previous sheet in this repo was
// written RGBA with 95.8 % of its pixels at alpha 0 and composited onto white,
// and was read as "creating a fusion shreds the mark". Every tile here is
// checked for a transparent pixel BEFORE it is drawn, the sheet is written as
// RGB, and the background is the frames' own paper value rather than #fff.
//
// Usage: node scripts/verify/_probe-lane3-sheet.mjs --before=<label> --after=<label>
//        [--steps=92,93,94,96,100] [--out=SHEET-blank-tail.png]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
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
const BEFORE = arg("before", "lane1-fs-font-dsf2")
const AFTER = arg("after", "lane3-fs-font-AFTER")
const STEPS = arg("steps", "92,93,94,96,100").split(",").map((s) => parseInt(s, 10))
const OUTNAME = arg("out", "SHEET-blank-tail-CLOSED.png")
const BASE = join(ROOT, "docs", "verification", "drawin-vanish")

/** The mark's own box, so the tiles are the MARK and not mostly paper.
 *
 * ⚠ MEASURED off the finished frame, not guessed. The first version of this
 * crop was `{460, 850, 1340, 320}` — a single line — and the font word WRAPS
 * (`fontWrap` defaults true), so it clipped the second line entirely and every
 * tile read the same 86 604 ink px while the full frame went 93 445 -> 100 690.
 * A crop that saturates is a sheet that cannot show the thing it is of. The
 * real ink bbox on `frames/100.png` is x 539..2020, y 901..1604. */
const CROP = { x: 480, y: 860, w: 1600, h: 790 }

async function tile(dir, step) {
  const p = join(BASE, dir, "frames", `${String(step).padStart(3, "0")}.png`)
  if (!existsSync(p)) throw new Error(`missing frame: ${p}`)
  const img = await loadImage(readFileSync(p))
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const d = x.getImageData(CROP.x, CROP.y, CROP.w, CROP.h)
  let clear = 0
  let ink = 0
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] !== 255) clear++
    hist[(0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]) | 0]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  for (let l = 0; l < cut; l++) ink += hist[l]
  return { data: d, clear, ink, paper, path: p }
}

async function main() {
  const rows = [
    { dir: BEFORE, label: "BEFORE — aFsLetter 58998 vs position 59936" },
    { dir: AFTER, label: "AFTER — aFsLetter == position, every build" },
  ]
  const SC = 0.5
  const TW = Math.round(CROP.w * SC)
  const TH = Math.round(CROP.h * SC)
  const PAD = 18
  const HEAD = 46
  const W = PAD + STEPS.length * (TW + PAD)
  const H = HEAD + rows.length * (TH + HEAD)
  const c = createCanvas(W, H)
  const g = c.getContext("2d")

  const tiles = []
  for (const r of rows) {
    const set = []
    for (const s of STEPS) set.push(await tile(r.dir, s))
    tiles.push(set)
  }
  const paper = tiles[0][0].paper
  g.fillStyle = `rgb(${paper},${paper},${paper})`
  g.fillRect(0, 0, W, H)

  let bad = 0
  g.fillStyle = "#111"
  g.font = "bold 20px sans-serif"
  g.fillText(`DRAW %  ${STEPS.join("   ·   ")}   —   FREE STROKE · word FONT · wobble 0 · endpoint CLEAN · dsf 2`, PAD, 28)
  for (let ri = 0; ri < rows.length; ri++) {
    const y0 = HEAD + ri * (TH + HEAD)
    g.fillStyle = "#111"
    g.font = "bold 18px sans-serif"
    g.fillText(rows[ri].label, PAD, y0 + 20)
    for (let si = 0; si < STEPS.length; si++) {
      const t = tiles[ri][si]
      if (t.clear > 0) bad++
      const tmp = createCanvas(CROP.w, CROP.h)
      tmp.getContext("2d").putImageData(t.data, 0, 0)
      const x0 = PAD + si * (TW + PAD)
      g.drawImage(tmp, x0, y0 + 28, TW, TH)
      g.strokeStyle = "#999"
      g.lineWidth = 1
      g.strokeRect(x0 + 0.5, y0 + 28.5, TW, TH)
      g.fillStyle = t.ink < 100 ? "#b00" : "#111"
      g.font = "16px sans-serif"
      g.fillText(`${STEPS[si]} %  ink ${t.ink}`, x0, y0 + 28 + TH + 20)
    }
  }

  if (bad > 0) throw new Error(`${bad} crop(s) carried transparent pixels — the sheet would be a lie. Refusing to write.`)
  mkdirSync(join(BASE, "lane3-closed"), { recursive: true })
  const out = join(BASE, "lane3-closed", OUTNAME)
  writeFileSync(out, c.toBuffer("image/png"))
  console.log("every crop opaque (0 transparent pixels), composited on the frames' own paper", paper)
  for (let ri = 0; ri < rows.length; ri++) {
    console.log(rows[ri].label)
    for (let si = 0; si < STEPS.length; si++) console.log(`   ${STEPS[si]} %  ink ${tiles[ri][si].ink}`)
  }
  console.log(`\n${out}  ${c.width}x${c.height}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
