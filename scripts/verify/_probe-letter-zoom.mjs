// A/B TWO FRAMES OF A FILM AT REAL MAGNIFICATION — the eye pass, not a score.
//
// Every real defect in this beat was caught by looking at frames at 5-10x. This
// crops the same window out of any two frames of a film and stacks them, so the
// question "did anything actually change" is answered by a picture rather than
// by a number that could be measuring nothing.
//
//   node scripts/verify/_probe-letter-zoom.mjs --label=o5-letters-01 \
//        --frames=0550,1200 --zoom=6 --w=240 --h=90 --cx=0.30
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "o5-letters-01")
const FRAMES = arg("frames", "0550,1200").split(",")
const ZOOM = parseFloat(arg("zoom", "5"))
const CX = parseFloat(arg("cx", "0.5"))
const CY = parseFloat(arg("cy", "0.5"))
const W = parseInt(arg("w", "300"), 10)
const H = parseInt(arg("h", "120"), 10)
const OUT = join(ROOT, "docs", "verification", "hero-beat-film", LABEL, "zoom")
mkdirSync(OUT, { recursive: true })

const imgs = []
for (const f of FRAMES) {
  imgs.push({
    f,
    img: await loadImage(
      join(ROOT, "docs/verification/hero-beat-film", LABEL, "frames", `${f.padStart(4, "0")}.png`),
    ),
  })
}
const c = createCanvas(W * ZOOM, (H * ZOOM + 22) * imgs.length)
const ctx = c.getContext("2d")
ctx.imageSmoothingEnabled = false
ctx.fillStyle = "#111"
ctx.fillRect(0, 0, c.width, c.height)
imgs.forEach((e, i) => {
  const sx = Math.round(e.img.width * CX - W / 2)
  const sy = Math.round(e.img.height * CY - H / 2)
  const y = i * (H * ZOOM + 22)
  ctx.drawImage(e.img, sx, sy, W, H, 0, y, W * ZOOM, H * ZOOM)
  ctx.fillStyle = "#eee"
  ctx.font = "15px monospace"
  ctx.fillText(`frame ${e.f}  crop ${W}x${H} at (${sx},${sy})  ${ZOOM}x`, 6, y + H * ZOOM + 16)
})
const name = `zoom-${FRAMES.join("-vs-")}.png`
writeFileSync(join(OUT, name), c.toBuffer("image/png"))
console.log(`wrote ${join(OUT, name)}  ${c.width}x${c.height}`)
