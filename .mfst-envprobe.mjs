// A/B probe: is envMapIntensity actually reaching the GPU?
// Sweeps the custom material's envMapIntensity and reports inked-pixel
// luminance. Before the fix these are all identical; after, they separate.
import { chromium } from "playwright-core"
import { loadImage, createCanvas } from "@napi-rs/canvas"

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 }) }
  return [pts]
}
async function stats(buf) {
  const img = await loadImage(buf); const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const d = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  const L = []
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 40) continue; L.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) }
  if (!L.length) return { mean: 0, max: 0, skew: 0, n: 0 }
  const m = L.reduce((s, v) => s + v, 0) / L.length
  const sd = Math.sqrt(L.reduce((s, v) => s + (v - m) ** 2, 0) / L.length) || 1
  const skew = L.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / L.length
  let mx = 0
  for (const v of L) if (v > mx) mx = v
  return { mean: m, max: mx, skew, n: L.length }
}
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 40000 })
await page.evaluate((p) => { window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }); window.__captureHarness.enable() }, testStroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__styleHarness.setMode("solid"))
await page.waitForTimeout(900)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__captureHarness.frontView(0.45))
await page.waitForTimeout(400)
const grab = async () => Buffer.from((await page.evaluate(() => window.__captureHarness.grab())).match(/base64,(.+)/)[1], "base64")
const setStyle = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
const setCustom = (p) => page.evaluate((x) => window.__styleHarness.setCustom(x), p)
await setStyle({ materialPreset: "custom", materialUserOverride: true, materialAnimationEnabled: false, materialAnimationType: "none", textureEnabled: false, ditherEnabled: false, asciiEnabled: false, fusionPreset: "none", layerStackEnabled: false, motionMode: "off" })
await page.waitForTimeout(700)

const BASE = { color: "#2a2a2a", roughness: 0.35, metalness: 0, clearcoat: 0.4, sheen: 0, sheenColor: "#000000", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 1 }
console.log("--- envMapIntensity sweep (dielectric, roughness .35) ---")
for (const v of [0, 0.5, 1, 2, 3]) {
  await setCustom({ ...BASE, envMapIntensity: v }); await page.waitForTimeout(550)
  const s = await stats(await grab())
  console.log(`  env=${v}  mean ${s.mean.toFixed(1)}  max ${s.max.toFixed(1)}  skew ${s.skew.toFixed(2)}`)
}
console.log("--- envMapIntensity sweep (metal, roughness .15) ---")
for (const v of [0, 1, 3]) {
  await setCustom({ ...BASE, color: "#ffffff", metalness: 1, roughness: 0.15, envMapIntensity: v }); await page.waitForTimeout(550)
  const s = await stats(await grab())
  console.log(`  env=${v}  mean ${s.mean.toFixed(1)}  max ${s.max.toFixed(1)}  skew ${s.skew.toFixed(2)}`)
}
console.log("--- sheen: black vs white sheenColor ---")
for (const [c, vs] of [["#000000", [0, 1]], ["#ffffff", [0, 1]]])
  for (const v of vs) {
    await setCustom({ ...BASE, clearcoat: 0, roughness: 0.8, sheen: v, sheenColor: c }); await page.waitForTimeout(550)
    const s = await stats(await grab())
    console.log(`  sheen=${v} color=${c}  mean ${s.mean.toFixed(1)}  max ${s.max.toFixed(1)}`)
  }
console.log("--- emissiveIntensity: black vs coloured emissive ---")
for (const [c, vs] of [["#000000", [0, 2]], ["#8899aa", [0, 2]]])
  for (const v of vs) {
    await setCustom({ ...BASE, emissive: c, emissiveIntensity: v }); await page.waitForTimeout(550)
    const s = await stats(await grab())
    console.log(`  emI=${v} color=${c}  mean ${s.mean.toFixed(1)}  max ${s.max.toFixed(1)}`)
  }
await browser.close()
