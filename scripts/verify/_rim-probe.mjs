// Numeric-only rim probe: no frames, no video — just the numbers that decide
// whether a rim reads as a curve or as a lattice comb, per (fixture × mode),
// plus the contour smoother's own telemetry.
//
// Kept separate from verify-gloss-rim.mjs because a full orbit capture is ~4
// minutes per label and the smoother's behaviour is a 10-second question.
// Usage: node scripts/verify/_rim-probe.mjs [--label=x] [--modes=solid,extrude]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "../capture/letters.mjs"
// ONE KNOB, ONE NAME — this probe spelled the default dev-server address, so a lane
// on its own port measured the CANONICAL tree's rims and wrote them under its own
// label. DISPATCH §3; explainers 27 §1 and 28 §3.2. IMPORTING the resolver is the
// bar — a private copy that happens to honour the knob opts out of the legacy-name
// throw (Lane F). No address is spelled in this comment (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MODES = arg("modes", "solid,extrude").split(",")
const OUT = join(ROOT, "docs", "verification", "gloss-rim")

const SHAPES = {
  word: () => {
    const { polylines, width } = layoutWord("hello", { x: 0, y: 0, size: 130, tracking: 14 })
    const k = 700 / width
    return polylines.map((pl) => pl.map((p) => ({ x: 90 + p.x * k, y: 380 + p.y * k })))
  },
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  square: () => {
    const p = []
    const corners = [[250, 180], [640, 180], [640, 545], [250, 545], [250, 180]]
    for (let c = 0; c < corners.length - 1; c++) {
      const [x0, y0] = corners[c]
      const [x1, y1] = corners[c + 1]
      for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  crossing: () => {
    const a = [], b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
}

const browser = await chromium.launch({ headed: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const errors = []
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
})
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, { timeout: 60000 })

const results = {}
for (const [name, fn] of Object.entries(SHAPES)) {
  for (const mode of MODES) {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), fn())
    await page.waitForTimeout(700)
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(1200)
    await page.evaluate((mat) => window.__styleHarness.setMaterial(mat), "glossyPlastic")
    await page.waitForTimeout(400)
    // Reset the smoother counters, then force ONE rebuild so the telemetry
    // describes THIS fixture only. Without the reset the counters are the
    // running total since page load and every reading is a lie of aggregation.
    await page.evaluate(() => {
      const d = window.__contourSmoothDebug
      if (d) { d.smoothed = 0; d.areaFallbacks = 0; d.selfIntersectFallbacks = 0; d.decimationRetries = 0 }
    })
    await page.evaluate(() => window.__revealHarness.setProgress(0.999))
    await page.waitForTimeout(500)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(700)
    // WAIT FOR THE MESH, don't assume it. Reading stats() straight after the
    // progress write caught an empty exportGroup on word/solid and
    // circle/extrude in two separate runs and recorded `meshes: 0` — which
    // reads as "this fixture produces nothing", a far more alarming claim than
    // "the harness read one frame early". The contour telemetry from the SAME
    // read proved the build had in fact run.
    await page
      .waitForFunction(() => (window.__geomDebug?.stats()?.meshes ?? 0) > 0, null, { timeout: 15000 })
      .catch(() => console.log(`    [warn] ${name}/${mode}: no mesh after 15s — recording as genuinely empty`))

    const stats = await page.evaluate(() => window.__geomDebug?.stats() ?? null)
    const dih = await page.evaluate(() => window.__geomDebug?.probeDihedral?.() ?? null)
    const contour = await page.evaluate(() => (window.__contourSmoothDebug ? { ...window.__contourSmoothDebug } : null))
    results[`${name}/${mode}`] = { stats, contour, dihedral: dih }
    console.log(
      `${name}/${mode}  meshes=${stats?.meshes} verts=${stats?.vertices}  ` +
        `contour{smoothed:${contour?.smoothed} areaFB:${contour?.areaFallbacks} siFB:${contour?.selfIntersectFallbacks} ` +
        `retries:${contour?.decimationRetries} eps:${contour?.lastEpsilonCells} in:${contour?.lastInPoints}->dec:${contour?.lastDecimatedPoints}->out:${contour?.lastOutPoints}}`,
    )
    for (const m of dih || []) {
      console.log(
        `    wall{n:${m.wall.n} mean:${m.wall.mean}° p95:${m.wall.p95}° max:${m.wall.max}° >30:${m.wall.over30}}  ` +
          `mixed{n:${m.mixed.n} mean:${m.mixed.mean}° max:${m.mixed.max}° >30:${m.mixed.over30}}  ` +
          `cap{max:${m.cap.max}°}  boundary:${m.boundaryEdges} nonmanifold:${m.nonManifoldEdges}`,
      )
    }
  }
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, `probe_${LABEL}.json`), JSON.stringify({ label: LABEL, errors, results }, null, 2))
console.log(`\nconsole errors: ${errors.length}`)
if (errors.length) console.log(errors.slice(0, 5).join("\n"))
await browser.close()
