// Verifies the shared visual timing system: each sync mode must behave
// DIFFERENTLY, not just be five names for "it moves".
//
// What each mode must show:
//   independent        moves continuously, ignores the reveal
//   loopSynced         moves, and returns to its start after loopSeconds
//   delayedAfterReveal STILL while the reveal is running, moves after it ends
//   completionPulse    STILL, then a burst at completion, then still again
//   revealSynced       moves only when the reveal moves (scrubbing drives it)
//
// Usage: node scripts/verify/verify-timing.mjs
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "timing-v1")

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [pts]
}

// A loud, easy-to-measure layer: scrolling scanlines.
const LAYER = {
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1,
  textureIntensity: 0.7,
  textureContrast: 0.6,
  textureSpeed: 2,
  textureDirection: "vertical",
  textureLockMode: "object",
  ditherEnabled: false,
  asciiEnabled: false,
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ channel: "chrome", headless: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness)
  await page.evaluate((p) => {
    window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
    window.__captureHarness.enable()
  }, testStroke())
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__captureHarness.frontView(1))

  const grab = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const setProgress = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)

  // --- A. continuous modes: capture frames while the reveal sits at 1 -----
  for (const mode of ["independent", "loopSynced"]) {
    await setProgress(1)
    await set({ ...LAYER, textureSyncMode: mode, motionMode: "independent", styleLoopSeconds: 2 })
    await page.waitForTimeout(500)
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(120)
      await grab(`A_${mode}_${String(i).padStart(2, "0")}`)
    }
    console.log(`[timing] captured ${mode}`)
  }

  // --- B. delayedAfterReveal: must be STILL mid-reveal, moving after ------
  // Re-arm by scrubbing back before completion.
  await set({ ...LAYER, textureSyncMode: "delayedAfterReveal", motionMode: "independent" })
  await setProgress(0.4)
  await page.waitForTimeout(600)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(120)
    await grab(`B_delayed_during_${String(i).padStart(2, "0")}`)
  }
  await setProgress(1)
  await page.waitForTimeout(400)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(120)
    await grab(`B_delayed_after_${String(i).padStart(2, "0")}`)
  }
  console.log("[timing] captured delayedAfterReveal")

  // --- C. completionPulse: still, burst at completion, still again -------
  await set({ ...LAYER, textureSyncMode: "completionPulse", motionMode: "independent" })
  await setProgress(0.4)
  await page.waitForTimeout(600)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(120)
    await grab(`C_pulse_before_${String(i).padStart(2, "0")}`)
  }
  await setProgress(1)
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(130)
    await grab(`C_pulse_burst_${String(i).padStart(2, "0")}`)
  }
  await page.waitForTimeout(2500) // let the pulse decay away
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(120)
    await grab(`C_pulse_settled_${String(i).padStart(2, "0")}`)
  }
  console.log("[timing] captured completionPulse")

  // --- D. revealSynced: driven by scrubbing, static when the playhead is --
  await set({ ...LAYER, textureSyncMode: "revealSynced", motionMode: "syncToDraw" })
  await setProgress(1)
  await page.waitForTimeout(500)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(120)
    await grab(`D_reveal_held_${String(i).padStart(2, "0")}`)
  }
  for (let i = 0; i < 8; i++) {
    await setProgress(0.3 + i * 0.085)
    await page.waitForTimeout(160)
    await grab(`D_reveal_scrub_${String(i).padStart(2, "0")}`)
  }
  console.log("[timing] captured revealSynced")

  console.log(`[timing] console errors: ${errors.length}`, errors.slice(0, 3))
  await browser.close()
  console.log(`[timing] wrote frames to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
