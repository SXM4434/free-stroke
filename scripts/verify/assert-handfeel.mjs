// HAND-FEEL ASSERTIONS — pass/fail on the effect's OWN signature.
//
// The companion to verify-handfeel.mjs, which only CAPTURES. This one fails the
// build. It deliberately does NOT assert "something changed" — that would pass
// for any bug that perturbs the geometry. It asserts the things that are true
// of an arc-length wobble field and false of every other perturbation:
//
//   A. INERT AT ZERO. wobble 0 + endpoint clean must return the pipeline
//      byte-identical. This is what lets the whole port default to off and
//      keeps the geometry baseline honest.
//   B. THE DEVIATION HAS THE FIELD'S WAVELENGTH. Desk Doodles' field is one
//      cycle per max(35, min(90, arcLen*0.12)) px. So the deviation signal
//      along a stroke must cross zero at roughly that spacing — NOT at the
//      4px point spacing (that would be the "braid" failure their RDP stage
//      exists to prevent), and not once over the whole stroke (that would be a
//      bulk offset, not a wobble).
//   C. THE SAME GLYPH DIFFERS TWICE. Per-stroke seeds are derived from stroke
//      coordinates, so two strokes of similar length must not share a
//      deviation series. If this fails, the word is still a font — it is just
//      a font that wobbles identically everywhere.
//   D. LEGIBILITY BOUND. Peak deviation must stay under a fraction of the
//      stroke's own size. This is the assertion that would have caught the
//      over-scaled capture that blew the letterforms apart.
//
// Reads the REAL processed strokes off the live page via __handFeelHarness, so
// it tests what actually renders.
import { chromium } from "./lib/browser.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const WOBBLE = Number(arg("wobble", "0.4"))

const setRange = ([labelText, value]) => {
  const labels = [...document.querySelectorAll("span")].filter(
    (s) => s.textContent.trim().toLowerCase() === labelText.toLowerCase(),
  )
  for (const lab of labels) {
    const input = lab.closest("div")?.parentElement?.querySelector("input[type=range]")
    if (!input) continue
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(
      input,
      String(value),
    )
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  }
  return false
}
const clickPill = (text) => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.textContent.trim().toLowerCase() === text.toLowerCase(),
  )
  if (!b) return false
  b.click()
  return true
}
const readHarness = () => JSON.parse(JSON.stringify(window.__handFeelHarness))

/** Resample a polyline to N points by arc length — puts two different-length
 *  point lists on a shared parameter so they can be compared pointwise. */
function resampleTo(pts, n) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = cum[cum.length - 1]
  if (!(total > 0)) return pts.slice(0, n)
  const out = []
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total
    let hi = 1
    while (hi < cum.length - 1 && cum[hi] < target) hi++
    const lo = hi - 1
    const span = cum[hi] - cum[lo]
    const f = span > 1e-9 ? (target - cum[lo]) / span : 0
    out.push([
      pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f,
      pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
    ])
  }
  return out
}

const arcLen = (pts) => {
  let L = 0
  for (let i = 1; i < pts.length; i++)
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return L
}

const bboxMin = (pts) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

/** Signed perpendicular deviation of `b` from `a`, sampled at N stations. */
function deviationSeries(a, b, n = 64) {
  const A = resampleTo(a, n)
  const B = resampleTo(b, n)
  const dev = []
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(n - 1, i + 1)
    const tx = A[i1][0] - A[i0][0]
    const ty = A[i1][1] - A[i0][1]
    const tl = Math.hypot(tx, ty) || 1
    // Perpendicular component of (B - A) — the sideways wander, ignoring any
    // along-path slide from the endpoint pass.
    const nx = -ty / tl
    const ny = tx / tl
    dev.push((B[i][0] - A[i][0]) * nx + (B[i][1] - A[i][1]) * ny)
  }
  return dev
}

const zeroCrossings = (s) => {
  let c = 0
  for (let i = 1; i < s.length; i++) if (s[i - 1] === 0 || s[i - 1] * s[i] < 0) c++
  return c
}
const rms = (s) => Math.sqrt(s.reduce((a, v) => a + v * v, 0) / (s.length || 1))
const corr = (a, b) => {
  const n = Math.min(a.length, b.length)
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const u = a[i] - ma
    const v = b[i] - mb
    num += u * v
    da += u * u
    db += v * v
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__handFeelHarness, null, { timeout: 40000 })
  await page.waitForTimeout(1200)

  const fails = []
  const ok = (name, cond, detail) => {
    console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`)
    if (!cond) fails.push(name)
  }

  // ---- A. inert at zero -------------------------------------------------
  await page.evaluate(clickPill, "clean")
  await page.evaluate(setRange, ["Wobble", 0])
  await page.waitForTimeout(600)
  const off = await page.evaluate(readHarness)

  console.log("\nA. INERT AT ZERO")
  const rawLens = off.raw.map((s) => s.length)
  ok(
    "harness populated",
    off.processed.length > 0 && off.processed.length === off.raw.length,
    `${off.processed.length} strokes`,
  )
  // With wobble 0 + clean endpoint the hand-feel branch must not run at all.
  // Its signature if it DID run would be RDP thinning, so compare arc length:
  // the pass preserves shape, RDP+field would perturb it.
  const offDev = off.raw.map((r, i) => rms(deviationSeries(r, off.processed[i])))
  const maxOffDev = Math.max(...offDev)
  ok("wobble 0 leaves the path alone", maxOffDev < 1.0, `max RMS deviation ${maxOffDev.toFixed(3)}px`)

  // ---- B/C/D. the field's own signature ---------------------------------
  await page.evaluate(setRange, ["Wobble", WOBBLE])
  await page.waitForTimeout(800)
  const on = await page.evaluate(readHarness)
  ok("wobble applied", on.wobble === WOBBLE, `dial reads ${on.wobble}`)

  // Compare ON against the OFF processed path (both went through resample +
  // smooth), so the only difference is the hand-feel pass itself.
  const series = []
  for (let i = 0; i < on.processed.length; i++) {
    const base = off.processed[i]
    const felt = on.processed[i]
    if (!base || base.length < 8 || felt.length < 8) continue
    const L = arcLen(base)
    if (L < 60) continue // too short to carry a 35px cycle
    series.push({ i, L, size: bboxMin(base), dev: deviationSeries(base, felt, 64) })
  }
  ok("enough long strokes to test", series.length >= 3, `${series.length} strokes`)

  console.log("\nB. DEVIATION CARRIES THE FIELD'S WAVELENGTH")
  // The field is NOT a sine wave — it is value noise with `numAnchors + 1`
  // random values cosine-interpolated between them, so the right prediction is
  // the ANCHOR COUNT, straight out of arcLengthWobbleField:
  //     wavelength  = max(35, min(90, arcLen * 0.12))
  //     numAnchors  = max(3, ceil(arcLen / wavelength))
  // A random series of numAnchors values crosses zero at most once per
  // interval, so crossings should land in [1, numAnchors + 2]. The two failure
  // modes this must exclude are the ones Desk Doodles names:
  //   0 crossings           = a bulk offset, not a wobble
  //   crossings ~= samples  = BRAID (wobble at point spacing — what their RDP
  //                           stage exists to prevent)
  const SAMPLES = 64
  let wavelengthOk = 0
  let braided = 0
  const detail = []
  for (const s of series) {
    const wavelength = Math.max(35, Math.min(90, s.L * 0.12))
    const numAnchors = Math.max(3, Math.ceil(s.L / wavelength))
    const crossings = zeroCrossings(s.dev)
    if (crossings >= SAMPLES * 0.35) braided++
    if (crossings >= 1 && crossings <= numAnchors + 2) wavelengthOk++
    detail.push(`${crossings}/${numAnchors + 2}`)
  }
  ok(
    "deviation oscillates at the field's anchor spacing",
    wavelengthOk >= Math.ceil(series.length * 0.7),
    `${wavelengthOk}/${series.length} in band [crossings/max] ${detail.join(" ")}`,
  )
  ok("no braid (wobble is not at point spacing)", braided === 0, `${braided} braided strokes`)

  console.log("\nC. THE SAME GLYPH DIFFERS TWICE (per-stroke seeds)")
  let maxCorr = 0
  let pairs = 0
  for (let a = 0; a < series.length; a++)
    for (let b = a + 1; b < series.length; b++) {
      pairs++
      maxCorr = Math.max(maxCorr, Math.abs(corr(series[a].dev, series[b].dev)))
    }
  ok(
    "no two strokes share a wobble series",
    maxCorr < 0.95,
    `max |correlation| ${maxCorr.toFixed(3)} over ${pairs} pairs`,
  )

  console.log("\nD. LEGIBILITY BOUND")
  // Measured against ARC LENGTH, not bboxMin. bboxMin is the wrong denominator
  // here: a letter STEM is a near-straight line whose smaller bbox dimension is
  // ~0, so any wander at all reads as an infinite fraction of it. That is a
  // property of the ruler, not of the mark — legibility depends on how far the
  // stroke wanders relative to how long it is.
  let worst = 0
  let worstIdx = -1
  for (const s of series) {
    const peak = Math.max(...s.dev.map(Math.abs))
    const frac = peak / Math.max(s.L, 1)
    if (frac > worst) {
      worst = frac
      worstIdx = s.i
    }
  }
  ok(
    "peak wander stays a small fraction of stroke length",
    worst < 0.12,
    `worst ${(worst * 100).toFixed(1)}% of arc length (stroke ${worstIdx})`,
  )

  const meanRms = series.reduce((a, s) => a + rms(s.dev), 0) / (series.length || 1)
  console.log(
    `\n  [info] mean RMS wander ${meanRms.toFixed(2)}px against ink width ${on.inkWidth.toFixed(2)}px ` +
      `(${((meanRms / on.inkWidth) * 100).toFixed(0)}% of the mark's own weight)`,
  )

  await browser.close()
  console.log(fails.length === 0 ? "\nALL HAND-FEEL ASSERTIONS PASS" : `\n${fails.length} FAILED: ${fails.join(", ")}`)
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
