// SMOKE: does the paper break RENDER at all, and does the shader compile?
//
// One question only, answered in pixels: with the flat state pinned and
// `jointBreak` driven 0 -> 1, does the picture lose ink? Everything else about
// K7 — gate 1, occlusion-not-shading, the negative controls — belongs to
// `assert-hero-k7-news.mjs`. This is the thing you run while writing the shader.
//
// Usage: node scripts/verify/_probe-k7-smoke.mjs [--open=1]
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
const OUT = join(ROOT, "docs", "verification", "hero-k7", "smoke")
const INK_MAX = 150

const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }

async function inkStats(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const H = Math.floor(img.height * 0.75)
  const mask = new Uint8Array(img.width * H)
  let n = 0
  for (let y = 0; y < H; y++)
    for (let px = 0; px < img.width; px++) {
      const i = (y * img.width + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l <= INK_MAX) {
        mask[y * img.width + px] = 1
        n++
      }
    }
  return { n, mask, W: img.width, H }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 300))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
  await page.waitForTimeout(2500)

  // Park on the settled flat mark — draw-in complete, dead-on, no turn. Same
  // 3.00s `assert-hero-flatstate.mjs` uses, and for the same reason: at t=0 the
  // reveal has drawn nothing and every ink statistic reads zero.
  await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    set.call(el, "3.0")
    el.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await page.waitForTimeout(600)

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const shot = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(300)
    // CLIP, not an element screenshot: the element path waits for the node to
    // be "stable", and this page never stops rendering.
    return page.screenshot({ clip: box })
  }

  const a = await shot({ ...FLAT, jointBreak: 0 })
  const b = await shot({ ...FLAT, jointBreak: 1 })
  writeFileSync(join(OUT, "k1-fused.png"), a)
  writeFileSync(join(OUT, "k7-open.png"), b)

  const breaks = await page.evaluate(() => window.__heroBreaks ?? null)
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await browser.close()

  const sa = await inkStats(a)
  const sb = await inkStats(b)
  let lost = 0
  let gained = 0
  for (let p = 0; p < sa.mask.length; p++) {
    if (sa.mask[p] && !sb.mask[p]) lost++
    else if (!sa.mask[p] && sb.mask[p]) gained++
  }
  console.log("__heroBreaks:", JSON.stringify(breaks, null, 1))
  console.log(`ink px  fused ${sa.n}  open ${sb.n}   delta ${sb.n - sa.n}`)
  console.log(`ink -> paper ${lost} px · paper -> ink ${gained} px`)
  console.log(`console errors: ${errors.length}`)
  for (const e of errors.slice(0, 8)) console.log("  " + e)
  console.log(`frames: ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
