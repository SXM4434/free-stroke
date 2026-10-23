// Verifies STACK-LEVEL animation: the whole group animating as one container.
//
// The thing that must be proven is that this is genuinely GROUP behaviour, not
// just another per-layer animation. Each behaviour therefore gets captured under
// conditions that expose its own signature:
//
//   fadeIn            starts near-invisible, ends at full strength
//   pulse             oscillates continuously
//   drift             moves continuously (phase, not opacity)
//   delayAfterReveal  absent mid-reveal, present after
//   completionPulse   normal, swells at completion, settles back to normal
//   freezeOnComplete  moving during the reveal, EXACTLY still after
//
// Usage: node scripts/verify/verify-stack-anim.mjs
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "stack-anim-v1")

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [pts]
}

// A stack with all three layers animating, so group behaviour is visible on top
// of per-layer motion.
const STACK = {
  layerStackEnabled: true,
  textureEnabled: true,
  textureMode: "scanlines",
  textureAnimated: true,
  textureScale: 1,
  textureIntensity: 0.6,
  textureContrast: 0.55,
  textureSpeed: 1.5,
  textureDirection: "vertical",
  textureLockMode: "object",
  textureSyncMode: "independent",
  ditherEnabled: true,
  ditherType: "bayer4",
  ditherScale: 4,
  ditherLevels: 3,
  ditherIntensity: 0.8,
  ditherContrast: 0.55,
  ditherThreshold: 0.5,
  ditherLockMode: "screen",
  ditherAnimated: true,
  ditherSpeed: 1.2,
  ditherDirection: "diagonal",
  ditherSyncMode: "independent",
  asciiEnabled: false,
  motionMode: "independent",
  stackTextureOpacity: 0.7,
  stackDitherOpacity: 0.9,
  stackOrder: "ditherFirst",
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
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

  const grab = async (n) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    writeFileSync(join(OUT, `${n}.png`), Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
  }
  const set = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const prog = (v) => page.evaluate((x) => window.__revealHarness.setProgress(x), v)
  // Re-mounting the stack animation restarts scene-relative behaviours.
  const arm = async (type) => {
    await set({ ...STACK, stackAnimationEnabled: false, stackAnimationType: "none" })
    await page.waitForTimeout(200)
    await set({ ...STACK, stackAnimationEnabled: true, stackAnimationType: type, stackAnimationSpeed: 1 })
  }

  // fadeIn: capture immediately, so the arrival is inside the window.
  await prog(1)
  await arm("fadeIn")
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(110)
    await grab(`fade_${String(i).padStart(2, "0")}`)
  }
  console.log("[stack-anim] fadeIn")

  // pulse / drift: continuous behaviours, just sample them.
  for (const b of ["pulse", "drift"]) {
    await arm(b)
    await page.waitForTimeout(400)
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(110)
      await grab(`${b}_${String(i).padStart(2, "0")}`)
    }
    console.log("[stack-anim]", b)
  }

  // delayAfterReveal: absent during, present after.
  await arm("delayAfterReveal")
  await prog(0.45)
  await page.waitForTimeout(600)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(110)
    await grab(`delay_during_${String(i).padStart(2, "0")}`)
  }
  await prog(1)
  await page.waitForTimeout(900)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(110)
    await grab(`delay_after_${String(i).padStart(2, "0")}`)
  }
  console.log("[stack-anim] delayAfterReveal")

  // freezeOnComplete: moving during the reveal, exactly still after.
  await arm("freezeOnComplete")
  await prog(0.45)
  await page.waitForTimeout(500)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(110)
    await grab(`freeze_during_${String(i).padStart(2, "0")}`)
  }
  await prog(1)
  await page.waitForTimeout(500)
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(110)
    await grab(`freeze_after_${String(i).padStart(2, "0")}`)
  }
  console.log("[stack-anim] freezeOnComplete")

  console.log(`[stack-anim] console errors: ${errors.length}`, errors.slice(0, 3))
  await browser.close()
  console.log(`[stack-anim] wrote frames to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
