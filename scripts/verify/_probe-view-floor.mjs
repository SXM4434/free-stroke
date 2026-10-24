// PROBE — what instrument can tell "the framing collapsed the form" apart from
// "the framing is thin on purpose"? Twin of assert-view-presets.mjs.
//
// The gate's floor row judged both with ALPHA COVERAGE and could not separate
// them: the documented el-89 defect reads 0.643% and the shipped `rakingProfile`
// ("almost edge-on — the shot that shows how deep the form really is") reads
// 0.715%, a gap of 1.11x. This probe measures candidate instruments against the
// same two frames plus a too-far-out arm, so the gate's floors can be picked
// from numbers instead of typed.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { LAB_URL } from "./lib/dev-server.mjs"
import { loadTs } from "./_ts-load.mjs"

const S = loadTs("lib/style-system.ts")
const { PRESET_REGISTRY, resolveViewPreset } = S

async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width }
}
function shape(a) {
  let n = 0, sx = 0, sy = 0
  const xs = [], ys = []
  for (let i = 0, p = 0; i < a.d.length; i += 4, p++) {
    if (a.d[i + 3] < 20) continue
    const x = p % a.w, y = (p / a.w) | 0
    xs.push(x); ys.push(y); sx += x; sy += y; n++
  }
  if (!n) return { n: 0, cov: 0, ratio: 0 }
  const mx = sx / n, my = sy / n
  let cxx = 0, cyy = 0, cxy = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  for (let k = 0; k < n; k++) {
    const dx = xs[k] - mx, dy = ys[k] - my
    cxx += dx * dx; cyy += dy * dy; cxy += dx * dy
    if (xs[k] < x0) x0 = xs[k]; if (xs[k] > x1) x1 = xs[k]
    if (ys[k] < y0) y0 = ys[k]; if (ys[k] > y1) y1 = ys[k]
  }
  cxx /= n; cyy /= n; cxy /= n
  const tr = cxx + cyy, det = cxx * cyy - cxy * cxy
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc
  return {
    n,
    cov: n / (a.d.length / 4),
    ratio: Math.sqrt(Math.max(0, l2)) / Math.sqrt(Math.max(1e-9, l1)),
    bbox: `${x1 - x0 + 1}x${y1 - y0 + 1}`,
  }
}
function testStroke() {
  const pts = []
  for (let i = 0; i <= 110; i++) {
    const t = i / 110
    pts.push({ x: 150 + t * 560, y: 340 + Math.sin(t * Math.PI * 1.9) * 120 })
  }
  return [pts]
}

const browser = await chromium.launch({ headed: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: "no-preference" })
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, { timeout: 30000 })
await page.evaluate((p) => {
  window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
  window.__captureHarness.enable()
}, testStroke())
await page.waitForTimeout(1600)
await page.evaluate(() => window.__styleHarness.setMode("extrude"))
await page.waitForTimeout(1200)
await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
await page.waitForTimeout(400)

const at = async (az, el, fill) => {
  /* READ WHAT THE DRIVER RETURNED. `apiOrbitView` answers FALSE when there
   * are no controls or the bounds have no radius, and this threw that away.
   * A refused orbit leaves the camera where it was, so every row below would
   * have been measuring the PREVIOUS pose and reporting it as this one, with
   * nothing in the output saying so. */
  const took = await page.evaluate(
    (c) => window.__captureHarness.orbitView(c[0], c[1], c[2]),
    [az, el, fill],
  )
  if (!took) {
    throw new Error(
      `_probe-view-floor: orbitView(${az}, ${el}, ${fill}) REFUSED. The camera did not ` +
        `move, so any shape read here belongs to the previous pose. Refusing to capture.`,
    )
  }
  await page.waitForTimeout(340)
  return shape(await decode(await page.evaluate(() => window.__captureHarness.grab())))
}

const rows = []
for (const p of PRESET_REGISTRY.view) {
  const c = resolveViewPreset(p.id).camera
  rows.push([`preset ${p.id}`, await at(c.azimuthDeg, c.elevationDeg, c.fill)])
}
rows.push(["KNOWN-BAD collapse az0/el89 fill1", await at(0, 0 + 89, 1)])
rows.push(["KNOWN-BAD collapse az90/el0 fill1", await at(90, 0, 1)])
for (const f of [1.5, 2.0, 2.5, 3.0, 4.0, 6.0]) {
  rows.push([`KNOWN-BAD too-far az38/el22 fill${f}`, await at(38, 22, f)])
}
// the empty arm: nothing revealed at all
await page.evaluate(() => window.__revealHarness.setProgress(0))
await page.waitForTimeout(500)
rows.push(["KNOWN-BAD empty (reveal 0) az38/el22 fill1.05", await at(38, 22, 1.05)])
await page.evaluate(() => window.__revealHarness.setProgress(1))

console.log("\narm".padEnd(46), "ink px".padStart(9), "cov%".padStart(8), "minor/major".padStart(12), "bbox".padStart(11))
for (const [k, s] of rows) {
  console.log(k.padEnd(46), String(s.n).padStart(9), (s.cov * 100).toFixed(4).padStart(8), s.ratio.toFixed(4).padStart(12), String(s.bbox || "-").padStart(11))
}
await browser.close()
