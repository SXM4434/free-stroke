// _PROBE-DRAWIN-TIP — ZOOM IN on the leading edge, both engines, same playhead.
//
// §0.6 of the dispatch contract: zoom in before you return. The full-word
// contact sheets show two reveals that look the same; the difference a viewer
// actually reads at the moving end of the line is a few pixels wide and cannot
// survive a 420 px thumbnail.
//
// WHAT IT IS LOOKING FOR, stated before it is run so the answer cannot be
// fitted to the picture. Explainer 18 §4 names a known cost of the Free Stroke
// mechanism and dismisses it:
//
//     "the leading edge is a cut through the finished surface, not a rounded
//      pen tip — the cap triangles at a stroke's far end sort last. It is one
//      stroke-width wide, it is moving, and it only exists during the draw
//      beat […] Checked on frames at 3x magnification, not argued"
//
// The Desk Doodles engine has no reveal table, so it reveals by REBUILDING from
// arc-length-clipped strokes — which means its moving end is a real end of a
// real mark, with whatever cap the engine gives it. Those are two different
// objects and this crops both at the same playhead, at the same magnification,
// so they can be compared rather than described.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
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
const LABEL = arg("label", "run")
const DIR = join(ROOT, "docs", "verification", "drawin-sweep", LABEL)
const ZOOM = parseInt(arg("zoom", "6"), 10)
const CROP_W = parseInt(arg("crop", "150"), 10)
const CROP_H = Math.round(CROP_W * 0.75)
const FRAMES = (arg("frames", "8,12,16,20,24,28")).split(",").map((n) => parseInt(n, 10))

async function readFrame(engine, k) {
  const p = join(DIR, engine, `${String(k).padStart(3, "0")}.png`)
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { img, ctx: x, data: x.getImageData(0, 0, img.width, img.height), w: img.width, h: img.height }
}

function inkStats(fr) {
  const { data } = fr
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(fr.w * fr.h)
  for (let i = 0, p = 0; i < data.data.length; i += 4, p++) {
    const l = (0.2126 * data.data[i] + 0.7152 * data.data[i + 1] + 0.0722 * data.data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  let maxX = -1
  let tipY = 0
  let n = 0
  for (let y = 0; y < fr.h; y++)
    for (let x = 0; x < fr.w; x++) {
      if (luma[y * fr.w + x] < cut) {
        n++
        if (x > maxX) {
          maxX = x
          tipY = y
        }
      }
    }
  return { maxX, tipY, n, cut, paper }
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR}`)
    process.exit(2)
  }
  const OUT = join(DIR, "tip")
  mkdirSync(OUT, { recursive: true })

  const engines = ["free-stroke", "desk-doodles"]
  const cols = FRAMES.length
  const cellW = CROP_W * ZOOM
  const cellH = CROP_H * ZOOM
  const LABELH = 26
  const sheet = createCanvas(cellW * cols, (cellH + LABELH) * engines.length)
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#101014"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false

  const rows = []
  for (let ei = 0; ei < engines.length; ei++) {
    const engine = engines[ei]
    for (let ci = 0; ci < cols; ci++) {
      const k = FRAMES[ci]
      const fr = await readFrame(engine, k)
      const st = inkStats(fr)
      // Crop centred on the leading edge — the moving end of the line.
      const cx = Math.max(0, Math.min(fr.w - CROP_W, st.maxX - Math.round(CROP_W * 0.55)))
      const cy = Math.max(0, Math.min(fr.h - CROP_H, st.tipY - Math.round(CROP_H / 2)))
      sc.drawImage(
        fr.img,
        cx,
        cy,
        CROP_W,
        CROP_H,
        ci * cellW,
        ei * (cellH + LABELH) + LABELH,
        cellW,
        cellH,
      )
      sc.strokeStyle = "#3a3a44"
      sc.lineWidth = 2
      sc.strokeRect(ci * cellW, ei * (cellH + LABELH) + LABELH, cellW, cellH)
      sc.fillStyle = "#e8e8ef"
      sc.font = "16px monospace"
      sc.fillText(`${engine}  frame ${k}  ink ${st.n}`, ci * cellW + 8, ei * (cellH + LABELH) + 18)
      rows.push({ engine, k, ...st, cx, cy })
    }
  }
  writeFileSync(join(OUT, `tip-${ZOOM}x.png`), sheet.toBuffer("image/png"))
  writeFileSync(join(OUT, "tip.json"), JSON.stringify(rows, null, 2))
  console.log(`sheet: ${join(OUT, `tip-${ZOOM}x.png`)}  (${sheet.width}x${sheet.height}, ${ZOOM}x)`)
  for (const r of rows) console.log(`  ${r.engine.padEnd(14)} f${String(r.k).padStart(3)}  ink ${String(r.n).padStart(6)}  tip x=${r.maxX} y=${r.tipY}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
