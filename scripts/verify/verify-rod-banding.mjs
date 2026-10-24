// ROD RING BANDING — CAPTURE PASS
//
// The defect: a Rod tube shows fine regular shading discontinuities
// perpendicular to its axis, one per tubular ring. On the matte materials it is
// subtle; on the glossy `ink` material the specular highlight traces every ring
// and the tube reads as a THREADED SCREW rather than an ink line.
//
// Gloss is therefore the test surface, not matte: specular traces every normal
// discontinuity, so a tube that reads clean under gloss reads clean everywhere.
// Both are captured so the difference in how loudly each material reports the
// same geometry is on the record.
//
// This also runs the UNIFORM vs CURVATURE-ADAPTIVE A/B through the existing
// `window.__rodTuning.adaptive` switch, because the adaptive ring placement
// landed recently and "did this defect arrive with it" is answerable by
// measurement rather than by reading the diff.
//
//   node scripts/verify/verify-rod-banding.mjs [--tag=before]
//   node scripts/verify/assert-rod-banding.mjs [--compare=before,after]
//
// STANDING RULE: headed Chrome with the Metal ANGLE backend. Never headless.
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

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const TAG = arg("tag", "after")
const OUT = join(ROOT, "docs", "verification", "rod-banding", TAG)

/** The lab's default: one long smooth S-curve. Curvature everywhere, corners
 *  nowhere — so any banding is the tube's own, not a corner artefact. */
const shapeS = () => {
  const p = []
  for (let i = 0; i <= 160; i++) {
    const t = i / 160
    p.push({ x: 150 + t * 620, y: 380 + Math.sin(t * Math.PI * 2) * 150 })
  }
  return [p]
}

/** A near-straight run: the harshest case for ring artefacts, because there is
 *  no real curvature to hide behind and the adaptive rule spends its minimum
 *  density here. */
const shapeLine = () => {
  const p = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    p.push({ x: 150 + t * 620, y: 380 + Math.sin(t * Math.PI) * 18 })
  }
  return [p]
}

const SHAPES = { s: shapeS, line: shapeLine }

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${String(e).slice(0, 200)}`))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () =>
      window.__styleHarness &&
      window.__captureHarness &&
      window.__revealHarness &&
      window.__geomDebug &&
      window.__rodTuning,
    null,
    { timeout: 40000 },
  )
  await page.evaluate(() => window.__captureHarness.enable())

  const report = { tag: TAG, cases: {}, consoleErrors: [] }

  for (const shapeName of Object.keys(SHAPES)) {
    for (const variant of ["uniform", "adaptive"]) {
      // The tuning flag is read at BUILD time, so it has to be set before the
      // strokes are (re)injected — re-injecting is also what busts the mesh
      // memo, which is keyed on the stroke set and would otherwise hand back
      // the previous variant's geometry.
      await page.evaluate((a) => {
        window.__rodTuning.adaptive = a
      }, variant === "adaptive")
      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(200)
      await page.evaluate(
        (poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }),
        SHAPES[shapeName](),
      )
      await page.waitForTimeout(600)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.evaluate(() => window.__styleHarness.setMode("rod"))
      await page.waitForTimeout(500)

      for (const material of ["ink", "matteClay"]) {
        await page.evaluate((m) => window.__styleHarness.setMaterial(m), material)
        await page.waitForTimeout(450)
        // Close on the tube: the banding is a few pixels per ring, so a frame
        // that fits the whole stroke cannot show it and cannot disprove it.
        // Framing MATTERS and is part of the finding: at a tight crop the tube
        // is many pixels across and reads smooth in every variant. The banding
        // only appears when the tube is a few pixels wide — which is the
        // framing the lab capture used, and the framing a user actually sees.
        // Capturing only the close crop is how you "verify" a defect away.
        for (const [az, el, zoom] of [
          [0, 0, 1.0],
          [0, 0, 0.6],
          [0, 25, 1.0],
          [0, 0, 0.22],
        ]) {
          await page.evaluate(
            ([a, e, z]) => window.__captureHarness.orbitView(a, e, z),
            [az, el, zoom],
          )
          await page.waitForTimeout(260)
          const url = await page.evaluate(() => window.__captureHarness.grab())
          const m = (url || "").match(/base64,(.+)/)
          if (!m) continue
          const name = `${shapeName}_${variant}_${material}_az${az}_el${el}.png`
          writeFileSync(join(OUT, name), Buffer.from(m[1], "base64"))
        }
      }

      const stats = await page.evaluate(() => window.__geomDebug.stats?.() ?? null)
      report.cases[`${shapeName}/${variant}`] = stats
      console.log(
        `[rod-band] ${shapeName}/${variant.padEnd(8)} verts=${stats?.vertices} tris=${stats?.triangles}`,
      )
    }
  }

  await page.evaluate(() => {
    window.__rodTuning.adaptive = true
  })
  report.consoleErrors = errors
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`[rod-band] -> ${OUT}  (console errors: ${errors.length})`)
  if (errors.length) console.log(errors.slice(0, 4).join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
