import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
const circle = () => { const p=[]; for(let i=0;i<=160;i++){const t=(i/160)*Math.PI*2;p.push({x:440+Math.cos(t)*210,y:360+Math.sin(t)*210})} return [p] }
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1300, height: 850 } })
const seen = new Set()
page.on("pageerror", (e) => {
  const s = (e.stack || String(e)).slice(0, 900)
  const k = s.slice(0, 140)
  if (seen.has(k)) return
  seen.add(k)
  console.log("=== PAGE ERROR ===\n" + s + "\n")
})
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness, null, { timeout: 60000 })
await page.waitForTimeout(1500)
console.log("--- inject strokes ---")
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), circle())
await page.waitForTimeout(2000)
for (const m of ["rod","extrude","solid","inflate"]) {
  console.log(`--- setMode ${m} ---`)
  await page.evaluate((x) => window.__styleHarness.setMode(x), m)
  await page.waitForTimeout(2500)
}
await b.close()
