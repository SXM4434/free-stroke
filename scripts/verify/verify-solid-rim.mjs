// SOLID RIM CAPTURE — close-up evidence of how the extruded side wall shades.
//
// The Solid engine builds a flat cap and extrudes it: the "rim" is the ring of
// side-wall quads between the +Z and -Z caps. Reported defect: the rim reads as
// stripes/bands rather than one continuous edge.
//
// This script does NOT judge. It captures:
//   - a wide establishing frame (so the crop is placeable),
//   - a dense azimuth sweep of CLOSE-UPS on one point of the rim (the camera is
//     aimed at a world point on the contour, not at the form's centre, so the
//     rim fills the frame instead of being 40px tall),
//   - an elevation sweep at the most grazing azimuth,
//   - the live geometry probe (`__geomDebug.probeNormals`) as JSON, which
//     reports coincident-vertex splits and the normal angle across them.
//
// Usage: node scripts/verify/verify-solid-rim.mjs --label=before
// Output: docs/verification/solid-rim/<label>/*.png + probe.json
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
const LABEL = arg("label", "run")
// Probe-only: skip the 50-frame sweep and just read the live geometry. Used
// while narrowing the diagnosis, when the frames are already on disk.
const PROBE_ONLY = process.argv.includes("--probe-only")
const OUT = join(ROOT, "docs", "verification", "solid-rim", LABEL)

// A long smooth arc. Smooth curvature is the worst case for a faceted rim:
// every contour segment turns by a small, roughly constant angle, so a per-face
// normal produces a regular ladder of tones — the reported striping.
function shape() {
  const pts = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    pts.push({
      x: 120 + t * 640,
      y: 360 + Math.sin(t * Math.PI * 1.15) * 190,
    })
  }
  return [pts]
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__geomDebug,
    null,
    { timeout: 30000 },
  )

  await page.evaluate((poly) => {
    window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 })
  }, shape())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForTimeout(900)

  const grab = async (file) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,(.+)/)
    if (!m) throw new Error("grab failed")
    writeFileSync(join(OUT, file), Buffer.from(m[1], "base64"))
  }

  if (PROBE_ONLY) {
    const probe = await page.evaluate(() => ({
      stats: window.__geomDebug.stats(),
      normals: window.__geomDebug.probeNormals(),
    }))
    writeFileSync(join(OUT, "probe.json"), JSON.stringify({ ...probe, errors }, null, 2))
    console.log("[rim]", JSON.stringify(probe, null, 2))
    await browser.close()
    return
  }

  // Wide establishing frames.
  await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 1.0))
  await page.waitForTimeout(400)
  await grab("wide_front.png")
  await page.evaluate(() => window.__captureHarness.orbitView(70, 12, 1.0))
  await page.waitForTimeout(400)
  await grab("wide_grazing.png")

  // World point on the rim: take a stroke point near the arc's apex and offset
  // it outward in +Y by roughly the stroke half-thickness so the target sits ON
  // the side wall rather than inside the slab.
  const focus = await page.evaluate(() => {
    const cw = window.innerWidth / 2
    const ch = window.innerHeight - 48
    const k = 3 / Math.max(cw, ch)
    // apex of the injected arc, in canvas px
    const px = 120 + 0.5 * 640
    const py = 360 + Math.sin(0.5 * Math.PI * 1.15) * 190
    return { x: (px - cw / 2) * k, y: -(py - ch / 2) * k + 0.075, z: 0 }
  })
  writeFileSync(join(OUT, "focus.json"), JSON.stringify(focus, null, 2))

  // Azimuth sweep of close-ups: 30 frames from head-on to fully grazing.
  const AZ = 30
  for (let i = 0; i < AZ; i++) {
    const az = -60 + (120 * i) / (AZ - 1)
    await page.evaluate(
      ({ f, az }) => window.__captureHarness.focusView(f, 0.32, az, 8),
      { f: focus, az },
    )
    await page.waitForTimeout(160)
    await grab(`close_az_${String(i).padStart(3, "0")}.png`)
  }

  // Elevation sweep at a fixed grazing azimuth: 18 frames.
  const EL = 18
  for (let i = 0; i < EL; i++) {
    const el = -40 + (80 * i) / (EL - 1)
    await page.evaluate(
      ({ f, el }) => window.__captureHarness.focusView(f, 0.32, 0, el),
      { f: focus, el },
    )
    await page.waitForTimeout(160)
    await grab(`close_el_${String(i).padStart(3, "0")}.png`)
  }

  const probe = await page.evaluate(() => ({
    stats: window.__geomDebug.stats(),
    normals: window.__geomDebug.probeNormals(),
  }))
  writeFileSync(join(OUT, "probe.json"), JSON.stringify({ ...probe, errors }, null, 2))
  console.log("[rim]", JSON.stringify(probe, null, 2))
  console.log(`[rim] saved ${AZ + EL + 2} frames to ${OUT} (console errors: ${errors.length})`)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
