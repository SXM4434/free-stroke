// PROBE — how far does the RELIEF channel carry the texture rail, and what does
// it cost the modes that already read?
//
// Sweeps `uFsTexBump` (lib/texture-shader.ts) across every texture rail preset
// on the two modes that bracket the problem: `rod` (the `ink` material, glossy
// near-black, the mode the hero mark uses and the one where the rail measures
// 3.4-4.7 against a 5.0 "reads" line) and `solid` (`matteClay`, matte and light,
// where the same rail measures 14-38 and must not be damaged).
//
// THE ROW AT 0 IS THE NEGATIVE CONTROL, and it is not decoration. Relief is a
// perturbation ADDED to the shading normal, so 0 must reproduce the pre-change
// render exactly rather than approximately. If the 0 column does not match the
// numbers this tree measured before the channel existed, the two arms are not
// the two arms and every other column is meaningless.
//
// Usage: node scripts/verify/_probe-relief-sweep.mjs [--modes=rod,solid] [--bumps=0,0.4,...]
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
const OUT = join(ROOT, "docs", "verification", "texture-relief")
mkdirSync(OUT, { recursive: true })
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const MODES = arg("modes", "rod,solid").split(",")
const BUMPS = arg("bumps", "0,0.3,0.6,1,1.6,2.4").split(",").map(Number)
/* Which parked uniform the columns sweep, and what to hold the others at.
 * uFsTexBump is the relief amplitude; any parked uniform in
 * lib/texture-shader.ts can be swept the same way. */
const UNIFORM = arg("uniform", "uFsTexBump")
const HOLD = arg("hold", "")   // "name:value", applied before every cell
const PRESETS = [
  "fineGrain", "scanlines", "contourBands", "scratchedInk", "gelBubbles", "crosshatch",
  "inkDots", "woodgrain", "cellular", "brushedSteel", "craquelure", "interference",
]

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
/* Mean |Δ| over pixels either frame calls ink. Same shape as the number
 * verify-screen-layers reports, taken over the whole form instead of a macro
 * crop — so the two are comparable in DIRECTION and magnitude, not to 3dp. */
const LUM = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
/* Ink is paper-relative, for the reason verify-screen-layers.mjs records: the
 * four per-mode materials do not share a value range, and a screen layer can
 * lift a cell ABOVE paper as well as push it below. PAPER is the modal stage
 * luminance, measured per mode from the layers-off frame. */
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
    s += Math.abs(LUM(a, i) - LUM(b, i))
    n++
  }
  return n ? s / n : 0
}
/* Structure, not just distance: mean |Δ| between horizontally adjacent ink
 * pixels. A tonal wash has a big dOff and no edge energy; a pattern has both.
 * The whole complaint being chased is "it looks like a silver tube", which is a
 * missing-EDGE complaint, so it needs its own number. */
function edgeEnergy(a, w) {
  let s = 0, n = 0
  for (let i = 0; i + 4 < a.length; i += 4) {
    if ((i / 4) % w === w - 1) continue
    const l0 = LUM(a, i), l1 = LUM(a, i + 4)
    if (!isInk(l0) || !isInk(l1)) continue
    s += Math.abs(l0 - l1); n++
  }
  return n ? s / n : 0
}

const errors = []
/* THE BED IS verify-screen-layers.mjs's BED, DELIBERATELY: same viewport, same
 * deviceScaleFactor, same page.screenshot() path. An earlier version of this
 * probe grabbed through `__captureHarness.grab()`, which RESIZES THE DRAWING
 * BUFFER for a hi-res export (components/viewport-3d.tsx, STILL_EXPORT) — so the
 * texture was being judged at a pixel density the viewport never renders at, and
 * every anti-aliasing guard and the grain LOD in this very file key off exactly
 * that. An amplitude chosen on that bed is an amplitude chosen for a picture
 * nobody sees. */
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 300)) })
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)))
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness)
await page.evaluate((p) => {
  window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
  window.__captureHarness.enable()
}, stroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness.setProgress(1))

let SHOT = null
async function frameBox() {
  const boxes = await page.$$eval("canvas", (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
  const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
  if (box.width < 300) throw new Error("3D canvas not found: " + JSON.stringify(boxes))
  SHOT = box
}

/* A NULL GRAB IS A HOT RELOAD, NOT A RESULT. This drives the shared dev server
 * while sibling lanes save files, and a Fast Refresh takes `__captureHarness`
 * away mid-sweep; the first version of this probe died on `null.match`. Dying is
 * the correct behaviour compared to recording a zero, but re-establishing the
 * bed is better than losing the run — and _run-clean.mjs still fails the whole
 * run afterwards if a watched file moved, so a re-established capture can never
 * be silently mixed with a pre-reload one. */
async function reestablish() {
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null, { timeout: 60000 })
  await page.evaluate((p) => {
    window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
    window.__captureHarness.enable()
  }, stroke())
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  if (currentMode) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), currentMode)
    await page.waitForTimeout(1200)
    await page.evaluate(() => window.__captureHarness.frontView(1))
    await page.waitForTimeout(500)
  }
}
let currentMode = null
/* ── THE ON-FORM GUARD, and the run it was written from ──────────────────────
 *
 * The first version of this probe had no guard and produced a table where EVERY
 * cell on rod read 27.69 and every cell on solid read 0.00 — twelve presets and
 * six amplitudes, one number. That is not a weak effect; it is an instrument
 * measuring an EMPTY STAGE. A sibling lane saved lib/style-system.ts mid-run,
 * Fast Refresh remounted the page and took the injected strokes with it, and
 * `diff()` over zero ink pixels returns exactly 0 while `window.__captureHarness`
 * was back and answering. `verify-screen-layers.mjs` records the same failure in
 * its own words — "A VERIFICATION FRAME SHOWING BLANK PAPER IS WORSE THAN NO
 * FRAME" — and this probe had to earn the lesson again.
 *
 * So a frame is only a measurement if there is a FORM in it, and the harness
 * calls below no longer use optional chaining: a missing harness must throw, not
 * silently no-op, because a silent no-op is what made every row identical. */
const INK_FLOOR = 0.02
async function inkFraction(buf) {
  const a = await px(buf)
  let n = 0, t = 0
  for (let i = 0; i < a.length; i += 4) { t++; if (isInk(LUM(a, i))) n++ }
  return t ? n / t : 0
}
const grab = async () => {
  for (let attempt = 0; ; attempt++) {
    const alive = await page.evaluate(() => !!window.__captureHarness && !!window.__styleHarness).catch(() => false)
    if (alive) {
      const buf = await page.screenshot({ clip: SHOT })
      const ink = await inkFraction(buf)
      if (ink >= INK_FLOOR) return buf
      console.log(`[relief] frame has no form (ink ${ink.toFixed(4)}) — re-establishing`)
    } else {
      console.log("[relief] harness vanished (hot reload) — re-establishing")
    }
    if (attempt >= 3) throw new Error("no form on the stage after 4 attempts — refusing to record a number")
    await reestablish()
  }
}
const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, asciiEnabled: false, layerStackEnabled: false,
  fusionPreset: "none", motionMode: "off",
}

const harnessOk = await page.evaluate(() => typeof window.__textureShaderHarness?.set === "function")
if (!harnessOk) {
  console.log("FAIL  window.__textureShaderHarness.set is missing — nothing can be swept or parked")
  await browser.close()
  process.exit(1)
}

const rows = []
for (const mode of MODES) {
  currentMode = mode
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await page.waitForTimeout(500)
  await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
  await page.waitForTimeout(600)
  await frameBox()
  const baseBuf = await grab()   // guarded: throws rather than measure blank paper
  const base = await px(baseBuf)
  const img = await loadImage(baseBuf)
  measurePaper(base)
  if (PAPER < 200) throw new Error(`paper measured at ${PAPER} — not framed on the stage`)
  const baseEdge = edgeEnergy(base, img.width)

  console.log(`\n=== ${mode} ===  (layers OFF: edge ${baseEdge.toFixed(2)})`)
  console.log(`preset          ` + BUMPS.map((v) => `${UNIFORM.replace("uFsTex", "")}=${v}`.padStart(11)).join("") + "   |   edge at last")
  for (const preset of PRESETS) {
    const line = []
    let lastEdge = 0
    for (const v of BUMPS) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
      await page.waitForTimeout(160)
      await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", preset])
      const applied = await page.evaluate(([name, k, hold]) => {
        if (hold) { const [hn, hv] = hold.split(":"); window.__textureShaderHarness.set(hn, Number(hv)) }
        window.__textureShaderHarness.set(name, k)
        return window.__textureShaderHarness.get(name)
      }, [UNIFORM, v, HOLD])
      if (!applied.length || applied.some((x) => Math.abs(x - v) > 1e-9)) {
        throw new Error(`${UNIFORM} did not take: asked ${v}, uniforms read ${JSON.stringify(applied)}`)
      }
      await page.waitForTimeout(600)
      const buf = await grab()
      const cur = await px(buf)
      const d = diff(base, cur)
      lastEdge = edgeEnergy(cur, img.width)
      line.push(d)
      rows.push({ mode, preset, uniform: UNIFORM, bump: v, hold: HOLD, dOff: +d.toFixed(3), edge: +lastEdge.toFixed(3) })
    }
    console.log(preset.padEnd(16) + line.map((d) => d.toFixed(2).padStart(11)).join("") + "   |  " + lastEdge.toFixed(2))
  }
}
await page.evaluate(() => {
  window.__textureShaderHarness.set("uFsTexBump", 0)
})
/* ── CAN THIS TABLE FAIL? ────────────────────────────────────────────────────
 * A sweep whose cells are all the same number is the signature of an instrument
 * measuring nothing, and this probe has produced exactly that table once. So it
 * says so itself rather than leaving it to whoever reads the columns. */
let flat = 0
for (const mode of MODES) {
  const vals = rows.filter((r) => r.mode === mode).map((r) => r.dOff)
  const spread = Math.max(...vals) - Math.min(...vals)
  if (spread < 0.5) { console.log(`FAIL  ${mode}: every cell in the sweep is the same number (spread ${spread.toFixed(3)}) — the instrument is measuring nothing`); flat++ }
  else console.log(`PASS  ${mode}: sweep spread ${spread.toFixed(2)} — the columns separate`)
}
writeFileSync(join(OUT, "sweep.json"), JSON.stringify(rows, null, 2))
console.log(`\nconsole errors: ${errors.length}`)
errors.slice(0, 6).forEach((e) => console.log("   ", e))
writeFileSync(join(OUT, "sweep-console.json"), JSON.stringify(errors, null, 2))
await browser.close()
console.log(`wrote ${OUT}/sweep.json`)
process.exit(flat || errors.length ? 1 : 0)
