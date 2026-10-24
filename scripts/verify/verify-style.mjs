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
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, cpSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const PASS = arg("pass", "unnamed")
const ONLY = arg("only", "all") // all | still | motion
/* STAGED, AND SEEDED, because this one clears PARTIALLY on purpose. `--pass` has
 * no fixed value, so this wipe can reach ANY subtree of docs/verification — the
 * widest reach in the class, `--pass=hero-beat-film` alone is 15302 tracked files.
 * Staging it plainly would break the rule the comment below states: a
 * `--only=motion` run must not destroy the stills. So the stored set is copied
 * into staging first and the same clearing rule is applied there, which keeps the
 * rule exactly and still means a run that dies partway replaces nothing.
 * lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", PASS)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const MOTION_FRAMES = parseInt(process.env.MOTION_FRAMES || "24", 10)

const MODES = ["rod", "extrude", "solid", "inflate"]
const TEXTURES = ["grain", "noise", "scanlines", "bands", "contour"]
const DITHERS = ["bayer4", "bayer8", "blueNoise", "halftone", "lines", "dotScreen", "hatch", "crosshatch", "diamond", "newsprint"]
const ASCII = ["classic", "blocks", "minimal", "dots", "custom", "braille", "boxes", "arrows", "punct", "numeric"]
// Which system this pass is exercising: texture | dither
const SYSTEM = arg("system", "texture")

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
  EV.open()
  if (existsSync(FINAL)) cpSync(FINAL, OUT, { recursive: true })
  const prefix = ONLY === "still" ? "still_" : ONLY === "motion" ? "motion_" : null
  if (prefix === null) {
    for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true })
  } else {
    for (const f of readdirSync(OUT).filter((f) => f.startsWith(prefix))) {
      rmSync(join(OUT, f), { force: true })
    }
  }

  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
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
      await setStyle({
        textureEnabled: false,
        textureMode: "none",
        textureAnimated: false,
        ditherEnabled: false,
        ditherAnimated: false,
        asciiEnabled: false,
        asciiAnimated: false,
      })
      await page.waitForTimeout(350)
      await grab(`still_${mode}_off`)
      if (SYSTEM === "texture") {
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
      } else if (SYSTEM === "ascii") {
        for (const cs of ASCII) {
          await setStyle({
            asciiEnabled: true,
            asciiAnimated: false,
            asciiCharset: cs,
            asciiCellSize: 16,
            asciiDensity: 0.5,
            asciiContrast: 0.5,
            asciiLockMode: "screen",
          })
          await page.waitForTimeout(350)
          await grab(`still_${mode}_${cs}`)
        }
      } else {
        for (const dit of DITHERS) {
          await setStyle({
            ditherEnabled: true,
            ditherAnimated: false,
            ditherType: dit,
            ditherScale: dit === "halftone" ? 6 : 4,
            ditherLevels: 2,
            ditherIntensity: 1,
            ditherContrast: 0.55,
            ditherThreshold: 0.5,
            ditherLockMode: "screen",
          })
          await page.waitForTimeout(350)
          await grab(`still_${mode}_${dit}`)
        }
      }
      console.log(`[verify] stills done: ${mode}`)
    }
  }

  // ---- MOTION: consecutive frames prove the pattern actually travels -----
  if (ONLY === "all" || ONLY === "motion") {
    const cells =
      SYSTEM === "texture"
        ? [
            { mode: "inflate", key: "scanlines", patch: { textureEnabled: true, textureMode: "scanlines", textureAnimated: true, textureScale: 1, textureIntensity: 0.65, textureContrast: 0.6, textureSpeed: 2, textureDirection: "vertical", motionMode: "independent", textureLockMode: "object" } },
            { mode: "inflate", key: "grain", patch: { textureEnabled: true, textureMode: "grain", textureAnimated: true, textureScale: 1, textureIntensity: 0.65, textureContrast: 0.6, textureSpeed: 2, textureDirection: "vertical", motionMode: "independent", textureLockMode: "object" } },
            { mode: "solid", key: "scanlines", patch: { textureEnabled: true, textureMode: "scanlines", textureAnimated: true, textureScale: 1, textureIntensity: 0.65, textureContrast: 0.6, textureSpeed: 2, textureDirection: "vertical", motionMode: "independent", textureLockMode: "object" } },
            { mode: "solid", key: "grain", patch: { textureEnabled: true, textureMode: "grain", textureAnimated: true, textureScale: 1, textureIntensity: 0.65, textureContrast: 0.6, textureSpeed: 2, textureDirection: "vertical", motionMode: "independent", textureLockMode: "object" } },
          ]
        : SYSTEM === "ascii"
        ? [
            { mode: "solid", key: "scroll", patch: { asciiEnabled: true, asciiAnimated: true, asciiAnimationType: "scroll", asciiCharset: "classic", asciiCellSize: 10, asciiDensity: 0.55, asciiContrast: 0.55, asciiScrollSpeed: 2, asciiDirection: "horizontal", asciiLockMode: "screen", motionMode: "independent" } },
            { mode: "solid", key: "rain", patch: { asciiEnabled: true, asciiAnimated: true, asciiAnimationType: "rain", asciiCharset: "minimal", asciiCellSize: 10, asciiDensity: 0.55, asciiContrast: 0.55, asciiScrollSpeed: 2, asciiDirection: "vertical", asciiLockMode: "screen", motionMode: "independent" } },
            { mode: "solid", key: "cycle", patch: { asciiEnabled: true, asciiAnimated: true, asciiAnimationType: "cycle", asciiCharset: "classic", asciiCellSize: 10, asciiDensity: 0.55, asciiContrast: 0.55, asciiScrollSpeed: 1.5, asciiLockMode: "screen", motionMode: "independent" } },
            { mode: "inflate", key: "flicker", patch: { asciiEnabled: true, asciiAnimated: true, asciiAnimationType: "flicker", asciiCharset: "custom", asciiCellSize: 10, asciiDensity: 0.55, asciiContrast: 0.55, asciiScrollSpeed: 2, asciiLockMode: "screen", motionMode: "independent" } },
          ]
        : [
            // matrix crawl (has a travel direction)
            { mode: "solid", key: "crawl", patch: { ditherEnabled: true, ditherAnimated: true, ditherType: "bayer4", ditherScale: 4, ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherSpeed: 2, ditherDirection: "diagonal", ditherLockMode: "screen", motionMode: "independent" } },
            // threshold-bias sweep (static direction -> tone opens/closes)
            { mode: "solid", key: "sweep", patch: { ditherEnabled: true, ditherAnimated: true, ditherType: "bayer8", ditherScale: 5, ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherSpeed: 1.6, ditherDirection: "static", ditherLockMode: "screen", motionMode: "independent" } },
            { mode: "inflate", key: "halftonesweep", patch: { ditherEnabled: true, ditherAnimated: true, ditherType: "halftone", ditherScale: 7, ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.5, ditherThreshold: 0.5, ditherSpeed: 1.6, ditherDirection: "static", ditherLockMode: "screen", motionMode: "independent" } },
          ]
    let lastMode = null
    for (const c of cells) {
      if (c.mode !== lastMode) {
        await setMode(c.mode)
        lastMode = c.mode
      }
      await setStyle(c.patch)
      await page.waitForTimeout(400)
      for (let i = 0; i < MOTION_FRAMES; i++) {
        await page.waitForTimeout(90)
        await grab(`motion_${c.mode}_${c.key}_${String(i).padStart(3, "0")}`)
      }
      console.log(`[verify] motion done: ${c.mode}/${c.key} (${MOTION_FRAMES} frames)`)
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
  /* THE SWAP. Staging holds the kept families plus the ones just re-captured. */
  EV.commit()
  console.log(`[verify] wrote frames to ${FINAL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
