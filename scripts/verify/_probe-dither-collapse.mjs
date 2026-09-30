// PROBE — why do two dither presets render the SAME PICTURE on Rod and a
// completely different one on Solid?
//
// THE OBSERVATION (docs/verification/screen-layers/lane14-before/report.json):
//   rod    hardThreshold <-> pixelSignal   nnDist  1.618
//   solid  hardThreshold <-> pixelSignal   nnDist 26.686
// Same two presets. One is a LINE screen, the other an 8x8 ordered Bayer matrix.
// Structurally they could not be less alike, and on ink they are the same frame
// to within a rounding error of the 1.0 "same frame" line.
//
// THE HYPOTHESIS THIS PROBE IS BUILT TO KILL OR CONFIRM. Both presets are
// `ditherLevels: 2`, so the whole picture is decided by one comparison:
//     round( clamp( toneWindow(lum) + (threshold - 0.5), 0, 1 ) )
// The threshold map can only change the answer for pixels whose WINDOWED TONE is
// strictly between 0 and 1. Where the window has already clipped the tone to 0
// or to 1, every screen produces the same black or the same white and the choice
// of screen is arithmetically irrelevant.
//
// `fsToneWindow` (lib/style-shader.ts) is positioned in ABSOLUTE display
// luminance: centre = mix(0.90, 0.12, exposure), halfWidth = mix(0.48, 0.05,
// contrast). A window positioned absolutely while the subject's luminance is
// decided by a material the preset never sees will sit right on one mode and
// wrong on another; that is §1 of docs/research/screen-space-layer-quality.md.
//
// ⚠ ONE CORRECTION TO THAT DOC, measured here. Its table gives rod/ink sigma
// 0.257 against solid/matteClay 0.071 — a 3.6x spread that would make Rod's
// problem obviously one of width. Measured over this bed's macro crop the two
// are 0.305 and 0.247, i.e. 1.23x apart, so WIDTH ALONE DOES NOT EXPLAIN IT and
// the interior-fraction number below is what actually does. Both figures are
// honest measurements of different crops; the ratio is what the argument rests
// on, so take it from a run rather than from the table.
//
// SO THE PROBE MAKES A PREDICTION BEFORE IT MEASURES. From the layers-off frame
// it computes, per preset, the fraction of ink pixels the window leaves in the
// interior. Then it sweeps `ditherContrast` (the window WIDTH) and measures the
// distance between the two presets. If the mechanism is clipping, the two curves
// must move together; if the presets separate while the interior fraction stays
// flat, the hypothesis is wrong and something else is going on.
//
// Usage: node scripts/verify/_probe-dither-collapse.mjs
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "dither-collapse")
mkdirSync(OUT, { recursive: true })

const PAIR = ["hardThreshold", "pixelSignal"]
/* The two presets' own dials, read from lib/style-system.ts so the arithmetic
 * below is the shipped arithmetic and not a retyping of it. */
const SHIPPED = { hardThreshold: { exposure: 0.42, contrast: 0.8 }, pixelSignal: { exposure: 0.46, contrast: 0.7 } }
const CONTRASTS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.8, 0.9]
const MODES = ["rod", "solid"]

/* fsToneWindow, verbatim from lib/style-shader.ts. */
const toneWindow = (lum, exposure, contrast) => {
  const centre = 0.90 + (0.12 - 0.90) * Math.min(Math.max(exposure, 0), 1)
  const halfW = 0.48 + (0.05 - 0.48) * Math.min(Math.max(contrast, 0), 1)
  return Math.min(Math.max((lum - (centre - halfW)) / Math.max(2 * halfW, 1e-3), 0), 1)
}

const stroke = () => {
  const p = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    p.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 })
  }
  return [p]
}
async function px(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
const LUM = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
let PAPER = 247
const isInk = (l) => Math.abs(l - PAPER) > 5
function measurePaper(a) {
  const hist = new Float64Array(256)
  for (let i = 0; i < a.length; i += 4) hist[Math.max(0, Math.min(255, Math.round(LUM(a, i))))]++
  let best = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
  PAPER = best
}
function diff(a, b) {
  let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (!isInk(LUM(a, i)) && !isInk(LUM(b, i))) continue
    s += Math.abs(LUM(a, i) - LUM(b, i)); n++
  }
  return n ? s / n : 0
}
function inkLums(a) {
  const out = []
  for (let i = 0; i < a.length; i += 4) { const l = LUM(a, i); if (isInk(l)) out.push(l / 255) }
  return out
}

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 300)) })
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)))
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), stroke())
await page.waitForTimeout(1600)
await page.evaluate(() => window.__revealHarness.setProgress(1))

let SHOT = null
async function frameBox() {
  const boxes = await page.$$eval("canvas", (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
  const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
  if (box.width < 300) throw new Error("3D canvas not found")
  SHOT = box
}
/* Same guard as _probe-relief-sweep: a frame without a form is not a
 * measurement, it is a hot reload, and `diff()` over zero ink pixels returns a
 * confident 0. */
async function grab() {
  for (let attempt = 0; ; attempt++) {
    const buf = await page.screenshot({ clip: SHOT })
    const a = await px(buf)
    let n = 0, t = 0
    for (let i = 0; i < a.length; i += 4) { t++; if (isInk(LUM(a, i))) n++ }
    if (n / t >= 0.02) return buf
    if (attempt >= 3) throw new Error("no form on the stage — refusing to record a number")
    await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, { timeout: 60000 })
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), stroke())
    await page.waitForTimeout(1600)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  }
}
const OFF = {
  textureEnabled: false, textureMode: "none", ditherEnabled: false,
  asciiEnabled: false, layerStackEnabled: false, fusionPreset: "none", motionMode: "off",
}

const rows = []
let fails = 0
for (const mode of MODES) {
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1300)
  await page.evaluate(() => window.__captureHarness.frontView(0.95))
  await page.waitForTimeout(600)
  await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
  await page.waitForTimeout(600)
  await frameBox()
  const offBuf = await grab()
  const off = await px(offBuf)
  measurePaper(off)
  if (PAPER < 200) throw new Error(`paper measured at ${PAPER} — not framed on the stage`)
  const lums = inkLums(off)
  const sd = Math.sqrt(lums.reduce((s, l) => s + l * l, 0) / lums.length - (lums.reduce((s, l) => s + l, 0) / lums.length) ** 2)

  console.log(`\n=== ${mode} ===  ink pixels ${lums.length}, sigma ${sd.toFixed(3)}`)
  console.log("  PREDICTION (from the layers-off frame + fsToneWindow, before anything is rendered):")
  for (const p of PAIR) {
    const { exposure, contrast } = SHIPPED[p]
    const interior = lums.filter((l) => { const w = toneWindow(l, exposure, contrast); return w > 0.001 && w < 0.999 }).length / lums.length
    console.log(`    ${p.padEnd(15)} exposure ${exposure} contrast ${contrast} -> ${(interior * 100).toFixed(1)}% of ink is INSIDE the window (the only pixels a screen can change)`)
    rows.push({ mode, kind: "shipped", preset: p, exposure, contrast, interior: +interior.toFixed(4) })
  }

  console.log("  MEASURED, sweeping the window WIDTH (ditherContrast) on both presets at once:")
  console.log("    contrast   interiorHT  interiorPS   pairDelta")
  for (const c of CONTRASTS) {
    const shots = {}
    for (const p of PAIR) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
      await page.waitForTimeout(140)
      await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["dither", p])
      await page.waitForTimeout(160)
      await page.evaluate((v) => window.__styleHarness.setStyle({ ditherContrast: v }), c)
      await page.waitForTimeout(420)
      shots[p] = await px(await grab())
    }
    const d = diff(shots[PAIR[0]], shots[PAIR[1]])
    const iHT = lums.filter((l) => { const w = toneWindow(l, SHIPPED.hardThreshold.exposure, c); return w > 0.001 && w < 0.999 }).length / lums.length
    const iPS = lums.filter((l) => { const w = toneWindow(l, SHIPPED.pixelSignal.exposure, c); return w > 0.001 && w < 0.999 }).length / lums.length
    console.log(`    ${String(c).padEnd(10)} ${(iHT * 100).toFixed(1).padStart(9)}% ${(iPS * 100).toFixed(1).padStart(10)}% ${d.toFixed(3).padStart(11)}`)
    rows.push({ mode, kind: "sweep", contrast: c, interiorHT: +iHT.toFixed(4), interiorPS: +iPS.toFixed(4), pairDelta: +d.toFixed(3) })
  }

  /* THE DECISION. If clipping is the mechanism, the pair distance must track the
   * interior fraction — widen the window and the two screens must separate. */
  const sweep = rows.filter((r) => r.mode === mode && r.kind === "sweep")
  const widest = sweep[0], tightest = sweep[sweep.length - 1]
  const gain = widest.pairDelta - tightest.pairDelta
  if (mode === "rod") {
    if (gain > 3.0 && widest.interiorHT > tightest.interiorHT) {
      console.log(`  PASS  rod: widening the window from contrast ${tightest.contrast} to ${widest.contrast} takes the pair from Δ ${tightest.pairDelta} to Δ ${widest.pairDelta} while the interior fraction goes ${(tightest.interiorHT * 100).toFixed(1)}% -> ${(widest.interiorHT * 100).toFixed(1)}% — the collapse is CLIPPING`)
    } else {
      console.log(`  FAIL  rod: the pair does not separate as the window widens (Δ ${tightest.pairDelta} -> ${widest.pairDelta}) — clipping is NOT the mechanism, look elsewhere`)
      fails++
    }
  } else {
    /* Solid is the CONTROL, and the claim it has to support is comparative, not
     * absolute: the same shipped dials must leave materially MORE of Solid's ink
     * inside the window than Rod's, because that is the whole explanation for why
     * one mode collapses and the other does not.
     *
     * An earlier version of this row asserted "solid interior > 50%" and failed at
     * 46.9% — a threshold picked from expectation rather than from the thing being
     * claimed. The absolute number is also known to be a LOWER BOUND on both
     * modes: the prediction reads display luminance straight off the frame, while
     * the shader first passes it through fsFormTone (style-shader.ts), a facing-
     * ratio term this instrument cannot observe. So absolute levels are not the
     * evidence here; the ratio between the two modes, and the sweep above, are. */
    const solidHT = rows.find((r) => r.mode === "solid" && r.kind === "shipped" && r.preset === "hardThreshold")
    const rodHT = rows.find((r) => r.mode === "rod" && r.kind === "shipped" && r.preset === "hardThreshold")
    const ratio = solidHT.interior / Math.max(rodHT.interior, 1e-6)
    if (ratio > 2.0) {
      console.log(`  PASS  solid control: at the SAME shipped dials Solid keeps ${(solidHT.interior * 100).toFixed(1)}% of its ink inside the window against Rod's ${(rodHT.interior * 100).toFixed(1)}% — ${ratio.toFixed(1)}x as much, which is the whole reason the identical preset pair reads Δ 26.7 there and Δ 1.6 on Rod`)
    } else {
      console.log(`  FAIL  solid control: Solid keeps only ${ratio.toFixed(2)}x Rod's interior fraction, so clipping does not explain the difference between the two modes`)
      fails++
    }
  }
}

writeFileSync(join(OUT, "collapse.json"), JSON.stringify(rows, null, 2))
console.log(`\nconsole errors: ${errors.length}`)
writeFileSync(join(OUT, "collapse-console.json"), JSON.stringify(errors, null, 2))
await browser.close()
console.log(fails ? `\n${fails} FAILING ROW(S)` : "\nALL ROWS PASS")
process.exit(fails ? 1 : 0)
