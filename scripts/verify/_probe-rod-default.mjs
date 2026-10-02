// Does a CLOSED Rod loop throw on the SHIPPED default, with nothing touched?
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
const openArc = () => { const p=[]; for(let i=0;i<=150;i++){const t=(i/150)*Math.PI*1.82;p.push({x:440+Math.cos(t)*210,y:360+Math.sin(t)*210})} return [p] }
const square = () => { const p=[]; const c=[[250,180],[640,180],[640,545],[250,545],[250,180]]; for(let k=0;k<c.length-1;k++){const[x0,y0]=c[k],[x1,y1]=c[k+1]; for(let i=0;i<30;i++)p.push({x:x0+((x1-x0)*i)/30,y:y0+((y1-y0)*i)/30})} p.push({x:250,y:180}); return [p] }
const SH = { circle, openArc, square }
const b = await chromium.launch()
for (const [name, fn] of Object.entries(SH)) {
  for (const mode of ["rod", "inflate"]) {
    const page = await b.newPage({ viewport: { width: 1300, height: 850 } })
    let perr = 0, first = null
    page.on("pageerror", (e) => { perr++; if (!first) first = (e.stack || String(e)).split("\n").slice(0,3).join(" | ").slice(0,240) })
    await page.goto(LAB_URL, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
    const tuning = await page.evaluate(() => JSON.stringify(window.__rodTuning ?? null))
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), fn())
    await page.waitForTimeout(900)
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(1800)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__captureHarness.orbitView(0, 26, 0.9))
    await page.waitForTimeout(300)
    const u1 = await page.evaluate(() => window.__captureHarness.grab())
    await page.evaluate(() => window.__captureHarness.orbitView(90, 40, 0.9))
    await page.waitForTimeout(300)
    const u2 = await page.evaluate(() => window.__captureHarness.grab())
    const i1 = (await frameInk(Buffer.from(u1.match(/base64,(.+)/)[1], "base64"))).ink
    const i2 = (await frameInk(Buffer.from(u2.match(/base64,(.+)/)[1], "base64"))).ink
    console.log(`${name}/${mode}  tuning ${tuning}  uncaught ${String(perr).padStart(4)}  cameraMoved ${i1 !== i2}  ink ${i1}/${i2}`)
    if (first) console.log(`     first: ${first}`)
    await page.close()
  }
}
await b.close()
