// PROBE — the wind-up ON PIXELS, off the frames `verify-hero-windup.mjs` shot.
//
// The model says the release is graded and the prior law snaps. This reads it
// back off the rendered PNGs, because a model that is right does not prove a
// page that renders it, and this beat has already paid twice for a number that
// was true of the sampler and false of the screen.
//
// Prints only the frames on which the bounding box CHANGED, so the run reads as
// the event rather than as a list of duplicates — the beat is on twos, so most
// adjacent frames are the same picture by construction.
//
// Usage: node scripts/verify/_probe-windup-frames.mjs
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"
import { ROOT } from "./_ts-load.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const OUT = join(ROOT, "docs", "verification", "hero-windup")

// The same absolute dark cut `assert-hero-dead-channels` uses, and for the same
// reason: the stage draws a grid and a ground plane that run its full height, so
// a modal-luma threshold returns a box the squash is invisible inside.
const INK_MAX = 120

async function measure(p) {
  const img = await loadImage(p)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  let n = 0
  for (let y = 0; y < img.height; y++) {
    for (let px = 0; px < img.width; px++) {
      const i = (y * img.width + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l < INK_MAX) {
        n++
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { ink: n, w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

if (!existsSync(OUT)) {
  console.error(
    `no frames at ${OUT} — run:\n  node scripts/verify/_run-clean.mjs scripts/verify/verify-hero-windup.mjs`,
  )
  process.exit(2)
}

for (const arm of ["uncoils", "snaps"]) {
  const dir = join(OUT, arm)
  if (!existsSync(dir)) continue
  console.log(`\n=== ${arm} — only the frames where the box moved ===`)
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
  let prev = null
  let biggestH = 0
  for (const f of files) {
    const m = await measure(join(dir, f))
    if (prev && m.w === prev.w && m.h === prev.h) {
      prev = m
      continue
    }
    const dh = prev ? m.h - prev.h : 0
    const dw = prev ? m.w - prev.w : 0
    if (Math.abs(dh) > biggestH) biggestH = Math.abs(dh)
    console.log(
      `  ${f}  w ${String(m.w).padStart(4)}  h ${String(m.h).padStart(4)}  cy ${m.cy.toFixed(1)}` +
        `   dH ${(dh >= 0 ? "+" : "") + dh}   dW ${(dw >= 0 ? "+" : "") + dw}`,
    )
    prev = m
  }
  console.log(`  largest single-frame HEIGHT step: ${biggestH} px`)
}
