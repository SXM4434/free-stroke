// ZOOM CROPS OF THE SWITCH, side by side, at 5–10×.
//
// THE EYE IS THE INSTRUMENT. Every statistic in `_probe-switch-tone.mjs` is an
// eroded-interior number, and the erosion is 3 px — which is exactly where the
// fresnel rim lives. So an interior statistic can under-report the very cue the
// switch is supposed to arrive with, and the only way to settle that is to look
// at the boundary at a magnification where it is resolvable.
//
// Usage:
//   node scripts/verify/_crop-switch.mjs --label=before --frames=39,46,54,76,95 \
//        [--zoom=6] [--box=520,380,600,260] [--out=switch]
// Output:
//   docs/verification/switch-tone/<label>/zoom/<out>.png   one strip, labelled
//   docs/verification/switch-tone/<label>/zoom/<out>-<f>.png  each crop alone
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "before")
const OUTNAME = arg("out", "switch")
const ZOOM = parseFloat(arg("zoom", "6"))
const FRAMES = arg("frames", "39,46,54,76").split(",").map((s) => s.trim())
const BOX = arg("box", null)
/* `--files=` takes explicit paths instead of frame indices, so the SAME crop
 * box and the SAME nearest-neighbour magnification can be applied to the
 * sweep's per-arm stills. A second cropping tool would be a second definition
 * of "the same crop", and the whole point of an A/B strip is that the two
 * panels are comparable to the pixel. Paths are relative to the repo root. */
const FILES = arg("files", null)

const DIR = join(ROOT, "docs", "verification", "switch-tone", LABEL, "frames")
const ZDIR = join(ROOT, "docs", "verification", "switch-tone", LABEL, "zoom")
mkdirSync(ZDIR, { recursive: true })

/* THE CROP BOX IS DERIVED FROM THE MARK, NOT HARDCODED.
 *
 * A hardcoded box is a hardcoded constant, and §11.8's conclusion applies:
 * every hardcoded time in this beat's tooling has been wrong at least once. The
 * mark's width changes by 25x across this window, so a box sized for the
 * settled word shows nothing at the sliver and a box sized for the sliver shows
 * a fragment of the settled word. Take it from the LAST frame in the list —
 * whichever is most settled — and use it for every crop, so the frames are
 * comparable to the pixel. */
async function inkBox(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l > 150) continue
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, maxX, minY, maxY }
}

async function main() {
  const names = FILES ? FILES.split(",").map((s) => s.trim()) : FRAMES
  const files = FILES
    ? names.map((p) => join(ROOT, p))
    : names.map((f) => join(DIR, String(f).padStart(4, "0") + ".png"))
  for (const f of files) if (!existsSync(f)) throw new Error(`missing frame: ${f}`)

  let bx
  if (BOX) {
    const [x, y, w, h] = BOX.split(",").map(Number)
    bx = { x, y, w, h }
  } else {
    /* Default: the LEFT THIRD of the settled word's own bbox, tall enough to
     * carry a full stroke height. That is where the "D" is — a closed bowl with
     * a stem, i.e. a shape whose interior shading and whose silhouette are both
     * legible in one crop. A whole-word crop at 6x is 3700 px wide and unusable
     * as a comparison. */
    const b = await inkBox(files[files.length - 1])
    const w = Math.round((b.maxX - b.minX) * 0.28)
    const h = Math.round((b.maxY - b.minY) * 1.5)
    bx = {
      x: Math.max(0, b.minX - 12),
      y: Math.max(0, Math.round((b.minY + b.maxY) / 2 - h / 2)),
      w,
      h,
    }
  }

  const pad = 10
  const labelH = 26
  const cw = Math.round(bx.w * ZOOM)
  const ch = Math.round(bx.h * ZOOM)
  const strip = createCanvas(files.length * cw + (files.length + 1) * pad, ch + labelH + pad * 2)
  const sx = strip.getContext("2d")
  sx.imageSmoothingEnabled = false
  sx.fillStyle = "#101010"
  sx.fillRect(0, 0, strip.width, strip.height)

  for (let i = 0; i < files.length; i++) {
    const img = await loadImage(files[i])
    const one = createCanvas(cw, ch)
    const ox = one.getContext("2d")
    ox.imageSmoothingEnabled = false
    ox.drawImage(img, bx.x, bx.y, bx.w, bx.h, 0, 0, cw, ch)
    const tag = FILES ? names[i].split("/").pop().replace(/\.png$/, "") : `f${names[i]}`
    writeFileSync(join(ZDIR, `${OUTNAME}-${tag}.png`), one.toBuffer("image/png"))
    const dx = pad + i * (cw + pad)
    sx.drawImage(one, dx, pad)
    sx.fillStyle = "#f0f0f0"
    sx.font = "600 18px sans-serif"
    sx.fillText(tag, dx + 4, pad + ch + 20)
  }
  writeFileSync(join(ZDIR, `${OUTNAME}.png`), strip.toBuffer("image/png"))
  console.log(`box x${bx.x} y${bx.y} w${bx.w} h${bx.h} at ${ZOOM}x -> ${join(ZDIR, OUTNAME + ".png")} (${strip.width}x${strip.height})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
