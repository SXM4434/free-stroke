// ROD SEGMENTATION A/B — uniform vs curvature-adaptive tube sampling.
//
// Same build, same stroke, same camera, same lighting; the ONLY variable is
// `window.__rodTuning.adaptive`. For each of a set of strokes chosen to contain
// both long straight runs and tight curvature, it records:
//   - triangle / vertex counts (window.__geomDebug.stats)
//   - a wide frame
//   - a dense close-up sweep across the TIGHTEST curve, where faceting shows
//
// Usage: node scripts/verify/verify-rod-segments.mjs
// Output: docs/verification/rod-adaptive/{uniform,adaptive}/*.png + report.json
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "rod-adaptive")

// Each shape carries a `focus` in CANVAS pixels: the point the close-up sweep
// aims at (the tightest part of the curve).
const SHAPES = {
  // A hairpin: two long straight runs joined by a very tight 180-degree turn.
  // The straight runs are where uniform sampling wastes triangles; the turn is
  // where it facets.
  hairpin: {
    focus: { x: 665, y: 380 }, // apex of the 180-degree turn
    poly: () => {
      const p = []
      for (let i = 0; i <= 60; i++) p.push({ x: 180 + (i / 60) * 420, y: 250 })
      for (let i = 1; i <= 60; i++) {
        const a = -Math.PI / 2 + (i / 60) * Math.PI
        p.push({ x: 600 + Math.cos(a) * 65, y: 380 + Math.sin(a) * 65 })
      }
      for (let i = 1; i <= 60; i++) p.push({ x: 600 - (i / 60) * 420, y: 510 })
      return [p]
    },
  },
  // THE FACETING CASE. A long tight spiral: ~6700px of arc, so the uniform rule
  // runs straight into MAX_TUBULAR_SEGMENTS (512) and then spreads those 512
  // rings EVENLY — about 13px apart. The innermost coil has an 8px radius and a
  // ~50px circumference, so under the uniform rule the whole first turn is
  // built from about four cross-sections: a visible polygon, not a curve.
  tightSpiral: {
    focus: { x: 400, y: 470 }, // the starved centre
    poly: () => {
      const p = []
      const STEPS = 900
      for (let i = 0; i <= STEPS; i++) {
        const t = (i / STEPS) * Math.PI * 12
        const r = 8 + t * 9
        p.push({ x: 400 + Math.cos(t) * r, y: 470 + Math.sin(t) * r })
      }
      return [p]
    },
  },
  // A spiral: curvature climbs continuously, so the sampler has to grade the
  // density rather than pick one number.
  spiral: {
    focus: { x: 460, y: 380 }, // innermost (tightest) coil
    poly: () => {
      const p = []
      for (let i = 0; i <= 200; i++) {
        const t = (i / 200) * Math.PI * 4.5
        const r = 30 + t * 26
        p.push({ x: 430 + Math.cos(t) * r, y: 380 + Math.sin(t) * r })
      }
      return [p]
    },
  },
  // The everyday case, for a sanity read on a normal stroke.
  loopyS: {
    focus: { x: 261, y: 460 }, // first sine extremum (tightest bend)
    poly: () => {
      const p = []
      for (let i = 0; i <= 120; i++) {
        const t = i / 120
        p.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
      }
      return [p]
    },
  },
}

const SWEEP = 20 // close-up frames per shape per variant

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__geomDebug && window.__rodTuning,
    null,
    { timeout: 30000 },
  )
  await page.evaluate(() => window.__styleHarness.setMode("rod"))
  await page.evaluate(() => window.__captureHarness.enable())

  const report = {}
  for (const variant of ["uniform", "adaptive"]) {
    const dir = join(OUT, variant)
    mkdirSync(dir, { recursive: true })
    await page.evaluate((a) => {
      window.__rodTuning.adaptive = a
    }, variant === "adaptive")

    for (const [name, shape] of Object.entries(SHAPES)) {
      // Re-inject AFTER flipping the switch: the flag is read at build time.
      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(250)
      await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), shape.poly())
      await page.waitForTimeout(1000)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(400)

      const stats = await page.evaluate(() => window.__geomDebug.stats())
      report[`${name}/${variant}`] = stats

      const grab = async (file) => {
        // The canvas can briefly be absent between R3F commits after a heavy
        // rebuild; retry rather than losing the whole sweep.
        for (let attempt = 0; attempt < 5; attempt++) {
          const url = await page.evaluate(() => window.__captureHarness?.grab?.() ?? null)
          const m = (url || "").match(/base64,(.+)/)
          if (m) {
            writeFileSync(join(dir, file), Buffer.from(m[1], "base64"))
            return
          }
          await page.waitForTimeout(400)
        }
        throw new Error(`grab failed for ${file}`)
      }

      await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 1.0))
      await page.waitForTimeout(350)
      await grab(`${name}_wide.png`)

      // Close-up sweep across the tightest curve.
      const focus = await page.evaluate((f) => {
        const cw = window.innerWidth / 2
        const ch = window.innerHeight - 48
        const k = 3 / Math.max(cw, ch)
        return { x: (f.x - cw / 2) * k, y: -(f.y - ch / 2) * k, z: 0 }
      }, shape.focus)

      for (let i = 0; i < SWEEP; i++) {
        const az = -70 + (140 * i) / (SWEEP - 1)
        await page.evaluate(
          ({ f, az }) => window.__captureHarness.focusView(f, 0.2, az, 14),
          { f: focus, az },
        )
        await page.waitForTimeout(140)
        await grab(`${name}_close_${String(i).padStart(3, "0")}.png`)
      }
      console.log(
        `[rod] ${variant}/${name}: verts=${stats?.vertices} tris=${stats?.triangles}`,
      )
    }
  }

  // Leave the app in its production configuration.
  await page.evaluate(() => {
    window.__rodTuning.adaptive = true
  })

  mkdirSync(OUT, { recursive: true })
  const summary = {}
  for (const name of Object.keys(SHAPES)) {
    const u = report[`${name}/uniform`] || {}
    const a = report[`${name}/adaptive`] || {}
    summary[name] = {
      uniformTris: u.triangles,
      adaptiveTris: a.triangles,
      deltaPct: u.triangles ? Math.round(((a.triangles - u.triangles) / u.triangles) * 100) : null,
      uniformVerts: u.vertices,
      adaptiveVerts: a.vertices,
      bboxUniform: u.bbox,
      bboxAdaptive: a.bbox,
    }
  }
  writeFileSync(join(OUT, "report.json"), JSON.stringify({ summary, report, errors }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  console.log(`[rod] console errors: ${errors.length}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
