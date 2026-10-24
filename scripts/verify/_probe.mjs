import { chromium } from "./lib/browser.mjs"
import { writeFileSync } from "node:fs"
// ONE KNOB, ONE NAME. This tool used to spell the default dev-server address, so
// a lane running it on its own port photographed the CANONICAL tree and filed
// the result under its own name. DISPATCH §3; explainers 27 §1 and 28 §3.2.
// IMPORTING the resolver is the bar, not reading the right variable: a private
// copy that happens to honour the knob opts out of the legacy-name throw, which
// is Lane F's finding about `assert-tsc-baseline.mjs`. This comment deliberately
// spells no address — a comment is source text too (explainer 28 §4.1).
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
await page.waitForTimeout(1200)
await page.evaluate(() => window.__captureHarness.frontView(0.95))
await page.waitForTimeout(500)
writeFileSync("/tmp/probe_full.png", await page.screenshot())
const info = await page.evaluate(() => {
  const g = window.__styleHarness.get()
  return { mode: g.geometryMode, solid: g.solidParams, style: { tex: g.styleState.textureMode, mat: g.styleState.materialPreset } }
})
console.log(JSON.stringify(info, null, 2))
const box = await (await page.$("canvas")).boundingBox()
console.log("canvasBox", JSON.stringify(box))
await browser.close()
