// SCREEN-SPACE STYLE LAYER RAILS — "does each option do anything, and is it
// different from the option next to it?"
//
// WHY THIS EXISTS AND WHY IT IS NOT verify-style-craft.mjs:
//
// verify-style-craft.mjs judges the three MACHINES (texture / dither / ascii)
// by driving their raw parameters at one harness-chosen setting. That answers
// "can this shader make a pattern". It cannot answer the question Sebs is
// actually asking, because it never renders a rail preset on the material that
// preset will actually be sitting on.
//
// A rail preset writes ONLY its own family's fields. The material comes from
// whatever mode the user is in:
//
//     rod -> ink            extrude -> glossyPlastic
//     solid -> matteClay    inflate -> softGel
//
// Those four surfaces sit at very different luminances, and every screen layer
// is a TONE-DRIVEN quantiser. So the honest test bed is: real preset, real
// per-mode default material, all four modes. That is what this script shoots.
//
// WHAT IT MEASURES, beyond "did pixels change":
//   dOff      mean |Δ| against the same frame with every layer off, over the
//             WHOLE crop. Kept unchanged so every stored label stays readable.
//   dInk      the same difference over the pixels where EITHER frame has ink.
//
//             ⚠ dInk EXISTS BECAUSE dOff IS NOT COMPARABLE ACROSS MODES, AND
//             THE 2.0 FLOOR QUOTED AGAINST IT WAS NEVER MEASURED ON ITS SCALE.
//             The floor comes from scripts/verify/diff-frames.mjs, whose own
//             first sentence is that it computes the mean "over pixels where
//             either frame has ink (alpha > 20)". This file divided by every
//             pixel in the crop instead, paper included — and the texture,
//             dither and ASCII layers only ever touch the form. Measured over
//             the 132 graded rows of the 2026-09-04 capture, paper contributes
//             0.000-0.032 of a delta whose ink value is 14-90, so
//             dOff = dInk x (ink fraction) to three decimals, and the ink
//             fraction is a property of the MODE, not of the effect:
//
//                 rod 0.131 · extrude 0.326 · solid 0.343 · inflate 0.485
//
//             Rod's dOff sits 1/0.131 = 7.6x below its own ink value where
//             Inflate's sits only 2.1x below, so the identical effect is scored
//             3.7x lower on Rod than on Inflate for no reason but the rod being
//             thin, and one absolute floor across four modes is therefore four
//             different bars. That is what
//             made rod/texture/fineGrain read "does nothing" at dOff 1.917
//             while reading 14.579 on the floor's own scale — 7.3x over — and
//             while being plainly speckled next to the OFF crop by eye.
//             Every OTHER field in this row (ink, mean, sd, edge, levels) was
//             already ink-masked through `metrics()`. dOff alone was not, and
//             dOff alone is the one with a floor quoted against it.
//
//             THE BAR DID NOT MOVE — it is still 2.0, and it still reddens.
//             Calibrated 2026-09-04 on Rod with the option present and dead
//             (textureIntensity 0): dInk 0.000 on 12 of 12 presets. The
//             relief-parked prior (uFsTexBump 0) reads dInk 8.357 on fineGrain
//             and is NOT caught here — it is not this row's question, and
//             `assert-texture-relief.mjs` owns it with a comparative arm
//             (+2.50 dOff shipped over parked) that cancels the dilution.
//   sd        luminance σ over the ink region — is there structure at all.
//   edge      mean |Δ| between horizontally adjacent pixels inside the ink.
//             Separates a REAL pattern from a soft tonal wash: a wash has σ
//             but no edge energy.
//   levels    how many 1/16 luminance buckets the ink actually occupies.
//             1-2 levels = the form has been flattened into a silhouette.
//   nnDist    distance to the NEAREST SIBLING in the same rail. Low => the
//             two presets are the same look under two names. This is the
//             measurement nothing in this repo had: an effect can pass
//             "it changed pixels" and still be redundant.
//
// Usage:
//   node scripts/verify/verify-screen-layers.mjs --label=before
//   node scripts/verify/verify-screen-layers.mjs --label=after --only=motion
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import ffmpegPath from "ffmpeg-static"
import { execFileSync } from "node:child_process"
import { writeFileSync, mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
/* REFUSE THE FRAME, NOT THE WINDOW.
 *
 * This is the one file where the blank was actually observed (explainer 27 §5:
 * rest Δ 5.931 turned out to be `65.241 / 11`, one frame, and that frame was
 * blank paper at mean luminance 252.171). Lane O then measured whether a headed
 * capture reproduces it — 3 arms x 8 s, 2 arms x 180 s, and both arms of this
 * tool — and it did not, on that machine, that night. Its recommendation was
 * therefore NOT to flip anything, because flipping changes what 28 tools record,
 * but to make a capture unable to file a frame that carries nothing:
 *
 *   *"refuse the frame rather than the window — a blank/frozen guard on the
 *    capture path fails whether or not the throttle reproduces, restages no
 *    stored evidence, and would have caught the original defect at the time."*
 *
 * The guard is ADDITIVE. It reads the buffer this file was already going to
 * write, writes nothing into the evidence sequence, changes no timing, no crop,
 * no camera and no report field that `assert-screen-layers` grades. What it adds
 * is a refusal and a sibling `frame-guard.json`. */
import { createFrameGuard, FrameRefused } from "./lib/frame-guard.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

/* THE PULSE'S OWN LIFETIME, READ OUT OF THE MODEL — never written down here.
 *
 * `PULSE_LIFETIME = PULSE_ATTACK_SECONDS + PULSE_DECAY_SECONDS · ln(1/PULSE_CUTOFF)`
 * is exported by `lib/style-clock.ts`. Move any of those three constants and the
 * rest window below moves with it; keep a copy here and this file becomes the
 * `PEN_CARVE_ENVELOPE_R` disease — a gate holding its own stale copy of the
 * number it guards. */
const { PULSE_LIFETIME } = loadTs("lib/style-clock.ts")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const LABEL = arg("label", "before")
const ONLY = arg("only", "all")
const MODES = arg("modes", "solid,extrude,rod,inflate").split(",")
const OUT = join(ROOT, "docs", "verification", "screen-layers", LABEL)
const SHEETS = join(OUT, "sheets")
const CROPS = join(OUT, "crops")
const VIDEO = join(OUT, "video")
const TMP = join(OUT, ".frames")
for (const d of [OUT, SHEETS, CROPS, VIDEO]) mkdirSync(d, { recursive: true })

/* Rails exactly as the UI lists them. */
const RAILS = {
  dither: ["bayerClassic", "dotMatrix", "hardThreshold", "softDither", "pixelSignal"],
  animatedDither: ["ditherCrawl", "thresholdSweep", "revealDither", "completionPulseDither", "diagonalMatrixDrift"],
  ascii: ["terminalShade", "binarySkin", "blockGlyph", "codeMarks", "sparseGlyph"],
  animatedAscii: ["glyphScroll", "asciiRain", "characterCycle", "revealGlyphs", "terminalFlicker", "slowCodeCrawl"],
  texture: ["fineGrain", "scanlines", "contourBands", "scratchedInk", "gelBubbles", "crosshatch",
    "inkDots", "woodgrain", "cellular", "brushedSteel", "craquelure", "interference"],
}

/* Animated presets get frames + video. Reveal-driven ones are captured ACROSS
 * A REAL DRAW-IN, not at rest — a reveal-synced effect at playhead 1 is
 * supposed to be finished, so shooting it at rest proves nothing either way. */
const MOTION = [
  { key: "dit_crawl", family: "animatedDither", preset: "ditherCrawl", reveal: false },
  { key: "dit_sweep", family: "animatedDither", preset: "thresholdSweep", reveal: false },
  { key: "dit_reveal", family: "animatedDither", preset: "revealDither", reveal: true },
  { key: "dit_pulse", family: "animatedDither", preset: "completionPulseDither", reveal: true },
  { key: "dit_diag", family: "animatedDither", preset: "diagonalMatrixDrift", reveal: false },
  { key: "asc_scroll", family: "animatedAscii", preset: "glyphScroll", reveal: false },
  { key: "asc_rain", family: "animatedAscii", preset: "asciiRain", reveal: false },
  { key: "asc_cycle", family: "animatedAscii", preset: "characterCycle", reveal: false },
  { key: "asc_reveal", family: "animatedAscii", preset: "revealGlyphs", reveal: true },
  { key: "asc_flicker", family: "animatedAscii", preset: "terminalFlicker", reveal: false },
  { key: "asc_crawl", family: "animatedAscii", preset: "slowCodeCrawl", reveal: false },
  /* THE REVEAL WITH NO EFFECT ON IT — the control the strobe statistic never had.
   *
   * On a reveal-driven cell the frame-to-frame delta is (new ink arriving) PLUS
   * (the effect moving), and the strobe predicate `sd > mean with a zero floor`
   * cannot tell those apart. It fired on `dit_reveal`, `dit_pulse` AND
   * `asc_reveal` — three of the four reveal cells in the sweep — which is either
   * three broken presets or a statistic reading the draw. This cell answers that
   * by running the identical ramp with EVERY style rail off, so whatever it
   * reads is the draw alone. `family: null` means "select nothing". */
  { key: "reveal_control", family: null, preset: null, reveal: true },
]

const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false, ditherDirection: "static",
  asciiEnabled: false, asciiAnimated: false, asciiAnimationType: "none",
  fusionPreset: "none", layerStackEnabled: false,
  stackAnimationEnabled: false, materialAnimationEnabled: false,
  motionMode: "off",
}

/* One broad loop with tight turns: every crop gets both a wide face (where a
 * pattern has room) and a narrow limb (where a too-large cell stops reading). */
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

/* ---------- image helpers ------------------------------------------------ */
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

/** INK IS PAPER-RELATIVE, not "darker than 232".
 *
 *  The four per-mode default materials do not share a value range: Soft Gel
 *  (inflate's default) renders at luminance ~230 against ~247 paper, so a fixed
 *  232 cut-off classifies almost the entire Inflate form as background — the
 *  first run of this script located "no ink" on a frame that plainly has a
 *  stroke in it. A screen layer can also LIFT cells above paper, and those
 *  pixels are part of the effect. So: measure the paper, and call anything far
 *  enough from it in EITHER direction ink.
 *
 *  DELTA = 5 on 0..255 is just above the frame-to-frame noise of the renderer
 *  and comfortably below the faintest real material contrast measured here. */
let PAPER = 247
const INK_DELTA = 5
const isInk = (l) => Math.abs(l - PAPER) > INK_DELTA

function metrics(a) {
  const { L, w, h } = a
  let n = 0, sum = 0, sum2 = 0
  const hist = new Float64Array(16)
  for (let i = 0; i < L.length; i++) {
    if (isInk(L[i])) {
      n++; sum += L[i]; sum2 += L[i] * L[i]
      hist[Math.min(15, Math.floor((L[i] / 256) * 16))]++
    }
  }
  if (!n) return { ink: 0, mean: 0, sd: 0, edge: 0, levels: 0 }
  const mean = sum / n
  // horizontal neighbour difference, ink pixels only
  let e = 0, en = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x + 1 < w; x++) {
      const i = y * w + x
      if (isInk(L[i]) && isInk(L[i + 1])) { e += Math.abs(L[i] - L[i + 1]); en++ }
    }
  }
  let levels = 0
  for (let b = 0; b < 16; b++) if (hist[b] / n > 0.005) levels++
  return {
    ink: +(n / L.length).toFixed(3),
    mean: +mean.toFixed(1),
    sd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1),
    edge: +(en ? e / en : 0).toFixed(2),
    levels,
  }
}

function meanAbsDiff(a, b) {
  let s = 0
  const n = Math.min(a.L.length, b.L.length)
  for (let i = 0; i < n; i++) s += Math.abs(a.L[i] - b.L[i])
  return +(s / n).toFixed(3)
}

/* The same difference on the scale the 2.0 floor was actually measured on: the
 * mean over pixels where EITHER frame has ink. See this file's header.
 *
 * EITHER, not "ink in the OFF frame". `diff-frames.mjs` masks on
 * `a.alpha >= 20 || b.alpha >= 20` and the reason shows up on the other two
 * rails: an ASCII glyph grid and a spreading halftone dot both put ink OUTSIDE
 * the silhouette they started from, and a mask taken from the before-frame
 * alone would score that new ink as if it were paper — i.e. it would hide the
 * effect it is there to measure. Returns the mask size too, because a ratio
 * whose denominator is not printed is how dOff got quoted against the wrong
 * floor for a month. */
function meanAbsDiffInk(a, b) {
  let s = 0, n = 0
  const len = Math.min(a.L.length, b.L.length)
  for (let i = 0; i < len; i++) {
    if (!isInk(a.L[i]) && !isInk(b.L[i])) continue
    s += Math.abs(a.L[i] - b.L[i])
    n++
  }
  return { dInk: n ? +(s / n).toFixed(3) : 0, inkMaskFrac: +(n / len).toFixed(3) }
}

async function main() {
  /* HEADLESS IS AN OPT-IN, NOT A NEW DEFAULT (added 2026-08-01 by the texture
   * lane). docs/DISPATCH.md §3 records headless as Sebs's preference and as
   * measured-equivalent (121 rAF ticks headless vs 120 headed, identical
   * renderer string), and this script is the one capture that still opened a
   * window on his screen. The DEFAULT is left at headed deliberately: every
   * baseline already on disk under docs/verification/screen-layers/ was shot
   * headed, and silently changing the bed would make an old label and a new one
   * look comparable when they are not. Set SL_HEADLESS=1 and shoot BOTH arms
   * of your own comparison that way.
   *
   * ── 🔴 2026-08-07 · HOW THIS LINE LAUNCHES IS NOT THIS LANE'S TO CHANGE ────
   * Lane R measured three separate things wrong with this line AS A CONTROL
   * SURFACE, and only the first is the stale default: (1) it defaults headed, so
   * the safe outcome requires an action; (2) it COMPUTES the flag, so it is
   * invisible to every `headless: false` census — this file was missing from
   * Lane J's survey of 48 headed launchers and had to be found by reading
   * (explainer 37 §3.1: *"the census is scoped by a spelling"*); (3) the name is
   * PRIVATE to this file, so a controller wanting a headless fleet has to know
   * 49 different spellings and setting the wrong one fails SILENTLY — the exact
   * defect `lib/dev-server.mjs` exists to prevent one knob over.
   *
   * R's additive `FS_HEADLESS` override is PARKED, not landed, at
   * `docs/verification/unfinished-lane-R/scripts/verify/verify-screen-layers.mjs:267-281`.
   * It is deliberately withheld because **the launch conversion is Lane V's, and
   * two live lanes may never hold the same concern** (DISPATCH §4). Fixing one
   * file out of 49 by hand is also the wrong shape: the structural answer is a
   * shared `scripts/verify/lib/browser.mjs` that every capture imports, holding
   * `--use-angle=metal` and the headless decision in ONE place, plus an
   * `assert-one-knob`-shaped channel that fails any capture naming its own
   * launch options — exactly what `dev-server.mjs` did for the port. Then a tool
   * that opts out is a red row rather than a window on Sebs's screen.
   *
   * ── ✅ 2026-08-07 · LANE V · IT IS NOW THAT SHARED MODULE ─────────────────
   * `scripts/verify/lib/browser.mjs` exists and this call goes through it, along
   * with 189 others. All three of R's findings are closed, and none of them was
   * closed by flipping this file:
   *   (1) the DEFAULT stays HEADED. `headed: true` is byte-identically what an
   *       unset environment did before, so not one frame under
   *       docs/verification/screen-layers/ is restaged and the default flip
   *       remains Sebs's call (explainer 37 §6 — "flipping a tool changes what
   *       it records").
   *   (2) the flag is no longer COMPUTED here, so this file is no longer
   *       invisible to a census. `assert-one-browser.mjs` channel C fails ANY
   *       script under scripts/verify that names `headless` at all — and this
   *       exact line, restored, is that gate's headline known-bad.
   *   (3) the name is no longer PRIVATE. `SL_HEADLESS` now THROWS from the
   *       shared module with the replacement command, and one knob — `FS_HEADED=0`
   *       — makes the whole fleet headless whatever any call site asks for.
   *       A controller no longer has to know 50 spellings. */
  const browser = await chromium.launch({ headed: true })
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  /* Retried: a Fast Refresh between waitForFunction and the next call takes the
   * harness away again, and the bootstrap is the most reload-prone stretch of
   * the run because it is the longest gap without a page interaction. */
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(
        () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
        null, { timeout: 60000 })
      await page.evaluate((poly) => {
        window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
      }, testStroke())
      await page.waitForTimeout(1600)
      await page.evaluate(() => window.__revealHarness.setProgress(1.0))
      break
    } catch (e) {
      if (attempt >= 4) throw e
      console.log("[layers] bootstrap retry", attempt + 1)
      await page.waitForTimeout(1500)
    }
  }

  /* HOT-RELOAD RESILIENCE. This runs against the live dev server while other
   * work is going on in the tree, and a Fast Refresh remounts the page —
   * `window.__styleHarness` disappears and the next call throws mid-sweep,
   * losing the run. Re-establish the whole test bed instead of dying. */
  let currentMode = null
  async function ensureHarness() {
    const ok = await page.evaluate(() => !!window.__styleHarness).catch(() => false)
    if (ok) return false
    console.log("[layers] harness vanished (hot reload) — re-establishing")
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null, { timeout: 60000 })
    await page.evaluate((poly) => {
      window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
    }, testStroke())
    await page.waitForTimeout(1600)
    await page.evaluate(() => window.__revealHarness.setProgress(1.0))
    if (currentMode) {
      await page.evaluate((m) => window.__styleHarness.setMode(m), currentMode)
      await page.waitForTimeout(1200)
      await page.evaluate(() => window.__captureHarness.frontView(0.95))
      await page.waitForTimeout(500)
    }
    return true
  }
  const setStyle = async (p) => {
    await ensureHarness()
    await page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  }
  const selectPreset = async (fam, id) => {
    await ensureHarness()
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), [fam, id])
  }
  const setMode = async (mode) => {
    await ensureHarness()
    currentMode = mode
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(1200)
    await page.evaluate(() => window.__captureHarness.frontView(0.95))
    await page.waitForTimeout(500)
  }

  /* 🔴 THE CROP IS RE-MEASURED, BECAUSE THE VIEWPORT MOVES UNDER IT.
   *
   * This used to be measured ONCE, before the first capture, and every crop for
   * the rest of the run was taken from it. The viewport is a flex child whose
   * size depends on which config strip the current mode is showing — this is
   * `viewport-3d.tsx`'s own `stillSize` comment, and explainer 35 §2.2 measured
   * the consequence at exactly 40 px, on a different tool, from the other side.
   *
   * MEASURED HERE, mid-run, by the refusal that found it:
   *
   *   the crop this run had been using since startup   x 750.5  y  92  h 858
   *   the canvas on the page at that moment            x 751    y 132  h 818
   *
   * So the tool was photographing a rectangle whose top 40 px is page chrome and
   * which stops 40 px short of the form. That is enough to put the macro crop on
   * blank paper: the frames that came back were 422 bytes, pure white, sigma 0 —
   * the 27 §5 signature arriving through a completely different door, with no
   * headed window and no throttle anywhere near it.
   *
   * It is the same sentence as explainer 35's: an instrument that resolves its
   * subject by POSITION will eventually resolve a different one.
   *
   * ── 🔴 AND THE FIX IS DIAGNOSED HERE BUT DELIBERATELY NOT APPLIED ──────────
   * Re-cropping to the live rectangle is the correct repair and it is ONE WORD
   * away (`apply: true` in the `reframe()` call below). It is withheld because
   * of what it would cost, which is a thing a lane may not spend:
   *
   *   `assert-screen-layers` grades `crops/<mode>_<rail>_<preset>_macro.png` and
   *   `report.json`, and BOTH come out of `rectOf()`. A label re-shot with the
   *   fix in place is cropped up to 40 px differently from one shot before it.
   *   Stored labels stay untouched and internally consistent, but a NEW label
   *   would no longer be comparable to `final/` — which is exactly the reason
   *   Lane O gave for not flipping the headless default, and it is a call above
   *   a lane (explainer 37 §6).
   *
   * So the measurement runs and REPORTS, and the crop does not move. `apply`
   * is the whole switch: `true` writes the new rectangle, `false` measures the
   * drift, prints it, and leaves the bed exactly where it was. Startup passes
   * `true` because that is the measurement this file has always taken; every
   * later call passes `false`.
   *
   * That split is not a compromise — it is what makes the defect FALSIFIABLE
   * without restaging anything. Before this, `box` was measured once at
   * `:298-300` and every crop for the rest of the run came from it, and no run
   * could say whether it had drifted. Now every run says so, in the log and in
   * the throw, and the controller can decide about the bed with the drift in
   * front of them rather than as an argument. */
  let box = null
  async function measureBox({ apply = false } = {}) {
    // Right-hand canvas is the 3D viewport; the left one is the 2D ink pad.
    const boxes = await page.$$eval("canvas", (els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
    const b = boxes.reduce((a, x) => (x.x > a.x ? x : a))
    if (b.width < 300) throw new Error("3D canvas not found: " + JSON.stringify(boxes))
    const drift =
      box && (Math.abs(b.x - box.x) > 0.5 || Math.abs(b.y - box.y) > 0.5 ||
        Math.abs(b.width - box.width) > 0.5 || Math.abs(b.height - box.height) > 0.5)
        ? `${JSON.stringify(box)} -> ${JSON.stringify(b)}`
        : null
    if (drift) {
      console.log(
        `[layers] ⚠ the 3-D viewport MOVED under the crop — ${drift}; ` +
          (apply
            ? `re-cropping`
            : `NOT re-cropping (the crop is the graded bed; see the note at this function). ` +
              `Every frame from here on is cropped to the STARTUP rectangle, which is now wrong.`),
      )
    }
    if (apply) box = b
    return { box: b, drift }
  }
  await measureBox({ apply: true })
  const rectOf = (fx, fy, fw, fh) => ({
    x: box.x + box.width * fx, y: box.y + box.height * fy,
    width: box.width * fw, height: box.height * fh,
  })
  const shotRect = (r) => page.screenshot({ clip: r })
  /* WHAT THE PAGE SAYS IT IS SHOWING, so a refusal can name its subject.
   * Lane M's census (explainer 35 §3): `grabInfo()` reports the viewport
   * canvas's backing-buffer size and, critically, whether the old
   * position-based resolution (`querySelector("canvas")`, first in document
   * order) still agrees with the ref that names the canvas by identity. This
   * file crops the page rather than calling `grab()`, so the census is about
   * the SUBJECT rather than about the bytes — which is the half that was
   * missing when seven frames came back at the wrong width and nothing said so.
   * Absent on an older build: recorded as null, never faked. */
  const grabInfo = () =>
    page
      .evaluate(() =>
        window.__captureHarness?.grabInfo ? window.__captureHarness.grabInfo() : null,
      )
      .catch(() => null)

  /** Locate the ink, and the densest patch of it, from a real frame. */
  async function locate() {
    const full = await shotRect(rectOf(0, 0, 1, 1))
    const { L, w, h } = await lumOf(full)
    const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97)
    const Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
    // PAPER = the modal luminance of the stage. Measured rather than assumed:
    // the stage carries a faint grid, and the paper tone is what everything
    // else is judged against.
    {
      const hist = new Float64Array(256)
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
        hist[Math.max(0, Math.min(255, Math.round(L[y * w + x])))]++
      }
      let best = 0
      for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
      PAPER = best
    }
    const colN = new Int32Array(w), rowN = new Int32Array(h)
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
      if (isInk(L[y * w + x])) { colN[x]++; rowN[y]++ }
    }
    // 4% of the span, not 1.2%: the stage grid lines are 1-2px wide and a
    // paper-relative ink test now sees them, so a 1.2% floor would return the
    // whole stage as "ink".
    const colMin = (Y1 - Y0) * 0.04, rowMin = (X1 - X0) * 0.04
    let x0 = -1, x1 = -1, y0 = -1, y1 = -1
    for (let x = X0; x < X1; x++) if (colN[x] > colMin) { if (x0 < 0) x0 = x; x1 = x }
    for (let y = Y0; y < Y1; y++) if (rowN[y] > rowMin) { if (y0 < 0) y0 = y; y1 = y }
    if (x1 < 0 || y1 < 0) throw new Error("no ink found in 3D canvas")
    const NB = 48, bw = (x1 - x0) / NB, bh = (y1 - y0) / NB
    const cov = new Float32Array(NB * NB)
    for (let y = y0; y <= y1; y++) {
      const by = Math.min(NB - 1, Math.floor((y - y0) / bh))
      for (let x = x0; x <= x1; x++) {
        if (isInk(L[y * w + x])) cov[by * NB + Math.min(NB - 1, Math.floor((x - x0) / bw))]++
      }
    }
    let best = -1, bx = 0, by = 0, W = 5
    for (let r = 0; r + W <= NB; r++) for (let c = 0; c + W <= NB; c++) {
      let s = 0
      for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) s += cov[(r + rr) * NB + c + cc]
      if (s > best) { best = s; bx = c; by = r }
    }
    return {
      x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h,
      mx: (x0 + (bx + W / 2) * bw) / w, my: (y0 + (by + W / 2) * bh) / h,
    }
  }

  let WIDE = null, MACRO = null
  async function reframe() {
    // Inflate's mesh finishes building a beat after the mode switch resolves,
    // and locating an empty stage yields a zero-width box that only fails
    // several screenshots later. Retry until there is a real form to frame.
    let ink = null
    /* 🔴 THE THROW BELOW USED TO REPORT AN ATTEMPT COUNT AND NOTHING ELSE, AND
     * `catch {}` THREW AWAY EVERY REASON. Two lanes hit it and neither could
     * chase it, and that is why: the instrument deleted its own evidence, so the
     * operator got "6 attempts" and no measurement.
     *
     * MEASURED HERE, over 28 real app states (4 modes x 6 reveal progresses,
     * plus mode switches with no settle at all): the box search returned
     * colsOver 7-1220 and rowsOver 8-565 and a usable box EVERY TIME — including
     * at reveal progress 0, where there is no mark on the stage at all
     * (colsOver 10, rowsOver 10, box 0.715 x 0.623, i.e. 14.3x and 31.2x over
     * the bar). The stage grid alone clears this test comfortably, which is the
     * same fact `locate()`'s own 4% comment records from the other side.
     *
     * So "the motion cell renders no ink" CANNOT reach this throw. Running the
     * same arithmetic over synthetic inputs says what can: a structureless frame
     * (colsOver 0) and a single narrow speck. Both are "the capture came back
     * with nothing in it" — which makes this line, indirectly and by accident,
     * the tool's existing blank-frame detector. It is refusing correctly.
     *
     * The bar is NOT relaxed — a reframe that proceeds without a usable box is
     * how a capture ends up measuring the wrong region. It is made to SAY what
     * it measured, so the next lane can chase it in one run. */
    const why = []
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        /* BEFORE LOOKING FOR THE FORM, ASK WHETHER WE ARE STILL LOOKING AT THE
         * CANVAS. `apply: false` — this MEASURES and REPORTS the drift and does
         * NOT move the crop, because the crop is the bed `assert-screen-layers`
         * grades. See the note on `measureBox`. The drift is folded into the
         * throw's reasons, so a run that dies here says whether the subject was
         * missing or the instrument had wandered off it — which is the exact
         * question two earlier lanes could not answer. */
        const drift = await measureBox({ apply: false }).then((r) => r.drift, () => null)
        if (drift) why.push(`#${attempt + 1} THE VIEWPORT MOVED UNDER THE CROP: ${drift}`)
        const cand = await locate()
        if (cand.x1 - cand.x0 > 0.05 && cand.y1 - cand.y0 > 0.02) { ink = cand; break }
        why.push(
          `#${attempt + 1} box ${(cand.x1 - cand.x0).toFixed(4)}x${(cand.y1 - cand.y0).toFixed(4)} ` +
            `below the 0.05x0.02 bar (paper ${PAPER})`,
        )
      } catch (e) {
        why.push(`#${attempt + 1} ${e.message} (paper ${PAPER})`)
      }
      await page.waitForTimeout(700)
    }
    if (!ink) {
      /* AND KEEP THE FRAME. `_probe-drawin-film`'s seven wrong-sized frames sat
       * on disk for hours with nothing saying so, and the lesson of explainer 35
       * is that an admission nothing parses is not an admission. The inverse
       * holds here: a refusal with no artefact is not a diagnosis. */
      let shot = "(could not be saved)"
      let census = "(unavailable)"
      try {
        shot = join(OUT, `REFUSED-reframe-${Date.now()}.png`)
        writeFileSync(shot, await shotRect(rectOf(0, 0, 1, 1)))
        census = JSON.stringify(
          await page.$$eval("canvas", (els) =>
            els.map((e) => {
              const r = e.getBoundingClientRect()
              return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bw: e.width, bh: e.height }
            }),
          ),
        )
      } catch { /* the page may be gone; the message still has to arrive */ }
      throw new Error(
        `reframe: no usable ink box after 6 attempts — ${why.join(" · ")}. ` +
          `Measured over 28 real app states this search clears its bar by 12-19x even on a stage ` +
          `with NO MARK on it, so reaching here means the capture came back with essentially ` +
          `nothing in it, not that the subject is missing. Check the frame, not the fixture.\n` +
          `  the refused frame is at ${shot}\n` +
          `  the crop this run has been using since startup: ${JSON.stringify(box)}\n` +
          `  the canvases on the page NOW: ${census}`,
      )
    }
    const iw = ink.x1 - ink.x0, ih = ink.y1 - ink.y0
    WIDE = rectOf(ink.x0 - 0.01, ink.y0 - 0.02, iw * 0.55, ih + 0.04)
    const mw = iw * 0.15, mh = mw * 0.72
    MACRO = rectOf(ink.mx - mw / 2, ink.my - mh / 2, mw, mh)
    // A VERIFICATION FRAME SHOWING BLANK PAPER IS WORSE THAN NO FRAME: every
    // preset looks the same on it, so the whole rail "passes" and the
    // nearest-sibling distance reads 0.00 for a reason that has nothing to do
    // with the presets. That is exactly what the first Inflate capture in this
    // pass did — six sheets of empty stage, and the numbers said the rail had
    // collapsed. Prove the crop is on the form before returning it.
    // THREE THINGS, because this guard has now been fooled twice.
    //   ink   — the crop contains something that is not paper.
    //   paper — what we measured as "paper" is actually paper-white. If the
    //           bounding-box search ran over a UI panel, the MODAL luminance is
    //           the panel's grey, every real paper pixel then counts as "ink",
    //           and the box happily locks onto the panel.
    //   sd    — the crop is not a FLAT field. A grey panel satisfies "ink" by
    //           any distance-from-paper test, which is exactly how a full run of
    //           flat-grey rectangles passed and produced 112 assertion failures
    //           that had nothing to do with the presets.
    const m = metrics(await lumOf(await shotRect(MACRO)))
    if (PAPER < 200) throw new Error(`reframe: paper measured at ${PAPER}, not on the stage`)
    if (m.ink < 0.12) throw new Error(`reframe: macro crop is off the form (ink ${m.ink})`)
    if (m.sd < 1.5) throw new Error(`reframe: macro crop is a flat field (sd ${m.sd})`)
  }
  const wide = () => shotRect(WIDE)
  const macro = () => shotRect(MACRO)

  async function sheet(name, entries, cols) {
    const imgs = await Promise.all(entries.map((e) => loadImage(e.buf)))
    const cw = imgs[0].width, ch = imgs[0].height
    const scale = Math.min(1, 1400 / (cols * cw))
    const tw = Math.round(cw * scale), th = Math.round(ch * scale)
    const pad = 4, lab = 22
    const rows = Math.ceil(entries.length / cols)
    const cv = createCanvas(cols * (tw + pad) + pad, rows * (th + lab + pad) + pad)
    const g = cv.getContext("2d")
    g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
    entries.forEach((e, i) => {
      const cx = pad + (i % cols) * (tw + pad)
      const cy = pad + Math.floor(i / cols) * (th + lab + pad)
      g.drawImage(imgs[i], cx, cy, tw, th)
      g.fillStyle = "#eee"; g.font = "13px monospace"
      g.fillText(e.label, cx + 3, cy + th + 15)
    })
    writeFileSync(join(SHEETS, `${name}.png`), cv.toBuffer("image/png"))
  }

  const report = []

  /* ================= STILLS ============================================== */
  if (ONLY === "all" || ONLY === "stills") {
    for (const mode of MODES) {
      await setMode(mode)
      await setStyle({ ...OFF })
      await page.waitForTimeout(500)
      // Retried around the on-form assertion: the Inflate mesh can still be
      // building when the mode switch resolves, and the stage grid is enough
      // "not paper" to satisfy a bounding-box search on its own.
      for (let attempt = 0; ; attempt++) {
        try { await reframe(); break } catch (e) {
          if (attempt >= 5) throw e
          console.log(`[layers] reframe retry ${attempt + 1} (${mode}): ${e.message}`)
          await page.waitForTimeout(1200)
        }
      }
      const offMacroBuf = await macro(), offWideBuf = await wide()
      const offMacro = await lumOf(offMacroBuf)
      writeFileSync(join(CROPS, `${mode}_OFF_macro.png`), offMacroBuf)
      writeFileSync(join(CROPS, `${mode}_OFF_wide.png`), offWideBuf)
      report.push({ mode, rail: "off", preset: "OFF", dOff: 0, dInk: 0, inkMaskFrac: 0, ...metrics(offMacro) })

      for (const [rail, ids] of Object.entries(RAILS)) {
        const cellsM = [{ label: "OFF", buf: offMacroBuf }]
        const cellsW = [{ label: "OFF", buf: offWideBuf }]
        const lums = []
        for (const id of ids) {
          await setStyle({ ...OFF })
          await page.waitForTimeout(120)
          await selectPreset(rail, id)
          await page.waitForTimeout(420)
          const mb = await macro(), wb = await wide()
          writeFileSync(join(CROPS, `${mode}_${rail}_${id}_macro.png`), mb)
          writeFileSync(join(CROPS, `${mode}_${rail}_${id}_wide.png`), wb)
          cellsM.push({ label: id, buf: mb })
          cellsW.push({ label: id, buf: wb })
          const lm = await lumOf(mb)
          lums.push({ id, lm })
          report.push({
            mode, rail, preset: id, dOff: meanAbsDiff(lm, offMacro),
            ...meanAbsDiffInk(lm, offMacro), ...metrics(lm),
          })
        }
        // nearest-sibling distance inside this rail
        for (let i = 0; i < lums.length; i++) {
          let nn = Infinity, who = ""
          for (let j = 0; j < lums.length; j++) {
            if (i === j) continue
            const d = meanAbsDiff(lums[i].lm, lums[j].lm)
            if (d < nn) { nn = d; who = lums[j].id }
          }
          const row = report.find((r) => r.mode === mode && r.rail === rail && r.preset === lums[i].id)
          row.nnDist = +nn.toFixed(3)
          row.nn = who
        }
        await sheet(`${mode}_${rail}_macro`, cellsM, Math.min(4, cellsM.length))
        await sheet(`${mode}_${rail}_wide`, cellsW, Math.min(4, cellsW.length))
      }
      console.log(`[layers] stills done: ${mode}`)
      // Written after EVERY mode: a crash in mode 4 used to throw away the
      // three modes' worth of measurements that had already been taken.
      writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
    }
  }

  /* ================= TONE-WINDOW SWEEP =================================== */
  /* The two dials that decide whether a screen models the form or flattens it
   * are exposure (window centre) and contrast (window width) — see
   * TONE_WINDOW_GLSL. Their good region is what the rail presets have to be
   * set to, and it is not the same on a flat slab as on a round tube, so both
   * extremes get swept: solid = matteClay on a flat form, rod = ink on a tube
   * whose luminance runs from near-black to a blown highlight. */
  if (ONLY === "sweep") {
    const EXP = [0.2, 0.35, 0.5, 0.65, 0.8]
    const CON = [0.2, 0.5, 0.8]
    const cases = [
      { mode: "solid", fam: "dither", preset: "dotMatrix", e: "ditherExposure", c: "ditherContrast" },
      { mode: "rod", fam: "dither", preset: "dotMatrix", e: "ditherExposure", c: "ditherContrast" },
      { mode: "solid", fam: "ascii", preset: "terminalShade", e: "asciiDensity", c: "asciiContrast" },
      { mode: "rod", fam: "ascii", preset: "terminalShade", e: "asciiDensity", c: "asciiContrast" },
    ]
    const rows = []
    let lastMode = null
    for (const cs of cases) {
      if (cs.mode !== lastMode) {
        await setMode(cs.mode)
        await setStyle({ ...OFF })
        await page.waitForTimeout(500)
        await reframe()
        lastMode = cs.mode
      }
      const cells = []
      for (const c of CON) for (const e of EXP) {
        await setStyle({ ...OFF })
        await page.waitForTimeout(100)
        await selectPreset(cs.fam, cs.preset)
        await page.waitForTimeout(150)
        await setStyle({ [cs.e]: e, [cs.c]: c })
        await page.waitForTimeout(320)
        const mb = await macro()
        writeFileSync(join(CROPS, `sweep_${cs.mode}_${cs.preset}_e${e}_c${c}.png`), mb)
        cells.push({ label: `e${e} c${c}`, buf: mb })
        rows.push({ mode: cs.mode, preset: cs.preset, exposure: e, contrast: c, ...metrics(await lumOf(mb)) })
      }
      await sheet(`sweep_${cs.mode}_${cs.preset}`, cells, EXP.length)
      console.log(`[layers] sweep done: ${cs.mode}/${cs.preset}`)
    }
    writeFileSync(join(OUT, "sweep-report.json"), JSON.stringify(rows, null, 2))
  }

  /* ================= MOTION ============================================== */
  if (ONLY === "all" || ONLY === "motion") {
    const FR = parseInt(process.env.MOTION_FRAMES || "56", 10)
    const mode = MODES[0]
    await setMode(mode)
    await setStyle({ ...OFF })
    await page.waitForTimeout(500)
    await reframe()
    const motionReport = []
    const guardReports = []
    const only = arg("cells", "")
    for (const c of MOTION) {
      if (only && !only.split(",").includes(c.key)) continue
      await setStyle({ ...OFF })
      await page.waitForTimeout(150)
      // Re-frame PER CELL, with the on-form guard. Framing once for the whole
      // motion run produced a strip of blank paper for the last cells and a
      // frame delta of 0.02 that looked exactly like an effect that had
      // stopped working — the most expensive kind of false negative here.
      for (let attempt = 0; ; attempt++) {
        try { await reframe(); break } catch (e) {
          if (attempt >= 5) throw e
          await page.evaluate(() => window.__captureHarness.frontView(0.95))
          await page.waitForTimeout(900)
        }
      }
      // `family: null` is the bare-reveal control — select nothing, leave OFF.
      if (c.family) await selectPreset(c.family, c.preset)
      await page.waitForTimeout(500)
      rmSync(TMP, { recursive: true, force: true })
      mkdirSync(join(TMP, "w"), { recursive: true })
      // Reveal-driven presets are only alive DURING the draw-in, so replay it.
      if (c.reveal) await page.evaluate(() => window.__revealHarness.setProgress(0))
      const lums = []
      /* WALL-CLOCK PER FRAME, and the frame the reveal COMPLETED on.
       *
       * ⚠ THE REST WINDOW USED TO BE A FRACTION OF THE FRAME COUNT — "the last
       * 20 % of a reveal clip, which the 45 % ramp puts clear of the pulse
       * lifetime". It does not. The clip's frames are not on a fixed cadence
       * (each one costs two screenshots plus a 45 ms sleep, measured ~84 ms),
       * so "the last 20 %" is a claim about INDICES and the pulse's lifetime is
       * a duration in SECONDS. Measured on `final/`, dit_pulse: the pulse fired
       * at delta 25, the deltas ran 7.0 · 10.4 · … · 14.5 and then EIGHT
       * consecutive frames of exactly 0.000 from delta 47 — the one-shot does
       * stop, hard — while the index-fraction window opened at delta 44, three
       * frames BEFORE it stopped. `restMeanDelta` came out
       * (4.149 + 3.346 + 14.501)/11 = 2.0 against a 0.5 bar, and the row read
       * "a one-shot that never stops" about a pulse that stops.
       *
       * That is the drift class this repo's own README names: a window sized in
       * the wrong unit. So the window is now derived from the MODEL's own
       * `PULSE_LIFETIME` and this run's own measured clock, and both are written
       * into the report so the judge prints what it read instead of trusting a
       * fraction. */
      const tMs = []
      let completionIndex = -1

      /* ── WHAT THIS CELL CLAIMS ABOUT ITS OWN FRAMES ────────────────────────
       *
       * The guard does not guess which stillness is the bad one, because it
       * cannot: a stopped animation and a still one are the same picture, which
       * is DISPATCH §3's whole sentence about the missing `--use-angle=metal`.
       * It is TOLD, and the MOTION table above is where the knowledge already
       * lives — `reveal` is exactly the axis that decides both answers.
       *
       * MEASURED on a full clean run of all twelve cells on this machine
       * (laneR-diag3, headless, 3119), pairs at delta EXACTLY 0:
       *
       *   the 8 NON-REVEAL cells   0/55, every one of them
       *   the 4 REVEAL cells       17, 29, 29 and 36 of 54
       *
       * A non-reveal cell is an animated preset on a finished form, so every
       * frame really must differ from the one before it and a frozen frame is a
       * defect. A reveal cell is the same effect keyed to a draw-in: the macro
       * crop stops changing once the pen has passed it and before the effect
       * fires, so a third of its pairs are legitimately identical — and
       * `reveal_control`, which selects nothing at all, has the most of any cell.
       * Declaring motion there would redden a clean run on day one, which is how
       * a guard gets switched off.
       *
       * The blank arm is the mirror image. A non-reveal cell may never be blank.
       * A reveal cell is legitimately empty until the draw-in completes — and
       * from `completionIndex` onward it is NOT, which is precisely the rest
       * window where 27 §5's blank frame sat. */
      const guard = createFrameGuard({
        label: `${LABEL}/${c.key}`,
        subject: `the macro crop of the 3-D viewport in ${mode}, preset ${c.preset ?? "none (bare reveal)"}`,
        ...(c.reveal
          ? {
              mayBeBlank: {
                when: (i) => completionIndex < 0 || i <= completionIndex,
                why: "a reveal cell replays the draw-in from playhead 0, so the crop is legitimately empty until the mark reaches it; after completion it is not, and that is where 27 §5's blank frame sat",
              },
            }
          : {
              mustMove: {
                all: true,
                why: "an animated preset on a finished form: measured 0 of 55 pairs at delta exactly 0 across all eight non-reveal cells, so a frozen frame here is a stalled compositor, not the subject",
              },
            }),
      })

      const t0 = Date.now()
      /* Enough frames to hold PULSE_LIFETIME plus a full second of stillness
       * AFTER the ramp, at whatever cadence this machine actually manages. The
       * cap keeps a slow machine from capturing forever; it is reported. */
      const MAX_FR = FR * 4
      for (let i = 0; ; i++) {
        if (c.reveal) {
          // 0 -> 1 over the first 45% of the NOMINAL frame count, then HOLD
          // until the pulse has provably ended (below).
          const p = Math.min(1, i / (FR * 0.45))
          await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
          if (p >= 1 && completionIndex < 0) completionIndex = i
        }
        const b = await macro()
        /* JUDGED BEFORE IT IS FILED. A refused frame never enters the sequence
         * the statistics are computed from — but it IS written, once, under a
         * name that says what it is, because the whole reason 27 §5 took three
         * days was that nobody could look at the frame. */
        try {
          await guard.frame(b, { index: i, grabInfo: await grabInfo() })
        } catch (e) {
          if (!(e instanceof FrameRefused)) throw e
          const stem = join(OUT, `REFUSED-${c.key}-f${String(i).padStart(4, "0")}`)
          writeFileSync(`${stem}.png`, b)
          /* THE CROP ALONE CANNOT SAY WHETHER THE SUBJECT WENT OR THE PAGE DID.
           * A white crop is either a blanked canvas or a crop that has drifted
           * off it, and those want opposite fixes — so the refusal takes the
           * whole page and the canvas census as well, once. */
          let census = "(unavailable)"
          try {
            writeFileSync(`${stem}-PAGE.png`, await page.screenshot({ fullPage: false }))
            writeFileSync(`${stem}-CANVAS.png`, await shotRect(rectOf(0, 0, 1, 1)))
            census = JSON.stringify(
              await page.$$eval("canvas", (els) =>
                els.map((el) => {
                  const r = el.getBoundingClientRect()
                  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bw: el.width, bh: el.height }
                }),
              ),
            )
          } catch { /* the page may be gone; the message still has to arrive */ }
          throw new Error(
            `${e.message}\n  the refused frame is at ${stem}.png` +
              ` (and ${stem}-PAGE.png / ${stem}-CANVAS.png)\n` +
              `  the crop this run has been using since startup: ${JSON.stringify(box)}\n` +
              `  the canvases on the page NOW: ${census}\n` +
              `  harness still present: ${await page.evaluate(() => !!window.__styleHarness).catch(() => "unknown")}\n` +
              `  console errors so far (${errors.length}): ${errors.slice(0, 4).join(" | ") || "none"}`,
          )
        }
        writeFileSync(join(TMP, `f${String(i).padStart(4, "0")}.png`), b)
        writeFileSync(join(TMP, "w", `f${String(i).padStart(4, "0")}.png`), await wide())
        lums.push(await lumOf(b))
        tMs.push(Date.now() - t0)
        await page.waitForTimeout(45)
        if (!c.reveal) {
          if (lums.length >= FR) break
        } else if (
          completionIndex >= 0 &&
          tMs[tMs.length - 1] - tMs[completionIndex] >= (PULSE_LIFETIME + 1.0) * 1000
        ) {
          break
        }
        if (lums.length >= MAX_FR) break
      }
      const FRAMES = lums.length
      if (c.reveal) await page.evaluate(() => window.__revealHarness.setProgress(1))
      /* THE TAIL VERDICT. A frame cleared at write time was judged against a
       * baseline built from three frames; the run's own evidence is better and
       * it exists by now, so every frame is re-judged here. Anything a
       * `{ last: n }`-shaped allowance deferred is also resolved here — a
       * streaming capture cannot know which frame is last until it stops. */
      const guardReport = guard.finish()
      if (!guardReport.ok) {
        const r = guardReport.refusals[0]
        throw new Error(
          `${r.message}\n  ${guardReport.refusals.length} refusal(s) in ${c.key}; ` +
            `the frames are in ${TMP} until the next cell clears it.`,
        )
      }
      guardReports.push(guardReport)
      const deltas = []
      for (let i = 1; i < lums.length; i++) deltas.push(meanAbsDiff(lums[i - 1], lums[i]))
      const mean = deltas.reduce((x, y) => x + y, 0) / deltas.length
      const sd = Math.sqrt(deltas.reduce((a, v) => a + (v - mean) ** 2, 0) / deltas.length)
      // SPAN, not just frame-to-frame. A slow effect and a dead one look the
      // same in `meanDelta`: Threshold Sweep moves the tone bias on a 4.8s
      // period, so consecutive frames differ by almost nothing while the clip
      // as a whole travels a long way. Span = the largest distance from frame 0
      // to any later frame, i.e. how far the effect actually goes.
      let span = 0
      for (let i = 1; i < lums.length; i++) span = Math.max(span, meanAbsDiff(lums[0], lums[i]))
      /* REST = every delta whose WHOLE INTERVAL lands after one PULSE_LIFETIME
       * from the reveal completing. Derived, printed, and published:
       * `restFromIndex` and `restStartsSec` say exactly which frames were
       * judged, so a short capture reports an empty window rather than silently
       * judging the tail of the pulse.
       *
       * ⚠ THE ENDPOINT WAS THE WRONG ONE, AND THE FRAME IT LET IN WAS THE
       * STOPPING ITSELF (2026-09-04).
       *
       * This read `tMs[i + 1] - completionMs >= PULSE_LIFETIME * 1000` — the
       * LATER frame of the pair. But `deltas[i]` is not a reading at an
       * instant, it is the change ACROSS `[tMs[i], tMs[i+1]]`, and picking it
       * by its right-hand end admits the one interval that straddles the
       * expiry. So the pulse's final act — the frame on which it goes from
       * moving to exactly static — was being filed under "rest", which is the
       * one window in which it cannot occur by definition.
       *
       * MEASURED, the 2026-09-04 capture of dit_pulse: 12 frames in the window,
       * of which ELEVEN are exactly 0.000 and one is 9.462. Mean 0.788 against
       * a 0.5 bar, and the row printed "a one-shot that never stops" about a
       * one-shot that stops dead and stays dead for 1.11 s. Take the interval
       * whose LEFT end clears the lifetime and the window is 11 frames of
       * exactly 0.000.
       *
       * This is the same defect the last fix here was written for, one level
       * down: that one had the window in the wrong UNIT (indices, not seconds),
       * this one has it on the wrong END of an interval. The capture always
       * runs to PULSE_LIFETIME + 1.0 s past completion, so dropping the
       * straddling frame still leaves ~1 s of rest to judge.
       *
       * ⚠ AND THE FRAME THAT LEAVES THE WINDOW IS NOT NOISE — see the note at
       * `expiryDelta` below. It is a real pop, it is measured, and it is not
       * this row's question. */
      const completionMs = completionIndex >= 0 ? tMs[completionIndex] : null
      const restFrom =
        c.reveal && completionMs !== null
          ? deltas.findIndex((_, i) => tMs[i] - completionMs >= PULSE_LIFETIME * 1000)
          : deltas.length
      const restStart = restFrom < 0 ? deltas.length : restFrom
      const restDeltas = deltas.slice(restStart)
      /* THE FRAME THE REST WINDOW NO LONGER OWNS, MEASURED RATHER THAN DROPPED.
       *
       * `restFromIndex - 1` is the interval the expiry instant falls inside —
       * the frame on which the one-shot stops. Moving the window off it (above)
       * answers "does the pulse end", and it must not be allowed to also answer
       * "does it end WELL", because those are different questions with
       * different fixes. So the number goes in the report next to its own live
       * tail, and the judge prints both on the row.
       *
       * On the 2026-09-04 capture of dit_pulse: expiry 8.895 against a live
       * tail mean of 3.379. Sampled finer (47 ms, densest-ink crop at ink
       * 0.364) the shipped preset reads live mean 1.0918, then 9.3637 in the
       * interval holding PULSE_LIFETIME, then exactly 0.0000 for 29 intervals.
       * It stops with a jolt 8.6x its own motion.
       *
       * ISOLATED BY A/B, not by reading the model. `ditherDirection` is the one
       * setting that takes the threshold sweep out: components/viewport-3d.tsx
       * runs it under `if (ditT.active && ditherDirection === "static")`. Set
       * the direction non-static and the whole cell reads 0.0000 through the
       * pulse AND across the expiry — so the sweep is the only visible channel
       * this preset has, and the step is that sweep being dropped. It sits at
       * -0.1030 when `evaluateLayerTime` returns `active: false`, and 16x a
       * normal 60 fps frame's change goes in one frame. Note `time` IS parked
       * at `PULSE_LIFETIME * speed` for exactly this reason ("returning to
       * phase 0 here snapped the pattern sideways") — the boolean gate throws
       * that parked phase away before anything reads it.
       *
       * The other candidate is ruled OUT by the same arm. `pulseEnvelope` is
       * cut off at PULSE_CUTOFF rather than faded to it, so `amount` steps
       * 1.024 -> 1.000 and `uFsDitIntensity` steps with it. That step applies
       * in both arms, and the non-static arm measured 0.0000 at expiry — real
       * in the model, worth nothing to the eye here.
       *
       * The fix is one condition in components/viewport-3d.tsx. Not in this
       * file, and not gradeable from a rest window. */
      const expiryIndex =
        c.reveal && completionMs !== null && restDeltas.length && restStart > 0 ? restStart - 1 : null
      const liveTail = expiryIndex === null ? [] : deltas.slice(Math.max(0, expiryIndex - 5), expiryIndex)
      motionReport.push({
        cell: c.key, preset: c.preset, frames: FRAMES, nominalFrames: FR, reveal: !!c.reveal,
        meanDelta: +mean.toFixed(3), sdDelta: +sd.toFixed(3),
        spanDelta: +span.toFixed(3),
        maxDelta: Math.max(...deltas), minDelta: Math.min(...deltas),
        restMeanDelta: restDeltas.length
          ? +(restDeltas.reduce((x, y) => x + y, 0) / restDeltas.length).toFixed(3) : null,
        /* Everything the rest window was derived FROM, so the judge can refuse
         * a window that does not exist instead of averaging three frames of a
         * live pulse and calling it rest. */
        pulseLifetimeSec: +PULSE_LIFETIME.toFixed(4),
        completionIndex: completionIndex >= 0 ? completionIndex : null,
        completionSec: completionMs === null ? null : +(completionMs / 1000).toFixed(3),
        frameSec: +((tMs[tMs.length - 1] - tMs[0]) / Math.max(1, FRAMES - 1) / 1000).toFixed(4),
        clipSec: +((tMs[tMs.length - 1] - tMs[0]) / 1000).toFixed(3),
        restFromIndex: restDeltas.length ? restStart : null,
        restFrames: restDeltas.length,
        /* The frame the pulse stops ON, and the motion it stops out of. */
        expiryIndex,
        expiryDelta: expiryIndex === null ? null : deltas[expiryIndex],
        liveTailMeanDelta: liveTail.length
          ? +(liveTail.reduce((x, y) => x + y, 0) / liveTail.length).toFixed(3) : null,
        restStartsSecAfterCompletion:
          restDeltas.length && completionMs !== null
            ? +((tMs[restStart + 1] - completionMs) / 1000).toFixed(3)
            : null,
        deltas,
      })
      // Ten evenly spaced frames as one strip, so phase progression (and any
      // strobe) is readable without opening the video.
      const step = Math.max(1, Math.floor(FRAMES / 10))
      const strip = []
      for (let i = 0; i < 10; i++) {
        const idx = Math.min(FRAMES - 1, i * step)
        strip.push({ label: `f${idx}`, buf: join(TMP, `f${String(idx).padStart(4, "0")}.png`) })
      }
      await sheet(`motion_${c.key}_strip`, strip, 5)
      if (ffmpegPath) {
        for (const [src, suffix] of [[join(TMP, "f%04d.png"), "macro"], [join(TMP, "w", "f%04d.png"), "wide"]]) {
          execFileSync(ffmpegPath, [
            "-y", "-framerate", "18", "-i", src,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            join(VIDEO, `${c.key}_${suffix}.mp4`),
          ], { stdio: "ignore" })
        }
      }
      {
        const r = motionReport.at(-1)
        console.log(
          `[layers] motion ${c.key}: meanΔ=${mean.toFixed(2)} rest=${r.restMeanDelta}` +
            ` (${r.restFrames} frame(s) from index ${r.restFromIndex}, ` +
            `${r.restStartsSecAfterCompletion ?? "—"}s after completion; pulse lifetime ${r.pulseLifetimeSec}s, ` +
            `${r.frames} frames at ${r.frameSec}s)`,
        )
      }
    }
    rmSync(TMP, { recursive: true, force: true })
    writeFileSync(join(OUT, "motion-report.json"), JSON.stringify(motionReport, null, 2))
    /* A SIBLING FILE, NOT A NEW FIELD. `assert-screen-layers` reads
     * `motion-report.json` key by key; adding to it would change a file the
     * judge parses, and this lane's whole premise is that the guard restages
     * nothing. So what the guard saw goes next to it, where a reader can find
     * it and no grader has to change. */
    writeFileSync(
      join(OUT, "frame-guard.json"),
      JSON.stringify(
        {
          _: "What the blank/frozen guard saw, per motion cell. A green run here means every " +
            "frame filed under this label carried a mark, and every frame the cell DECLARED must " +
            "be moving did move. Explainer 40; the defect is explainer 27 §5.",
          cells: guardReports,
        },
        null,
        2,
      ),
    )
    const frozenSeen = guardReports.reduce((n, r) => n + r.frozenPairs, 0)
    console.log(
      `[layers] frame-guard: ${guardReports.length} cell(s) clean — ` +
        `${guardReports.reduce((n, r) => n + r.frames, 0)} frames, 0 refusals, ` +
        `${frozenSeen} byte-identical pair(s) seen and correctly ignored where no motion was declared`,
    )
  }

  console.log(`[layers] console errors: ${errors.length}`)
  errors.slice(0, 8).forEach((e) => console.log("   ", e))
  writeFileSync(join(OUT, "console-errors.json"), JSON.stringify(errors, null, 2))
  await ctx.close()
  await browser.close()
  console.log(`[layers] wrote ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
