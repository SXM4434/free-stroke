// Phase-gate checks that are assertions, not pictures.
//
//   1. GEOMETRY REBUILD GATE — the PRD's hard requirement: "changing style
//      state updates preview without rebuilding geometry". Counts the actual
//      number of geometry builds (via a dev counter on window) across a big
//      sweep of style changes; must stay flat.
//   2. EXPORT REGRESSION — every mode still exports a non-empty GLB with the
//      style layer active.
//   3. TAXONOMY GATE — texture presets must never write dither/ascii state.
//
// Usage: node scripts/verify/verify-gates.mjs
import { chromium } from "playwright-core"

const MODES = ["rod", "extrude", "solid", "inflate"]
const TEXTURES = ["grain", "noise", "scanlines", "bands", "contour"]

function testStroke() {
  const pts = []
  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    pts.push({ x: 140 + t * 560, y: 340 + Math.sin(t * Math.PI * 2) * 120 })
  }
  return [pts]
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 30000 })
  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)

  let pass = true
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }

  // ---- 1. geometry rebuild gate ----------------------------------------
  for (const mode of MODES) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(800)
    const before = await page.evaluate(() => window.__geomDebug.buildCount())
    for (const tex of TEXTURES) {
      for (const intensity of [0.3, 0.9]) {
        await page.evaluate(
          ({ tex, intensity }) =>
            window.__styleHarness.setStyle({
              textureEnabled: true,
              textureMode: tex,
              textureIntensity: intensity,
              textureScale: 1 + intensity,
              textureAnimated: true,
              motionMode: "independent",
            }),
          { tex, intensity },
        )
        await page.waitForTimeout(90)
      }
    }
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => window.__geomDebug.buildCount())
    say(after === before, `geometry-rebuild gate / ${mode}`, `buildCount ${before} → ${after} (10 style changes)`)
  }

  // ---- 2. export regression ---------------------------------------------
  for (const mode of MODES) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(800)
    const bytes = await page.evaluate(() => window.__geomDebug.exportBytes())
    say(typeof bytes === "number" && bytes > 1000, `export / ${mode}`, `${bytes} bytes`)
  }

  // ---- 3. taxonomy gate --------------------------------------------------
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      ditherEnabled: false,
      asciiEnabled: false,
      textureEnabled: true,
      textureMode: "scanlines",
    }),
  )
  await page.waitForTimeout(200)
  const s = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(!s.ditherEnabled, "taxonomy / texture does not enable dither")
  say(!s.asciiEnabled, "taxonomy / texture does not enable ascii")

  say(errors.length === 0, "console errors", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)

  await browser.close()
  console.log(pass ? "\nALL GATES PASS" : "\nGATE FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
