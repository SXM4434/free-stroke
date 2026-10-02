// _PROBE-DRAWIN-TIPFINAL — is the blunt leading edge the REVEAL, or the MESH?
//
// The 6x tip sheet shows Free Stroke's moving end as a flat, faceted, square-cut
// block and Desk Doodles' as a tapered pen tip. That is two claims, not one, and
// only one of them is about the draw-in:
//
//   (a) the FREE STROKE MARK is coarser than the Desk Doodles mark — a mesh
//       property, true at every playhead including the last;
//   (b) the FREE STROKE LEADING EDGE is a CUT — a property of the reveal
//       mechanism, present only while the pen is moving and gone at the end.
//
// They are separated by cropping THE SAME RECTANGLE out of the mid-draw frame
// and out of the FINAL frame. If the box is blunt mid-draw and tapered when
// finished, the bluntness is the reveal. If it is blunt in both, it is the mesh
// and the reveal is not what to fix.
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
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
const ZOOM = parseInt(arg("zoom", "7"), 10)
const CROP_W = parseInt(arg("crop", "130"), 10)
const CROP_H = Math.round(CROP_W * 0.8)
const FRAMES = arg("frames", "14,18,22,26").split(",").map((n) => parseInt(n, 10))
const LAST = parseInt(arg("last", "32"), 10)
// The stage screenshot includes a hairline border and a faint grid; ignore a
// margin so the "rightmost ink pixel" is the PEN, not the chrome. Found by
// looking: without it the tip located at y = 1 and y = 1001, the two edges.
const MARGIN = parseInt(arg("margin", "12"), 10)

async function readFrame(engine, k) {
  const p = join(DIR, engine, `${String(k).padStart(3, "0")}.png`)
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, img.width, img.height)
  return { img, data: d, w: img.width, h: img.height }
}

function tipOf(fr) {
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
  for (let y = MARGIN; y < fr.h - MARGIN; y++)
    for (let x = MARGIN; x < fr.w - MARGIN; x++)
      if (luma[y * fr.w + x] < cut) {
        n++
        if (x > maxX) {
          maxX = x
          tipY = y
        }
      }
  return { maxX, tipY, n }
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR}`)
    process.exit(2)
  }
  const OUT = join(DIR, "tip")
  mkdirSync(OUT, { recursive: true })
  const engines = ["free-stroke", "desk-doodles"]

  const cellW = CROP_W * ZOOM
  const cellH = CROP_H * ZOOM
  const LAB = 26
  // 4 rows: FS mid, FS final, DD mid, DD final — same box in each pair.
  const sheet = createCanvas(cellW * FRAMES.length, (cellH + LAB) * 4)
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#101014"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false

  const rows = []
  let row = 0
  for (const engine of engines) {
    const finalFr = await readFrame(engine, LAST)
    for (const [which, whichLabel] of [["mid", "mid-draw"], ["final", "FINISHED (same box)"]]) {
      for (let ci = 0; ci < FRAMES.length; ci++) {
        const k = FRAMES[ci]
        const midFr = await readFrame(engine, k)
        const t = tipOf(midFr)
        const cx = Math.max(0, Math.min(midFr.w - CROP_W, t.maxX - Math.round(CROP_W * 0.55)))
        const cy = Math.max(0, Math.min(midFr.h - CROP_H, t.tipY - Math.round(CROP_H / 2)))
        const src = which === "mid" ? midFr : finalFr
        sc.drawImage(src.img, cx, cy, CROP_W, CROP_H, ci * cellW, row * (cellH + LAB) + LAB, cellW, cellH)
        sc.strokeStyle = "#3a3a44"
        sc.lineWidth = 2
        sc.strokeRect(ci * cellW, row * (cellH + LAB) + LAB, cellW, cellH)
        sc.fillStyle = which === "mid" ? "#ffd479" : "#8fd3ff"
        sc.font = "17px monospace"
        sc.fillText(`${engine} — ${whichLabel} — f${k}`, ci * cellW + 8, row * (cellH + LAB) + 18)
        if (which === "mid") rows.push({ engine, k, tipX: t.maxX, tipY: t.tipY, ink: t.n, cx, cy })
      }
      row++
    }
  }
  const out = join(OUT, `tip-vs-final-${ZOOM}x.png`)
  writeFileSync(out, sheet.toBuffer("image/png"))
  console.log(`sheet: ${out}  (${sheet.width}x${sheet.height})`)
  for (const r of rows)
    console.log(`  ${r.engine.padEnd(14)} f${String(r.k).padStart(3)}  ink ${String(r.ink).padStart(6)}  tip ${r.tipX},${r.tipY}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
