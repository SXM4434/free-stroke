// LOOK AT THE BREAKS AT FULL RES — the eye pass, not a statistic.
//
// The pixel counts in `assert-hero-k7-news.mjs` say the break is an occlusion
// and that it changed the picture. They cannot say whether it reads as a pen
// lift or as damage, and that is the whole craft question. This crops the
// junctions the shader actually opened, scales them up with NEAREST sampling
// (so a 3 px gap stays a 3 px gap and is not smoothed into a suggestion), and
// tiles fused-vs-open side by side.
//
// Usage: node scripts/verify/_probe-k7-zoom.mjs [--zoom=6] [--pad=48]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "zoom")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? Number(hit.split("=")[1]) : d
}
const ZOOM = arg("zoom", 6)
const PAD = arg("pad", 48)

const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
  await page.waitForTimeout(2000)

  // The RETURNED flat mark: the very end of the beat, where the word is whole.
  const end = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    set.call(el, el.max)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    return Number(el.max)
  })
  await page.waitForTimeout(900)

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const shot = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(350)
    return page.screenshot({ clip: box })
  }
  const fused = await shot({ ...FLAT, jointBreak: 0 })
  const open = await shot({ ...FLAT, jointBreak: 1 })
  writeFileSync(join(OUT, "full-fused.png"), fused)
  writeFileSync(join(OUT, "full-open.png"), open)

  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await browser.close()

  const A = await loadImage(fused)
  const B = await loadImage(open)

  // Find the changed regions from the images themselves, so the crops are of
  // what MOVED rather than of where a junction was declared to be.
  const c1 = createCanvas(A.width, A.height)
  const x1 = c1.getContext("2d")
  x1.drawImage(A, 0, 0)
  const c2 = createCanvas(B.width, B.height)
  const x2 = c2.getContext("2d")
  x2.drawImage(B, 0, 0)
  const da = x1.getImageData(0, 0, A.width, A.height).data
  const db = x2.getImageData(0, 0, B.width, B.height).data

  const seen = new Uint8Array(A.width * A.height)
  const blobs = []
  const stack = []
  for (let y = 0; y < A.height; y++) {
    for (let x = 0; x < A.width; x++) {
      const p = y * A.width + x
      if (seen[p]) continue
      const i = p * 4
      if (Math.abs(da[i] - db[i]) < 24) continue
      // Flood fill one changed region.
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let n = 0
      stack.length = 0
      stack.push(p)
      seen[p] = 1
      while (stack.length) {
        const q = stack.pop()
        const qy = (q / A.width) | 0
        const qx = q - qy * A.width
        n++
        if (qx < minX) minX = qx
        if (qx > maxX) maxX = qx
        if (qy < minY) minY = qy
        if (qy > maxY) maxY = qy
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = qx + dx
            const ny = qy + dy
            if (nx < 0 || ny < 0 || nx >= A.width || ny >= A.height) continue
            const np = ny * A.width + nx
            if (seen[np]) continue
            if (Math.abs(da[np * 4] - db[np * 4]) < 24) continue
            seen[np] = 1
            stack.push(np)
          }
      }
      if (n >= 12) blobs.push({ minX, maxX, minY, maxY, n })
    }
  }
  blobs.sort((a, b) => b.n - a.n)
  console.log(`beat end ${end.toFixed(2)}s · ${blobs.length} changed regions >= 12 px`)

  const cols = 4
  const rows = Math.max(1, Math.ceil(blobs.length / cols))
  const cellW = PAD * 2 * ZOOM
  const cellH = PAD * 2 * ZOOM
  for (const [name, src] of [
    ["fused", c1],
    ["open", c2],
  ]) {
    const sheet = createCanvas(cols * cellW, rows * cellH)
    const sx = sheet.getContext("2d")
    sx.imageSmoothingEnabled = false
    sx.fillStyle = "#ffffff"
    sx.fillRect(0, 0, sheet.width, sheet.height)
    blobs.forEach((b, i) => {
      const cx = Math.round((b.minX + b.maxX) / 2)
      const cy = Math.round((b.minY + b.maxY) / 2)
      const col = i % cols
      const row = (i / cols) | 0
      sx.drawImage(
        src,
        cx - PAD,
        cy - PAD,
        PAD * 2,
        PAD * 2,
        col * cellW,
        row * cellH,
        cellW,
        cellH,
      )
      sx.strokeStyle = "#c0c0c0"
      sx.lineWidth = 2
      sx.strokeRect(col * cellW, row * cellH, cellW, cellH)
      sx.fillStyle = "#888"
      sx.font = "20px monospace"
      sx.fillText(`${i} (${b.n}px)`, col * cellW + 8, row * cellH + 24)
    })
    writeFileSync(join(OUT, `zoom-${name}.png`), sheet.toBuffer("image/png"))
  }
  for (const b of blobs) {
    console.log(
      `  ${String(b.n).padStart(5)} px  at ${((b.minX + b.maxX) / 2) | 0},${((b.minY + b.maxY) / 2) | 0}  ` +
        `${b.maxX - b.minX + 1}x${b.maxY - b.minY + 1}`,
    )
  }
  console.log(`sheets: ${OUT}/zoom-fused.png · zoom-open.png`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
