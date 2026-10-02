// GATE — the texture RELIEF channel, in both directions.
//
// WHAT IT GUARDS. `uFsTexBump` (lib/texture-shader.ts) makes the texture pattern
// perturb the shading normal, so the specular lobe is BENT by the pattern rather
// than only dimmed by it. It exists because three level controls — bidirectional
// albedo, additive dark-body albedo, roughness + clearcoat strength — left Rod's
// whole texture rail at dOff 3.4-4.7 against the repo's own 5.0 "reads" line,
// with Fine Grain at 1.48, under the 2.0 perceptual floor.
// ⚠ THOSE TWO SENTENCES ARE ON DIFFERENT SCALES AND THE SECOND IS THE WRONG ONE.
// 1.48 is a whole-crop dOff; the 2.0 floor is ink-masked. See `meanAbsDiffInk`.
// Left as written, with the correction beside it, because the relief is a
// shipped pick and re-arguing it is not this gate's call.
//
// FOUR ASSERTIONS, and the second is the one that makes the other three mean
// something:
//
//   1 · EVERY texture preset on Rod clears the perceptual floor — measured on
//       the floor's OWN scale, over inked pixels. See `meanAbsDiffInk`.
//   2 · THE DEAD OPTION FAILS. The preset selected with textureIntensity driven
//       to 0 must put every preset under the floor. This is the negative control
//       and it is not optional: without it, row 1 is a green row nobody has seen
//       go red, and this repo has shipped eleven instruments with that shape.
//       (It was the PARKED RELIEF until 2026-09-04; that arm only crossed the
//       floor because of a paper-diluted metric, so it is demoted to the
//       comparative row 2b and no longer stands in for a bar it does not cross.)
//   3 · RELIEF DOES NOT REACH THE NON-TEXTURE RAILS. Dither and ASCII are
//       separate systems (PRD §4). Driving the relief uniform across its whole
//       range with a dither preset selected must change NOTHING — the shipped
//       proof is byte-level: mean |Δ| exactly 0.
//   4 · SCREEN LOCK IS EXCLUDED BY CONSTRUCTION. Screen lock is documented as a
//       graphic overlay printed on glass; physical relief on an overlay is a
//       category error, and the shader gates it off. Asserted, not assumed.
//
// Usage: node scripts/verify/assert-texture-relief.mjs
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "texture-relief")
mkdirSync(OUT, { recursive: true })

const FLOOR = 2.0        // scripts/verify/diff-frames.mjs — below this is under the
                         // perceptual floor on a dark subject
const PRESETS = ["fineGrain", "scanlines", "contourBands", "scratchedInk", "gelBubbles", "crosshatch",
  "inkDots", "woodgrain", "cellular", "brushedSteel", "craquelure", "interference"]

let fails = 0
const pass = (m) => console.log("PASS  " + m)
const fail = (m) => { console.log("FAIL  " + m); fails++ }

const stroke = () => {
  const p = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    p.push({ x: 110 + t * 640, y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24 })
  }
  return [p]
}
async function pxOf(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}
const LUM = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
let PAPER = 247
const isInk = (l) => Math.abs(l - PAPER) > 5
/** verify-screen-layers.mjs's dOff: mean |Δ| over the WHOLE crop, paper
 *  included. Kept, unchanged, so every number this file has ever written stays
 *  readable beside the ones in each `screen-layers` label's `report.json`. It is no longer
 *  what the floor is applied to — see `meanAbsDiffInk`. */
function meanAbsDiff(a, b) {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i += 4) s += Math.abs(LUM(a, i) - LUM(b, i))
  return (s / (n / 4))
}
/**
 * THE SAME DIFFERENCE ON THE SCALE THE 2.0 FLOOR WAS ACTUALLY MEASURED ON.
 *
 * 🔴 THE FLOOR AND THE NUMBER IT GRADED WERE ON DIFFERENT SCALES. `FLOOR` is
 * quoted from `scripts/verify/diff-frames.mjs`, and that file's first sentence
 * says what it averages over: "over pixels where either frame has ink (alpha >
 * 20)". `dOff` above divides by every pixel in the crop, paper included — and
 * texture only ever touches the FORM. So `dOff = dInk x (ink fraction)`, and
 * the ink fraction is a property of the MODE rather than of the effect. Lane C2
 * measured it across 132 graded rows on 2026-09-04: rod 0.131 · extrude 0.326 ·
 * solid 0.343 · inflate 0.485, a 3.7x spread, with paper contributing
 * 0.000-0.032 of a delta whose ink value is 14-90. One absolute floor across
 * four modes was four different bars, and this file grades ROD — the thinnest,
 * the one marked hardest. Its fix to `assert-screen-layers.mjs` is `aa4830f7`
 * and this is that fix, applied to the sibling row.
 *
 * ⚠ THE BAR DID NOT MOVE. `FLOOR` is still 2.0 and it still reddens — the
 * negative control below is re-derived on this scale and calibrated.
 *
 * EITHER frame, not "ink in the OFF frame", and C2's reason carries here
 * unchanged: an effect that puts ink OUTSIDE the silhouette it started from
 * would be scored as paper by a before-only mask, i.e. hidden by the instrument
 * that exists to measure it. The mask SIZE is returned and printed, because a
 * ratio whose denominator is not printed is how a number got quoted against the
 * wrong floor for a month.
 */
function meanAbsDiffInk(a, b) {
  let s = 0
  let n = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i += 4) {
    const la = LUM(a, i)
    const lb = LUM(b, i)
    if (!isInk(la) && !isInk(lb)) continue
    s += Math.abs(la - lb)
    n++
  }
  return { dInk: n ? s / n : 0, inkPx: n, ofPx: len / 4 }
}

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 300)) })
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)))
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke())
await page.waitForTimeout(1600)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__styleHarness.setMode("rod"))
await page.waitForTimeout(1300)
await page.evaluate(() => window.__captureHarness.frontView(0.95))
await page.waitForTimeout(600)

const boxes = await page.$$eval("canvas", (els) =>
  els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
const rectOf = (fx, fy, fw, fh) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy, width: box.width * fw, height: box.height * fh })
const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false, ditherEnabled: false,
  asciiEnabled: false, layerStackEnabled: false, fusionPreset: "none", motionMode: "off",
}
await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
await page.waitForTimeout(600)

/* Densest patch of ink, with verify-screen-layers.mjs's three guards: paper must
 * be paper, the crop must be ON the form, and the crop must not be a flat field.
 * A run of blank-stage frames passes every comparison in this file for reasons
 * that have nothing to do with the subject. */
let MACRO = null
{
  const { d, w, h } = await pxOf(await page.screenshot({ clip: rectOf(0, 0, 1, 1) }))
  const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97), Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
  const hist = new Float64Array(256)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) hist[Math.max(0, Math.min(255, Math.round(LUM(d, (y * w + x) * 4))))]++
  let best = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
  PAPER = best
  if (PAPER < 200) throw new Error(`paper measured at ${PAPER} — not framed on the stage`)
  const colN = new Int32Array(w), rowN = new Int32Array(h)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isInk(LUM(d, (y * w + x) * 4))) { colN[x]++; rowN[y]++ }
  let x0 = -1, x1 = -1, y0 = -1, y1 = -1
  for (let x = X0; x < X1; x++) if (colN[x] > (Y1 - Y0) * 0.04) { if (x0 < 0) x0 = x; x1 = x }
  for (let y = Y0; y < Y1; y++) if (rowN[y] > (X1 - X0) * 0.04) { if (y0 < 0) y0 = y; y1 = y }
  if (x1 < 0 || y1 < 0) throw new Error("no ink found in the 3-D canvas")
  const NB = 48, bw = (x1 - x0) / NB, bh = (y1 - y0) / NB
  const cov = new Float32Array(NB * NB)
  for (let y = y0; y <= y1; y++) {
    const by = Math.min(NB - 1, Math.floor((y - y0) / bh))
    for (let x = x0; x <= x1; x++) if (isInk(LUM(d, (y * w + x) * 4))) cov[by * NB + Math.min(NB - 1, Math.floor((x - x0) / bw))]++
  }
  let bestS = -1, bx = 0, by = 0
  const W = 5
  for (let r = 0; r + W <= NB; r++) for (let c = 0; c + W <= NB; c++) {
    let sm = 0
    for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) sm += cov[(r + rr) * NB + c + cc]
    if (sm > bestS) { bestS = sm; bx = c; by = r }
  }
  const mx = (x0 + (bx + W / 2) * bw) / w, my = (y0 + (by + W / 2) * bh) / h
  const iw = (x1 - x0) / w, mw = iw * 0.15
  MACRO = rectOf(mx - mw / 2, my - mw * 0.72 / 2, mw, mw * 0.72)
}
async function macro() {
  const buf = await page.screenshot({ clip: MACRO })
  const { d } = await pxOf(buf)
  let ink = 0, tot = 0
  for (let i = 0; i < d.length; i += 4) { tot++; if (isInk(LUM(d, i))) ink++ }
  if (ink / tot < 0.05) throw new Error(`macro crop is off the form (ink ${(ink / tot).toFixed(4)}) — refusing to record a number`)
  return d
}

const harness = await page.evaluate(() => typeof window.__textureShaderHarness?.set === "function")
if (!harness) {
  fail("window.__textureShaderHarness.set is missing — the relief cannot be parked, so nothing below can be shown to fail")
} else {
  const setBump = async (v) => {
    const got = await page.evaluate((k) => {
      window.__textureShaderHarness.set("uFsTexBump", k)
      return window.__textureShaderHarness.get("uFsTexBump")
    }, v)
    if (!got.length || got.some((x) => Math.abs(x - v) > 1e-9)) {
      throw new Error(`uFsTexBump did not take: asked ${v}, uniforms read ${JSON.stringify(got)}`)
    }
  }
  const shipped = (await page.evaluate(() => window.__textureShaderHarness.get("uFsTexBump")))[0]

  const offD = await macro()
  const rows = []

  /* One arm of one preset, on BOTH scales, with the denominator carried. `dead`
   * selects the preset and then drives `textureIntensity` to 0 — the option
   * PRESENT and doing nothing, which is the known-bad row 1 has to reject. */
  const sample = async (arm, preset, { bump, dead = false }) => {
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(140)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", preset])
    if (dead) await page.evaluate(() => window.__styleHarness.setStyle({ textureIntensity: 0 }))
    await setBump(bump)
    await page.waitForTimeout(520)
    const now = await macro()
    const dOff = meanAbsDiff(offD, now)
    const { dInk, inkPx, ofPx } = meanAbsDiffInk(offD, now)
    /* A capture with no ink mask is REFUSED BY NAME rather than quietly falling
     * back to `dOff` — a fallback here would put the floor back on the wrong
     * scale and report green about it. C2's rule, and the reason it is a rule. */
    if (!inkPx) throw new Error(`${arm}/${preset}: the ink mask is EMPTY (${ofPx} px in the crop, 0 inked) — the crop is off the form, refusing to record a dInk`)
    const row = { arm, preset, dOff: +dOff.toFixed(3), dInk: +dInk.toFixed(3), inkMaskFrac: +(inkPx / ofPx).toFixed(3) }
    rows.push(row)
    return row
  }

  /* --- 1 · every texture preset on Rod clears the floor, at the SHIPPED value
   *        and ON THE FLOOR'S OWN SCALE. See `meanAbsDiffInk`. */
  const shippedRows = []
  let worst = { d: Infinity, p: "" }
  for (const preset of PRESETS) {
    const r = await sample("shipped", preset, { bump: shipped })
    shippedRows.push(r)
    if (r.dInk < worst.d) worst = { d: r.dInk, p: preset }
    if (r.dInk < FLOOR) fail(`rod/texture/${preset} is under the perceptual floor — dInk ${r.dInk.toFixed(3)} < ${FLOOR} (whole-crop dOff ${r.dOff.toFixed(3)}, ink mask ${(100 * r.inkMaskFrac).toFixed(1)} % of the crop)`)
  }
  const meanFrac = shippedRows.reduce((a, r) => a + r.inkMaskFrac, 0) / shippedRows.length
  if (worst.d >= FLOOR) pass(`all ${PRESETS.length} texture presets clear the perceptual floor on Rod at relief ${shipped} — weakest is ${worst.p} at dInk ${worst.d.toFixed(3)}, over an ink mask averaging ${(100 * meanFrac).toFixed(1)} % of the crop (its whole-crop dOff is ${shippedRows.find((r) => r.preset === worst.p).dOff.toFixed(3)}, which is the number the floor used to be applied to)`)

  /* --- 2 · THE NEGATIVE CONTROL, RE-DERIVED ON THE NEW SCALE --------------
   *
   * 🔴 IT USED TO BE THE PARKED RELIEF, AND THAT ONLY WORKED BECAUSE OF THE
   * DILUTION. With `uFsTexBump` at 0 the rail read `dOff` 1.198-3.881 and
   * fineGrain fell under 2.0 — but ON THE FLOOR'S OWN SCALE the parked prior is
   * nowhere near it (C2 measured relief-parked fineGrain at dInk 8.357), so
   * after the rescale that arm would clear the floor on every preset and row 1
   * would become a row nobody has seen go red. Lane C2 flagged exactly this
   * before I touched the metric.
   *
   * THE KNOWN-BAD IS NOW THE OPTION PRESENT AND DEAD: the preset selected,
   * `textureIntensity` driven to 0. That is the failure row 1 exists to catch —
   * a texture rail that is on and doing nothing — and it is the same control
   * C2 calibrated on Rod, where it reads dInk 0.000 on 12 of 12 presets.
   *
   * ⭐ AND THIS ROW WAS ITSELF SHOWN TO GO RED, which is the step that gets
   * skipped. Driving the arm to `textureIntensity: 0.85` — the option present
   * and ALIVE, i.e. the arm no longer being a known-bad — this row fails naming
   * all twelve (fineGrain 14.175 … gelBubbles 55.529) with "assertion 1 above
   * is a green row that CANNOT fail", exit 1. Run 2026-09-04 on :3122 and the
   * edit reverted byte-for-byte.
   *
   * ⚠ AND THE OLD ARM IS NOT DELETED, IT IS DEMOTED. The parked relief still
   * runs, because the COMPARATIVE row below it is the relief's own claim and a
   * comparison of two arms on one scale cancels the dilution either way. What
   * it no longer does is stand in for a floor it does not actually cross. */
  const dead = []
  for (const preset of PRESETS) dead.push(await sample("dead", preset, { bump: shipped, dead: true }))
  const over = dead.filter((r) => r.dInk >= FLOOR)
  if (!over.length) {
    pass(`the ruler was shown to FAIL: with the option PRESENT AND DEAD (textureIntensity 0) all ${dead.length} presets fall under the floor — worst ${Math.max(...dead.map((r) => r.dInk)).toFixed(3)} against ${FLOOR}`)
  } else {
    fail(`${over.length} preset(s) still clear the floor with textureIntensity at 0 — ${over.map((r) => `${r.preset} ${r.dInk}`).join(", ")} — so assertion 1 above is a green row that CANNOT fail`)
  }

  /* --- 2b · the relief's own claim, and it is a COMPARISON, not a floor ---
   * Two arms, one scale, so the ink fraction divides out of the difference
   * whichever scale it is read on. Both are printed. */
  const prior = []
  for (const preset of PRESETS) prior.push(await sample("prior", preset, { bump: 0 }))
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
  const gain = mean(shippedRows.map((r) => r.dOff)) - mean(prior.map((r) => r.dOff))
  const gainInk = mean(shippedRows.map((r) => r.dInk)) - mean(prior.map((r) => r.dInk))
  if (gain > 0.5) pass(`relief carries the Rod rail by a mean of +${gain.toFixed(2)} dOff over the parked prior (+${gainInk.toFixed(2)} dInk on the floor's scale)`)
  else fail(`relief moves the Rod rail by only +${gain.toFixed(2)} dOff — it is not doing the job it was added for`)
  /* ROUTED, NOT SWALLOWED. The sentence at the top of this file — "Fine Grain
   * at 1.48, under the 2.0 perceptual floor" — is a `dOff` reading against a
   * `dInk` bar, so the number that was cited to justify the relief channel was
   * on the wrong scale. Printed here rather than quietly corrected, because the
   * relief is a shipped pick and the picture case for it (`_probe-relief-pick`,
   * "does the pattern read as a material") is separate from this arithmetic and
   * is Sebs's, not this gate's. Nothing here changes the channel. */
  const priorUnder = prior.filter((r) => r.dInk < FLOOR)
  console.log(
    `      note · on the floor's own scale the parked prior is ${priorUnder.length ? `under it on ${priorUnder.length} of ${prior.length}` : `OVER it on all ${prior.length}`} presets ` +
      `(weakest ${Math.min(...prior.map((r) => r.dInk)).toFixed(3)}) — so the 1.48 "under the floor" reading in this file's header was a whole-crop dOff quoted against an ink-masked bar. Not this gate's call to act on.`,
  )

  /* --- 3 · the relief may not reach the non-texture rails ----------------- */
  for (const [fam, id] of [["dither", "dotMatrix"], ["ascii", "terminalShade"]]) {
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(140)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), [fam, id])
    await setBump(0)
    await page.waitForTimeout(520)
    const a = await macro()
    await setBump(Math.max(shipped, 1) * 4)
    await page.waitForTimeout(520)
    const b = await macro()
    await setBump(shipped)
    const d = meanAbsDiff(a, b)
    rows.push({ arm: "cross-family", preset: id, dOff: +d.toFixed(5) })
    if (d === 0) pass(`${fam}/${id} is byte-identical across the relief's whole range — texture cannot reach the ${fam} rail (PRD §4 keeps them separate systems)`)
    else fail(`${fam}/${id} MOVED by ${d.toFixed(5)} when only the texture relief changed — the texture layer is leaking into the ${fam} layer`)
  }

  /* --- 4 · screen lock excluded by construction --------------------------- */
  await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
  await page.waitForTimeout(140)
  await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", "crosshatch"])
  await page.evaluate(() => window.__styleHarness.setStyle({ textureLockMode: "screen" }))
  await setBump(0)
  await page.waitForTimeout(520)
  const sa = await macro()
  await setBump(Math.max(shipped, 1) * 4)
  await page.waitForTimeout(520)
  const sb = await macro()
  await setBump(shipped)
  const sd = meanAbsDiff(sa, sb)
  rows.push({ arm: "screen-lock", preset: "crosshatch", dOff: +sd.toFixed(5) })
  if (sd === 0) pass("screen lock is byte-identical across the relief's whole range — an overlay printed on glass does not get physical relief")
  else fail(`screen lock MOVED by ${sd.toFixed(5)} under the relief — it is meant to be excluded by construction`)

  await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
  writeFileSync(join(OUT, "relief-gate.json"), JSON.stringify(rows, null, 2))
}

if (errors.length) { fail(`${errors.length} console error(s): ${errors.slice(0, 3).join(" | ")}`) }
else pass("no console errors")
await browser.close()
console.log(fails ? `\n${fails} FAILING ASSERTION(S)` : "\nALL ASSERTIONS PASS")
process.exit(fails ? 1 : 0)
