// One-off diagnostics for the style-layer craft pass.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// ONE KNOB, ONE NAME — this named the default dev-server address, so a lane
// running it on its own port photographed the shared tree (DISPATCH §3;
// explainers 27 §1 and 28 §3.2 — importing the resolver, not copying the port
// line, is what keeps the legacy-name throw).
import { LAB_URL } from "./lib/dev-server.mjs"
// ...AND THE OUTPUT SIDE, WHICH IS THE HALF NO SURVEY COULD SEE. This wrote to a
// FIXED directory named by absolute path inside a checkout, so a lane's
// diagnostic published its frames into the shared checkout's stored evidence.
// Derived from the script's own location; byte-identical there to the string it
// replaces. The defect is a PATH, not a URL — `assert-one-knob` channel F.
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "verification", "style-craft", "diag")
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headed: true })
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)

const OFF = { textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false, asciiEnabled: false, asciiAnimated: false,
  fusionPreset: "none", layerStackEnabled: false, stackAnimationEnabled: false,
  materialAnimationEnabled: false, motionMode: "off" }

function stroke(scale) {
  const cx = 430, cy = 330
  const pts = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    const x = 110 + t * 640, y = 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24
    pts.push({ x: cx + (x - cx) * scale, y: cy + (y - cy) * scale })
  }
  return [pts]
}

const boxes = await page.$$eval("canvas", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
const rectOf = (fx, fy, fw, fh) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy, width: box.width * fw, height: box.height * fh })

async function hist(buf, label) {
  const img = await loadImage(buf)
  const cv = createCanvas(img.width, img.height), g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  const vals = []
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    if (l < 0.91) vals.push(l)   // exclude paper
  }
  vals.sort((a, b) => a - b)
  const q = (p) => vals.length ? +vals[Math.floor(p * (vals.length - 1))].toFixed(3) : -1
  console.log(`HIST ${label}: n=${vals.length} p01=${q(0.01)} p10=${q(0.10)} p25=${q(0.25)} p50=${q(0.50)} p75=${q(0.75)} p90=${q(0.90)} p99=${q(0.99)}`)
}

for (const mode of ["solid", "extrude", "rod", "inflate"]) {
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke(1))
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1100)
  await page.evaluate(() => window.__captureHarness.frontView(0.95))
  await page.evaluate((o) => window.__styleHarness.setStyle(o), OFF)
  await page.waitForTimeout(500)
  const buf = await page.screenshot({ clip: rectOf(0.02, 0.02, 0.96, 0.62) })
  writeFileSync(`${OUT}/off_${mode}.png`, buf)
  await hist(buf, mode)
}

// ---- stroke-size sensitivity of texture scale --------------------------
await page.evaluate((m) => window.__styleHarness.setMode(m), "solid")
await page.waitForTimeout(800)
for (const s of [1.0, 0.45]) {
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke(s))
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.evaluate(() => window.__captureHarness.frontView(0.95))
  await page.evaluate((o) => window.__styleHarness.setStyle({ ...o, textureEnabled: true, textureMode: "dots", textureScale: 1, textureIntensity: 0.75, textureContrast: 0.6, textureLockMode: "object" }), OFF)
  await page.waitForTimeout(600)
  writeFileSync(`${OUT}/scale_stroke${s}.png`, await page.screenshot({ clip: rectOf(0.05, 0.05, 0.9, 0.6) }))
}

// ---- extrude side-wall projection stretch ------------------------------
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke(1))
await page.waitForTimeout(1000)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate((m) => window.__styleHarness.setMode(m), "extrude")
await page.waitForTimeout(1200)
for (const az of [0, 35, 60]) {
  await page.evaluate((a) => window.__captureHarness.orbitView(a, 6, 0.55), az)
  await page.evaluate((o) => window.__styleHarness.setStyle({ ...o, textureEnabled: true, textureMode: "dots", textureScale: 1.2, textureIntensity: 0.8, textureContrast: 0.6, textureLockMode: "object" }), OFF)
  await page.waitForTimeout(600)
  writeFileSync(`${OUT}/proj_az${az}.png`, await page.screenshot({ clip: rectOf(0.15, 0.08, 0.5, 0.5) }))
}
console.log("diag done")
await browser.close()
