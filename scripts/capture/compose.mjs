// Flip compositor: builds a 1920x1080 RGBA frame sequence that
//   (1) plays the captured 3D draw-in (optional),
//   (2) card-flips the 3D face out and the flat logo in,
//   (3) holds the flat logo,
//   (4) flips back to the 3D face.
// The flat logo is scaled to match the 3D word's on-screen width and centered
// on the same point, so the two faces line up in length/height during the flip.
//
// Usage: node scripts/capture/compose.mjs [--mode=with3d|logoonly]
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const DIR = dirname(fileURLToPath(import.meta.url))
const FRAMES = join(DIR, "frames")
const OUT = join(DIR, "composed")
const LOGO = join(DIR, "..", "..", "public", "desk-doodles-logo.png")

const W = 1920
const H = 1080
const FPS = 30
const CENTER_X = W / 2
const CENTER_Y = H / 2

const mode = (process.argv.find((a) => a.startsWith("--mode=")) || "--mode=with3d").split("=")[1]

// Phase durations (seconds)
const HOLD_3D = 0.5
const FLIP = 0.55
const HOLD_LOGO = 1.4
const secToFrames = (s) => Math.round(s * FPS)

function opaqueBBox(img) {
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, img.width, img.height).data
  let minX = 1e9,
    minY = 1e9,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let xx = 0; xx < img.width; xx++) {
      if (d[(y * img.width + xx) * 4 + 3] > 20) {
        if (xx < minX) minX = xx
        if (xx > maxX) maxX = xx
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// Renders the flat logo into a full-frame 1920x1080 canvas, scaled to `targetW`
// width and centered on the frame center. Returns the canvas.
function renderLogoFrame(logo, targetW, targetCy) {
  const lb = opaqueBBox(logo)
  const scale = targetW / lb.w
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  // position so the logo's opaque center lands on (CENTER_X, targetCy)
  const drawW = logo.width * scale
  const drawH = logo.height * scale
  const dx = CENTER_X - (lb.cx * scale)
  const dy = targetCy - (lb.cy * scale)
  ctx.drawImage(logo, dx, dy, drawW, drawH)
  return c
}

// Draws a source canvas/image onto the output ctx with a horizontal card-flip
// scale about the frame center. scaleX in [0..1]; a subtle shade darkens the
// face as it turns edge-on to suggest lighting.
function drawFlip(ctx, src, scaleX, shade = 0) {
  ctx.save()
  ctx.translate(CENTER_X, 0)
  ctx.scale(Math.max(0.0001, scaleX), 1)
  ctx.translate(-CENTER_X, 0)
  ctx.drawImage(src, 0, 0, W, H)
  ctx.restore()
  if (shade > 0) {
    ctx.save()
    ctx.globalCompositeOperation = "source-atop"
    ctx.fillStyle = `rgba(0,0,0,${shade})`
    ctx.translate(CENTER_X, 0)
    ctx.scale(Math.max(0.0001, scaleX), 1)
    ctx.translate(-CENTER_X, 0)
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }
}

async function main() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  const logo = await loadImage(LOGO)

  // Determine the 3D word footprint (from the full-reveal frame) so the logo
  // can be matched to it. In logoonly mode we fall back to a default footprint.
  let wordW = 900
  let wordCy = CENTER_Y
  let drawInFrames = []
  if (mode === "with3d") {
    const files = readdirSync(FRAMES)
      .filter((f) => /^3d_\d+\.png$/.test(f))
      .sort()
    drawInFrames = files
    const full = await loadImage(join(FRAMES, "3d_full.png"))
    const wb = opaqueBBox(full)
    wordW = wb.w
    wordCy = wb.cy
    console.log(`[compose] 3D word footprint w=${wordW} cy=${wordCy.toFixed(0)} frames=${files.length}`)
  }

  const logoFrame = renderLogoFrame(logo, wordW, wordCy)

  let idx = 0
  const emit = (canvas) => {
    writeFileSync(join(OUT, String(idx).padStart(4, "0") + ".png"), canvas.toBuffer("image/png"))
    idx++
  }

  const blank = () => {
    const c = createCanvas(W, H)
    return c
  }

  // Phase 1: draw-in (3D frames as-is), or a logo flip-in for logoonly
  if (mode === "with3d") {
    for (const f of drawInFrames) {
      const img = await loadImage(join(FRAMES, f))
      const c = blank()
      c.getContext("2d").drawImage(img, 0, 0, W, H)
      emit(c)
    }
    // Phase 2: hold full 3D
    const full = await loadImage(join(FRAMES, "3d_full.png"))
    for (let i = 0; i < secToFrames(HOLD_3D); i++) {
      const c = blank()
      c.getContext("2d").drawImage(full, 0, 0, W, H)
      emit(c)
    }
    // Phase 3: flip 3D out (scaleX 1->0), then logo in (0->1)
    const full3d = full
    const flipN = secToFrames(FLIP)
    for (let i = 0; i <= flipN; i++) {
      const t = i / flipN
      const angle = t * Math.PI // 0..180deg
      const sx = Math.abs(Math.cos(angle))
      const c = blank()
      const ctx = c.getContext("2d")
      const shade = 0.35 * (1 - sx)
      drawFlip(ctx, t < 0.5 ? full3d : logoFrame, sx, shade)
      emit(c)
    }
    // Phase 4: hold logo
    for (let i = 0; i < secToFrames(HOLD_LOGO); i++) emit(cloneCanvas(logoFrame))
    // Phase 5: flip back (logo out -> 3D in)
    for (let i = 0; i <= flipN; i++) {
      const t = i / flipN
      const angle = t * Math.PI
      const sx = Math.abs(Math.cos(angle))
      const c = blank()
      const ctx = c.getContext("2d")
      const shade = 0.35 * (1 - sx)
      drawFlip(ctx, t < 0.5 ? logoFrame : full3d, sx, shade)
      emit(c)
    }
    // Phase 6: brief hold on 3D
    for (let i = 0; i < secToFrames(HOLD_3D); i++) {
      const c = blank()
      c.getContext("2d").drawImage(full3d, 0, 0, W, H)
      emit(c)
    }
  } else {
    // logoonly: flip the flat logo in, hold, flip out
    const flipN = secToFrames(FLIP)
    for (let i = 0; i <= flipN; i++) {
      const t = i / flipN
      const sx = t // grow from edge
      const c = blank()
      drawFlip(c.getContext("2d"), logoFrame, sx, 0.3 * (1 - sx))
      emit(c)
    }
    for (let i = 0; i < secToFrames(HOLD_LOGO + HOLD_3D); i++) emit(cloneCanvas(logoFrame))
    for (let i = 0; i <= flipN; i++) {
      const t = i / flipN
      const sx = 1 - t
      const c = blank()
      drawFlip(c.getContext("2d"), logoFrame, sx, 0.3 * (1 - sx))
      emit(c)
    }
  }

  console.log(`[compose] wrote ${idx} frames to ${OUT} (mode=${mode})`)
}

function cloneCanvas(src) {
  const c = createCanvas(W, H)
  c.getContext("2d").drawImage(src, 0, 0)
  return c
}

main()
