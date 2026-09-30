import { chromium } from "playwright-core"
import { loadImage, createCanvas } from "@napi-rs/canvas"

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 }) }
  return [pts]
}
async function lum(buf) {
  const img = await loadImage(buf); const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const d = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  let n = 0, s = 0, mx = 0
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 40) continue; const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += L; if (L > mx) mx = L; n++ }
  return { mean: n ? s / n : 0, max: mx, n }
}
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)
await page.evaluate((p) => { window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }); window.__captureHarness.enable() }, testStroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__styleHarness.setMode("solid"))
await page.waitForTimeout(900)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__captureHarness.frontView(0.45))
await page.waitForTimeout(400)

const info = await page.evaluate(() => {
  const cv = document.querySelector("canvas")
  const out = { canvasKeys: Object.keys(cv).slice(0, 10) }
  const r3f = cv.__r3f
  out.hasR3f = !!r3f
  if (r3f) out.r3fKeys = Object.keys(r3f)
  let store = null
  if (r3f && r3f.root) {
    store = typeof r3f.root.getState === "function" ? r3f.root.getState() : r3f.root
    out.rootKeys = Object.keys(r3f.root)
  }
  if (store && store.scene) {
    const s = store.scene
    out.environment = s.environment ? s.environment.constructor.name : null
    out.envIntensity = s.environmentIntensity
    out.background = s.background ? s.background.constructor.name : null
    const mats = []
    s.traverse((o) => {
      if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) {
        const m = o.material
        mats.push({ env: m.envMapIntensity, envMap: !!m.envMap, sheen: m.sheen, cc: m.clearcoat, rough: m.roughness, metal: m.metalness, col: m.color.getHexString(), emi: m.emissive.getHexString(), emiI: m.emissiveIntensity, defines: m.defines ? Object.keys(m.defines) : null })
      }
    })
    const seen = new Set()
    out.mats = mats.filter((m) => { const k = JSON.stringify(m); return seen.has(k) ? false : (seen.add(k), true) })
  }
  return out
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
