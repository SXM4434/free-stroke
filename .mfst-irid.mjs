// Iridescence film-thickness sweep.
// `iridescenceThicknessRange` is not harness-drivable (it is creation-only on
// the material), so this patches the preset in lib/style-system.ts, waits for
// HMR, captures, and restores. Deliberately measures CHROMA — the whole claim
// of this preset is "multiple distinct hues", which is a chroma question, not a
// brightness one.
import { chromium } from "playwright-core"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const SRC = "/Users/sebs/Desktop/Projects/free-stroke/lib/style-system.ts"
const OUT = "/Users/sebs/Desktop/Projects/free-stroke/docs/verification/material-craft/iridescence"
mkdirSync(OUT, { recursive: true })
const original = readFileSync(SRC, "utf8")
const RE = /iridescenceThicknessRange: \[\s*\d+\s*,\s*\d+\s*\]/

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 + Math.sin(t * Math.PI * 6) * 22 }) }
  return [pts]
}
async function stats(buf) {
  const img = await loadImage(buf); const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const d = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  let n = 0, sm = 0, sr = 0, sg = 0, sb = 0
  // Per-pixel saturation: how colourful is the surface, pixel by pixel? A
  // mean-RGB spread hides a rainbow (equal amounts of every hue average grey),
  // which is exactly the failure mode being measured here.
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
    sm += mx > 0 ? (mx - mn) / mx : 0
    sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++
  }
  return { sat: n ? (sm / n) * 100 : 0, meanSpread: n ? Math.max(sr, sg, sb) / n - Math.min(sr, sg, sb) / n : 0, n }
}
const patch = (lo, hi) =>
  writeFileSync(SRC, original.replace(RE, `iridescenceThicknessRange: [${lo}, ${hi}]`))

const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const arm = async () => {
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => { window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }); window.__captureHarness.enable() }, testStroke())
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setStyle({ materialPreset: "iridescent", materialUserOverride: true, materialAnimationEnabled: false, materialAnimationType: "none", textureEnabled: false, ditherEnabled: false, asciiEnabled: false, fusionPreset: "none", layerStackEnabled: false, motionMode: "off" }))
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)
}
try {
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await arm()
  console.log("thickness (constant, nm)      per-pixel saturation %   mean-RGB spread")
  for (const hi of [150, 200, 250, 300, 350, 420, 550, 800]) {
    patch(120, hi)
    await page.waitForTimeout(3500) // HMR + material re-create
    // HMR drops the injected strokes, so re-arm every time rather than hoping.
    await arm()
    await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.42))
    await page.waitForTimeout(500)
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const buf = Buffer.from(url.match(/base64,(.+)/)[1], "base64")
    writeFileSync(join(OUT, `thickness_${String(hi).padStart(4, "0")}.png`), buf)
    const s = await stats(buf)
    console.log(`  ${String(hi).padEnd(20)} ${s.sat.toFixed(2).padStart(8)}    ${s.meanSpread.toFixed(1).padStart(6)}   px ${s.n}`)
  }
} finally {
  writeFileSync(SRC, original)
  await browser.close()
  console.log("style-system.ts restored")
}
