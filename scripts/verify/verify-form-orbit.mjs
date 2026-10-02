// FORM ORBIT CAPTURE — silhouette + faceting evidence at every angle.
//
// Silhouette quality and faceting are ANGLE-DEPENDENT defects: a rim that reads
// as one continuous edge head-on can break into a ladder of flats at 40° and
// vanish again at 80°. A single hero frame cannot show that, and the existing
// capture scripts either sweep a close-up of ONE point (verify-solid-rim) or
// shoot the hero camera move (capture-run). This one orbits the WHOLE form
// through a full 360° at three elevations, at a high frame count, and writes
// both the frames and an mp4 per (shape x mode) so the artefacts can be judged
// in motion.
//
// It does NOT judge. assert-form-orbit.mjs turns these frames into pass/fail.
//
// Usage: node scripts/verify/verify-form-orbit.mjs --label=before [--modes=extrude,solid]
// Output: docs/verification/form-orbit/<label>/<shape>_<mode>/*.png + .mp4
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
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
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MODES = arg("modes", "extrude,solid").split(",")
const AZ_STEPS = parseInt(arg("az", "48"), 10)
const OUT = join(ROOT, "docs", "verification", "form-orbit", LABEL)

// ── Fixtures. Each is chosen to expose one specific failure mode. ────────────
const SHAPES = {
  // HANDWRITING. The actual complaint: "it doesn't look like handwriting, it
  // looks like some stupid machine wrote it — the weird joints, the edges and
  // overlaps". A laid-out word is the only fixture that has real joints,
  // real crossings and real letter counters all at once.
  word: () => {
    const { polylines, width } = layoutWord("hello", { x: 0, y: 0, size: 130, tracking: 14 })
    const k = 700 / width
    return polylines.map((pl) => pl.map((p) => ({ x: 90 + p.x * k, y: 380 + p.y * k })))
  },
  // CIRCLE. The canonical faceting test: uniform curvature means every contour
  // segment turns by the same small angle, so any polygonalisation shows up as
  // a regular ladder of flats on the silhouette and a banded rim.
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  // SQUARE. The control for the circle: corner-aware smoothing must round the
  // circle WITHOUT rounding these four 90° corners. If both round, the fix is
  // just a blur; if neither rounds, the fix did nothing.
  square: () => {
    const p = []
    const corners = [
      [250, 180],
      [640, 180],
      [640, 545],
      [250, 545],
      [250, 180],
    ]
    for (let c = 0; c < corners.length - 1; c++) {
      const [x0, y0] = corners[c]
      const [x1, y1] = corners[c + 1]
      for (let i = 0; i < 30; i++) {
        p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
      }
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  // CROSSING. Two strokes that overlap at a shallow angle — where "the geometry
  // gets all weird" at overlaps.
  crossing: () => {
    const a = []
    const b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
}

async function main() {
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
  await page.evaluate(() => window.__captureHarness.enable())

  const manifest = []
  for (const [shapeName, shapeFn] of Object.entries(SHAPES)) {
    for (const mode of MODES) {
      const dirFinal = join(OUT, `${shapeName}_${mode}`)
    /* STAGED PER UNIT. `form-orbit` holds 1586 tracked files and this
     * wipe used to empty one shape/mode directory before spending minutes refilling it.
     * A run that dies mid-unit now leaves that unit's stored frames alone; every
     * unit already finished stays finished. lib/evidence-swap.mjs. */
      const ev = stageEvidence(dirFinal)
      const dir = ev.open()

      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(200)
      await page.evaluate((poly) => {
        window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 })
      }, shapeFn())
      await page.waitForTimeout(700)
      await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
      await page.waitForTimeout(1100)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(500)

      const grab = async (file) => {
        const url = await page.evaluate(() => window.__captureHarness.grab())
        const m = (url || "").match(/base64,(.+)/)
        if (!m) throw new Error("grab failed")
        writeFileSync(join(dir, file), Buffer.from(m[1], "base64"))
      }

      // Full 360° azimuth at three elevations. Low elevation grazes the rim
      // (worst case for banding); high elevation shows the cap silhouette.
      let f = 0
      for (const el of [4, 26, 55]) {
        for (let i = 0; i < AZ_STEPS; i++) {
          const az = (360 * i) / AZ_STEPS
          await page.evaluate(
            ({ az, el }) => window.__captureHarness.orbitView(az, el, 0.92),
            { az, el },
          )
          await page.waitForTimeout(90)
          await grab(`${String(f).padStart(4, "0")}.png`)
          f++
        }
      }

      // Numeric companion to the frames: the engine's own topology report.
      const stats = await page.evaluate(() =>
        window.__geomDebug ? window.__geomDebug.stats() : null,
      )
      manifest.push({ shape: shapeName, mode, frames: f, stats })

      try {
        execFileSync(
          "ffmpeg",
          [
            "-y", "-framerate", "24",
            "-i", join(dir, "%04d.png"),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            join(OUT, `${shapeName}_${mode}.mp4`),
          ],
          { stdio: "ignore" },
        )
      } catch {
        console.log(`[orbit] ffmpeg failed for ${shapeName}/${mode} (frames still on disk)`)
      }
      /* THE SWAP, after ffmpeg has read the frames out of staging. */
      ev.commit()
      console.log(`[orbit] ${shapeName}/${mode}: ${f} frames`)
    }
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ label: LABEL, azSteps: AZ_STEPS, entries: manifest, errors }, null, 2),
  )
  console.log(`[orbit] saved to ${OUT} (console errors: ${errors.length})`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
