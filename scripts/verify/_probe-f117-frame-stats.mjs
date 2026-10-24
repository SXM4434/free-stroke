// F117 item 3. What changed in every pentip frame since 09-04, measured per capture.
//
// `assert-pentip-specks.mjs` counts the "AA band" as every pixel with luma in
// (40, paper - 12). The grid lines on the paper are light grey. If their luma
// sits under paper - 12 they are counted as AA band on every frame, far from any
// ink; if above, they are not. So the grid's luma alone can move the AA band by
// thousands of pixels with no change to the ink. This probe reads, per arm and
// per capture, with the gate's own rules:
//
//   paper      modal luma (the gate's `paper`)
//   gridLuma   modal luma among pixels in [paper - 30, paper - 2], i.e. the grid
//   grey       the gate's AA band count, (40, paper - 12)
//   greyFar    of those, how many sit farther than 12 px from any ink pixel
//   ink        pixels under max(8, paper - 45), the gate's ink mask
//
// Medians over the gate's body window (frac 0.08 to 0.97). Read-only on frames.
//
//   node scripts/verify/_probe-f117-frame-stats.mjs --dir=<capture> [--arms=a,b] [--step=4]
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, dirname, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.slice(k.length + 3) : d
}
const dirArg = arg("dir", null)
if (!dirArg) {
  console.error("--dir=<capture folder> is required")
  process.exit(2)
}
const DIR = isAbsolute(dirArg) ? dirArg : join(ROOT, dirArg)
const ARMS = arg("arms", "free-stroke,chisel,t160,t160-aaprior,t275,t275-aaprior").split(",")
const STEP = Number(arg("step", "4"))
const FAR = 12

const med = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[(s.length / 2) | 0] : null
}

async function stats(p) {
  const img = await loadImage(readFileSync(p))
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(W * H)
  for (let i = 0, q = 0; i < data.length; i += 4, q++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[q] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  let gridLuma = paper - 30
  for (let l = paper - 30; l <= paper - 2; l++) if (hist[l] > hist[gridLuma]) gridLuma = l
  const cut = Math.max(8, paper - 45)
  // distance-to-ink, chessboard, capped at FAR+1, two passes
  const d = new Uint8Array(W * H).fill(FAR + 1)
  let ink = 0
  for (let q = 0; q < luma.length; q++) if (luma[q] < cut) (d[q] = 0), ink++
  for (let y = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++) {
      const q = y * W + xx
      let v = d[q]
      if (xx > 0 && d[q - 1] + 1 < v) v = d[q - 1] + 1
      if (y > 0 && d[q - W] + 1 < v) v = d[q - W] + 1
      if (y > 0 && xx > 0 && d[q - W - 1] + 1 < v) v = d[q - W - 1] + 1
      if (y > 0 && xx < W - 1 && d[q - W + 1] + 1 < v) v = d[q - W + 1] + 1
      d[q] = v
    }
  for (let y = H - 1; y >= 0; y--)
    for (let xx = W - 1; xx >= 0; xx--) {
      const q = y * W + xx
      let v = d[q]
      if (xx < W - 1 && d[q + 1] + 1 < v) v = d[q + 1] + 1
      if (y < H - 1 && d[q + W] + 1 < v) v = d[q + W] + 1
      if (y < H - 1 && xx < W - 1 && d[q + W + 1] + 1 < v) v = d[q + W + 1] + 1
      if (y < H - 1 && xx > 0 && d[q + W - 1] + 1 < v) v = d[q + W - 1] + 1
      d[q] = v
    }
  let grey = 0
  let greyFar = 0
  for (let q = 0; q < luma.length; q++)
    if (luma[q] > 40 && luma[q] < paper - 12) {
      grey++
      if (d[q] > FAR) greyFar++
    }
  return { W, H, paper, gridLuma, gridPx: hist[gridLuma], ink, grey, greyFar }
}

const out = {}
for (const arm of ARMS) {
  const ad = join(DIR, arm)
  if (!existsSync(ad)) {
    console.log(`${arm}: no folder`)
    continue
  }
  const files = readdirSync(ad).filter((f) => /^\d{3}\.png$/.test(f)).sort()
  const n = files.length
  const rows = []
  for (let i = 0; i < n; i += STEP) {
    const frac = n > 1 ? i / (n - 1) : 0
    if (frac < 0.08 || frac > 0.97) continue
    rows.push(await stats(join(ad, files[i])))
  }
  const m = (k) => med(rows.map((r) => r[k]))
  out[arm] = {
    frames: rows.length,
    size: `${rows[0]?.W}x${rows[0]?.H}`,
    paper: m("paper"),
    gridLuma: m("gridLuma"),
    gridPx: m("gridPx"),
    ink: m("ink"),
    grey: m("grey"),
    greyFar: m("greyFar"),
  }
  const o = out[arm]
  console.log(
    `${arm.padEnd(13)} ${o.size} frames ${o.frames}  paper ${o.paper}  grid luma ${o.gridLuma} (${o.gridPx} px)  ink ${o.ink}  AA band ${o.grey}  of it >${FAR}px from ink ${o.greyFar} (${((100 * o.greyFar) / o.grey).toFixed(0)} %)`,
  )
}
console.log(JSON.stringify(out))
