// CAPTURE — the same drawn corner, shipped predicate vs the parked inverted one.
//
// WHY. The numbers moved (`_probe-elbow-arms.mjs`) and numbers alone cannot
// settle this: `assert-elbow`'s ρ_out reads 0.973–1.000 on the shipped arm
// against 0.992–1.034 on the parked one, a spread smaller than the
// marching-cubes floor explainer 19 §9.3 measured on the same fixture
// (0.035–0.075 in the same normalised units). At that size the metric cannot
// tell "the corner is slightly rounder" from "the isosurface fell on the other
// side of a cell". A picture can.
//
// Framing, material and the blank-frame floor are `verify-elbow.mjs`'s, verbatim
// — same three views per corner, same `glossyPlastic` (a broad sheen lobe
// averages over a normal discontinuity instead of tracing it), same read-back of
// the material so a `setMode` that stamps its own default cannot silently revert
// it, same ink floor on the saved bytes.
//
// Usage: node scripts/verify/_probe-corner-frames.mjs [--label=corners]
// Output: docs/verification/corner-split/<label>/<arm>_c<corner>_<view>.png
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./_ts-load.mjs"
import { frameInk } from "./lib/frame-ink.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "corners")
const OUT = join(ROOT, "docs", "verification", "corner-split", LABEL)

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
const squareShape = () => {
  const p = []
  const c = [...SQUARE_PX, SQUARE_PX[0]]
  for (let k = 0; k < c.length - 1; k++) {
    const [x0, y0] = c[k]
    const [x1, y1] = c[k + 1]
    for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
  }
  p.push({ x: 250, y: 180 })
  return [p]
}
const VIEWS = [
  ["flat", 0, 6],
  ["high", 0, 62],
  ["raking", 38, 22],
]
const INK_FLOOR = 15000

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEW })
const pageErrors = []
page.on("pageerror", (e) => {
  const s = (e.stack || String(e)).split("\n").slice(0, 2).join(" | ").slice(0, 200)
  if (!pageErrors.includes(s)) pageErrors.push(s)
})
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(
  () => window.__styleHarness && window.__captureHarness && window.__geomDebug && window.__strokeTuning,
  null,
  { timeout: 60000 },
)

mkdirSync(OUT, { recursive: true })
const corners = SQUARE_PX.map(([px, py]) => px2w(px, py))

const grab = async (file) => {
  const url = await page.evaluate(() => window.__captureHarness.grab())
  const m = (url || "").match(/base64,(.+)/)
  if (!m) throw new Error(`grab failed for ${file}`)
  const buf = Buffer.from(m[1], "base64")
  const { ink } = await frameInk(buf)
  if (ink < INK_FLOOR) {
    throw new Error(
      `EMPTY frame for ${file} (ink=${ink} < ${INK_FLOOR}) — the camera is not on the corner, ` +
        `or the render loop is frozen. Do not lower the floor; find out which.`,
    )
  }
  writeFileSync(join(OUT, file), buf)
  return ink
}

for (const arm of ["turn", "interior"]) {
  await page.evaluate((a) => {
    window.__strokeTuning.corner.predicate = a
  }, arm)
  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(200)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), squareShape())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(300)
  const mat = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
  if (mat !== "glossyPlastic") {
    console.log(`FAIL material did not take: ${mat}`)
    await browser.close()
    process.exit(1)
  }
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(600)
  const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
  const r = dbg?.fieldBaseRadius || 0.05
  console.log(`\n[${arm}] used=${dbg?.fusionUsed} r=${r.toFixed(5)}`)
  for (let ci = 1; ci <= 2; ci++) {
    for (const [vname, az, el] of VIEWS) {
      await page.evaluate(
        ({ c, dist, az, el }) => window.__captureHarness.focusView({ x: c.x, y: c.y, z: 0 }, dist, az, el),
        { c: corners[ci], dist: r * 7, az, el },
      )
      await page.waitForTimeout(160)
      const ink = await grab(`${arm}_c${ci}_${vname}.png`)
      console.log(`   ${arm}_c${ci}_${vname}.png  ink=${ink}`)
    }
  }
}

await page.evaluate(() => {
  window.__strokeTuning.corner.predicate = "turn"
})
console.log(`\npage errors: ${pageErrors.length}${pageErrors.length ? " — " + pageErrors.join(" ;; ") : ""}`)
console.log(`wrote ${OUT}`)
await browser.close()
