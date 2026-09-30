// HOW MUCH PEN WEIGHT THE AMPLITUDE COSTS — the "wiry at 1.00" claim, measured.
//
// The recommendation to ship 0.70 rests on two things: the news is largest
// there (`assert-hero-k7-news --carve=`, which is its own instrument), and the
// mark keeps its weight. This is the second one. It reads the FLAT mark at K7
// off the live page at each amplitude and reports the medial half-width
// distribution — the same `boundaryStats` `assert-flat-silhouette` grades with,
// so the two numbers are commensurable — plus a 3x crop of the same letters at
// each amplitude, because a distribution is not a picture.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { boundaryFromPng } from "./lib/medial-width.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "lane31")
mkdirSync(OUT, { recursive: true })
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const AMPS = arg("amps", "0.7,0.85,1")
  .split(",")
  .map(Number)
const ZOOM = Number(arg("zoom", "3"))
const CROP = (arg("crop", "282,382,300,115").split(",").map(Number))

const browser = await chromium.launch()
const panes = []
for (const amp of AMPS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await ctx.newPage()
  await page.addInitScript((a) => {
    window.__heroCarveAmount = a
  }, amp)
  await page.goto(HERO_URL, {
    waitUntil: "networkidle",
  })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)
  const box = await page.locator("[data-hero-stage]").boundingBox()
  const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  await page.evaluate((v) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(v))
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, endT)
  await page.waitForTimeout(900)
  const png = await page.screenshot({ clip: box })
  const live = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")),
  )
  const b = await boundaryFromPng(png)
  const w = b.widths.slice().sort((p, q) => p - q)
  const q = (f) => w[Math.floor(f * (w.length - 1))]
  console.log(
    `carve ${live.toFixed(2)}  ink ${b.inkPx} px  medial samples ${w.length}  ` +
      `half-width  p10 ${q(0.1).toFixed(2)}  median ${q(0.5).toFixed(2)}  ` +
      `p90 ${q(0.9).toFixed(2)}  min ${w[0].toFixed(2)}`,
  )
  panes.push({ amp: live, png })
  await ctx.close()
}
await browser.close()

const [x, y, cw, chh] = CROP
const sheet = createCanvas(panes.length * (cw * ZOOM + 8) + 8, chh * ZOOM + 30)
const g = sheet.getContext("2d")
g.fillStyle = "#e8e8e8"
g.fillRect(0, 0, sheet.width, sheet.height)
g.imageSmoothingEnabled = false
for (let i = 0; i < panes.length; i++) {
  const img = await loadImage(panes[i].png)
  const dx = 8 + i * (cw * ZOOM + 8)
  g.fillStyle = "#fff"
  g.fillRect(dx, 4, cw * ZOOM, chh * ZOOM)
  g.drawImage(img, x, y, cw, chh, dx, 4, cw * ZOOM, chh * ZOOM)
  g.fillStyle = "#000"
  g.font = "15px monospace"
  g.fillText(`carve ${panes[i].amp.toFixed(2)}`, dx + 4, chh * ZOOM + 22)
}
const p = join(OUT, `weight-x${ZOOM}.png`)
writeFileSync(p, sheet.toBuffer("image/png"))
console.log(`wrote ${p} (${sheet.width}x${sheet.height})`)
