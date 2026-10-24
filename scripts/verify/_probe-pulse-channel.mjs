// WHICH UNIFORM WRITE CARRIES THE completionPulse EXPIRY POP (F86).
//
// F86 records a jolt at the instant a `completionPulse` expires — on the
// densest-ink crop, a live mean of 1.0918, then 9.3637 in the interval holding
// PULSE_LIFETIME, then exactly 0.0000 for 29 intervals. C2 routed the fix to
// the threshold-sweep gate (`ditT.active &&`), it was tried, and it moved the
// number by 0.005. So the channel is still unnamed and the block's writes have
// never been separated.
//
// THIS FILE IS A BISECT INSTRUMENT, NOT A GATE. It measures ONE cell —
// `dit_pulse`, the `completionPulseDither` preset on solid — across the expiry,
// and it prints the uniform values the renderer actually used on every frame
// next to the pixel delta they produced. An arm is a patched
// components/viewport-3d.tsx in a lane copy; the probe reads
// `styleClock().pulseArm` back out of the page so that "the edit was served" is
// a value on the report rather than a claim in the log.
//
// ⚠ WHY EVERY 0.0000 HERE IS SUSPECT UNTIL A POSITIVE CONTROL SAYS OTHERWISE.
// The one arm F86 leans on is C2's non-static control, which read 0.0000
// through the pulse AND at expiry. A crop that reads 0.0000 while the effect
// it is watching is provably animating is not a control, it is a blind
// instrument (silent-degradation §3: "an instrument that improves its own
// numbers by seeing less"). So this probe refuses to report a rest window
// before it has proved, on the same crop and in the same run, that
//   1 · the preset changes the crop at all      (dither ON vs OFF)
//   2 · the crop moves DURING the live pulse    (max live delta)
// Both are printed as `control.dOffInk` and `control.liveMax` and both have a
// floor. A blind arm fails here instead of contributing a confident zero.
//
// ── THE UNIFORM READBACK IS AN OPT-IN PATCH, AND ITS ABSENCE IS ANNOUNCED ──
// The pixel numbers below need nothing from the page. The `uniformStep` block —
// what `amount`, `time`, `intensity` and `threshold` actually were on the two
// frames the expiry spans — needs six lines that the shipped tree does not
// carry, because a shipped source file should not grow a debug channel for one
// bisect. Add them in a lane copy, at the end of the dither block in
// components/viewport-3d.tsx (find `d.uFsDitThreshold.value = styleState.ditherThreshold`,
// the else arm), plus the matching fields on STYLE_CLOCK_DEBUG:
//
//   STYLE_CLOCK_DEBUG.pulseArm = "<name of the arm you patched in>"
//   STYLE_CLOCK_DEBUG.ditAmount = ditT.amount
//   STYLE_CLOCK_DEBUG.ditActive = ditT.active
//   STYLE_CLOCK_DEBUG.ditTime = ditT.time
//   STYLE_CLOCK_DEBUG.ditIntensity = d.uFsDitIntensity.value
//   STYLE_CLOCK_DEBUG.ditThreshold = d.uFsDitThreshold.value
//
// Without them the probe SAYS SO on its own verdict line rather than printing a
// row of nulls that reads like a measurement.
//
// Usage:  FS_PORT=3133 FS_HEADED=0 node scripts/verify/_probe-pulse-channel.mjs \
//           --arm=shipped [--dir=static|horizontal|vertical|diagonal] [--out=<name>]
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { LAB_URL } from "./lib/dev-server.mjs"
import { loadTs } from "./_ts-load.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const ARM = arg("arm", "shipped")
const DIR = arg("dir", "static")
const OUT = join(ROOT, "docs", "verification", "pulse-channel")
mkdirSync(OUT, { recursive: true })

// THE LIFETIME IS READ OUT OF THE MODEL, never written down here — same reason
// verify-screen-layers.mjs gives: a gate holding its own copy of the constant
// it guards is the PEN_CARVE_ENVELOPE_R disease.
const { PULSE_LIFETIME } = loadTs("lib/style-clock.ts")

/* ---------- image helpers (verify-screen-layers.mjs's, unchanged) -------- */
let PAPER = 247
const INK_DELTA = 5
const isInk = (l) => Math.abs(l - PAPER) > INK_DELTA

async function lumOf(buf) {
  const img = await loadImage(buf)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  const L = new Float32Array(img.width * img.height)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    L[p] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  }
  return { L, w: img.width, h: img.height }
}
function metrics(a) {
  const { L } = a
  let n = 0, sum = 0, sum2 = 0
  for (let i = 0; i < L.length; i++) {
    if (isInk(L[i])) { n++; sum += L[i]; sum2 += L[i] * L[i] }
  }
  if (!n) return { ink: 0, mean: 0, sd: 0 }
  const mean = sum / n
  return {
    ink: +(n / L.length).toFixed(3),
    mean: +mean.toFixed(1),
    sd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1),
  }
}
function meanAbsDiff(a, b) {
  let s = 0
  const n = Math.min(a.L.length, b.L.length)
  for (let i = 0; i < n; i++) s += Math.abs(a.L[i] - b.L[i])
  return +(s / n).toFixed(4)
}
/* The ink-masked scale, `diff-frames.mjs`'s mask: either frame has ink. The
 * mask SIZE is returned with it — a ratio whose denominator is not printed is
 * how dOff got quoted against the wrong floor for a month. */
function meanAbsDiffInk(a, b) {
  let s = 0, n = 0
  const len = Math.min(a.L.length, b.L.length)
  for (let i = 0; i < len; i++) {
    if (!isInk(a.L[i]) && !isInk(b.L[i])) continue
    s += Math.abs(a.L[i] - b.L[i]); n++
  }
  return { dInk: n ? +(s / n).toFixed(4) : 0, maskFrac: +(n / len).toFixed(3) }
}

const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false, ditherDirection: "static",
  asciiEnabled: false, asciiAnimated: false, asciiAnimationType: "none",
  fusionPreset: "none", layerStackEnabled: false,
  stackAnimationEnabled: false, materialAnimationEnabled: false,
  motionMode: "off",
}
function testStroke() {
  const pts = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    pts.push({
      x: 110 + t * 640,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24,
    })
  }
  return [pts]
}

async function main() {
  const browser = await chromium.launch({ headed: true, label: "pulse-channel" })
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200)) })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
    null, { timeout: 60000 })
  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 }), testStroke())
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.__revealHarness.setProgress(1.0))

  const setStyle = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const selectPreset = (f, i) => page.evaluate(([a, b]) => window.__styleHarness.selectPreset(a, b), [f, i])
  const clockOf = () => page.evaluate(() => window.__geomDebug.styleClock())

  await page.evaluate(() => window.__styleHarness.setMode("solid"))
  await page.waitForTimeout(1200)
  /* THE FRAMING'S ANSWER IS READ, NOT DROPPED. `frontView` returns a boolean and
   * a REFUSED framing leaves the camera exactly where it was, so every frame
   * after it belongs to the previous pose — which on a bisect means naming a
   * uniform with complete confidence off the wrong arm's pixels. Same defect
   * `_probe-view-floor.mjs` shipped with `orbitView` earlier today. */
  const framed = await page.evaluate(() => window.__captureHarness.frontView(0.95))
  if (framed !== true) {
    throw new Error(
      `__captureHarness.frontView(0.95) returned ${JSON.stringify(framed)} rather than true — ` +
        `the camera was NOT reframed, so every crop below would be taken from the previous pose.`,
    )
  }
  await page.waitForTimeout(600)
  await setStyle({ ...OFF })
  await page.waitForTimeout(400)

  /* ---- crop, located on a real frame exactly as the capture does -------- */
  const boxes = await page.$$eval("canvas", (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
  const box = boxes.reduce((a, x) => (x.x > a.x ? x : a))
  if (box.width < 300) throw new Error("3D canvas not found: " + JSON.stringify(boxes))
  const rectOf = (fx, fy, fw, fh) => ({
    x: box.x + box.width * fx, y: box.y + box.height * fy,
    width: box.width * fw, height: box.height * fh,
  })
  const shotRect = (r) => page.screenshot({ clip: r })

  const full = await shotRect(rectOf(0, 0, 1, 1))
  const { L, w, h } = await lumOf(full)
  const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97)
  const Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
  {
    const hist = new Float64Array(256)
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) hist[Math.max(0, Math.min(255, Math.round(L[y * w + x])))]++
    let best = 0
    for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
    PAPER = best
  }
  if (PAPER < 200) throw new Error(`paper measured at ${PAPER}, not on the stage`)
  const colN = new Int32Array(w), rowN = new Int32Array(h)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isInk(L[y * w + x])) { colN[x]++; rowN[y]++ }
  const colMin = (Y1 - Y0) * 0.04, rowMin = (X1 - X0) * 0.04
  let x0 = -1, x1 = -1, y0 = -1, y1 = -1
  for (let x = X0; x < X1; x++) if (colN[x] > colMin) { if (x0 < 0) x0 = x; x1 = x }
  for (let y = Y0; y < Y1; y++) if (rowN[y] > rowMin) { if (y0 < 0) y0 = y; y1 = y }
  if (x1 < 0 || y1 < 0) throw new Error("no ink found in 3D canvas")
  const NB = 48, bw = (x1 - x0) / NB, bh = (y1 - y0) / NB
  const cov = new Float32Array(NB * NB)
  for (let y = y0; y <= y1; y++) {
    const by = Math.min(NB - 1, Math.floor((y - y0) / bh))
    for (let x = x0; x <= x1; x++) if (isInk(L[y * w + x])) cov[by * NB + Math.min(NB - 1, Math.floor((x - x0) / bw))]++
  }
  let bestS = -1, bx = 0, by = 0
  const W = 5
  for (let r = 0; r + W <= NB; r++) for (let c = 0; c + W <= NB; c++) {
    let s = 0
    for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) s += cov[(r + rr) * NB + c + cc]
    if (s > bestS) { bestS = s; bx = c; by = r }
  }
  const iw = (x1 - x0) / w, ih = (y1 - y0) / h
  const mx = (x0 + (bx + W / 2) * bw) / w, my = (y0 + (by + W / 2) * bh) / h
  const mw = iw * 0.15, mh = mw * 0.72
  const MACRO = rectOf(mx - mw / 2, my - mh / 2, mw, mh)
  const macro = () => shotRect(MACRO)

  const offFrame = await lumOf(await macro())
  const offM = metrics(offFrame)
  if (offM.ink < 0.12) throw new Error(`macro crop is off the form (ink ${offM.ink})`)
  if (offM.sd < 1.5) throw new Error(`macro crop is a flat field (sd ${offM.sd})`)

  /* ---- the arm ---------------------------------------------------------- */
  await selectPreset("animatedDither", "completionPulseDither")
  if (DIR !== "static") await setStyle({ ditherDirection: DIR })
  await page.waitForTimeout(600)

  const armSeen = (await clockOf()).pulseArm ?? null
  const styleNow = await page.evaluate(() => window.__styleHarness.get().styleState)

  /* CONTROL 1 · the preset changes this crop at all. Without this, an arm that
   * simply failed to select the preset reads "0.0000 everywhere" and looks like
   * proof that the channel is elsewhere. */
  const onFrame = await lumOf(await macro())
  const dOff = meanAbsDiffInk(offFrame, onFrame)

  /* ---- the clip: replay the draw-in, then hold across the expiry -------- */
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.waitForTimeout(200)
  const rows = []
  const lums = []
  const t0 = Date.now()
  let completed = false
  for (let i = 0; ; i++) {
    if (!completed) {
      const p = Math.min(1, i / 14)
      await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
      if (p >= 1) completed = true
    }
    const b = await macro()
    const c = await clockOf()
    lums.push(await lumOf(b))
    rows.push({
      i,
      ms: Date.now() - t0,
      sinceCompletion: Number.isFinite(c.sinceCompletion) ? +c.sinceCompletion.toFixed(4) : null,
      reveal: +(c.reveal ?? 0).toFixed(3),
      // Published by the bisect patch; null on an unpatched tree.
      ditAmount: c.ditAmount ?? null,
      ditActive: c.ditActive ?? null,
      ditTime: c.ditTime ?? null,
      ditIntensity: c.ditIntensity ?? null,
      ditThreshold: c.ditThreshold ?? null,
    })
    if (completed && rows[rows.length - 1].sinceCompletion !== null &&
        rows[rows.length - 1].sinceCompletion >= PULSE_LIFETIME + 0.8) break
    if (i > 400) break
  }

  const deltas = []
  for (let i = 1; i < lums.length; i++) deltas.push(meanAbsDiff(lums[i - 1], lums[i]))

  /* THE EXPIRY INTERVAL, PICKED BY THE MODEL'S OWN LIFETIME AND THIS RUN'S OWN
   * CLOCK — the interval `[s_i, s_{i+1}]` that CONTAINS PULSE_LIFETIME. Not an
   * index fraction, and not the right-hand end: F86's sibling note in
   * verify-screen-layers.mjs records both of those getting it wrong. */
  let expiryIdx = -1
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i].sinceCompletion, b = rows[i + 1].sinceCompletion
    if (a === null || b === null) continue
    if (a < PULSE_LIFETIME && b >= PULSE_LIFETIME) { expiryIdx = i; break }
  }
  const liveTail = expiryIdx > 0 ? deltas.slice(Math.max(0, expiryIdx - 6), expiryIdx) : []
  const rest = expiryIdx >= 0 ? deltas.slice(expiryIdx + 1) : []
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4) : null)
  const liveMax = liveTail.length ? Math.max(...liveTail) : 0

  const out = {
    arm: ARM,
    armSeenInPage: armSeen,
    ditherDirection: styleNow.ditherDirection,
    ditherType: styleNow.ditherType,
    ditherAnimated: styleNow.ditherAnimated,
    ditherSyncMode: styleNow.ditherSyncMode ?? null,
    pulseLifetimeSec: +PULSE_LIFETIME.toFixed(4),
    frames: lums.length,
    frameSec: +(((Date.now() - t0) / lums.length) / 1000).toFixed(4),
    control: { dOffInk: dOff.dInk, dOffMaskFrac: dOff.maskFrac, liveMax: +liveMax.toFixed(4) },
    liveTailMean: mean(liveTail),
    liveTail: liveTail,
    expiryIndex: expiryIdx,
    expiryDelta: expiryIdx >= 0 ? deltas[expiryIdx] : null,
    expirySinceCompletion: expiryIdx >= 0 ? [rows[expiryIdx].sinceCompletion, rows[expiryIdx + 1].sinceCompletion] : null,
    restMean: mean(rest),
    restFrames: rest.length,
    ratio: expiryIdx >= 0 && mean(liveTail) ? +(deltas[expiryIdx] / mean(liveTail)).toFixed(2) : null,
    uniformStep: null,
    rows,
    deltas,
    errors,
  }
  // The uniform values on the two frames the expiry interval spans, when the
  // page publishes them.
  if (expiryIdx >= 0 && rows[expiryIdx].ditAmount !== null) {
    const a = rows[expiryIdx], b = rows[expiryIdx + 1]
    out.uniformStep = {
      before: { amount: a.ditAmount, active: a.ditActive, time: a.ditTime, intensity: a.ditIntensity, threshold: a.ditThreshold },
      after: { amount: b.ditAmount, active: b.ditActive, time: b.ditTime, intensity: b.ditIntensity, threshold: b.ditThreshold },
      dAmount: +(b.ditAmount - a.ditAmount).toFixed(5),
      dTime: +(b.ditTime - a.ditTime).toFixed(5),
      dIntensity: +(b.ditIntensity - a.ditIntensity).toFixed(5),
      dThreshold: +(b.ditThreshold - a.ditThreshold).toFixed(5),
    }
  }

  const name = arg("out", ARM)
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(out, null, 2))

  /* ---- verdict ---------------------------------------------------------- */
  console.log(`\narm=${ARM}  page reports pulseArm=${armSeen}  direction=${out.ditherDirection}  frames=${out.frames} @ ${out.frameSec}s`)
  console.log(`CONTROL  the preset changes this crop  dOffInk ${out.control.dOffInk} over mask ${out.control.dOffMaskFrac}`)
  console.log(`CONTROL  the crop moves during the live pulse  liveMax ${out.control.liveMax}`)
  let bad = 0
  if (out.control.dOffInk < 1.0) { console.log(`FAIL  the crop cannot see this preset at all (dOffInk ${out.control.dOffInk}) — every zero below is blindness, not evidence`); bad++ }
  if (out.control.liveMax < 0.05) { console.log(`FAIL  the crop never moved during the live pulse (liveMax ${out.control.liveMax}) — this arm measures nothing`); bad++ }
  if (expiryIdx < 0) { console.log(`FAIL  no interval spans PULSE_LIFETIME (${PULSE_LIFETIME.toFixed(3)}s) — the clip never held the expiry`); bad++ }
  console.log(`live tail mean ${out.liveTailMean}   EXPIRY ${out.expiryDelta}   rest mean ${out.restMean} over ${out.restFrames}   ratio ${out.ratio}x`)
  if (armSeen === null) {
    console.log(
      `NOTE  this tree does not publish the uniform readback, so uniformStep is absent rather than ` +
        `zero, and nothing here can name WHICH uniform stepped — only how far the picture moved. ` +
        `See the header for the six lines that turn it on in a lane copy.`,
    )
  }
  if (out.uniformStep) {
    const u = out.uniformStep
    console.log(`uniforms across the expiry interval:  amount ${u.before.amount} -> ${u.after.amount} (${u.dAmount})   ` +
      `intensity ${u.before.intensity} -> ${u.after.intensity} (${u.dIntensity})   ` +
      `threshold ${u.before.threshold} -> ${u.after.threshold} (${u.dThreshold})   ` +
      `time ${u.before.time} -> ${u.after.time} (${u.dTime})`)
  }
  if (errors.length) console.log(`page errors (${errors.length}): ${errors.slice(0, 3).join(" | ")}`)
  console.log(`json: ${join(OUT, `${name}.json`).replace(ROOT + "/", "")}`)

  await ctx.close()
  await browser.close()
  process.exit(bad ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
