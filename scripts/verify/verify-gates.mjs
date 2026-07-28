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
const DITHERS = ["bayer4", "bayer8", "blueNoise", "halftone", "lines"]
const ASCII = ["classic", "blocks", "minimal", "dots", "custom"]

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
        await page.waitForTimeout(80)
      }
    }
    for (const dit of DITHERS) {
      for (const levels of [2, 5]) {
        await page.evaluate(
          ({ dit, levels }) =>
            window.__styleHarness.setStyle({
              ditherEnabled: true,
              ditherType: dit,
              ditherLevels: levels,
              ditherScale: 3 + levels,
              ditherAnimated: true,
              ditherDirection: "diagonal",
              motionMode: "independent",
            }),
          { dit, levels },
        )
        await page.waitForTimeout(80)
      }
    }
    for (const cs of ASCII) {
      for (const cell of [8, 16]) {
        await page.evaluate(
          ({ cs, cell }) =>
            window.__styleHarness.setStyle({
              asciiEnabled: true,
              asciiCharset: cs,
              asciiCellSize: cell,
              asciiAnimated: true,
              asciiAnimationType: "scroll",
              motionMode: "independent",
            }),
          { cs, cell },
        )
        await page.waitForTimeout(80)
      }
    }
    await page.waitForTimeout(300)
    const after = await page.evaluate(() => window.__geomDebug.buildCount())
    say(after === before, `geometry-rebuild gate / ${mode}`, `buildCount ${before} → ${after} (30 style changes)`)
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

  // Dither presets must write ONLY dither* state — never textureMode/ascii.
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: false,
      textureMode: "none",
      ditherEnabled: false,
      asciiEnabled: false,
    }),
  )
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__styleHarness.selectPreset("dither", "dotMatrix"))
  await page.waitForTimeout(200)
  const s2 = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(s2.ditherEnabled && s2.ditherType === "halftone", "dither preset / dotMatrix applies", `type=${s2.ditherType}`)
  say(s2.textureMode === "none" && !s2.textureEnabled, "taxonomy / dither preset does not touch texture")
  say(!s2.asciiEnabled, "taxonomy / dither preset does not touch ascii")

  // ASCII presets must write ONLY ascii* state.
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: false,
      textureMode: "none",
      ditherEnabled: false,
      asciiEnabled: false,
    }),
  )
  await page.waitForTimeout(150)
  await page.evaluate(() => window.__styleHarness.selectPreset("ascii", "blockGlyph"))
  await page.waitForTimeout(200)
  const s3 = await page.evaluate(() => window.__styleHarness.get().styleState)
  say(s3.asciiEnabled && s3.asciiCharset === "blocks", "ascii preset / blockGlyph applies", `charset=${s3.asciiCharset}`)
  say(s3.textureMode === "none" && !s3.textureEnabled, "taxonomy / ascii preset does not touch texture")
  say(!s3.ditherEnabled, "taxonomy / ascii preset does not touch dither")

  // All three systems on at once must not error or rebuild geometry.
  const stackBefore = await page.evaluate(() => window.__geomDebug.buildCount())
  await page.evaluate(() =>
    window.__styleHarness.setStyle({
      textureEnabled: true,
      textureMode: "scanlines",
      textureAnimated: true,
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherAnimated: true,
      asciiEnabled: true,
      asciiCharset: "classic",
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      motionMode: "independent",
    }),
  )
  await page.waitForTimeout(600)
  const stackAfter = await page.evaluate(() => window.__geomDebug.buildCount())
  say(stackAfter === stackBefore, "all three systems stacked / no geometry rebuild", `buildCount ${stackBefore} → ${stackAfter}`)
  const stackBytes = await page.evaluate(() => window.__geomDebug.exportBytes())
  say(stackBytes > 1000, "all three systems stacked / export still works", `${stackBytes} bytes`)

  say(errors.length === 0, "console errors", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)

  await browser.close()
  console.log(pass ? "\nALL GATES PASS" : "\nGATE FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
