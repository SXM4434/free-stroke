// Visual verification harness for style-system build passes.
//
// STANDING RULE: every edit that changes rendered output gets frames captured
// and actually looked at, at high frame counts. This script is the tool for
// that: it drives the running dev preview through a matrix of
// (geometry mode × style state) and writes PNGs to docs/verification/<pass>/.
//
// Two capture kinds:
//   still  — one frame per cell of the matrix (A/B comparison of static looks)
//   motion — N consecutive frames of one cell (proves animation actually moves)
//
// Usage:
//   node scripts/verify/verify-style.mjs --pass=texture-v1
//   node scripts/verify/verify-style.mjs --pass=texture-v1 --only=motion
import { chromium } from "playwright-core"
import { writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const PASS = arg("pass", "unnamed")
const ONLY = arg("only", "all") // all | still | motion
const OUT = join(ROOT, "docs", "verification", PASS)
const MOTION_FRAMES = parseInt(process.env.MOTION_FRAMES || "24", 10)

const MODES = ["rod", "extrude", "solid", "inflate"]
const TEXTURES = ["grain", "noise", "scanlines", "bands", "contour"]

// A single loopy test stroke, drawn once and reused across the whole matrix so
// every comparison is same-geometry / different-style.
function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({
      x: 120 + t * 620,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 130 + Math.sin(t * Math.PI * 6) * 22,
    })
  }
  return [pts]
}

async function main() {
  // Only clear the family we're about to re-capture — a `--only=motion` run
  // must never destroy the stills (or vice versa); this directory is the
  // documented evidence for the pass.
  mkdirSync(OUT, { recursive: true })
  const prefix = ONLY === "still" ? "still_" : ONLY === "motion" ? "motion_" : null
  if (prefix === null) {
    rmSync(OUT, { recursive: true, force: true })
    mkdirSync(OUT, { recursive: true })
  } else {
    for (const f of readdirSync(OUT).filter((f) => f.startsWith(prefix))) {
      rmSync(join(OUT, f), { force: true })
    }
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 30000 },
  )

  await page.evaluate((poly) => {
    window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
    window.__captureHarness.enable()
  }, testStroke())
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setProgress(1.0))

  const grab = async (name) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
    if (!m) throw new Error(`grab failed for ${name}`)
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(m[1], "base64"))
  }

  const setStyle = (patch) => page.evaluate((p) => window.__styleHarness.setStyle(p), patch)
  const setMode = async (mode) => {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(300)
  }

  // ---- STILLS: every mode × every pattern, plus an off baseline ----------
  if (ONLY === "all" || ONLY === "still") {
    for (const mode of MODES) {
      await setMode(mode)
      await setStyle({ textureEnabled: false, textureMode: "none", textureAnimated: false })
      await page.waitForTimeout(350)
      await grab(`still_${mode}_off`)
      for (const tex of TEXTURES) {
        await setStyle({
          textureEnabled: true,
          textureMode: tex,
          textureAnimated: false,
          textureScale: 1.2,
          textureIntensity: 0.6,
          textureContrast: 0.55,
          textureLockMode: "object",
        })
        await page.waitForTimeout(350)
        await grab(`still_${mode}_${tex}`)
      }
      console.log(`[verify] stills done: ${mode}`)
    }
  }

  // ---- MOTION: consecutive frames prove the pattern actually travels -----
  if (ONLY === "all" || ONLY === "motion") {
    for (const mode of ["inflate", "solid"]) {
      await setMode(mode)
      for (const tex of ["scanlines", "grain"]) {
        await setStyle({
          textureEnabled: true,
          textureMode: tex,
          textureAnimated: true,
          textureScale: 1.0,
          textureIntensity: 0.65,
          textureContrast: 0.6,
          textureSpeed: 2.0,
          textureDirection: "vertical",
          motionMode: "independent",
          textureLockMode: "object",
        })
        await page.waitForTimeout(400)
        for (let i = 0; i < MOTION_FRAMES; i++) {
          await page.waitForTimeout(90)
          await grab(`motion_${mode}_${tex}_${String(i).padStart(3, "0")}`)
        }
        console.log(`[verify] motion done: ${mode}/${tex} (${MOTION_FRAMES} frames)`)
      }
    }
  }

  // Geometry-rebuild guard: style changes must never rebuild geometry.
  await setMode("extrude")
  const before = await page.evaluate(() => window.__SOLID_STAGE_DEBUG?.previewBuildCount ?? null)
  for (const tex of TEXTURES) {
    await setStyle({ textureEnabled: true, textureMode: tex, textureIntensity: 0.5 })
    await page.waitForTimeout(120)
  }
  const after = await page.evaluate(() => window.__SOLID_STAGE_DEBUG?.previewBuildCount ?? null)
  console.log(`[verify] previewBuildCount before=${before} after=${after}`)
  console.log(`[verify] console errors: ${errors.length}`, errors.slice(0, 5))

  await browser.close()
  console.log(`[verify] wrote frames to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
