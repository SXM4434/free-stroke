// Is the empty rod/wrapped frame a Rod defect or a frozen render loop?
import { chromium } from "./lib/browser.mjs"
import { frameInk } from "./lib/frame-ink.mjs"
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
let perr = 0
page.on("pageerror", () => perr++)
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
const shot = async () => {
  const url = await page.evaluate(() => window.__captureHarness.grab())
  const buf = Buffer.from(url.match(/base64,(.+)/)[1], "base64")
  return (await frameInk(buf)).ink
}
// rAF liveness: does the loop still tick?
const ticks = async (ms) => page.evaluate((ms) => new Promise((res) => {
  let n = 0
  const t0 = performance.now()
  const step = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(step); else res(n) }
  requestAnimationFrame(step)
}), ms)
for (const [mode, le] of [["inflate","capped"],["inflate","wrapped"],["rod","capped"],["rod","wrapped"],["rod","capped"]]) {
  const e0 = perr
  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(250)
  await page.evaluate((v) => { if (window.__rodTuning) window.__rodTuning.loopEnds = v }, le)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), circle())
  await page.waitForTimeout(900)
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => window.__captureHarness.bounds().radius)
  await page.evaluate(({r}) => window.__captureHarness.orbitView(0, 26, 0.9), { r })
  await page.waitForTimeout(300)
  const a = await shot()
  await page.evaluate(() => window.__captureHarness.orbitView(90, 40, 0.9))
  await page.waitForTimeout(300)
  const c = await shot()
  const t = await ticks(500)
  const st = await page.evaluate(() => window.__geomDebug.stats())
  console.log(`${mode}/${le}  bounds r ${r.toFixed(3)}  ink(az0) ${a}  ink(az90) ${c}  cameraMoved ${a!==c}  rAFticks/500ms ${t}  capSpheres ${st.capSpheres}  verts ${st.vertices}  newPageErrors ${perr-e0}`)
}
await b.close()
