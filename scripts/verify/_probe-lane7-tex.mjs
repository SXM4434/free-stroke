// PROBE — how much authority does the dark-body boost actually have?
//
// Sweeps `uFsTexDarkBoost` and measures the mean |Δ| against the same frame with
// the texture rail OFF, on Rod's shipping `ink` material. 0 is the parked prior,
// so the row at 0 is the negative control: it must reproduce the pre-change
// number, or the two arms are not the two arms.
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const PRESETS = ["fineGrain", "crosshatch", "inkDots", "scanlines"]
const BOOSTS = [0, 1, 2, 4, 8]

const stroke = () => {
  const p = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    p.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [p]
}
async function px(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
function diff(a, b) {
  let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    s += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? s / n : 0
}

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1200, height: 800 } })
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)
await page.evaluate((p) => {
  window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
  window.__captureHarness.enable()
}, stroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__styleHarness.setMode("rod"))
await page.waitForTimeout(1000)
await page.evaluate(() => window.__captureHarness.frontView(1))
await page.waitForTimeout(400)

const grab = async () => {
  const u = await page.evaluate(() => window.__captureHarness.grab())
  return Buffer.from(u.match(/base64,(.+)/)[1], "base64")
}
const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, asciiEnabled: false, layerStackEnabled: false,
  fusionPreset: "none", motionMode: "off",
}
await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
await page.waitForTimeout(600)
const base = await px(await grab())

console.log("preset          " + BOOSTS.map((v) => `boost=${v}`.padStart(9)).join(""))
for (const preset of PRESETS) {
  const row = []
  for (const v of BOOSTS) {
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(200)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", preset])
    await page.evaluate((k) => window.__textureShaderHarness.setDarkBoost(k), v)
    await page.waitForTimeout(700)
    row.push(diff(base, await px(await grab())))
  }
  console.log(preset.padEnd(16) + row.map((d) => d.toFixed(2).padStart(9)).join(""))
}
await page.evaluate(() => window.__textureShaderHarness.setDarkBoost(1))
await b.close()
