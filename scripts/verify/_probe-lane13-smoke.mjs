import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
const b = await chromium.launch({ headed: true })
const p = await b.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: "no-preference" })
const errs = []
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text().slice(0,120)) })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness && window.__captureHarness)
const pts=[]; for(let i=0;i<=120;i++){const t=i/120;pts.push({x:120+t*620,y:330+Math.sin(t*Math.PI*2.2)*130})}
await p.evaluate((x)=>{window.__styleHarness.injectStrokes(x,{msPerPoint:12});window.__captureHarness.enable()},[pts])
await p.waitForTimeout(1500)
await p.evaluate(()=>window.__styleHarness.setMode("solid"))
await p.waitForTimeout(900)
await p.evaluate(()=>window.__styleHarness.setStyle({layerStackEnabled:true,textureEnabled:true,textureMode:"scanlines",ditherEnabled:true,asciiEnabled:true,asciiCharset:"blocks",asciiCellSize:14,motionMode:"off"}))
await p.waitForTimeout(700)
const u = await p.evaluate(()=>window.__captureHarness.grab())
const buf = Buffer.from(u.match(/base64,(.+)/)[1],"base64")
console.log("png bytes", buf.length, "| console errors", errs.length, errs[0]??"")
await b.close()
