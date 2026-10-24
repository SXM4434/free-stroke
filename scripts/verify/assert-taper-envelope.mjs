// TAPER ENVELOPE — testing the falsifiable prediction in
// docs/research/stroke-width-models.md §3.2.
//
// THE CLAIM
//
// A varying-radius tube's surface is the envelope of a moving sphere, and that
// envelope only exists where |dr/ds| <= 1. Our end taper is
// sin(pi*x/2)^0.8 over 0.7 diameters, and an exponent below 1 gives that
// function a VERTICAL TANGENT at zero — so |dr/ds| is unbounded at the tip by
// construction. The doc computes |dr/ds| > 1 for the first 0.195 R of arc
// length in from each stroke end.
//
// The consequence is a parity break the codebase has never flagged. Inflate has
// two fusion modes over the same `ink` width profile:
//
//   loft     — inflateBuildEllipticalTube places rings PERPENDICULAR to the
//              tangent. That is the RADIAL construction, which is thinner than
//              the true envelope by 1/cos(asin(|dr/ds|)).
//   implicit — implicit-surface.ts builds exact round-CONE SDFs, which ARE the
//              union of spheres, i.e. the true envelope.
//
// So the two modes should disagree near every stroke end, by ~18% in radius
// through the middle of the taper (the doc's own most-trusted row) with the
// IMPLICIT one fatter. If that holds, "which fusion mode" is silently also
// "which stroke ending".
//
// HOW IT IS TESTED
//
// One straight horizontal stroke, Inflate, dead-on front view, glossy is
// irrelevant here so the default material stands. Read the alpha channel of the
// captured frame and measure the silhouette's vertical extent per column: that
// IS the radius profile, directly, with no engine introspection to be wrong
// about. Then compare the two fusion modes column by column.
//
// A straight stroke is deliberate. Curvature would add its own offset-surface
// error and confound the measurement; the prediction is about dr/ds alone.
//
// Usage: node scripts/verify/assert-taper-envelope.mjs [--label=run]
// Output: docs/verification/taper-envelope/<label>/
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
// The taper zone is 0.7 DIAMETERS long, so at the default ink weight it is only
// ~27 screen px — enough to resolve an 18% difference, but only just. These let
// the same test run at a weight where the taper zone is large enough that no
// plausible measurement floor can hide the effect.
const THICKNESS = arg("thickness", null)
const RESOLUTION = arg("resolution", null)
const OUT = join(ROOT, "docs", "verification", "taper-envelope", LABEL)

let failures = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  if (!ok) failures++
}

// ── Part 1: the numeric claim, from the shipped constants ────────────────────
//
// INSTRUMENT REPAIR 2026-08-03 — A SECOND COPY OF A GUARDED CONSTANT.
//   WAS: `const INFLATE_TIP_FRACTION = 0.035 / 0.22` and
//   `const INFLATE_PROFILE_EXP = 0.8`, with the claim "If they are ever changed,
//   this block goes stale loudly (the printed values stop matching the file)".
//   NOTHING IN THE FILE COMPARED THEM TO THE FILE. Set INFLATE_PROFILE_EXP to
//   1.2 in the engine and ENV-3 still computed from 0.8 and passed; ENV-1 and
//   ENV-2 are loft-vs-implicit ratios where BOTH arms use the new exponent, so
//   they stayed green too. All three rows were blind to the constant the gate
//   exists to guard — the `PEN_CARVE_ENVELOPE_R` disease.
//
// ── AND THE FIRST REPAIR WAS A WORKAROUND, NOW REPLACED (same day) ──────────
//   The three constants were module-private `const`s, so `loadTs` could not
//   import them, and the repair TEXT-PARSED `lib/geometry-engines.ts` for
//   `^const NAME = <arithmetic>`. That closed the blindness but bought two new
//   couplings: the regex depends on this file's FORMATTING (reflow the
//   declaration onto two lines and the gate silently reads NaN), and channel D
//   of `assert-gate-integrity` mutates constants through `_ts-load.mjs`, which a
//   text-parse never sees.
//
//   `INFLATE_TIP_FRACTION`, `INFLATE_PROFILE_EXP` and
//   `INFLATE_TAPER_SPAN_DIAMETERS` are now EXPORTED by the engine (the export
//   carries a note saying it is for this gate), so they are imported like any
//   other guarded value. The recorded copies below stay, and their only job is
//   still to fail ENV-0 when the engine's move — a pin, not a second source.
const ENG = loadTs("lib/geometry-engines.ts")
/** The engine's own value for a constant this gate guards. */
function engineConst(name) {
  const value = ENG[name]
  return typeof value === "number" && Number.isFinite(value)
    ? { found: true, expr: String(value), value }
    : { found: false, expr: null, value: NaN }
}
/* THE ARM, so ENV-0 is proven rather than stated:
 *   TAPER_ARM=exp1.2 node scripts/verify/assert-taper-envelope.mjs
 * pretends the engine's exponent moved to 1.2 — the exact known-bad the old
 * comment claimed would be caught — and ENV-0 must go RED. */
const TAPER_ARM = process.env.TAPER_ARM ?? ""
const ENG_TIP = engineConst("INFLATE_TIP_FRACTION")
const ENG_EXP = engineConst("INFLATE_PROFILE_EXP")
const ENG_SPAN = engineConst("INFLATE_TAPER_SPAN_DIAMETERS")
if (TAPER_ARM === "exp1.2") {
  ENG_EXP.value = 1.2
  ENG_EXP.expr = "1.2 (ARM)"
  console.log("[arm] TAPER_ARM=exp1.2 — INFLATE_PROFILE_EXP is read as 1.2")
}
/** Recorded 2026-08-03 from lib/geometry-engines.ts — now :5628 / :5630 / :5639. */
const RECORDED = { INFLATE_TIP_FRACTION: 0.035 / 0.22, INFLATE_PROFILE_EXP: 0.8, INFLATE_TAPER_SPAN_DIAMETERS: 0.7 }
const INFLATE_TIP_FRACTION = ENG_TIP.value
const INFLATE_PROFILE_EXP = ENG_EXP.value
/** The taper zone in RADII. Was the bare literal 1.4; it is 2 x the engine's
 *  span in DIAMETERS, so it moves when the engine's does. */
const TAPER_SPAN_R = ENG_SPAN.value * 2

/**
 * r(x)/R over the taper zone, x in [0,1] from the stroke end inward, and its
 * slope with respect to ARC LENGTH given a taper span of `spanR` radii.
 */
function taperProfile(x) {
  return INFLATE_TIP_FRACTION + (1 - INFLATE_TIP_FRACTION) * Math.pow(Math.sin((Math.PI / 2) * x), INFLATE_PROFILE_EXP)
}
function drds(x, spanR) {
  const h = 1e-6
  const a = taperProfile(Math.max(x - h, 0))
  const b = taperProfile(Math.min(x + h, 1))
  return Math.abs((b - a) / ((Math.min(x + h, 1) - Math.max(x - h, 0)) * spanR))
}

function numericCheck() {
  const spanR = TAPER_SPAN_R // the engine's INFLATE_TAPER_SPAN_DIAMETERS, in radii
  const rows = []
  let firstOk = null
  for (let i = 1; i <= 400; i++) {
    const x = i / 400
    const k = drds(x, spanR)
    if (firstOk === null && k <= 1) firstOk = x
    if ([0.05, 0.1, 0.156, 0.25, 0.5, 0.75].some((t) => Math.abs(x - t) < 1 / 800)) {
      rows.push({ x, r: taperProfile(x), drds: k, radialUnderfill: k < 1 ? 1 / Math.cos(Math.asin(k)) - 1 : null })
    }
  }
  return { rows, envelopeExistsFrom: firstOk, envelopeExistsFromR: firstOk === null ? null : firstOk * spanR }
}

// ── Part 2: the live measurement ─────────────────────────────────────────────

/** Silhouette vertical extent per column, from the alpha channel. */
async function widthProfile(pngPath) {
  const img = await loadImage(pngPath)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, img.width, img.height).data
  const cols = new Array(img.width).fill(0)
  for (let x = 0; x < img.width; x++) {
    let top = -1
    let bot = -1
    for (let y = 0; y < img.height; y++) {
      if (d[(y * img.width + x) * 4 + 3] > 24) {
        if (top < 0) top = y
        bot = y
      }
    }
    cols[x] = top < 0 ? 0 : bot - top + 1
  }
  return cols
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  /* ENV-0 — THE CONSTANTS THIS FILE PREDICTS FROM ARE THE ENGINE'S.
   * Run before anything else, because if it fails every number below is a
   * prediction about a build that no longer exists. */
  console.log("\n── the guarded constants, read out of lib/geometry-engines.ts ──")
  for (const [name, eng] of [
    ["INFLATE_TIP_FRACTION", ENG_TIP],
    ["INFLATE_PROFILE_EXP", ENG_EXP],
    ["INFLATE_TAPER_SPAN_DIAMETERS", ENG_SPAN],
  ]) {
    check(
      `ENV-0 ${name} is still ${RECORDED[name]}`,
      eng.found && Number.isFinite(eng.value) && Math.abs(eng.value - RECORDED[name]) < 1e-12,
      eng.found
        ? `source reads \`${eng.expr}\` = ${eng.value} (recorded ${RECORDED[name]})`
        : `NOT FOUND in ${ENGINE_SRC} — the gate can no longer see the constant it guards`,
    )
  }

  const numeric = numericCheck()
  console.log(`\n── |dr/ds| over the taper zone (span ${TAPER_SPAN_R} R) ──`)
  for (const r of numeric.rows) {
    console.log(
      `  x=${r.x.toFixed(3)}  r=${r.r.toFixed(3)}R  |dr/ds|=${r.drds.toFixed(3)}` +
        (r.radialUnderfill === null
          ? "   ENVELOPE DOES NOT EXIST"
          : `   radial rings under-fill by ${(r.radialUnderfill * 100).toFixed(1)}%`),
    )
  }
  console.log(
    `  envelope first exists at x=${numeric.envelopeExistsFrom?.toFixed(3)} ` +
      `= ${numeric.envelopeExistsFromR?.toFixed(3)} R in from the stroke end`,
  )

  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 60000 },
  )
  await page.evaluate(() => window.__captureHarness.enable())

  // A single straight horizontal stroke: no curvature to confound dr/ds.
  const stroke = []
  for (let i = 0; i <= 200; i++) stroke.push({ x: 150 + (i / 200) * 600, y: 360 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes([p], { msPerPoint: 8 }), stroke)
  await page.waitForTimeout(700)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1000)
  if (THICKNESS) {
    await page.evaluate((t) => window.__styleHarness.setSolidParams({ thickness: t }), Number(THICKNESS))
    await page.waitForTimeout(1200)
  }
  if (RESOLUTION) {
    await page.evaluate((r) => window.__styleHarness.setInflate({ resolution: Number(r) }), RESOLUTION)
    await page.waitForTimeout(1200)
  }
  await page.evaluate(() => window.__revealHarness.setProgress(1))

  const profiles = {}
  for (const fusion of ["loft", "implicit"]) {
    await page.evaluate((f) => window.__styleHarness.setInflate({ fusion: f }), fusion)
    // Implicit runs marching cubes over a field grid, which is a much heavier
    // rebuild than the loft; the first attempt at this script grabbed the
    // implicit frame too early AND with capture mode dropped, and wrote a blank
    // 799x866 canvas that the measurement then happily "confirmed" the
    // prediction from. Re-enable, wait properly, and refuse anything that is
    // not the 1920x1080 capture target.
    await page.waitForTimeout(2500)
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(1200)
    const got = await page.evaluate(() => ({
      fusion: window.__styleHarness.get().inflateParams.fusion,
      capture: window.__captureHarness.isEnabled(),
    }))
    if (got.fusion !== fusion) throw new Error(`fusion did not take: asked ${fusion}, got ${got.fusion}`)
    if (!got.capture) throw new Error("capture mode is off — the grab would be the wrong canvas")
    // Dead-on front so the silhouette IS the radius profile.
    await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.92))
    await page.waitForTimeout(600)
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const file = join(OUT, `${fusion}.png`)
    writeFileSync(file, Buffer.from(url.match(/base64,(.+)/)[1], "base64"))
    const probe = await loadImage(file)
    if (probe.width !== 1920 || probe.height !== 1080) {
      throw new Error(`${fusion} frame is ${probe.width}x${probe.height}, not the 1920x1080 capture target`)
    }
    profiles[fusion] = await widthProfile(file)
    const ink = profiles[fusion].filter((v) => v > 0).length
    if (ink < 100) throw new Error(`${fusion} frame has only ${ink} inked columns — nothing rendered`)
  }
  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight (08-07).
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *                                              Measured on assert-geom-offthread
   *                                              at 12:23 — a sibling lane wrote
   *                                              lib/style-fusion.ts nine seconds in,
   *                                              and three arms went red with nothing
   *                                              able to say why.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * The filter is narrowed to loft.png and implicit.png so the row cannot certify this gate's
   * own result.json as evidence — the trap `assert-drawin-pentip.mjs` recorded.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.png$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
    const detailP = !landed
      ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-taper-envelope.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-taper-envelope.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    check(
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      landed && treeHeld,
      detailP,
    )
  }
  await browser.close()

  // Compare over the shared ink span.
  const spanOf = (cols) => {
    let lo = cols.findIndex((v) => v > 0)
    let hi = cols.length - 1
    while (hi > 0 && cols[hi] === 0) hi--
    return [lo, hi]
  }
  const [l0, h0] = spanOf(profiles.loft)
  const [l1, h1] = spanOf(profiles.implicit)
  const maxLoft = Math.max(...profiles.loft)
  const maxImp = Math.max(...profiles.implicit)

  console.log("\n── measured silhouette ──")
  console.log(`  loft      span ${l0}..${h0}  (${h0 - l0}px)   max thickness ${maxLoft}px`)
  console.log(`  implicit  span ${l1}..${h1}  (${h1 - l1}px)   max thickness ${maxImp}px`)

  // The prediction is about the TAPER ZONE, so sample as a fraction of the
  // stroke's own length in from each end, normalised by each mode's own
  // mid-stroke thickness — otherwise a global weight difference between the two
  // fusion paths would masquerade as the taper effect.
  const sample = (cols, lo, hi, f) => cols[Math.round(lo + (hi - lo) * f)]
  const midL = sample(profiles.loft, l0, h0, 0.5)
  const midI = sample(profiles.implicit, l1, h1, 0.5)
  console.log("\n── taper zone, each normalised by its own mid-stroke thickness ──")
  console.log("   f      loft      implicit   implicit/loft")
  const ratios = []
  const rawPairs = []
  for (const f of [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.35, 0.5]) {
    const rawA = sample(profiles.loft, l0, h0, f)
    const rawB = sample(profiles.implicit, l1, h1, f)
    const a = rawA / midL
    const b = rawB / midI
    const ratio = a > 0 ? b / a : NaN
    if (f <= 0.12) {
      ratios.push(ratio)
      rawPairs.push({ f, rawA, rawB })
    }
    console.log(`  ${f.toFixed(2)}   ${a.toFixed(3)}     ${b.toFixed(3)}      ${ratio.toFixed(3)}`)
  }
  const meanTaperRatio = ratios.filter(Number.isFinite).reduce((s, v) => s + v, 0) / ratios.filter(Number.isFinite).length

  const verdict =
    meanTaperRatio > 1.05
      ? "CONFIRMED — implicit is measurably fatter through the taper, as predicted"
      : meanTaperRatio < 0.95
        ? "REFUTED WITH THE SIGN REVERSED — loft is fatter through the taper"
        : "NOT CONFIRMED — the two modes agree through the taper to within 5%"
  console.log(`\n  mean implicit/loft over the taper zone: ${meanTaperRatio.toFixed(3)}`)
  console.log(`  ${verdict}`)

  /* ---- AND IT IS NOW ASSERTED, because it was not ------------------------
   *
   * Found 2026-07-31 sweeping the geometry gates: this file is named `assert-`
   * and contained NO check at all. It printed the table, printed a verdict, and
   * exited 0 whichever way the numbers went — a script that cannot fail, which
   * is this repo's own definition of the lie. It has been reporting
   * "NOT CONFIRMED" for a whole cycle with nothing reading it.
   *
   * The reading itself is the RIGHT one, and it is a fix landing rather than a
   * prediction failing. `stroke-width-models.md` §3.2 predicted the two fusion
   * modes would disagree by ~18% through the taper because the loft placed its
   * rings PERPENDICULAR to the tangent (the radial construction, thinner than
   * the envelope by 1/cos(asin|dr/ds|)). Explainer 17 §1 rebuilt the loft AS the
   * canal surface — rings on the characteristic circles of the same ball family
   * the implicit path unions — so the two now describe the same solid and the
   * predicted parity break is CLOSED. Measured 0.981, i.e. 1.9% apart.
   *
   * So the assertion is that they AGREE, and the negative control is the
   * prediction this pass closed: the same predicate, applied to the radial
   * under-fill ratios this run already computes at the same sample points, must
   * FAIL. That control is not synthetic — it is what the loft measured before
   * the canal-surface construction, from the doc's own closed form. */
  // `failures` / `check` are module-level now, so ENV-0 above can use them.
  const agree = (r) => Number.isFinite(r) && r > 0.95 && r < 1.05

  console.log("")
  check(
    "ENV-1 the two fusion modes describe the SAME solid through the taper (the §3.2 parity break is closed)",
    agree(meanTaperRatio),
    `mean implicit/loft ${meanTaperRatio.toFixed(3)} over the taper zone — ${verdict.split(" — ")[0]}`,
  )
  /* ENV-2 is stated in PIXELS, which is what this instrument measures.
   *
   * A 5% RATIO test fails at f=0.01 and it is the instrument, not the geometry:
   * there the silhouette is 26 px on the loft against 25 px on the field — ONE
   * row of pixels of a 39/40 px ribbon, which is 3.8% before the two modes'
   * mid-stroke thicknesses (39 vs 40) are divided out. Demanding sub-pixel
   * agreement of a row-counted alpha profile is the same defect as BLEND-3's
   * tolerance sitting under the marching-cubes floor. Two pixels is the floor
   * this reading can carry, and the effect it has to catch is far above it:
   * §3.2 predicted ~18% through the taper, which on a 39 px ribbon is 7 px. */
  const MAX_PX = 2
  const worstPx = Math.max(...rawPairs.map((p) => Math.abs(p.rawA - p.rawB)))
  check(
    "ENV-2 and they agree at EVERY sampled station, to within the 2 px this alpha profile can resolve",
    rawPairs.every((p) => Math.abs(p.rawA - p.rawB) <= MAX_PX),
    `worst ${worstPx} px of ${maxLoft}/${maxImp} px — per station ` +
      rawPairs.map((p) => `f${p.f}:${p.rawA}v${p.rawB}`).join(" ") +
      ` (the ~18% break §3.2 predicted would be ${Math.round(maxLoft * 0.18)} px)`,
  )
  {
    /* ENV-3 — THE NEGATIVE CONTROL, REBUILT 2026-08-03.
     *
     * INSTRUMENT REPAIR — A CONTROL WITH NO INPUT.
     *   WAS: `predicted` came from `numericCheck()`, which is pure arithmetic
     *   over this file's own two literals. No engine, no browser, no build.
     *   Computed: the stations give |dr/ds| 1.252/1.080/0.974/0.845/0.572/0.293,
     *   the four with k<1 give 4.3843/1.8702/1.2192/1.0461, predictedMean =
     *   2.1299, and the row evaluated `2.1299 ∉ (0.95, 1.05)` — a FIXED TRUE,
     *   103 % clear of the band, with nothing in the repository able to make it
     *   false. A negative control that cannot be driven by the subject is a
     *   decoration: it went green on a blank frame exactly as readily as on a
     *   good one, which is the failure mode the loud comment at line 174 above
     *   describes this script having already had once.
     *
     * NOW: the pre-canal-surface loft is SYNTHESISED FROM THE MEASURED IMPLICIT
     * SILHOUETTE. The radial construction under-fills the envelope by
     * cos(asin|dr/ds|) — the doc's own quantity — so at each measured station
     * the pre-explainer-17 loft would have read `rawB x cos(asin k)` px. Those
     * synthetic widths are handed to ENV-2's OWN predicate, and it must REJECT
     * them. The control is therefore driven by the same pixels ENV-2 grades:
     * on a blank or degenerate frame every rawB is 0, the synthetic arm is 0
     * too, the differences are 0, the predicate ACCEPTS, and this row goes RED
     * — which is the behaviour that was missing.
     *
     * `k` is evaluated at the station's real position in the taper zone: the
     * zone is INFLATE_TAPER_SPAN_DIAMETERS long, i.e. TAPER_SPAN_R x R px with
     * R = midI/2, so x = f x (span in px) / (TAPER_SPAN_R x midI / 2). */
    const strokePx = h1 - l1
    const zonePx = (TAPER_SPAN_R * midI) / 2
    const radial = rawPairs.map((p) => {
      const x = Math.min(1, Math.max(0, (p.f * strokePx) / Math.max(zonePx, 1e-9)))
      const k = Math.min(drds(x, TAPER_SPAN_R), 0.999999)
      const fill = Math.cos(Math.asin(k))
      return { ...p, x, k, fill, radialPx: p.rawB * fill }
    })
    const worstRadialPx = Math.max(...radial.map((r) => Math.abs(r.radialPx - r.rawB)))
    check(
      "ENV-3 NEGATIVE CONTROL: the pre-canal-surface RADIAL construction, rebuilt from THIS RUN's pixels, is rejected by ENV-2's predicate",
      radial.length > 0 &&
        radial.every((r) => r.rawB > 0) &&
        !radial.every((r) => Math.abs(r.radialPx - r.rawB) <= MAX_PX),
      radial.length === 0
        ? "no taper stations — the control could not be built, so ENV-1/2 are UNCALIBRATED"
        : radial.every((r) => r.rawB > 0)
          ? `worst ${worstRadialPx.toFixed(2)} px against the ${MAX_PX} px floor; per station ` +
            radial.map((r) => `f${r.f}:x${r.x.toFixed(2)} k${r.k.toFixed(2)} ${r.rawB}->${r.radialPx.toFixed(1)}px`).join(" ")
          : `a measured station read 0 px — the frame is degenerate and this control CANNOT distinguish anything: ` +
            radial.map((r) => `f${r.f}:${r.rawB}`).join(" "),
    )
    /* PARKED, NOT DELETED — the closed-form table the old ENV-3 gated on. Still
     * worth printing (it is the doc's prediction) and still worth writing to
     * JSON; it is simply not a control, because no build input reaches it. */
    const predictedClosedForm = (numeric?.rows ?? [])
      .filter((r) => Number.isFinite(r?.drds) && r.drds < 1)
      .map((r) => 1 / Math.cos(Math.asin(r.drds)))
    console.log(
      `  ....  parked diagnostic: the closed-form radial/envelope ratios the old ENV-3 gated on are ` +
        `${predictedClosedForm.map((r) => r.toFixed(3)).join(" ")} — pure arithmetic over this file's own constants, ` +
        `and unchanged by anything the build does`,
    )
    numeric.predictedClosedForm = predictedClosedForm
    numeric.radialControl = radial
  }

  writeFileSync(
    join(OUT, "result.json"),
    JSON.stringify({ numeric, profiles, meanTaperRatio, verdict, failures }, null, 2),
  )
  console.log(failures === 0 ? "\nALL TAPER-ENVELOPE ASSERTIONS PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
