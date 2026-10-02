// _PROBE-LANE1-ZOOM — CROP + MAGNIFY NAMED FRAMES SO A LETTER CAN BE JUDGED BY EYE.
//
// WHY THIS EXISTS. Every real bug in this repo was found by looking at 5-10x, and
// several were HIDDEN by a sum that could not see a letter come apart. A 1600x1600
// stage screenshot puts the word at ~1500x330; the counter of an `o` is ~40 px.
// Judging "is the o bitten" off that is judging it with the evidence turned off.
//
// AND A CONTACT SHEET CAN LIE — twice, on record in this repo. One was written as
// RGBA with 95.8 % of its pixels at alpha 0 and composited onto white by the
// viewer; another was read on black and misreported as the mark being shredded.
// So this tool ASSERTS its own output rather than trusting it:
//
//   * every source frame is opaque (alpha 255 everywhere) BEFORE it is cropped;
//   * the composite it writes is opaque, and it composites onto the frame's OWN
//     measured paper colour (the modal luma), never onto white or black;
//   * it prints the paper colour it found, so a wrong background is visible in
//     the log rather than silently believed.
//
// Magnification is NEAREST-NEIGHBOUR on purpose. A smooth upscale invents a
// gradient across exactly the sub-pixel boundary the question is about.
//
// Usage:
//   node scripts/verify/_probe-lane1-zoom.mjs \
//        --dir=docs/verification/drawin-vanish/lane1-dd-now/frames \
//        --frames=061,069,075 --zoom=4 --out=docs/verification/drawin-eye/dd-now
//   [--roi=x0,y0,x1,y1]  crop box in SOURCE pixels; default = union ink bbox
//   [--label=...]        text drawn under each tile
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const abs = (p) => (isAbsolute(p) ? p : join(ROOT, p))

const DIR = abs(arg("dir", ""))
const FRAMES = arg("frames", "").split(",").filter(Boolean)
const ZOOM = parseInt(arg("zoom", "4"), 10)
const OUT = abs(arg("out", "docs/verification/drawin-eye/run"))
const ROI = arg("roi", "")
const LABELS = arg("labels", "").split(",")

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** Read a PNG into raw RGBA plus the modal (paper) luma. */
async function readFrame(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const id = x.getImageData(0, 0, img.width, img.height)
  const { data } = id
  const hist = new Uint32Array(256)
  let transparent = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) transparent++
    hist[(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  return { id, w: img.width, h: img.height, paper, transparent, data }
}

function inkBBox(f, cut) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
  for (let p = 0, i = 0; p < f.w * f.h; p++, i += 4) {
    const l = 0.2126 * f.data[i] + 0.7152 * f.data[i + 1] + 0.0722 * f.data[i + 2]
    if (l >= cut) continue
    const px = p % f.w
    const py = (p / f.w) | 0
    if (px < x0) x0 = px
    if (px > x1) x1 = px
    if (py < y0) y0 = py
    if (py > y1) y1 = py
  }
  return x1 < x0 ? null : { x0, y0, x1, y1 }
}

async function main() {
  if (!DIR || FRAMES.length === 0) {
    console.error("need --dir= and --frames=")
    process.exit(2)
  }
  mkdirSync(OUT, { recursive: true })

  const frames = []
  for (const n of FRAMES) {
    const p = join(DIR, `${n}.png`)
    if (!existsSync(p)) {
      say(false, `frame ${n} exists`, p)
      continue
    }
    const f = await readFrame(p)
    // THE OPACITY ASSERTION — this is the one a contact sheet has lied about.
    say(f.transparent === 0, `frame ${n} is OPAQUE (no alpha<255)`, `${f.transparent} transparent px · paper luma ${f.paper}`)
    frames.push({ n, ...f })
  }
  if (frames.length === 0) process.exit(1)

  // Crop box: explicit, or the union of every frame's ink bbox so all tiles are
  // registered to the SAME rectangle (a per-frame bbox would silently re-frame
  // each tile and make a growing mark look stationary).
  let box
  if (ROI) {
    const [a, b, c, d] = ROI.split(",").map(Number)
    box = { x0: a, y0: b, x1: c, y1: d }
  } else {
    box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }
    for (const f of frames) {
      const bb = inkBBox(f, Math.max(8, f.paper - 45))
      if (!bb) continue
      box.x0 = Math.min(box.x0, bb.x0)
      box.y0 = Math.min(box.y0, bb.y0)
      box.x1 = Math.max(box.x1, bb.x1)
      box.y1 = Math.max(box.y1, bb.y1)
    }
    const pad = 12
    box = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad }
  }
  box.x0 = Math.max(0, box.x0)
  box.y0 = Math.max(0, box.y0)
  box.x1 = Math.min(frames[0].w - 1, box.x1)
  box.y1 = Math.min(frames[0].h - 1, box.y1)
  const cw = box.x1 - box.x0 + 1
  const ch = box.y1 - box.y0 + 1
  console.log(`crop ${cw}x${ch} at (${box.x0},${box.y0}) · zoom ${ZOOM} → ${cw * ZOOM}x${ch * ZOOM} per tile`)

  const GUT = 14
  const CAP = 26
  const sheet = createCanvas(cw * ZOOM + GUT * 2, (ch * ZOOM + CAP) * frames.length + GUT)
  const sx = sheet.getContext("2d")
  // The paper the frames themselves are on — measured, not chosen.
  const paperL = frames[0].paper
  sx.fillStyle = `rgb(${paperL},${paperL},${paperL})`
  sx.fillRect(0, 0, sheet.width, sheet.height)

  frames.forEach((f, i) => {
    const tile = createCanvas(cw, ch)
    const tx = tile.getContext("2d")
    tx.putImageData(f.id, -box.x0, -box.y0)
    const y = GUT + i * (ch * ZOOM + CAP)
    sx.imageSmoothingEnabled = false
    sx.drawImage(tile, 0, 0, cw, ch, GUT, y, cw * ZOOM, ch * ZOOM)
    sx.fillStyle = "#111"
    sx.font = "600 18px sans-serif"
    sx.fillText(LABELS[i] ?? `frame ${f.n}`, GUT, y + ch * ZOOM + 19)
    // Per-tile single, so a detail can be opened without the sheet's scaling.
    const single = createCanvas(cw * ZOOM, ch * ZOOM)
    const g = single.getContext("2d")
    g.imageSmoothingEnabled = false
    g.drawImage(tile, 0, 0, cw, ch, 0, 0, cw * ZOOM, ch * ZOOM)
    writeFileSync(join(OUT, `zoom-${f.n}.png`), single.toBuffer("image/png"))
  })

  const buf = sheet.toBuffer("image/png")
  writeFileSync(join(OUT, "SHEET.png"), buf)

  // Assert what we WROTE, not what we intended to write.
  const check = await readFrame(join(OUT, "SHEET.png"))
  say(check.transparent === 0, "the sheet this tool wrote is OPAQUE", `${check.transparent} transparent px`)
  say(check.paper === paperL, "…and it composites on the frames' OWN paper", `sheet ${check.paper} vs frames ${paperL}`)

  console.log(`\n${join(OUT, "SHEET.png")}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
