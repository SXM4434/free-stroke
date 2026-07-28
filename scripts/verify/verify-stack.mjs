// Layering evidence: captures the SAME stroke with style systems switched on
// one at a time, so the composition can be judged rather than assumed.
//   1 none -> 2 texture -> 3 texture+dither -> 4 texture+dither+ascii
// This is the visual answer to the PRD's layering gate ("dither + ASCII +
// texture + material coexist without unreadable soup").
//
// Usage: node scripts/verify/verify-stack.mjs
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync } from "node:fs"
const OUT = "/Users/sebs/free-stroke/docs/verification/stack-v1"
mkdirSync(OUT, { recursive: true })
const stroke = () => { const p=[]; for(let i=0;i<=120;i++){const t=i/120; p.push({x:120+t*620,y:330+Math.sin(t*Math.PI*2.2)*130+Math.sin(t*Math.PI*6)*22})} return [p] }
const b = await chromium.launch({ channel: "chrome", headless: true })
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } })
await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)
await page.evaluate((p) => { window.__styleHarness.injectStrokes(p,{msPerPoint:12}); window.__captureHarness.enable() }, stroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__styleHarness.setMode("solid"))
await page.waitForTimeout(800)
await page.evaluate(() => window.__captureHarness.frontView(1))
const grab = async (n) => { const u = await page.evaluate(()=>window.__captureHarness.grab()); writeFileSync(`${OUT}/${n}.png`, Buffer.from(u.match(/base64,(.+)/)[1],"base64")) }
const set = (p) => page.evaluate((x)=>window.__styleHarness.setStyle(x), p)
const OFF = { textureEnabled:false, ditherEnabled:false, asciiEnabled:false, textureAnimated:false, ditherAnimated:false, asciiAnimated:false }
const cases = [
  ["1_none", OFF],
  ["2_texture_only", {...OFF, textureEnabled:true, textureMode:"contour", textureScale:1.2, textureIntensity:0.6, textureContrast:0.55, textureLockMode:"object"}],
  ["3_texture_dither", {...OFF, textureEnabled:true, textureMode:"contour", textureScale:1.2, textureIntensity:0.6, textureLockMode:"object", ditherEnabled:true, ditherType:"bayer4", ditherScale:4, ditherLevels:2, ditherIntensity:1, ditherContrast:0.55, ditherThreshold:0.5, ditherLockMode:"screen"}],
  ["4_all_three", {...OFF, textureEnabled:true, textureMode:"contour", textureScale:1.2, textureIntensity:0.6, textureLockMode:"object", ditherEnabled:true, ditherType:"bayer4", ditherScale:4, ditherLevels:3, ditherIntensity:0.7, ditherContrast:0.55, ditherThreshold:0.5, ditherLockMode:"screen", asciiEnabled:true, asciiCharset:"classic", asciiCellSize:16, asciiDensity:0.5, asciiContrast:0.5, asciiLockMode:"screen"}],
]
for (const [n, p] of cases) { await set(p); await page.waitForTimeout(500); await grab(n); console.log("captured", n) }
await b.close()
