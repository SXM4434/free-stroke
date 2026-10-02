import { chromium } from "./lib/browser.mjs"
import { writeFileSync } from "node:fs"
// ONE KNOB, ONE NAME — see `_probe.mjs`'s note. Imports the resolver rather than
// copying the port line, which is what keeps the legacy-name throw reachable.
// DISPATCH §3; explainers 27 §1 and 28 §3.2. No address is spelled here.
import { LAB_URL } from "./lib/dev-server.mjs"
const browser = await chromium.launch({ headed: true })
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
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
await page.waitForTimeout(1000)
await page.evaluate(() => window.__captureHarness.frontView(0.95))
await page.waitForTimeout(400)
writeFileSync("/tmp/p3_before.png", await page.screenshot())
const st0 = await page.evaluate(() => ({ ...window.__styleHarness.get().styleState, _p: window.__revealHarness }))
await page.evaluate(() => window.__styleHarness.selectPreset("animatedDither", "ditherCrawl"))
await page.waitForTimeout(700)
writeFileSync("/tmp/p3_after.png", await page.screenshot())
await page.waitForTimeout(1500)
writeFileSync("/tmp/p3_after2.png", await page.screenshot())
console.log("done")
await browser.close()
