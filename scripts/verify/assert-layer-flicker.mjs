// TEMPORAL QUALITY OF THE ANIMATED SCREEN LAYERS — "does it travel, or does it
// strobe?"
//
// WHY THIS EXISTS AND WHY IT IS NOT verify-screen-layers.mjs --only=motion.
//
// That script samples frames with page.screenshot(), which costs 150-500ms per
// frame. Every temporal number it reports is therefore taken at 2-6 "fps" — and
// at that rate a pattern that advances ~2 threshold cells per second ALIASES.
// Dither Crawl measured a perfect two-state alternation there (Δ = 0.0, 24.0,
// 0.0, 24.0 ... with 24 of 55 consecutive pairs bit-identical), which looks like
// a 100% strobe but is partly an artifact of the sampling rate. The defect is
// real; the number was not trustworthy. You cannot judge motion at 4fps.
//
// So this script samples INSIDE the page on requestAnimationFrame, at the true
// display rate, by drawing the WebGL canvas into a small 2D canvas
// (`preserveDrawingBuffer: true` is already set on the r3f canvas, so the read
// is valid). ~2000x cheaper per frame, and honest.
//
// WHAT IT MEASURES, and why each number is the one that matters:
//
//   medianΔ    typical per-frame change over the ink. The effect's "speed".
//   p95Δ       the big frames. On smooth travel p95 ≈ median.
//   stepiness  p95Δ / medianΔ. THE HEADLINE. Smooth continuous motion moves a
//              little every frame, so this sits near 1. Motion that advances a
//              QUANTISED index (a threshold-matrix cell, a glyph ramp level)
//              holds still and then jumps by a full quantum, so this blows up.
//              > 3 is stepped; > 6 is a strobe.
//   holdFrac   fraction of frames with Δ below 10% of p95 — i.e. frozen frames.
//              Smooth motion has almost none.
//   jumpHz     jumps per second (frames above half of p95). Anything landing in
//              4-20 Hz with a high stepiness is in the worst band for perceived
//              flicker.
//   travelRat  spanΔ / medianΔ, where span = the largest distance from frame 0.
//              Separates TRAVEL from RE-ROLL: a pattern that slides away from
//              where it started keeps growing its distance from frame 0, while
//              one that just re-randomises in place saturates immediately at
//              about its per-frame delta. ~1 = re-roll, not motion.
//
// CALIBRATION — WHY THIS SCRIPT REFUSES TO BE TRUSTED UNTIL IT HAS FAILED.
//
// This pass has now caught FOUR instruments that reported confidently while
// measuring nothing: a motion harness sampling at 2-6fps, two rim metrics giving
// opposite verdicts on the same geometry, and a whole directory of "close-up"
// frames that were blank because an index shift NaN'd the camera while the
// filename came out correct. A green number from an unfalsifiable ruler is worth
// less than no number, because it stops the search.
//
// So the CALIBRATION runs the sampler against inputs whose answer is already known
// — including two that are known BAD — and exits non-zero unless every one comes
// out as expected:
//
//   cal_dead     a preset with motionMode "off". Nothing moves. Must read DEAD.
//                (If the ruler cannot produce DEAD, every "smooth" is suspect.)
//   cal_strobe   the HISTORICAL Dither Crawl — bayer4 translated diagonally, the
//                defect this rail was fixed for. Must read STROBE.
//   cal_judder   the HISTORICAL Diagonal Matrix Drift — bayer8 translated fast.
//                Must read JUDDER or STROBE, i.e. stepped either way.
//   cal_smooth   the CURRENT Dither Crawl. Must read smooth.
//   cal_offform  a real, moving effect sampled from a crop deliberately placed
//                on blank paper (--crop=corner). This is failure mode #3 above,
//                reproduced on purpose: the effect IS moving, the read is not on
//                it. Must report BROKEN. Anything else — including DEAD — means
//                the script cannot tell "nothing is happening" from "I am not
//                looking at it", which is the exact confusion that produced a
//                directory of blank evidence.
//
// ⚠ WHAT THIS FILE WAS, AND WHY THE DEFAULT PATH IS DIFFERENT NOW (2026-08-01)
//
//   Every judgement in this file was real, well-reasoned and CALIBRATED — and on
//   the DEFAULT invocation not one of them ran. `--fusion`, `--fusion-intensity`,
//   `--reduced`, `--calibrate` and `--calibrate-guard` each owned a block that
//   emitted PASS/FAIL and exited on its verdict. (The last two are deleted as of
//   2026-08-28; the flag block further down says why they stopped being arms.) The plain `node
//   assert-layer-flicker.mjs` fell through all five to the rails block at the
//   bottom, which printed a table of verdict WORDS (smooth / STROBE / JUDDER /
//   RE-ROLL / DEAD), never a PASS or a FAIL, and then let `main()` return —
//   so the process exited 0 whatever the table said. It even counted failures
//   into `failed` on a broken sampler and then threw the number away.
//
//   Seventeen presets could all have read DEAD and the sweep would have been
//   green. That is the same defect class as `assert-joint-beading` and
//   `assert-taper-envelope`, and `assert-gate-integrity.mjs` now watches for it.
//
//   THE FIX, in three parts:
//     · every cell carries an `expect` — the verdict its AUTHORED INTENT
//       requires — so the table becomes rows;
//     · the metric calibration runs on the default path too, exactly as the
//       fusion rail already does ("CALIBRATE FIRST, EVERY RUN"), because a
//       matrix from an unproven ruler is worth less than no matrix;
//     · the exit code carries the verdict.
//
// Usage:
//   node scripts/verify/assert-layer-flicker.mjs              # calibrate AND judge
//   node scripts/verify/assert-layer-flicker.mjs --label=before
//   node scripts/verify/assert-layer-flicker.mjs --label=after --cells=dit_crawl
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, renameSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
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
  return hit ? hit.split("=")[1] : d
}
const has = (k) => process.argv.includes(`--${k}`)
const LABEL = arg("label", "before")
const MODE = arg("mode", "solid")
const FRAMES = parseInt(arg("frames", "150"), 10)
/* WHY `--calibrate` AND `--calibrate-guard` ARE GONE (2026-08-28).
 *
 * They were not withheld arms. They were leftovers. Explainer 31 moved
 * `calibrateGuard()` and `runMetricCal()` onto the DEFAULT path and left behind
 * the two flags that used to be the only way to reach them. From that day the
 * flags ran a strict SUBSET of the bare invocation: the same two calls, in the
 * same order, followed by an exit that skipped all 51 subject rows.
 *
 * Channel J reported them, and by its own rule it was right: the exit inside
 * `if (CALIBRATE)` was flag-blocked and failure-capable. But there was nothing
 * behind them left to reach. Deleting beats tabling, and `run-battery.mjs` says
 * why: "an arm that always runs needs no entry and cannot drift out of one."
 * This one has always run since 2026-08-07. */
const REDUCED = has("reduced")
/* The FUSION rail. Separate plan, not another entry in CELLS, because it needs a
 * different window (seconds, not a fraction of one), a different verdict
 * vocabulary (loop vs one-shot vs still, not smooth vs strobe) and its own
 * known-answer cases. See the FUSION block below. */
const FUSION = has("fusion")
const FUSION_INTENSITY = has("fusion-intensity")
const OUT = join(
  ROOT, "docs", "verification", "layer-flicker",
  FUSION && REDUCED ? "fusion-reduced-motion"
      : REDUCED ? "reduced-motion"
        : FUSION ? `fusion-${LABEL}`
      : FUSION_INTENSITY ? `fusion-${arg("dial", "link")}-${LABEL}`
        : LABEL,
)
const VIDEO = join(OUT, "video")
const STILLS = join(OUT, "frames")
mkdirSync(VIDEO, { recursive: true })
mkdirSync(STILLS, { recursive: true })

/* Every animated preset on the THREE rails this pass owns. The texture rail was
 * added by the completion pass: procedural patterns quantise too (a hashed cell
 * lattice, a floor()ed time tick), so the "animating a quantised index" root
 * cause that explained the dither rail had to be tested here rather than
 * assumed absent. */
/* `expect` is the verdict the preset's AUTHORED INTENT requires, and it is not a
 * transcription of what the rail measured today. Sixteen of seventeen say
 * `smooth` because that IS the specification: `docs/research/ascii-glyph-
 * resolution-and-temporal-stability.md` locates the root cause of "these options
 * are weak" as *animating a quantised index instead of the value that gets
 * quantised*, and the whole rail was re-authored to stop doing that. A preset
 * that comes back STROBE has regressed to the defect.
 *
 * The one exception is named, not tolerated silently: `terminalFlicker` is a
 * flicker. Its NAME is its spec (§3 "names must match behaviour" cuts both
 * ways), and `assert-screen-layers.mjs:121` already carries the same exemption
 * for the same preset, so this is the second consumer of one rule rather than a
 * new one. RE-ROLL is on nobody's list: a pattern that re-randomises in place
 * without travelling is exactly the "weak option" finding. */
const CELLS = [
  { key: "dit_crawl", family: "animatedDither", preset: "ditherCrawl", expect: ["smooth"] },
  { key: "dit_sweep", family: "animatedDither", preset: "thresholdSweep", expect: ["smooth"] },
  { key: "dit_diag", family: "animatedDither", preset: "diagonalMatrixDrift", expect: ["smooth"] },
  { key: "asc_scroll", family: "animatedAscii", preset: "glyphScroll", expect: ["smooth"] },
  { key: "asc_rain", family: "animatedAscii", preset: "asciiRain", expect: ["smooth"] },
  { key: "asc_cycle", family: "animatedAscii", preset: "characterCycle", expect: ["smooth"] },
  {
    key: "asc_flicker", family: "animatedAscii", preset: "terminalFlicker",
    // A flicker that read `smooth` would be a preset that stopped doing the one
    // thing it is named for, so this cell is asserted in BOTH directions.
    expect: ["STROBE", "JUDDER"],
    why: "a terminal flicker is authored to strobe — the name is the spec",
  },
  { key: "asc_crawl", family: "animatedAscii", preset: "slowCodeCrawl", expect: ["smooth"] },
  { key: "tex_grain", family: "animatedTexture", preset: "grainDrift", expect: ["smooth"] },
  { key: "tex_scan", family: "animatedTexture", preset: "scanlineScroll", expect: ["smooth"] },
  { key: "tex_contour", family: "animatedTexture", preset: "rippleFlow", expect: ["smooth"] },
  { key: "tex_band", family: "animatedTexture", preset: "bandCrawl", expect: ["smooth"] },
  { key: "tex_noise", family: "animatedTexture", preset: "bubbleDrift", expect: ["smooth"] },
  { key: "tex_ripple", family: "animatedTexture", preset: "rippleRadiate", expect: ["smooth"] },
  { key: "tex_cell", family: "animatedTexture", preset: "cellFlow", expect: ["smooth"] },
  { key: "tex_hatch", family: "animatedTexture", preset: "hatchDrift", expect: ["smooth"] },
  { key: "tex_dots", family: "animatedTexture", preset: "dotStream", expect: ["smooth"] },
]

/* TWO FLOORS THE VERDICT WORD CANNOT ENFORCE ON ITS OWN.
 *
 *   TRAVEL_FLOOR — `smooth` only says the motion is not STEPPED. An effect that
 *   creeps 0.3 of a level across three seconds is smooth and invisible. `spanD`
 *   is the distance the pattern gets from where it started; the calibration's
 *   `cal_dead` reads it at ~0 and the quietest genuinely-live cell on this rail
 *   reads 13.8, so 5.0 sits an order of magnitude above the dead case and well
 *   under the signal. Set from the known-answer cases, not from taste — the same
 *   rule the fusion rail's MOVE_PATH/MOVE_LUM are set by.
 *
 *   FPS_FLOOR — this whole file exists because the sibling harness sampled at
 *   2-6 fps and every temporal number it produced was aliased. If THIS sampler
 *   ever drops to that regime its own numbers are worthless in exactly the same
 *   way, so the frame rate is asserted rather than reported. 50 is half of a
 *   60 Hz display and a fifth of the 120 Hz this machine runs at. */
const TRAVEL_FLOOR = 5.0
const FPS_FLOOR = 50

/* Known-answer cases. `expect` is a LIST because two of them are legitimately
 * satisfiable by more than one stepped verdict; nothing here accepts "smooth"
 * except the case that is supposed to be smooth. */
const CAL = [
  {
    key: "cal_dead", expect: ["DEAD"], style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "dotScreen", ditherScale: 3,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 0.25, ditherContrast: 0.55,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", motionMode: "off",
    },
  },
  {
    key: "cal_strobe", expect: ["STROBE"], style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "bayer4", ditherScale: 3,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 0.5, ditherContrast: 0.55,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", motionMode: "independent",
    },
  },
  {
    key: "cal_judder", expect: ["JUDDER", "STROBE"], style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "bayer8", ditherScale: 5,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 1.5, ditherContrast: 0.7,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", motionMode: "independent",
    },
  },
  {
    key: "cal_smooth", expect: ["smooth"], style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "dotScreen", ditherScale: 3,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 0.25, ditherContrast: 0.55,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", motionMode: "independent",
    },
  },
  {
    key: "cal_offform", expect: ["BROKEN"], crop: "corner", style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "bayer4", ditherScale: 3,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 0.5, ditherContrast: 0.55,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", motionMode: "independent",
    },
  },
]

/* ---------------------------------------------------------------------------
 * THE FUSION RAIL
 *
 * The complaint this answers: "there's presets then animated fusion presets, but
 * the normal presets some already animate, and in the animated ones some don't
 * or are broken." All three halves of that are measurable, and none of them are
 * measurable in a 2.5-second window — a reveal build takes ~3s, the break cycle
 * 7s, the balloon settle 14s. So this plan samples 13 SECONDS per cell and asks
 * the same question twice: what is moving in the first three seconds, and what is
 * still moving in the last six.
 *
 *   LIVE-LOOP        still moving late. A relationship that breathes forever.
 *   ONE-SHOT→STILL   moved early, dead late. It plays once and never again.
 *   DEAD-STILL       never moved. The option does nothing.
 *
 * Every preset is run with the drive OFF and ON, so "does turning animation on
 * add motion" is a subtraction rather than an opinion.
 * ------------------------------------------------------------------------- */
/* (preset, drive) -> the registry id that NAMES that combination, read from the
 * registry rather than transcribed. A hardcoded list here is how you get a matrix
 * that silently stops covering a combination someone added — and a hole in this
 * exact table (Pixel Clay having no second shape at all) was one of the findings,
 * so the table has to be generated if it is going to be able to show holes. */
const FUSION_SHAPE_ID = (() => {
  const m = new Map()
  const S = loadTs("lib/style-system.ts")
  for (const p of S.FUSION_PRESET_DEFS) m.set(`${p.id}:loop`, p.id)
  for (const p of S.ANIMATED_FUSION_PRESET_DEFS) {
    m.set(`${p.applies.fusionPreset}:${p.applies.fusionDrive}`, p.id)
  }
  return m
})()
const FUSION_DRIVES = ["loop", "arc", "burst"]

const FUSION_CELLS = [
  { key: "terminalGel", mode: "inflate" },
  { key: "ditherBloom", mode: "solid" },
  // extrude, not rod. Signal Ink is authored for both (`bestModes: ["rod",
  // "extrude"]`), but a rod stroke is thin enough that the densest 192px window
  // still comes out 7.2% ink and the sampler correctly refuses to report a number
  // it cannot stand behind. Measuring it on the other mode it was authored for is
  // the honest fix; loosening the on-form guard would not be.
  { key: "signalInk", mode: "extrude" },
  { key: "asciiRubber", mode: "inflate" },
  { key: "scanlineBalloon", mode: "inflate" },
  { key: "pixelClay", mode: "solid" },
  { key: "codeBloom", mode: "extrude" },
  { key: "glitchRibbon", mode: "extrude" },
  // gate-integrity: partial BUILTIN_LINK_FUSIONS — `viewTurn` is driven by the
  // CAMERA, not by style time. This gate holds the camera still and measures
  // motion over a time window, so it would be asking that one relationship the
  // single question it is designed to answer with "nothing". Its evidence is an
  // ORBIT sweep with an uncoupled control arm, not a liveness window:
  // `_probe-fusion-sheet.mjs --orbit=viewTurn`, sheet in
  // docs/verification/fusion-rail/.
  /* THE FOUR ADDED 2026-08-03, on the mode each was authored for
   * (`bestModes` in lib/style-system.ts). A cell list that does not follow the
   * rail is how `assert-hero-option-panel` graded four films against seven and
   * read ALL PASS throughout — the exact defect the meta-gate's inventory
   * channel exists to catch, and it would have caught this one on its next run.
   *
   * ⚠ `viewTurn` IS DELIBERATELY NOT HERE, and that is a statement rather than
   * an omission: its relationship is driven by the CAMERA, not by style time, so
   * a liveness gate that holds the camera still and measures motion over a time
   * window is asking it the one question it is designed to answer with
   * "nothing". Its evidence is an ORBIT sweep with an uncoupled control arm —
   * `_probe-fusion-sheet.mjs --orbit=viewTurn`, sheet in
   * docs/verification/fusion-rail/ — because the axis it lives on is the one
   * this instrument does not travel. */
  { key: "slowWeather", mode: "solid" },
  { key: "formation", mode: "extrude" },
  { key: "wholeCloth", mode: "solid" },
]

/* Known-answer cases for the FUSION verdict, all three constructed so their
 * answer is fixed by something other than the code under test.
 *
 *   fus_still  fusion ON at intensity 0. `evaluateFusion` returns the identity
 *              frame by an explicit early return, and Code Bloom animates none
 *              of its own layers, so there is nothing left that could move.
 *              If this does not read DEAD-STILL the sampler is inventing motion.
 *   fus_loop   Code Bloom's ambient drive: a continuous sine on scene time. Must
 *              read LIVE-LOOP.
 *   fus_once   a one-shot from a DIFFERENT subsystem — the dither layer on
 *              `completionPulse`, whose envelope lib/style-clock.ts gives a hard
 *              1.86s lifetime after which it explicitly parks the phase. Not
 *              fusion at all, deliberately: calibrating a one-shot detector on a
 *              fusion one-shot would be circular. Must read ONE-SHOT→STILL. */
const FUSION_CAL = [
  {
    key: "fus_still", mode: "extrude", expect: ["DEAD-STILL"],
    select: ["fusion", "codeBloom"], patch: { fusionIntensity: 0 },
  },
  {
    key: "fus_loop", mode: "extrude", expect: ["LIVE-LOOP"],
    select: ["fusion", "codeBloom"],
  },
  {
    key: "fus_once", mode: "solid", expect: ["ONE-SHOT→STILL"],
    style: {
      ditherEnabled: true, ditherAnimated: true, ditherType: "bayer4", ditherScale: 3,
      ditherLevels: 2, ditherIntensity: 1, ditherSpeed: 1, ditherContrast: 0.55,
      ditherThreshold: 0.5, ditherExposure: 0.46, ditherDirection: "diagonal",
      ditherLockMode: "screen", ditherSyncMode: "completionPulse",
      motionMode: "independent",
    },
  },
]

const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  // The texture rail is the one family whose presets never declared their own
  // lock mode, so the read has to pin it or a texture cell is measured in
  // whatever projection the previous cell left behind.
  textureLockMode: "object",
  ditherEnabled: false, ditherAnimated: false, ditherDirection: "static",
  asciiEnabled: false, asciiAnimated: false, asciiAnimationType: "none",
  // Sync modes are part of the reset because the fusion rail's calibration arms a
  // completionPulse on the dither layer; leaving that behind would put a one-shot
  // envelope under the next cell's measurement.
  textureSyncMode: "independent", ditherSyncMode: "independent", asciiSyncMode: "independent",
  fusionPreset: "none", fusionAnimationEnabled: false, layerStackEnabled: false,
  stackAnimationEnabled: false, materialAnimationEnabled: false, motionMode: "off",
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

/* ---- the in-page sampler -------------------------------------------------
 * Runs entirely in the page so it can hit rAF cadence. Registered AFTER the
 * renderer's own rAF, so by the time it runs the frame has been drawn.
 * Returns per-frame deltas over the ink mask taken from frame 0, plus the
 * distance from frame 0 for every frame (for travel-vs-re-roll). */
const SAMPLER = ({ n, crop, keep }) =>
  new Promise((resolve) => {
    const cs = [...document.querySelectorAll("canvas")]
    const src = cs.reduce((a, b) => (b.getBoundingClientRect().x > a.getBoundingClientRect().x ? b : a))
    /* SAMPLE 1:1, NEVER DOWNSCALED.
     *
     * The first version drew the whole 700x768 viewport into a 128x128 buffer.
     * That is a 5.5x box filter, and the features being judged are SMALLER than
     * the filter: an ASCII glyph bit is cellSize/5 = 3.6 device px, which lands
     * at 0.65px in a 128-wide read. Glyph Scroll therefore measured span 0.011
     * over three full seconds — "completely dead" — while a screenshot pair 1.4s
     * apart plainly differed. The motion was real and the ruler averaged it out.
     * Dither Crawl survived the same downscale only because a 2-level bayer step
     * inverts large contiguous areas, which no box filter can hide.
     *
     * So: crop a window out of the densest ink at native device resolution and
     * compare those pixels. Small enough to read back at display rate, and it
     * resolves a single glyph bit. */
    const W = 192, H = 192
    const cv = document.createElement("canvas")
    cv.width = W; cv.height = H
    const g = cv.getContext("2d", { willReadFrequently: true })
    // PAPER MUST BE PAINTED IN FIRST. The r3f canvas is created with
    // `alpha: true` and its paper colour is a CSS background on the ELEMENT, not
    // pixels in the drawing buffer. drawImage() copies only the buffer, so
    // compositing it onto a cleared (transparent-black) 2D canvas turns the
    // paper into rgb(0,0,0) and premultiplies the ink down toward black — the
    // first run of this script measured meanLum 5.1 on a paper-white viewport
    // and reported every preset "DEAD" because the ink mask came out empty.
    // Fill with the same #fafafa the element uses and the read matches the eye.
    const cs2 = getComputedStyle(src).backgroundColor
    const PAPER_CSS = cs2 && cs2 !== "rgba(0, 0, 0, 0)" ? cs2 : "#fafafa"
    /* Locate the densest patch of ink once, at full resolution, so the crop is
     * over the subject rather than over paper. */
    const loc = (() => {
      const SW = 256, SH = 256
      const lc = document.createElement("canvas")
      lc.width = SW; lc.height = SH
      const lg = lc.getContext("2d", { willReadFrequently: true })
      lg.fillStyle = PAPER_CSS
      lg.fillRect(0, 0, SW, SH)
      lg.drawImage(src, 0, 0, SW, SH)
      const d = lg.getImageData(0, 0, SW, SH).data
      const hist = new Float64Array(256)
      const L = new Float32Array(SW * SH)
      for (let p = 0, q = 0; q < L.length; p += 4, q++) {
        L[q] = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]
        hist[Math.max(0, Math.min(255, Math.round(L[q])))]++
      }
      let pap = 0
      for (let v = 1; v < 256; v++) if (hist[v] > hist[pap]) pap = v
      // Coverage over a grid of candidate windows the same relative size as the
      // crop, then take the densest.
      const gw = Math.max(1, Math.round((W / src.width) * SW))
      const gh = Math.max(1, Math.round((H / src.height) * SH))
      let best = -1, bx = 0, by = 0
      for (let y = 0; y + gh <= SH; y += 4) {
        for (let x = 0; x + gw <= SW; x += 4) {
          let cnt = 0
          for (let yy = y; yy < y + gh; yy += 2) {
            for (let xx = x; xx < x + gw; xx += 2) {
              if (Math.abs(L[yy * SW + xx] - pap) > 6) cnt++
            }
          }
          if (cnt > best) { best = cnt; bx = x; by = y }
        }
      }
      return {
        sx: Math.round((bx / SW) * src.width),
        sy: Math.round((by / SH) * src.height),
      }
    })()
    // crop === "corner" is the CALIBRATION input, not an option a real run uses:
    // it deliberately puts the read on blank paper while the effect is running,
    // so the script has to prove it can tell "off the form" from "not moving".
    const wanted = crop === "corner" ? { sx: 2, sy: 2 } : loc
    const SX = Math.max(0, Math.min(src.width - W, wanted.sx))
    const SY = Math.max(0, Math.min(src.height - H, wanted.sy))
    /* STREAMING, NOT ACCUMULATING.
     *
     * The original kept every sampled frame (a 192x192 Float32Array each) and
     * did the arithmetic at the end. At the 150-frame window the dither/ascii/
     * texture rails use that is 22 MB and fine. The FUSION rail cannot live in a
     * 150-frame window at all: its choreographies run 3-14 SECONDS (a reveal
     * build, a 7s break cycle, a 14s settle), so judging them needs ~720 frames
     * — 106 MB of retained buffers inside the page, per cell, which is how you
     * get a renderer that starts dropping frames and a "motion" number that is
     * really a measurement of your own GC.
     *
     * Every statistic here only ever compares frame k to frame k-1 or to frame
     * 0, so exactly two buffers need to be alive. The mask and both on-form
     * guards come from frame 0, which is available on the first tick. The output
     * arrays are therefore identical to the accumulating version's, element for
     * element — `runMetricCal()` is what proves that, and it reproduces all five
     * known answers unchanged. */
    const times = []
    const stills = []
    // Per-frame mean luminance over the ink mask. The MAD deltas answer "did the
    // pixels move"; this answers "did the whole thing get brighter or darker",
    // which is the axis half the fusion relationships drive (emissive glow,
    // wet-look albedo darkening). A glow that swells and fades uniformly moves
    // every ink pixel by the same small amount — real, readable, and easy to
    // mistake for noise in a delta-only read.
    const lums = []
    const deltas = []
    const fromZero = []
    const keepSet = new Set(keep || [])
    let i = 0
    let f0 = null, prev = null, mask = null
    let paper = 0, sd = 0, inkFrac = 0
    const mad = (a, b) => {
      let s = 0
      for (let k = 0; k < mask.length; k++) s += Math.abs(a[mask[k]] - b[mask[k]])
      return s / mask.length
    }
    const tick = () => {
      g.globalCompositeOperation = "source-over"
      g.fillStyle = PAPER_CSS
      g.fillRect(0, 0, W, H)
      g.drawImage(src, SX, SY, W, H, 0, 0, W, H)
      const d = g.getImageData(0, 0, W, H).data
      const L = new Float32Array(W * H)
      for (let p = 0, q = 0; q < L.length; p += 4, q++) {
        L[q] = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]
      }
      times.push(performance.now())
      if (!f0) {
        // Ink mask = pixels far from the modal (paper) luminance in frame 0. The
        // whole point is to not average the effect away against static paper.
        f0 = L
        const hist = new Float64Array(256)
        for (const v of f0) hist[Math.max(0, Math.min(255, Math.round(v)))]++
        for (let v = 1; v < 256; v++) if (hist[v] > hist[paper]) paper = v
        const m = []
        for (let q = 0; q < f0.length; q++) if (Math.abs(f0[q] - paper) > 6) m.push(q)
        mask = m
        // A near-empty mask means the read is broken (see PAPER_CSS above), not
        // that the effect is subtle. Say so instead of reporting a fake 0.
        //
        // TWO GUARDS, because "is there ink" alone was fooled in the sibling
        // script by a flat grey UI panel, which is not paper by any
        // distance-from-paper test and therefore reads as 100% ink.
        //   inkFrac — enough of the crop is not paper to be ON the subject.
        //   sd      — the crop is not a FLAT field. A blank corner of the stage
        //             carries a faint grid line or two, so 40 stray pixels can
        //             clear the mask test; a field with no structure cannot
        //             possibly be the densest ink on the form.
        let s1 = 0, s2 = 0
        for (const v of f0) { s1 += v; s2 += v * v }
        sd = Math.sqrt(Math.max(0, s2 / f0.length - (s1 / f0.length) ** 2))
        inkFrac = mask.length / f0.length
        if (mask.length < 40 || inkFrac < 0.10) {
          return resolve({ broken: `ink ${(inkFrac * 100).toFixed(1)}% of crop (${mask.length}px, paper=${paper})` })
        }
        if (sd < 1.5) return resolve({ broken: `crop is a flat field (sd ${sd.toFixed(2)})` })
      } else {
        deltas.push(mad(prev, L))
        fromZero.push(mad(f0, L))
      }
      let ls = 0
      for (let k = 0; k < mask.length; k++) ls += L[mask[k]]
      lums.push(ls / mask.length)
      prev = L
      // Native-resolution stills of the exact pixels the numbers are computed
      // from. A number and a picture that disagree is how three of the four
      // measurement failures in this pass were found; keeping them from the SAME
      // buffer removes the "which one is lying" question.
      if (keepSet.has(i)) stills.push({ i, png: cv.toDataURL("image/png") })
      if (++i >= n) return resolve(finish())
      requestAnimationFrame(tick)
    }
    const finish = () => {
      const dt = []
      for (let k = 1; k < times.length; k++) dt.push(times[k] - times[k - 1])
      return { deltas, fromZero, lums, dt, inkPx: mask.length, inkFrac, sd, paper, stills, SX, SY }
    }
    requestAnimationFrame(tick)
  })

const quant = (a, q) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]
}

/* METRICS DELIBERATELY NOT BUILT ON THE MEDIAN.
 *
 * The first version used p95/median as "stepiness", and every stepped preset
 * came back as the sentinel 999 — because when an effect is frozen for more than
 * half of all frames the median IS 0 and the ratio is a divide-by-zero, not a
 * measurement. That is the exact regime this script exists to characterise, so
 * the statistic has to survive it.
 *
 * mean is the robust denominator (it counts the jumps the holds are hiding), and
 * `frozenFrac` is measured against an ABSOLUTE floor rather than a relative one,
 * so "how much of the time is this thing simply not moving" is answered without
 * reference to how big its jumps are.
 *
 * EXTRACTED INTO A FUNCTION so `runMetricCal()` scores its known-answer cases with
 * the SAME arithmetic the real run uses. A calibration that runs a parallel
 * implementation calibrates nothing. */
const FROZEN = 0.02 // mean |Δ| per ink pixel, on 0..255: below this the frame is a repeat

/**
 * Slice a sampler result down to a frame window, so the SAME arithmetic can be
 * asked about the first three seconds and the last five separately.
 *
 * WHY THE WINDOW EXISTS. A one-shot choreography and a continuous loop are
 * indistinguishable in a whole-window read: both report plenty of motion. They
 * differ only in WHERE the motion is. Measuring early and late with the same
 * ruler is what separates "plays once then sits dead" from "keeps breathing" —
 * and that distinction is the entire fusion complaint.
 *
 * `deltas`/`fromZero` are offset by one from `lums` (delta k is between frames
 * k and k+1), which is why the slices are taken with that offset rather than
 * from the same index.
 */
function windowOf(r, a, b) {
  const hi = Math.min(b, r.lums.length)
  return {
    ...r,
    deltas: r.deltas.slice(Math.max(0, a - 1), Math.max(0, hi - 1)),
    fromZero: r.fromZero.slice(Math.max(0, a - 1), Math.max(0, hi - 1)),
    lums: r.lums.slice(a, hi),
    dt: r.dt.slice(Math.max(0, a - 1), Math.max(0, hi - 1)),
  }
}

function measure(r, label) {
  const n = r.deltas.length
  const mean = r.deltas.reduce((a, b) => a + b, 0) / n
  const med = quant(r.deltas, 0.5)
  const p95 = quant(r.deltas, 0.95)
  const max = Math.max(...r.deltas)
  const span = Math.max(...r.fromZero)
  const fps = 1000 / (r.dt.reduce((a, b) => a + b, 0) / r.dt.length)
  const frozen = r.deltas.filter((v) => v < FROZEN).length
  const secs = n / fps
  // A "step" = a frame that moved after at least one frozen frame. Counting
  // transitions rather than large frames gives the true update rate of a
  // quantised effect regardless of how big each quantum is.
  let steps = 0
  for (let k = 0; k < n; k++) {
    if (r.deltas[k] >= FROZEN && (k === 0 || r.deltas[k - 1] < FROZEN)) steps++
  }
  /* jumpD — HOW BIG IS THE UPDATE, measured over the frames that MOVED.
   *
   * FOUND BY THE METRIC CALIBRATION, ON ITS FIRST RUN, ON THE CASE WHOSE ANSWER WAS ALREADY
   * KNOWN. The verdict used to be built on p95 of ALL deltas, and p95 is
   * knife-edge unstable in precisely the regime this script exists to
   * characterise: the historical Dither Crawl is frozen for 94.6% of frames, so
   * the 95th percentile sits a hair from the edge of the frozen mass. One run
   * measured p95 = 45.1 (inside the jumps) and the next measured p95 = 0.00
   * (inside the holds) on bit-identical shader state. With p95 = 0, travelRat =
   * span/p95 collapsed to 0 and the verdict came out RE-ROLL — the OPPOSITE
   * diagnosis ("moves every frame, never travels") for something that is frozen
   * 19 frames out of 20 and travels 97/255. A strobe was being reported as its
   * own inverse, and nothing in the old script could have noticed.
   *
   * The fix is to stop asking a percentile of the whole distribution about a
   * bimodal one. "When it moves, how far does it move" is a conditional
   * statistic, so condition on it: the median of the moving frames. That is
   * well-defined at ANY frozen fraction, and it is exactly the quantity the
   * verdict is asking about.
   *
   * p95D is still reported, for continuity with the numbers already published in
   * docs/research/ascii-glyph-resolution-and-temporal-stability.md §4.3. It is no
   * longer allowed to decide anything. */
  const moving = r.deltas.filter((v) => v >= FROZEN)
  const jumpD = moving.length ? quant(moving, 0.5) : 0
  /* TONE SWING — the axis MAD cannot see well.
   *
   * Half the fusion relationships drive the surface, not the pattern: emissive
   * glow swelling, albedo darkening as the ink "wets". Those move every ink
   * pixel by the same few levels, which lands as a small MAD and a large,
   * unmistakable change to the eye. lumRange is measured on the 5th..95th
   * percentile so one dropped frame cannot manufacture a swing. */
  const lumRange = r.lums && r.lums.length > 2 ? quant(r.lums, 0.95) - quant(r.lums, 0.05) : 0
  const lumMean = r.lums && r.lums.length ? r.lums.reduce((a, b) => a + b, 0) / r.lums.length : 0
  return {
    ...label, fps: +fps.toFixed(1), inkPx: r.inkPx,
    lumMean: +lumMean.toFixed(2), lumRange: +lumRange.toFixed(2),
    // Total distance the pattern travelled per second, holds included. Unlike
    // spanD this is window-local, so it is the honest "is it still moving NOW".
    pathD: +(r.deltas.reduce((a, b) => a + b, 0) / (n / fps)).toFixed(2),
    inkFrac: +r.inkFrac.toFixed(3), cropSd: +r.sd.toFixed(2), frames: n,
    meanD: +mean.toFixed(3), medianD: +med.toFixed(3), p95D: +p95.toFixed(3),
    jumpD: +jumpD.toFixed(3), jumpP95: +quant(moving, 0.95).toFixed(3),
    maxD: +max.toFixed(3), spanD: +span.toFixed(3),
    // >3 means the motion arrives in jumps much larger than its average pace.
    stepiness: +(mean > 0.0005 ? max / mean : 0).toFixed(2),
    frozenFrac: +(frozen / n).toFixed(3),
    stepHz: +(steps / secs).toFixed(2),
    // Does it go anywhere, or re-roll in place? Compared against the JUMP size,
    // not the average, so holds cannot inflate it.
    travelRat: +(jumpD > 0.0005 ? span / jumpD : 0).toFixed(2),
    deltas: r.deltas.map((v) => +v.toFixed(2)),
  }
}

/* VERDICTS.
 *  DEAD    — nothing moves at all.
 *  STROBE  — mostly frozen, and each update is a large jump, at a rate in the
 *            band the eye reads as flicker rather than motion.
 *  JUDDER  — mostly frozen with small updates: motion, but stepped.
 *  RE-ROLL — moves every frame but never travels: it re-randomises in place.
 *  smooth  — moves a little every frame and gets somewhere. */
function verdictOf(row) {
  if (row.spanD < 0.2) return "DEAD"
  // The amplitude gate is 5, not 1. Threshold Sweep holds still for 49% of
  // frames but each update moves ~0.6 on a 0..255 scale — a change that small is
  // not a strobe by any perceptual definition, and gating at 1.0 labelled the
  // one genuinely smooth preset on the rail as the worst offender.
  if (row.frozenFrac > 0.45 && row.jumpD > 5 && row.stepHz < 24) return "STROBE"
  // Same amplitude gate as STROBE, for the same reason: holding still is only a
  // defect if the update you were waiting for is big enough to see.
  if (row.frozenFrac > 0.45 && row.jumpD > 2) return "JUDDER"
  if (row.travelRat < 1.6) return "RE-ROLL"
  return "smooth"
}

/* FUSION LIVENESS.
 *
 * Two independent channels, because the fusion relationships split cleanly into
 * two kinds and each is nearly invisible to the other's ruler:
 *   pathD     the pattern MOVED  (threshold matrix sliding, glyphs re-rolling)
 *   lumRange  the tone SWUNG     (glow swelling, albedo wetting)
 * Either one alone is enough to call a window alive.
 *
 * The floors are set from the calibration cases, not from taste: the identity
 * frame (fusion at intensity 0) reads pathD 0.00 / lumRange ~0.0x, and the
 * quietest genuinely-visible ambient drive on the rail reads pathD > 2. 0.60 and
 * 1.50 sit an order of magnitude above the noise and well below the signal. */
const MOVE_PATH = 0.6
const MOVE_LUM = 1.5
const isMoving = (w) => w.pathD > MOVE_PATH || w.lumRange > MOVE_LUM
function fusionVerdict(early, late) {
  const e = isMoving(early), l = isMoving(late)
  if (l) return "LIVE-LOOP"
  if (e) return "ONE-SHOT→STILL"
  return "DEAD-STILL"
}

const line = (key, row, verdict) =>
  `[flicker] ${key.padEnd(12)} mean=${row.meanD.toFixed(2).padStart(6)} jump=${row.jumpD
    .toFixed(2).padStart(6)} max=${row.maxD.toFixed(2).padStart(6)} step=${String(row.stepiness)
    .padStart(6)} frozen=${String(row.frozenFrac).padStart(5)} stepHz=${String(row.stepHz)
    .padStart(6)} span=${String(row.spanD).padStart(7)} travel=${String(row.travelRat).padStart(6)}  ${verdict}`

/** Frame indices to keep as native-resolution PNGs.
 *
 * TWO SETS, because they answer different questions and an evenly-spaced strip
 * cannot answer the second one.
 *   spread — 8 frames across the whole window: does the effect GO anywhere.
 *   run    — 10 CONSECUTIVE frames from the middle: what does one frame of this
 *            motion actually look like. A strip sampled every 25 frames is a
 *            0.2s stride, which is the same 4-6fps aliasing that made the old
 *            motion harness unusable — it cannot show whether a pattern advanced
 *            a tenth of a feature or three whole features between frames. Every
 *            "too fast / shimmer" judgement has to be made on adjacent frames. */
const keepIdx = (n) => {
  const spread = Array.from({ length: 8 }, (_, i) => Math.min(n - 1, Math.round((i * (n - 1)) / 7)))
  const mid = Math.floor(n / 2)
  const run = Array.from({ length: 10 }, (_, i) => Math.min(n - 1, mid + i))
  return [...new Set([...spread, ...run])].sort((a, b) => a - b)
}

function writeStills(key, stills) {
  if (!stills || !stills.length) return
  const dir = join(STILLS, key)
  mkdirSync(dir, { recursive: true })
  for (const s of stills) {
    writeFileSync(
      join(dir, `${String(s.i).padStart(4, "0")}.png`),
      Buffer.from(s.png.split(",")[1], "base64"),
    )
  }
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: VIDEO, size: { width: 1400, height: 900 } },
    // --reduced drives the REAL media query, not a test hook, so what is asserted
    // is the behaviour a user with the OS setting on actually gets.
    ...(REDUCED ? { reducedMotion: "reduce" } : {}),
  })
  const page = await ctx.newPage()
  let ACTIVE_MODE = MODE
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })

  /* IS THERE A FORM ON THE STAGE, AND HAS IT FINISHED DRAWING?
   *
   * Both halves earned by failure, in one run of --reduced. A Fast Refresh (this
   * runs against the dev server while the tree is being edited) remounts the
   * viewport and takes the injected strokes with it. The old guard asked only
   * `!!window.__styleHarness`, which comes BACK with the remount — so it saw a
   * healthy page and sampled nine consecutive presets off a blank stage, then
   * four more while the replacement stroke was still drawing in. Every one of the
   * thirteen produced a confident number: the blank ones read "ink 1.6% of crop"
   * and the mid-draw-in ones read STROBE with a span of 65, which is the GEOMETRY
   * growing and has nothing to do with the layer under test.
   *
   * That is failure mode #3 of this pass all over again — a real number about the
   * wrong pixels — so the guard asserts the SUBJECT, not the API surface.
   *
   * ...AND THE SECOND HALF WAS ONLY IN THE COMMENT. The version that shipped that
   * paragraph tested ink >= 3% and paper >= 200 and nothing else, so it answered
   * "is there a form" twice and "has it finished drawing" never. Arithmetic: the
   * test stroke covers ~18.6% of the canvas when complete, so a form that is 30%
   * drawn reads 5.6% ink and clears a 3% floor with room to spare. The exact
   * condition the comment was written about — thirteen cells measured on a form
   * that was still growing — would have passed the guard that was written to
   * catch it. `calibrateGuard()` below exists because of that, and it drives the
   * page's OWN Play button rather than a test hook, because the failure arrived
   * through a real draw-in.
   *
   * THREE TESTS, and each one has a blind spot the other two cover:
   *   ink/paper     there is a subject and we are looking at the stage.
   *                 Blind to: a partial form, which is still a subject.
   *   playhead      the reveal is parked at 1. Cheap, exact, and it is the API
   *                 surface — so it is never the only test.
   *   growth        the ink fraction is not RISING between two reads. This is the
   *                 one that answers the question in pixels: a form drawing in
   *                 gains area monotonically, and 200 ms of a ~1.8 s draw-in is
   *                 ~11% relative growth against a 1.5% gate. Style layers are
   *                 forced OFF before the read (see `ensure`) so the only thing
   *                 that can move the ink count is the geometry. */
  const GROW_MS = 200
  const GROW_GATE = 0.015
  const stageProbe = () =>
    page.evaluate(() => {
      if (!window.__styleHarness || !window.__revealHarness) return { why: "harness gone" }
      const cs = [...document.querySelectorAll("canvas")]
      if (!cs.length) return { why: "no canvas" }
      const src = cs.reduce((a, b) => (b.getBoundingClientRect().x > a.getBoundingClientRect().x ? b : a))
      const S = 200
      const cv = document.createElement("canvas")
      cv.width = S; cv.height = S
      const g = cv.getContext("2d", { willReadFrequently: true })
      const bg = getComputedStyle(src).backgroundColor
      g.fillStyle = bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#fafafa"
      g.fillRect(0, 0, S, S)
      g.drawImage(src, 0, 0, S, S)
      const d = g.getImageData(0, 0, S, S).data
      const hist = new Float64Array(256)
      const L = new Float32Array(S * S)
      for (let p = 0, q = 0; q < L.length; p += 4, q++) {
        L[q] = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]
        hist[Math.max(0, Math.min(255, Math.round(L[q])))]++
      }
      let paper = 0
      for (let v = 1; v < 256; v++) if (hist[v] > hist[paper]) paper = v
      let ink = 0
      for (const v of L) if (Math.abs(v - paper) > 6) ink++
      let progress = null
      try { progress = window.__revealHarness.getProgress() } catch { progress = null }
      return { frac: ink / L.length, paper, progress }
    }).catch((e) => ({ why: "evaluate threw: " + String(e).slice(0, 80) }))

  /** The verdict, kept OUT of the page so `calibrateGuard()` can report exactly
   *  which of the three tests fired on each known-bad input. A guard that only
   *  ever says "not ready" cannot be shown to be testing three things. */
  const formReady = async () => {
    const a = await stageProbe()
    if (a.why) return { ok: false, fired: "harness", why: a.why }
    // 3% of the whole viewport: the stage grid alone is well under that, and a
    // drawn stroke is well over it.
    if (a.frac < 0.03) {
      return { ok: false, fired: "ink", why: `stage is blank (ink ${(a.frac * 100).toFixed(1)}%)`, frac: +a.frac.toFixed(3) }
    }
    if (a.paper < 200) {
      return { ok: false, fired: "paper", why: `paper measured ${a.paper}, not on the stage`, frac: +a.frac.toFixed(3) }
    }
    if (a.progress !== null && a.progress < 0.999) {
      return { ok: false, fired: "playhead", why: `draw-in at playhead ${a.progress.toFixed(3)}`, frac: +a.frac.toFixed(3), progress: a.progress }
    }
    await page.waitForTimeout(GROW_MS)
    const b = await stageProbe()
    if (b.why) return { ok: false, fired: "harness", why: b.why }
    const growth = (b.frac - a.frac) / Math.max(a.frac, 1e-6)
    if (growth > GROW_GATE) {
      return {
        ok: false, fired: "growth",
        why: `form still growing (ink ${(a.frac * 100).toFixed(1)}% -> ${(b.frac * 100).toFixed(1)}%, +${(growth * 100).toFixed(1)}% in ${GROW_MS}ms)`,
        frac: +b.frac.toFixed(3), growth: +growth.toFixed(4),
      }
    }
    return { ok: true, fired: "none", frac: +b.frac.toFixed(3), growth: +growth.toFixed(4), progress: a.progress }
  }

  const bootstrap = async () => {
    await page.waitForFunction(
      () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
      null, { timeout: 60000 })
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), testStroke())
    await page.waitForTimeout(1800)
    // ACTIVE_MODE, not MODE: the fusion rail measures each preset in the geometry
    // mode its own `bestModes` names, so a re-bootstrap mid-run has to restore the
    // mode the current cell asked for rather than the CLI default.
    await page.evaluate((m) => window.__styleHarness.setMode(m), ACTIVE_MODE)
    await page.waitForTimeout(1200)
    // PIN THE PLAYHEAD AT 1. This script never set it, and relied on the injected
    // stroke's own draw-in finishing inside the 1800ms wait. When it does not, the
    // "effect" being measured is the form still growing.
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__captureHarness.frontView(0.95))
    // STYLE OFF BEFORE THE READ, not after. The growth test counts ink pixels
    // twice 200ms apart, and an animated dither can move that count on its own —
    // which would make the guard's verdict depend on which preset the PREVIOUS
    // cell left running. Every caller sets its own style immediately after, so
    // this costs nothing and makes geometry the only thing the read can see.
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(600)
    const st = await formReady()
    if (!st.ok) throw new Error("bootstrap: " + st.why)
  }
  for (let a = 0; ; a++) {
    try { await bootstrap(); break } catch (e) {
      if (a >= 5) throw e
      console.log("[flicker] bootstrap retry", a + 1, "-", e.message)
      await page.waitForTimeout(2000)
    }
  }
  const ensure = async () => {
    for (let a = 0; a < 6; a++) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF).catch(() => {})
      const st = await formReady()
      if (st.ok) return
      console.log(`[flicker] stage not ready (${st.fired}: ${st.why}) — re-establishing`)
      try { await bootstrap(); return } catch { await page.waitForTimeout(1500) }
    }
    throw new Error("ensure: could not get a form on the stage")
  }

  /* ---- CALIBRATING THE GUARD ITSELF ------------------------------------
   * The rule this project keeps re-learning: an assertion that has never been
   * shown to FAIL is not evidence. That applies to the guard as much as to the
   * metrics, and the guard is the one every other number depends on — nine cells
   * were measured on blank paper and four more mid-draw-in while it reported a
   * healthy page.
   *
   * Four inputs whose answer is fixed outside this script:
   *   gd_blank    strokes cleared. There is no subject. Must FAIL.
   *   gd_playing  the page's OWN Play button, pressed on a full stroke, so the
   *               reveal really is running. Must FAIL — and the `growth` test
   *               must be one of the ones that fires, because that is the half
   *               that reads the FORM rather than the harness. If only the
   *               playhead test ever fires, the pixel half is dead and this
   *               calibration says so.
   *   gd_partial  playhead pinned at 0.45. Must FAIL, and its ink fraction must
   *               be materially below the finished form's — that is the evidence
   *               the pixel read can resolve a partial form at all.
   *   gd_ready    the state every measurement is taken in. Must PASS.
   */
  const calibrateGuard = async () => {
    const rows = []
    const say = (r) => {
      rows.push(r)
      if (!r.ok) failed++
      /* Leads with the token for the same reason `runMetricCal` does — these are
       * the guard's three known-BAD stages, and `[guard] PASS …` is counted by
       * nothing. */
      console.log(`${r.ok ? "PASS" : "FAIL"}  CONTROL · guard ${r.key.padEnd(11)} ${r.note}`)
    }
    await ensure()
    const full = await formReady()
    const fullFrac = full.frac ?? 0

    // gd_blank
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(700)
    let g = await formReady()
    say({
      key: "gd_blank", ok: g.ok === false, fired: g.fired, why: g.why,
      note: `guard ${g.ok ? "ACCEPTED A BLANK STAGE" : `rejected (${g.fired}: ${g.why})`}`,
    })

    // gd_playing — through the real transport control, not a test hook.
    await bootstrap()
    await page.evaluate(() => window.__revealHarness.setProgress(0))
    await page.waitForTimeout(250)
    const playBtn = await page.$('[aria-label="Play"]')
    if (!playBtn) {
      say({ key: "gd_playing", ok: false, note: "no [aria-label=\"Play\"] control in the real UI — cannot press Play" })
    } else {
      await playBtn.click()
      await page.waitForTimeout(300)
      g = await formReady()
      const grew = g.fired === "growth"
      // The playhead test runs first and will usually be the one that fires, so
      // ask the growth half its own question directly: two reads, is the ink
      // rising? Same GROW_MS, same gate, on the same drawing-in form.
      const p1 = await stageProbe()
      await page.waitForTimeout(GROW_MS)
      const p2 = await stageProbe()
      const rise = p1.frac > 0 ? (p2.frac - p1.frac) / p1.frac : 0
      say({
        key: "gd_playing", ok: g.ok === false && (grew || rise > GROW_GATE),
        fired: g.fired, why: g.why, riseWhilePlaying: +rise.toFixed(4),
        note: `guard ${g.ok ? "ACCEPTED A DRAWING-IN FORM" : `rejected (${g.fired}: ${g.why})`}; independent growth read ${(rise * 100).toFixed(1)}%/${GROW_MS}ms vs gate ${(GROW_GATE * 100).toFixed(1)}%`,
      })
    }

    // gd_partial
    await bootstrap()
    await page.evaluate(() => window.__revealHarness.setProgress(0.45))
    await page.waitForTimeout(500)
    g = await formReady()
    const partFrac = g.frac ?? 0
    say({
      key: "gd_partial", ok: g.ok === false && partFrac < fullFrac * 0.85,
      fired: g.fired, why: g.why, frac: partFrac, fullFrac,
      note: `guard ${g.ok ? "ACCEPTED A HALF-DRAWN FORM" : `rejected (${g.fired}: ${g.why})`}; ink ${(partFrac * 100).toFixed(1)}% vs finished ${(fullFrac * 100).toFixed(1)}%`,
    })

    // gd_ready
    await bootstrap()
    g = await formReady()
    say({
      key: "gd_ready", ok: g.ok === true, fired: g.fired, why: g.why, frac: g.frac,
      note: g.ok ? `accepted the measurement state (ink ${(g.frac * 100).toFixed(1)}%, growth ${(g.growth * 100).toFixed(2)}%)` : `REJECTED THE STATE EVERY MEASUREMENT IS TAKEN IN (${g.fired}: ${g.why})`,
    })
    writeFileSync(join(OUT, "guard-calibration.json"), JSON.stringify(rows, null, 2))
    return rows
  }

  const sample = (crop, n = FRAMES) =>
    page.evaluate(SAMPLER, { n, crop, keep: keepIdx(n) })

  let failed = 0

  /* THE METRIC'S KNOWN-ANSWER CASES, extracted so the DEFAULT path can run them
   * too. Five inputs whose answer is fixed outside this script, two of them
   * KNOWN BAD (`cal_strobe` is the historical Dither Crawl defect; `cal_offform`
   * is a live effect read off the form). Returns the number that came out wrong.
   *
   * It is a function rather than a flag-gated block because the rails matrix
   * below is only worth reading if the same code, in this browser, at this frame
   * rate, has just reproduced a DEAD, a STROBE, a JUDDER and a smooth. That is
   * the rule the fusion rail in this same file already states and follows. */
  const runMetricCal = async () => {
    let bad = 0
    const cal = []
    for (const c of CAL) {
      await ensure()
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
      await page.waitForTimeout(200)
      await page.evaluate((x) => window.__styleHarness.setStyle(x), c.style)
      await page.waitForTimeout(900)
      const r = await sample(c.crop)
      const verdict = r.broken ? "BROKEN" : verdictOf(measure(r, {}))
      const ok = c.expect.includes(verdict)
      if (!ok) bad++
      const row = r.broken ? { cell: c.key, broken: r.broken } : measure(r, { cell: c.key })
      row.expect = c.expect
      row.verdict = verdict
      row.ok = ok
      cal.push(row)
      /* ⚠ THE VERDICT TOKEN LEADS THE LINE, AND THAT IS NOT COSMETIC.
       * These five rows are this gate's negative controls — three of them are
       * known-BAD. They used to print as `[calib] PASS  …` and
       * `[flicker] cal_dead … DEAD  PASS`, and BOTH battery runners count rows
       * with `/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm`, which requires the token at
       * the START of the line. So every control in this file was invisible to
       * every scoreboard in the repo while 53 subject rows were counted: the
       * sweep saw the measurements and none of the evidence that they mean
       * anything. Same defect as `assert-hero-dials`'s `live`/`DEAD` arm
       * (explainer 29 §5), found in the controls instead of the subject. */
      const head = `${ok ? "PASS" : "FAIL"}  CONTROL · ${c.key.padEnd(12)} reads ${verdict} (expect ${c.expect.join("|")})`
      if (r.broken) {
        console.log(`${head} — BROKEN: ${r.broken}`)
      } else {
        writeStills(c.key, r.stills)
        console.log(head)
        console.log(`      ${line(c.key, row, verdict)}`)
      }
    }
    writeFileSync(join(OUT, "calibration-report.json"), JSON.stringify(cal, null, 2))
    return bad
  }

  /* ================= THE FUSION RAIL ===================================== */
  /* 13 s per cell at display rate. EARLY = 0-3 s (does the choreography play at
   * all), LATE = 7-13 s (is anything still happening once it has). */
  const FUS_FRAMES = parseInt(arg("fusFrames", "780"), 10)
  const EARLY = [0, 180]
  const LATE = [420, FUS_FRAMES]

  const setMode = async (m) => {
    if (ACTIVE_MODE === m) return
    ACTIVE_MODE = m
    await page.evaluate((x) => window.__styleHarness.setMode(x), m)
    await page.waitForTimeout(1100)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__captureHarness.frontView(0.95))
    await page.waitForTimeout(500)
  }

  /** Arm a fusion cell through the REAL preset path, from a clean slate, so the
   *  choreography's `sinceArmed` starts at ~0 exactly as it does for a user who
   *  just clicked the pill. */
  const armFusion = async (cell) => {
    await setMode(cell.mode)
    await ensure()
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(220)
    if (cell.select) {
      await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), cell.select)
    }
    if (cell.style) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), cell.style)
    }
    if (cell.patch) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), cell.patch)
    }
    // Short, and deliberately so: the sample has to START at the beginning of the
    // choreography. A long settle here is how you measure the tail of a build and
    // conclude the build never happened.
    await page.waitForTimeout(180)
  }

  const fusionRow = async (key, cell, n = FUS_FRAMES) => {
    await armFusion(cell)
    const r = await sample(undefined, n)
    if (r.broken) return { cell: key, broken: r.broken }
    const early = measure(windowOf(r, EARLY[0], EARLY[1]), {})
    const late = measure(windowOf(r, LATE[0], LATE[1]), {})
    const all = measure(r, { cell: key })
    writeStills(key, r.stills)
    return {
      ...all,
      early: { pathD: early.pathD, lumRange: early.lumRange, lumMean: early.lumMean },
      late: { pathD: late.pathD, lumRange: late.lumRange, lumMean: late.lumMean },
      verdict: fusionVerdict(early, late),
    }
  }

  const fusLine = (row) =>
    `[fusion] ${String(row.cell).padEnd(26)} early(path=${String(row.early.pathD).padStart(7)} lum=${String(row.early.lumRange).padStart(6)})  late(path=${String(row.late.pathD).padStart(7)} lum=${String(row.late.lumRange).padStart(6)})  fps=${String(row.fps).padStart(5)}  ${row.verdict}`

  /* ---- FUSION x prefers-reduced-motion ---------------------------------
   * `--fusion --reduced` asserts the thing fusion used to be alone in getting
   * wrong. The local `motionMode` in viewport-3d folds the media query in for
   * texture, dither, ascii, the stack and the material; `evaluateFusion` was
   * handed the raw style state and read `styleState.motionMode` from it, which
   * FUSION_BASE pins to "independent" — so with the OS setting on, every fusion
   * relationship went on breathing at full amplitude. Four rails honoured it and
   * the fifth never had.
   *
   * Two assertions per combination, and the second is the one that keeps the fix
   * honest: the motion must STOP, and the graphic must still be THERE. "Reduced
   * motion" that switches the look off is a different bug wearing an
   * accessibility label, and it would pass the first assertion perfectly. */
  if (FUSION && REDUCED) {
    const rows = []
    for (const c of FUSION_CELLS) {
      for (const drive of FUSION_DRIVES) {
        const id = FUSION_SHAPE_ID.get(`${c.key}:${drive}`)
        const key = `${c.key}/${drive}`
        const family = drive === "loop" ? "fusion" : "animatedFusion"
        const row = await fusionRow(key, { mode: c.mode, select: [family, id] })
        if (row.broken) {
          console.log(`FAIL  [fus-reduced] ${key.padEnd(26)} layer not renderable — ${row.broken}`)
          rows.push({ cell: key, broken: row.broken, ok: false }); failed++; continue
        }
        const still = row.verdict === "DEAD-STILL"
        const present = row.inkFrac > 0.1 && row.cropSd > 1.5
        const ok = still && present
        if (!ok) failed++
        row.ok = ok
        rows.push(row)
        console.log(
          `${ok ? "PASS" : "FAIL"}  [fus-reduced] ${key.padEnd(26)} motion=${
            still ? "stopped" : `STILL MOVING (${row.verdict}, late path ${row.late.pathD})`
          }  layer=${present ? `present (ink ${row.inkFrac}, sd ${row.cropSd})` : "MISSING"}`,
        )
      }
    }
    writeFileSync(join(OUT, "fusion-reduced-motion-report.json"), JSON.stringify(rows, null, 2))
    await ctx.close(); await browser.close()
    for (const f of readdirSync(VIDEO)) {
      if (f.endsWith(".webm") && !f.startsWith("session")) renameSync(join(VIDEO, f), join(VIDEO, `session-fusion-reduced.webm`))
    }
    console.log(failed === 0
      ? `\n[fus-reduced] ALL PASS — every fusion combination parks its motion and keeps its graphic under prefers-reduced-motion.`
      : `\n[fus-reduced] ${failed} FAILURES`)
    process.exit(failed === 0 ? 0 : 1)
  }

  if (FUSION) {
    /* CALIBRATE FIRST, EVERY RUN. Not a separate flag: a fusion verdict is only
     * worth reading if the same code just reproduced a known DEAD-STILL, a known
     * LIVE-LOOP and a known ONE-SHOT in this browser, on this machine, at this
     * frame rate. */
    const cal = []
    for (const c of FUSION_CAL) {
      const row = await fusionRow(c.key, c, FUS_FRAMES)
      if (row.broken) {
        console.log(`FAIL  CONTROL · [fus-cal] ${c.key.padEnd(14)} sampler broken — ${row.broken}`)
        failed++; cal.push({ ...row, expect: c.expect, ok: false }); continue
      }
      const ok = c.expect.includes(row.verdict)
      if (!ok) failed++
      row.expect = c.expect; row.ok = ok
      cal.push(row)
      console.log(`${ok ? "PASS" : "FAIL"}  CONTROL · ${fusLine(row)}${ok ? "" : `  (expect ${c.expect.join("|")})`}`)
    }
    writeFileSync(join(OUT, "fusion-calibration.json"), JSON.stringify(cal, null, 2))
    if (failed) {
      console.log(`\n[fusion] NOT CALIBRATED — ${failed}/${FUSION_CAL.length} known answers wrong. Refusing to report a matrix.`)
      await ctx.close(); await browser.close()
      process.exit(1)
    }
    console.log(`[fusion] calibrated (${FUSION_CAL.length}/${FUSION_CAL.length}) — DEAD-STILL, LIVE-LOOP and ONE-SHOT all reproduced.\n`)

    const rows = []
    const onlyFus = arg("fusCells", "")
    for (const c of FUSION_CELLS) {
      if (onlyFus && !onlyFus.split(",").includes(c.key)) continue
      for (const drive of FUSION_DRIVES) {
        const key = `${c.key}/${drive}`
        const id = FUSION_SHAPE_ID.get(`${c.key}:${drive}`)
        if (!id) {
          console.log(`FAIL  [fusion] ${key.padEnd(26)} NO SUCH COMBINATION IN THE REGISTRY`)
          rows.push({ cell: key, missing: true })
          failed++
          continue
        }
        // Selected the way a user selects it: the base pill for Loop, the named
        // combination for the other two shapes. Both go through selectPreset,
        // which is the same function the panel calls.
        const family = drive === "loop" ? "fusion" : "animatedFusion"
        const row = await fusionRow(key, { mode: c.mode, select: [family, id] })
        if (row.broken) { console.log(`FAIL  [fusion] ${key}: SAMPLER BROKEN — ${row.broken}`); failed++; rows.push(row); continue }
        row.drive = drive
        row.preset = c.key
        rows.push(row)
        console.log(fusLine(row))
      }
    }
    /* THE ASSERTION THE TAXONOMY STANDS OR FALLS ON.
     *
     * Every combination must still be moving in the LATE window — the steady
     * state a user sits looking at. Under the old taxonomy five of seven
     * "animated" cells were quieter than their sibling and one measured exactly
     * zero, which is what made the rail read as broken. Nothing here is allowed
     * to be DEAD-STILL. */
    console.log("\n[fusion] LATE-window liveness (the steady state a user sits looking at):")
    for (const c of FUSION_CELLS) {
      const got = FUSION_DRIVES.map((d) => rows.find((r) => r.cell === `${c.key}/${d}`))
      if (got.some((r) => !r || r.broken || r.missing)) continue
      const bad = got.filter((r) => r.verdict === "DEAD-STILL")
      if (bad.length) failed += bad.length
      /* This block counted failures into `failed` and printed them as `***`,
       * which no scoreboard parses — the same defect as the bracket prefixes
       * above, in the one place that decides whether a fusion cell is alive. */
      console.log(
        `${bad.length ? "FAIL" : "PASS"}  [fusion] ${c.key.padEnd(18)} LATE-window liveness — ` +
        got.map((r) => `${r.drive}=${String(r.late.pathD).padStart(7)}`).join("  ") +
        (bad.length ? `   ${bad.map((r) => r.drive).join(",")} DEAD-STILL` : "   all live"),
      )
    }
    console.log(`\n[fusion] console errors: ${errors.length}`, errors.slice(0, 3))
    writeFileSync(join(OUT, "fusion-report.json"), JSON.stringify(rows, null, 2))
    await ctx.close(); await browser.close()
    for (const f of readdirSync(VIDEO)) {
      if (f.endsWith(".webm") && !f.startsWith("session")) renameSync(join(VIDEO, f), join(VIDEO, `session-fusion-${LABEL}.webm`))
    }
    console.log(`[fusion] wrote ${OUT}`)
    process.exit(failed === 0 ? 0 : 1)
  }

  if (FUSION_INTENSITY) {
    /* WHAT DO THE TWO DIALS ACTUALLY DO?
     *
     * `--dial=link` sweeps LINK (`fusionIntensity`): how strongly the driver
     * reaches the driven parameter. Its old copy said "how deeply the systems
     * drive each other. 0 keeps the look but unlinks them", and swept end to end
     * that was not what it did — five of eight presets were completely still at 0
     * and moving at 0.25, so it was a motion switch, while the other three still
     * moved at 0 because their own layers were animated.
     *
     * `--dial=swing` sweeps SWING (`fusionSwing`), the dial that half now lives
     * in. Its promise is testable: 0 must be STILL (or, on the presets whose
     * layers animate themselves, no more alive than fusion-off) and the response
     * upward must be monotonic.
     *
     * 6 s per point is enough for the ambient drives (period 4-7 s) to show their
     * swing. */
    const DIAL = arg("dial", "link")
    const N = parseInt(arg("fusFrames", "380"), 10)
    const rows = []
    for (const c of FUSION_CELLS) {
      const out = []
      for (const v of [0, 0.25, 0.5, 0.75, 1]) {
        const patch = DIAL === "swing" ? { fusionSwing: v } : { fusionIntensity: v }
        const row = await fusionRow(
          `${DIAL}_${c.key}_${String(v).replace(".", "")}`,
          { mode: c.mode, select: ["fusion", c.key], patch },
          N,
        )
        if (row.broken) { out.push({ v, broken: row.broken }); continue }
        out.push({ v, pathD: row.pathD, lumRange: row.lumRange, lumMean: row.lumMean, verdict: row.verdict })
      }
      const vals = out.filter((o) => !o.broken).map((o) => o.pathD + o.lumRange)
      // A dial that does LESS at the top than in the middle is a defect, and one
      // was found this way: Code Bloom's density swing clipped against the 0..1
      // uFsAscDensity clamp above LINK 0.73, so the response reversed.
      const mono = vals.every((v, i) => i === 0 || v >= vals[i - 1] * 0.75)
      rows.push({ preset: c.key, dial: DIAL, sweep: out, monotonic: mono })
      console.log(
        `[${DIAL}] ${c.key.padEnd(18)} ` +
        out.map((o) => `${o.v}:${o.broken ? "BROKEN" : `path=${String(o.pathD).padStart(6)}/lum=${String(o.lumRange).padStart(5)}`}`).join("  ") +
        (mono ? "" : "   *** NOT MONOTONIC ***"),
      )
    }
    writeFileSync(join(OUT, `fusion-${DIAL}-report.json`), JSON.stringify(rows, null, 2))
    await ctx.close(); await browser.close()
    for (const f of readdirSync(VIDEO)) {
      if (f.endsWith(".webm") && !f.startsWith("session")) renameSync(join(VIDEO, f), join(VIDEO, `session-fusion-${DIAL}-${LABEL}.webm`))
    }
    console.log(`[intens] wrote ${OUT}`)
    process.exit(0)
  }

  /* ================= REDUCED MOTION ====================================== */
  /* TWO assertions per preset, and the second one is the one that matters.
   *
   *   1. the motion STOPS         verdict must be DEAD
   *   2. the layer is still THERE crop still has ink and still has structure
   *
   * The rule is "gentler, not zero": a reduced-motion path that switches the
   * graphic off is a different bug wearing an accessibility label, and it would
   * pass assertion 1 perfectly. So the sampler's own on-form guards (inkFrac,
   * cropSd) are re-used as the evidence that the dot screen / glyph grid / grain
   * is still being rendered, parked. */
  if (REDUCED) {
    const flag = await page.evaluate(() => window.__geomDebug?.styleClock?.().reduceMotion)
    const res = []
    let flagOk = flag === true
    if (!flagOk) failed++
    console.log(`${flagOk ? "PASS" : "FAIL"}  [reduced] renderer is on the reduced-motion path (STYLE_CLOCK_DEBUG.reduceMotion=${flag})`)
    for (const c of CELLS) {
      await ensure()
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
      await page.waitForTimeout(200)
      await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), [c.family, c.preset])
      await page.waitForTimeout(900)
      const r = await sample()
      if (r.broken) {
        // The layer vanished, or the read is off the form. Either way this is a
        // FAIL: "reduced motion" must not mean "no layer".
        console.log(`FAIL  [reduced] ${c.key.padEnd(12)} layer not renderable — ${r.broken}`)
        res.push({ cell: c.key, preset: c.preset, broken: r.broken, ok: false })
        failed++
        continue
      }
      const row = measure(r, { cell: c.key, preset: c.preset })
      const verdict = verdictOf(row)
      const still = verdict === "DEAD"
      const present = row.inkFrac > 0.10 && row.cropSd > 1.5
      const ok = still && present
      if (!ok) failed++
      row.verdict = verdict
      row.ok = ok
      res.push(row)
      writeStills(c.key, r.stills)
      console.log(
        `${ok ? "PASS" : "FAIL"}  [reduced] ${c.key.padEnd(12)} motion=${still ? "stopped" : `STILL MOVING (${verdict}, span ${row.spanD})`}  layer=${present ? `present (ink ${row.inkFrac}, sd ${row.cropSd})` : "MISSING"}`,
      )
    }
    writeFileSync(join(OUT, "reduced-motion-report.json"), JSON.stringify(res, null, 2))
    await ctx.close()
    await browser.close()
    for (const f of readdirSync(VIDEO)) {
      if (f.endsWith(".webm") && !f.startsWith("session")) {
        renameSync(join(VIDEO, f), join(VIDEO, `session-reduced-motion.webm`))
      }
    }
    console.log(failed === 0
      ? `\n[reduced] ALL PASS — every animated preset parks its motion and keeps its graphic under prefers-reduced-motion.`
      : `\n[reduced] ${failed} FAILURES`)
    process.exit(failed === 0 ? 0 : 1)
  }

  /* ================= THE RAILS =========================================== */
  /* CALIBRATE FIRST, EVERY RUN — the same rule the fusion rail states above and
   * the reason this block used to be worthless: it reported seventeen verdicts
   * from a ruler nothing had shown could produce a wrong answer. */
  /* ── 2026-08-07 · THE GUARD IS CALIBRATED ON THE DEFAULT PATH TOO ────────
   *
   * The note that used to stand here said it plainly and then did nothing about
   * it: *"NOT RUN HERE, and it is a skip rather than a pass: the GUARD's own
   * known-answer cases (--calibrate-guard)."* It was right about the diagnosis
   * and wrong to stop there — and worse, it printed that admission as a
   * `[flicker]` note, which no scoreboard reads, so a sweep recorded 53 green
   * rows and no trace of the hole.
   *
   * The order is not negotiable: THE GUARD BEFORE THE METRIC. Both of the metric's known-bad
   * cases (`cal_dead`, `cal_offform`) are statements about WHICH PIXELS the
   * sampler is reading, so they mean nothing until the thing that decides the
   * stage is in a readable state has been shown it can say NO.
   *
   * Cost: ~40 s on top of ~63 s. Explainer 29 §6: *"'It is slow' is not a
   * reason; every browser gate is slow and they all run."* */
  console.log("[flicker] calibrating the GUARD before the metric — its ability to REJECT, on three known-bad stages:\n")
  const guardRows = await calibrateGuard()
  const guardBad = guardRows.filter((r) => !r.ok).length
  if (guardBad) {
    console.log(
      `\n[flicker] GUARD NOT CALIBRATED — ${guardBad} of ${guardRows.length} known-bad stages it failed to reject.` +
        ` Every number below would be about unknown pixels. Refusing to report a matrix.`,
    )
    await ctx.close(); await browser.close()
    process.exit(1)
  }
  console.log(
    `[flicker] guard calibrated (${guardRows.length}/${guardRows.length}) — blank stage, drawing-in form and` +
      ` half-drawn form all REJECTED.\n`,
  )

  console.log("[flicker] calibrating the metric before reporting a matrix:\n")
  const calBad = await runMetricCal()
  if (calBad) {
    console.log(
      `\n[flicker] NOT CALIBRATED — ${calBad}/${CAL.length} known answers wrong. Refusing to report a matrix.`,
    )
    await ctx.close(); await browser.close()
    process.exit(1)
  }
  console.log(
    `[flicker] calibrated (${CAL.length}/${CAL.length}) — DEAD, STROBE, JUDDER, smooth and off-form all reproduced,` +
      ` two of them known-bad. The guard's three known-bad stages were rejected above, in this same run.\n`,
  )

  const only = arg("cells", "")
  const rows = []
  const say = (ok, name, detail) => {
    if (!ok) failed++
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`)
  }
  for (const c of CELLS) {
    if (only && !only.split(",").includes(c.key)) continue
    await ensure()
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(200)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), [c.family, c.preset])
    await page.waitForTimeout(900)
    const r = await sample()
    if (r.broken) {
      // A broken sampler used to increment `failed` and then have the number
      // thrown away when main() returned. It is a FAIL row now.
      say(false, `${c.key} / sampler on the form`, `SAMPLER BROKEN — ${r.broken}`)
      rows.push({ cell: c.key, preset: c.preset, broken: r.broken, ok: false })
      continue
    }
    const row = measure(r, { cell: c.key, preset: c.preset })
    const verdict = verdictOf(row)
    row.verdict = verdict
    row.expect = c.expect
    rows.push(row)
    writeStills(c.key, r.stills)
    console.log("      " + line(c.key, row, verdict).replace(/^\[flicker\] /, ""))
    say(
      c.expect.includes(verdict),
      `${c.key} (${c.preset}) / temporal character`,
      `${verdict}, expected ${c.expect.join("|")}${c.why ? " — " + c.why : ""}`,
    )
    say(
      row.spanD >= TRAVEL_FLOOR,
      `${c.key} (${c.preset}) / travels far enough to be seen`,
      `span ${row.spanD} vs floor ${TRAVEL_FLOOR}`,
    )
    say(
      row.fps >= FPS_FLOOR,
      `${c.key} (${c.preset}) / sampled at display rate`,
      `${row.fps} fps vs floor ${FPS_FLOOR} — below this every temporal number aliases`,
    )
    row.ok = c.expect.includes(verdict) && row.spanD >= TRAVEL_FLOOR && row.fps >= FPS_FLOOR
  }
  /* THE TWO-DIRECTION PROOF, on the rail's own data.
   *
   * Sixteen cells are required to be `smooth` and one is required NOT to be, so
   * an instrument stuck on a single answer cannot come out clean: if everything
   * read `smooth`, asc_flicker goes red; if everything read STROBE, the other
   * sixteen do. This row states that out loud so the property is asserted rather
   * than merely implied by the table's shape. */
  const seen = new Set(rows.filter((r) => !r.broken).map((r) => r.verdict))
  say(
    seen.size >= 2,
    "the rail returns more than one verdict",
    `verdicts seen: ${[...seen].join(", ")} — one answer everywhere would be an instrument, not a measurement`,
  )
  say(errors.length === 0, "console errors during the run", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight (stills from 08-07).
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
   * The filter is narrowed to the captured stills and session video so the row cannot certify this gate's
   * own flicker-report.json as evidence — the trap `assert-drawin-pentip.mjs` recorded.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.(png|webm)$/)
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
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-layer-flicker.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-layer-flicker.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }
  writeFileSync(join(OUT, "flicker-report.json"), JSON.stringify(rows, null, 2))
  await ctx.close()
  await browser.close()
  // Name the real-time recording something a human can find.
  for (const f of readdirSync(VIDEO)) {
    if (f.endsWith(".webm") && !f.startsWith("session")) {
      renameSync(join(VIDEO, f), join(VIDEO, `session-${LABEL}.webm`))
    }
  }
  console.log(`[flicker] wrote ${OUT}`)
  console.log(
    failed === 0
      ? `\nALL LAYER-FLICKER ASSERTIONS PASS — ${rows.length} cells on three rails, against a ruler calibrated in this same run.`
      : `\n${failed} LAYER-FLICKER FAILURE(S).`,
  )
  // THE EXIT CODE CARRIES THE VERDICT. Without this the whole block was a table.
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
