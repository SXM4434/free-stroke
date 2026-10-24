import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — see `_probe.mjs`'s note. Imports the resolver rather than
// copying the port line, which is what keeps the legacy-name throw reachable.
// DISPATCH §3; explainers 27 §1 and 28 §3.2. No address is spelled here.
import { LAB_URL } from "./lib/dev-server.mjs"
const browser = await chromium.launch({ headed: true })
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR", m.text().slice(0, 200)) })
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)
const pts = []
for (let i = 0; i <= 140; i++) {
  const t = i / 140
  pts.push({ x: 110 + t * 640, y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24 })
}
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), [pts])
await page.waitForTimeout(1600)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__styleHarness.setMode("solid"))
await page.waitForTimeout(1200)

const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false, asciiEnabled: false, asciiAnimated: false,
  fusionPreset: "none", layerStackEnabled: false, stackAnimationEnabled: false,
  materialAnimationEnabled: false, motionMode: "off",
}

async function probe(label, apply) {
  await page.evaluate((o) => window.__styleHarness.setStyle(o), OFF)
  await page.waitForTimeout(300)
  await apply()
  await page.waitForTimeout(800)
  const st = await page.evaluate(() => {
    const s = window.__styleHarness.get().styleState
    return { motionMode: s.motionMode, ditherAnimated: s.ditherAnimated, ditherSpeed: s.ditherSpeed,
      ditherDirection: s.ditherDirection, asciiAnimated: s.asciiAnimated, asciiAnimationType: s.asciiAnimationType,
      textureAnimated: s.textureAnimated, ditherSyncMode: s.ditherSyncMode, asciiSyncMode: s.asciiSyncMode,
      textureSyncMode: s.textureSyncMode, syncMode: s.syncMode }
  })
  // sample the canvas pixels directly over time
  const samples = []
  for (let i = 0; i < 6; i++) {
    const px = await page.evaluate(() => {
      const cs = [...document.querySelectorAll("canvas")]
      const c = cs[cs.length - 1]
      const g = c.getContext("webgl2") || c.getContext("webgl")
      return null
    })
    const url = await page.evaluate(() => window.__captureHarness.grab())
    samples.push(url ? url.length : 0)
    await page.waitForTimeout(220)
  }
  const uniq = new Set(samples).size
  console.log(label, JSON.stringify(st), "distinctFrameSizes=", uniq, samples.slice(0, 6).join(","))
}

await probe("PRESET ditherCrawl", () => page.evaluate(() => window.__styleHarness.selectPreset("animatedDither", "ditherCrawl")))
await probe("MANUAL dither crawl", () => page.evaluate(() => window.__styleHarness.setStyle({
  ditherEnabled: true, ditherAnimated: true, ditherType: "bayer4", ditherScale: 4, ditherLevels: 2,
  ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherSpeed: 2,
  ditherDirection: "diagonal", ditherLockMode: "screen", motionMode: "independent" })))
await probe("PRESET glyphScroll", () => page.evaluate(() => window.__styleHarness.selectPreset("animatedAscii", "glyphScroll")))
await probe("PRESET grainDrift", () => page.evaluate(() => window.__styleHarness.selectPreset("animatedTexture", "grainDrift")))
await probe("PRESET scanlineScroll", () => page.evaluate(() => window.__styleHarness.selectPreset("animatedTexture", "scanlineScroll")))

const dbg = await page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => d.textContent?.startsWith("styleClockElapsed"))
  return el ? el.textContent : "no debug panel"
})
console.log("debug:", dbg)
await browser.close()
