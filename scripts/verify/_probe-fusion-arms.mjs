// WHERE DOES EACH OF THESE THREE PARAMETERS ACTUALLY ACT?
//
// Three rows of assert-fusion-authoring came back under the floor and each one
// was answered by guessing at a better arm, which made two of them WORSE. That
// is the loop this repo calls tuning without measuring, so the arms are settled
// here instead — by sweeping the parameter ITSELF (not the fusion link) across
// the compositions it might live in and reading the delta.
//
//   ditherContrast  across dither type x levels
//   iridescence     across every material body
//   stack gOff      across stackAnimationType x speed — how big is the group's
//                   own motion, which is the floor the Stack source is measured
//                   against
//
//   node scripts/verify/_probe-fusion-arms.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "fusion-newborn", "arms")
mkdirSync(OUT, { recursive: true })

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}
async function frameDelta(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  const w = Math.min(ia.width, ib.width)
  const h = Math.min(ia.height, ib.height)
  const ca = createCanvas(w, h)
  const cb = createCanvas(w, h)
  ca.getContext("2d").drawImage(ia, 0, 0)
  cb.getContext("2d").drawImage(ib, 0, 0)
  const da = ca.getContext("2d").getImageData(0, 0, w, h).data
  const db = cb.getContext("2d").getImageData(0, 0, w, h).data
  let s = 0
  for (let i = 0; i < da.length; i += 4)
    s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  return s / (w * h * 3)
}

const BASE = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false, ditherDirection: "static",
  asciiEnabled: false, asciiAnimated: false, asciiAnimationType: "none",
  layerStackEnabled: false, stackAnimationEnabled: false, stackAnimationType: "none",
  fusionPreset: "none", motionMode: "independent",
  materialPreset: "ink", materialUserOverride: false,
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const grab = async () => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    return u ? Buffer.from(u.split(",")[1], "base64") : null
  }
  const pair = async (a, b) => {
    await set(a)
    await page.waitForTimeout(750)
    const fa = await grab()
    await set(b)
    await page.waitForTimeout(750)
    const fb = await grab()
    return frameDelta(fa, fb)
  }

  const report = { ditherContrast: [], iridescence: [], stack: [] }

  console.log("\n=== ditherContrast 0.05 -> 0.95, across type x levels ===")
  for (const type of ["bayer4", "bayer8", "blueNoise", "halftone"]) {
    for (const levels of [2, 3, 4, 6]) {
      const arm = { ...BASE, ditherEnabled: true, ditherType: type, ditherLevels: levels, ditherScale: 3, ditherExposure: 0.7, ditherIntensity: 1, ditherLockMode: "screen" }
      const d = await pair({ ...arm, ditherContrast: 0.05 }, { ...arm, ditherContrast: 0.95 })
      report.ditherContrast.push({ type, levels, delta: d })
      console.log(`  ${type.padEnd(10)} levels ${levels}  Δ${d.toFixed(3)}`)
    }
  }

  console.log("\n=== iridescence, via the material's own custom body, per preset ===")
  // The fusion lever adds to whatever the body's base is, so what matters is
  // which BODY makes a thin film visible at all. Driven through the fusion
  // engine itself so this measures the real path.
  const mk = (amount) => ({
    customFusions: [{ id: "arm", name: "arm", glowColor: "#7ec8a0", links: [{ id: "l", source: "reveal", target: "iridescence", amount }] }],
    fusionPreset: "custom:arm",
    fusionIntensity: 1,
    fusionSwing: 1,
    fusionDrive: "loop",
  })
  for (const m of ["ink", "signal", "glossyPlastic", "ceramic", "chrome", "gold", "iridescent", "matteClay", "softGel"]) {
    const arm = { ...BASE, materialPreset: m, materialUserOverride: true }
    let best = 0
    for (const a of [1, -1]) {
      const d = await pair({ ...arm, ...mk(0) }, { ...arm, ...mk(a) })
      if (d > best) best = d
    }
    report.iridescence.push({ material: m, delta: best })
    console.log(`  ${m.padEnd(14)} Δ${best.toFixed(3)}`)
  }

  console.log("\n=== the stack group's OWN motion (the floor the Stack source fights) ===")
  for (const type of ["drift", "loop", "pulse"]) {
    for (const speed of [0.1, 0.2, 0.6, 1.6]) {
      const arm = {
        ...BASE, ditherEnabled: true, ditherType: "bayer4", ditherScale: 3, ditherExposure: 0.7,
        asciiEnabled: true, layerStackEnabled: true, stackAnimationEnabled: true,
        stackAnimationType: type, stackAnimationSpeed: speed,
      }
      await set(arm)
      await page.waitForTimeout(900)
      const f0 = await grab()
      let worst = 0
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(700)
        const d = await frameDelta(f0, await grab())
        if (d > worst) worst = d
      }
      report.stack.push({ type, speed, selfMotion: worst })
      console.log(`  ${type.padEnd(8)} speed ${String(speed).padEnd(5)} the group moves the frame by Δ${worst.toFixed(3)} on its own`)
    }
  }

  writeFileSync(join(OUT, "arms-report.json"), JSON.stringify(report, null, 2))
  console.log(`\nwrote ${join(OUT, "arms-report.json")}`)
  await ctx.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
