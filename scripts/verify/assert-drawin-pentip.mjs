// ASSERT-DRAWIN-PENTIP — is the moving end of the line a PEN, or a CUT?
//
// Sebs, 2026-08-01: *"WHEN THE ENGINE IS FREE STROKE THE 2D DRAW-IN IT STILL
// JANK, IT'S LIKE ITS USING SOME STUPID SWEEP REVEAL, AND THE SPECIAL DRAWING
// ANIMATION IN DESK DOODLES IS A LOT BETTER"*. And 2026-08-02, after a pass
// that measured this and did not fix it: *"the 2d drawing animation still
// doesnt draw like someone actually drawing the strokes."*
//
// `_probe-drawin-order.mjs` already settled that the reveal is NOT a spatial
// wipe: on the discriminating-pair test both engines score 0.86-0.90 where 1 is
// a pen and 0 is a sweep, with synthetic controls at exactly 1.0000 and 0.0000.
// So the ORDER is right. What is left is the SHAPE OF THE MOVING END, and that
// is where "sweep" is literally true: a wipe terminates in a straight cut across
// the mark, a pen terminates in a nib.
//
// ════════════════════════════════════════════════════════════════════════════
// ⚠ THIS INSTRUMENT HAS NOW BEEN RECALIBRATED TWICE. READ BOTH.
// ════════════════════════════════════════════════════════════════════════════
//
// ── RECALIBRATION 1, 2026-08-02 (kept because it is the reason for the shape of
//    this file, and because its lesson is the one that caught round 2) ────────
//
// The version that shipped read PASS while ITS OWN CONTROLS had collapsed —
//
//     CONTROL  half-plane CUT     2.0 px
//     CONTROL  disc-dilated NIB   5.0 px      (14.0 px when it was written)
//
// Both causes were the DRIFT class named in `docs/README.md`'s sixth bug pattern
// — *"a hardcoded second, a window sized for an old beat"* — and the defence it
// prescribes is *"derive every window from the model's own offsets and print
// what was actually read."* So every window became a multiple of the mark's own
// measured ink half-width, the bins went sub-pixel, and the calibration was
// asserted BEFORE the verdict.
//
// ── RECALIBRATION 2, 2026-08-02 (this one) ──────────────────────────────────
//
// THAT WAS NOT ENOUGH, AND THE GATE SAID SO ITSELF. The row *"CONTROL: the
// PARKED PRIOR still reads as a CUT"* wants a pen score < 0.5 and read **1.695**
// on a fresh capture. The parked prior is the raw `setDrawRange` boundary — the
// thing this whole fix exists to replace. A negative control that cannot fail
// proves nothing, and that is the same sentence recalibration 1 was written
// under.
//
// Two candidate explanations, and they need opposite responses:
//
//   (a) THE INSTRUMENT IS WRONG AGAIN, or
//   (b) THE SURFACE CHANGED — something else already rounds the moving end, in
//       which case the premise that the tip shape is what fixed the ending is
//       false and must be restated.
//
// IT WAS (a), AND HERE IS THE MEASUREMENT THAT DECIDED IT. `_probe-pentip-
// forensic.mjs` re-derives every row of the failing run's own `pentip.json` to
// |Δ| = 0 — so it is describing the same arithmetic, not an approximation of it
// — and then reports what that arithmetic never printed:
//
//     arm                per-playhead spread          foreign ink in the disc
//     free-stroke        IQR 0.76 w   (0.17 → 37.06)  median 27.7 %, max 87.4 %
//     free-stroke-off    IQR 1.32 w   (0.52 → 27.93)  median 27.7 %, max 87.4 %
//     free-stroke-nib    IQR 0.65 w   (0.20 → 40.38)  median 27.7 %, max 87.4 %
//     desk-doodles       IQR 1.00 w   (0.17 → 43.08)  median 17.0 %, max 81.0 %
//
// THE ENTIRE CUT → NIB RANGE THE RULER IS TRYING TO RESOLVE IS 0.462 w. Its
// noise was two to three times its subject on every arm of every capture. A
// median of a sample that wide is not a measurement, and the giveaway is that
// the same parked-prior arm read **0.444 at 33 samples and 1.695 at 25** — the
// number was tracking THE PLAYHEAD GRID, not the mark.
//
// The cause is one sentence. `f(u)` is drawn ink over finished ink at tangential
// offset u, measured inside a Cartesian disc of 2.5 w. On a word this dense that
// disc is full of OTHER STROKES, and foreign ink sits in both sums, so those
// bins answer a question about STROKE ORDER rather than about the shape of the
// moving end. Restricting the same discs to the pen's own stroke moved the
// medians to off 2.19 px < nib 2.88 < quill 6.44 < desk-doodles 8.83 — the
// ordering the eye reads off a 7× crop, which the shipped ruler had scrambled
// (it put the parked prior ABOVE the nib shape).
//
// AND (b) IS RULED OUT DIRECTLY, ON THE SAME FRAMES. Both rulers were run over
// all three captures on disk. The parked prior's pen score:
//
//     capture                              old ruler      this ruler
//     run           33 samples, carve 1.00     0.444          0.278
//     lane-carve100 25 samples, carve 1.00     1.905          0.267
//     lane-paneltip 25 samples, carve 0.70     1.695          0.174
//
// The old number swings 4.3× across captures that differ only in sample grid and
// carve; the new one says CUT three times out of three, and the underlying
// measurement is 0.0895 / 0.0887 / 0.0596 w. Nothing had started rounding the
// prior's ending. The ruler was reading the word around it.
//
// ── 2026-09-04 · THE SAME FORK CAME BACK, AND THIS TIME IT IS (b) ───────────
//
// The parked-prior row is RED again, and the ruler is not the reason. Same
// instrument, both sets of frames, one command apart:
//
//   arm                Aug-3 frames      Sep-4 frames     what the row wants
//   free-stroke-off    0.239             1.321            < 0.5
//   free-stroke-nib    1.083             1.039
//   free-stroke        5.460             3.735            (quill then, reed now)
//   desk-doodles       5.282             3.431
//
// The Aug-3 column is this file reading the August capture, and it lands on the
// numbers that capture's own committed `pentip.json` recorded at the time
// (0.264 · 0.976 · 5.578 · 5.796), every one inside its IQR. An instrument that
// reproduces the old answer on the old frames is not what moved the new one.
//
// AND THE EYE SAYS THE SAME THING. Crop the moving end of `free-stroke-off` at
// the same playhead in both sets: August ends in a flat square chop straight
// across the ribbon, faceted, exactly the raw `setDrawRange` boundary §0.7
// describes. Today it ends in a long tapered wedge with the facet steps running
// down ONE side.
//
// The tip shader is not doing it. `viewport-3d.tsx`, find by text
// `const wants = mode !== "off"` and the `else { tu.on.value = 0 }` four lines
// under `tu.on.value = 1`: at `off` the fragment test is switched off and the
// uniforms are not written. So the taper is in the GEOMETRY the draw range
// walks — the mark's edges now lag its centre because of the order the
// triangles come in, which is a taper for free and needs no shader at all.
//
// NOT ATTRIBUTED TO A COMMIT. Nothing was bisected. `lib/stroke-schedule.ts` is
// the newest file under `lib/` and the schedule work landed this week, which is
// a suspicion and not a measurement. What IS measured is that the pen's
// POSITION law did not move: the Aug-3 column above was graded with today's
// `revealDistanceFraction` and still reproduced August's readings, so whatever
// changed changed the SHAPE of the end and not when the pen gets there.
//
// WHAT THIS ROW MEANS NOW, AND WHY IT IS NOT BEING RELAXED. The row is the
// control on the claim *"the tip shape is what fixed the ending"*. That claim
// is now unsupported here, because the ending is rounded with the tip off. The
// row is doing its job by going red. Moving the 0.5, or dropping the arm, would
// delete the only evidence that the premise changed — and the restatement §0.7
// warned would be needed is Sebs's call, not a gate's.
//
// ── WHAT CHANGED, AND WHY EACH IS FORCED RATHER THAN CHOSEN ─────────────────
//
//  1. THE COORDINATE IS ARC LENGTH ALONG THE PEN PATH. The old ruler projected
//     every pixel in the disc onto ONE tangent taken at the pen point; the mark
//     curves inside 2.5 w, which the old header itself lists as one of three
//     reasons its nib control could only reach 63 % of its closed form. Every
//     pixel now carries the arc `a` and offset `rho` of its nearest point on the
//     path (rasterised once per arm), so the axis follows the mark exactly.
//
//     THIS ALSO MAKES THE CLOSED FORM EXACT INSTEAD OF ASPIRATIONAL. A disc of
//     radius w swept along the path first covers the ribbon point (a, rho) when
//     the pen reaches `a − √(w² − rho²)`, so at arc offset u the covered share is
//     `√(1 − (u/w)²)`. Measured between f = 0.75 and f = 0.25 that is
//     `√(1−0.25²) − √(1−0.75²)` = 0.3068 w, and the geometric control now reads
//     101-102 % of it on the dense capture and 92-107 % across every capture on
//     disk, where the Cartesian one read 53-63 %.
//
//  2. ONLY THE STROKE THAT OWNS THE PEN, AND ONLY INK ONE STROKE LAID DOWN.
//     Pixels nearest a different stroke are dropped; so are pixels within 1.15 w
//     of a second stroke's centreline, because at a crossing the same ink
//     belongs to both and reads as "already drawn" ahead of the pen whatever the
//     tip does. Each pixel therefore carries its distance to the nearest OTHER
//     stroke as well as to its own.
//
//  3. THE CROSSINGS ARE TAKEN ON A MONOTONE FIT, NOT ON RAW BINS. `f` runs 1 → 0
//     across the moving end and is non-increasing by construction, so it is fitted
//     with pool-adjacent-violators first. The old search — *last* bin at or above
//     F_HI, then *first* at or below F_LO — is decided by two bins out of a
//     hundred and fifty, and one contaminated bin moves the answer by its whole
//     range. On the monotone fit each level is crossed exactly once.
//
//  4. THE LEVELS ARE 0.75 / 0.25, NOT 0.85 / 0.15. Same statistic, taken further
//     from the tails, where an antialiased threshold and a junction blob live.
//
//  5. THE HALF-WIDTH IS LOCAL, AND IT IS AN AREA RATHER THAN A RAY. Every ray
//     estimate is a tangent estimate in disguise, which is why the old one read
//     17.50 px on one capture and 14.25 px on another for the same engine. In
//     ribbon coordinates the area element is `(1 + rho·κ) da drho`, and
//     integrating rho from −W to +W kills the κ term outright: THE COUNT OF INK
//     PIXELS PER UNIT ARC IS 2W however the mark curves. That estimate is exactly
//     unbiased where the mean, the median and every percentile of rho are biased
//     upward on a bend.
//
//  6. A PLAYHEAD THAT CANNOT BE MEASURED IS REJECTED, COUNTED AND PRINTED,
//     AND EVERY REJECTION TEST IS ARM-INDEPENDENT. Three are properties of the
//     PATH alone, decided before a pixel is read; the fourth is a property of the
//     finished mask and the two synthetic controls, which are identical for every
//     arm at a given playhead. None of them can drop a row because its answer is
//     inconvenient.
//
//  7. THE SPREAD IS ASSERTED. `DECISIVE` is a first-class calibration row: the
//     reading must be further from the cut/nib decision than its own
//     inter-quartile range is wide, or the median is not a measurement for the
//     purpose this gate puts it to. This is the row the shipped instrument
//     fails, and it fails it on its own frames — median 0.235 w against a
//     decision at 0.231 w, with an IQR of 0.948 w.
//
// ── THE MEASUREMENT ────────────────────────────────────────────────────────
//
// Using the page's own strokes and the page's own reveal law:
//
//     d = revealDistanceFraction(strokes, phaseT, "hybrid", 0.4)   <- the same
//         call `AnimatedStrokes` makes, not a re-derivation. Both settings are
//         checked against `viewport-3d.tsx` on every run.
//
// Around arc d, over the pen's own ribbon and nothing else, for each arc offset u
//
//     f(u) = (finished ink at u that is ALREADY DRAWN) / (finished ink at u)
//
// f goes from 1 behind the pen to 0 ahead of it, and THE WIDTH OF THAT TRANSITION
// is the shape of the moving end:
//
//     ~0 w        the mark is at full width and then simply stops — A CUT
//     ~0.3068 w   it rounds off over its own half-width — A NIB
//
// ⚠ TWO EARLIER METRICS WERE TRIED AND DISCARDED, AND BOTH ARE NAMED because
// each failed in a way that read as an answer:
//
//  (1) half-width across the path AT the clock's pen point. It returned 0 on
//      17 of 24 Free Stroke playheads — there is no ink there — and then
//      DIVIDED by it, reporting "a perfect nib" for an absence.
//  (2) the same with a walk-back to the last inked point. Better, but the
//      perpendicular ray crosses NEIGHBOURING STROKES in a word this dense,
//      which put the Free Stroke "ink half-width" at 23.3 px against a real one
//      nearer 9, and the noise swamped the effect.
//
// ── EVERY DISCRIMINATING ROW HAS A KNOWN-BAD INPUT AND IS REQUIRED TO FAIL ON
//    IT, IN THE SAME RUN ────────────────────────────────────────────────────
//
// `docs/DISPATCH.md` §2.6: *"Calibrate the instrument against a known-bad input
// and require it to fail."* Not "have a control somewhere" — each row gets an
// input built wrong in the exact way that row is about, pushed through the
// identical scoring path, and the row is required to come back FAIL:
//
//     row                                    known-bad arm it must fail on
//     reads as a NIB, not a CUT              an arm whose frames ARE the arc-cut
//     reads as a NIB, not a CUT              an arm whose frames ARE a half-plane wipe
//     the PARKED PRIOR still reads as a CUT  a "prior" whose frames ARE the disc nib
//     shipped is decisively nearer a NIB     prior := the nib, shipped := the cut
//     the stroke->screen fit is real         the fit deliberately mis-scaled
//     enough playheads to judge              the playhead list truncated
//     DECISIVE                               THE SHIPPED RULER'S OWN CARTESIAN
//                                            MEASUREMENT, on these same frames
//
// The last one is the point of the whole exercise: the instrument this replaces
// is run inside this one, on the same pixels, and is required to fail the row it
// was blind to.
//
// Reads the frames captured by `_probe-pentip-sweep.mjs`.
// Usage: node scripts/verify/assert-drawin-pentip.mjs --label=gate-repair
//                                                     [--dir=docs/verification/pentip/x]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute, relative } from "node:path"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate had — grading stored PNGs without ever
 * asking whether they were rendered by the code under test — and
 * `assert-pentip-specks.mjs` already uses these two primitives the same way, for
 * the same reason. Nothing new is written here.
 *
 * ⚠ NOT `captureFreshness()` ITSELF, and the reason is the one its sibling gate
 * recorded: its `newestCapture` default filter is `/\.(png|json|jpg|webm)$/`,
 * and THIS GATE WRITES `pentip.json` INTO THE CAPTURE DIRECTORY at the end of
 * every run. One invocation would make the capture look newer than any source
 * file and the check could never fail again — a provenance row certifying its own
 * output. The filter is narrowed to the frames, which are the only artefacts a
 * renderer wrote. The defect is in that module and belongs to whoever owns it. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"
import { createRequire } from "node:module"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
import { loadTs } from "./_ts-load.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const { revealDistanceFraction } = loadTs("lib/pen-reveal.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DIR_ARG = arg("dir", null)
const DIR = DIR_ARG
  ? isAbsolute(DIR_ARG)
    ? DIR_ARG
    : join(ROOT, DIR_ARG)
  : join(ROOT, "docs", "verification", "pentip", LABEL)

/**
 * The arm captured with the tip shape OFF. It is the PARKED PRIOR (explainer
 * 18's raw per-triangle `setDrawRange` boundary) and it is the negative control
 * for the fix itself, so the "reads as a NIB" verdict is NOT asserted on it —
 * the INVERSE is, further down. Asserting both would make the script exit 1 in
 * the shipped state, and a gate that is red when everything is right gets
 * ignored, which is the same disease as one that is green when nothing is.
 */
const PRIOR_ARM = "free-stroke-off"

/* ── THE PAGE'S REVEAL SETTINGS, RESTATED AND THEN CHECKED ────────────────
 * `viewport-3d.tsx` is a React module `_ts-load.mjs` cannot execute, so these
 * two are restated — and a restated constant that silently drifts is the exact
 * defect class this file keeps finding, so they are grepped on every run. */
/* ⚠ THE REVEAL MODE IS NO LONGER GREPPED, IT IS READ.
 *
 * This used to check `viewport-3d.tsx` contained `useState<RevealMode>("hybrid")`,
 * which was the only option while the default lived inside a React component
 * `_ts-load.mjs` cannot execute. On 2026-09-04 the pace moved into
 * `REVEAL_ENVELOPE_DEFAULTS` in `lib/stroke-schedule.ts`, so the gate now reads
 * the value rather than searching for the shape of its declaration. A grep for
 * a declaration goes red when the code is REFACTORED; reading the export goes
 * red only when the VALUE changes, which is what this row was always about. */
const MODE = loadTs("lib/stroke-schedule.ts").REVEAL_ENVELOPE_DEFAULTS.mode
const BLEND = 0.4
{
  const src = readFileSync(join(ROOT, "components/viewport-3d.tsx"), "utf8")
  for (const [needle, what] of [
    [`setHybridBlend] = useState(${BLEND})`, "the hybrid blend"],
  ])
    if (!src.includes(needle))
      throw new Error(
        `assert-drawin-pentip: ${what} no longer matches viewport-3d.tsx (looked for \`${needle}\`). ` +
          `Update this file; do NOT adjust the measurement.`,
      )
}

/* ── EVERY WINDOW, AS A MULTIPLE OF THE MARK'S OWN INK HALF-WIDTH ──────────
 * Not one of them is a pixel count, for the reason recalibration 1 gives. */
/**
 * Arc window either side of the pen.
 *
 * THE WINDOW HAS TO BE WIDER THAN THE TRANSITION IT MEASURES, plus enough
 * settled mark on each side for f to reach 1 and 0. Desk Doodles' end is the
 * longest thing here at ~2.3 w, so ±3 w is the floor rather than a preference.
 * Widening it to ±4 w and ±4.5 w moves no arm median outside its own IQR and
 * costs playheads (the fold test sees more path), which is why it stops at 3.
 */
const ARC_WINDOW_W = parseFloat(arg("arcw", "3.0"))
/**
 * Ink further off the centreline than this is a junction blob, not the ribbon.
 *
 * 1.15 rather than a rounder number because the ribbon's ink reaches exactly one
 * half-width BY DEFINITION and the extra 0.15 is the antialiased edge the
 * threshold keeps. It is not a free parameter, and it was not tuned to an
 * answer: the arm medians barely move across 1.15 / 1.30 / 1.70 (free-stroke
 * 0.720 / 0.744 / 0.746 w, the parked prior 0.093 / 0.090 / 0.090 w), while the
 * DISC CONTROL's agreement with its own closed form does — 98 % at 1.15, 106 %
 * at 1.30, 114 % at 1.70 — because a cap well past the ink pulls junction blobs
 * into the local half-width and inflates the disc.
 */
const RHO_CAP_W = parseFloat(arg("rhocap", "1.15"))
/** Ink this close to ANOTHER stroke's centreline was laid down twice. */
const SHARED_W = 1.15
/** Bin pitch. 0.025 w puts 12.3 bins across the closed-form nib span, against
 *  the 8 the resolution bar below asks for. Sub-pixel at every capture scale by
 *  construction, because it is a fraction of the mark rather than of the screen. */
const BIN_W = 0.025
/** f's two crossings, taken on the monotone fit. */
const F_HI = 0.75
const F_LO = 0.25
/**
 * WHAT THE NIB CONTROL MUST READ, IN CLOSED FORM.
 * f(u) = √(1 − (u/w)²) for a disc of radius w swept along the path, so the
 * F_HI → F_LO span is √(1 − F_LO²) − √(1 − F_HI²).
 */
const NIB_IDEAL_W = Math.sqrt(1 - F_LO * F_LO) - Math.sqrt(1 - F_HI * F_HI)

/* ── THE PLAYHEAD REJECTION TESTS. All four are arm-independent. ─────────── */
/**
 * The pen needs body behind it and mark ahead of it, ON ITS OWN STROKE — 2.5 w
 * each way, which is the body the arc window needs to see f settle. Without it
 * a playhead near a stroke start has no "already drawn" plateau and one near a
 * stroke end has no "not yet drawn" one, and f runs into the window edge rather
 * than into the mark.
 */
const STROKE_MARGIN_W = parseFloat(arg("margin", "2.5"))
/**
 * HOW SHARPLY THE PATH MAY BEND BEFORE THE RIBBON COORDINATE STOPS BEING AN
 * AXIS — and the bound is the embedding condition, not a taste.
 *
 * The nearest-point map (pixel -> arc, offset) is one-to-one out to offset rho
 * exactly while `rho · kappa < 1`; past that the offset curves fold onto each
 * other and one pixel has two arcs. That is the SAME `r · kappa < 1` explainer
 * 19 is about — *"the other half of the embedding theorem, which had never been
 * checked anywhere"* — applied to a measurement instead of to a loft.
 *
 * So the test is on the local curvature, measured as turning over a baseline of
 * one half-width, and it is `RHO_CAP_W · w · kappa <= FOLD_MARGIN`. The margin
 * is 0.7 rather than 1.0 because the map degenerates continuously: at 1.0 the
 * Jacobian is zero and the bins nearest the inside of the bend are empty long
 * before that.
 *
 * ⚠ AN EARLIER VERSION CAPPED TOTAL TURNING OVER THE WHOLE WINDOW AT 75°, WHICH
 * IS A DIFFERENT AND WRONG QUESTION. A long gentle arc can turn 140° over six
 * half-widths without ever folding anything; it rejected 35 of 72 playheads on
 * the hero word for no geometric reason, and it took the Desk Doodles arm below
 * the count at which a median means anything.
 */
const FOLD_MARGIN = 0.7
/** How much of the window may be foreign or shared ink before the ribbon is not
 *  the pen's own. */
const CROWD_CAP = 0.15

/* ── THE CALIBRATION BARS ─────────────────────────────────────────────────── */
/** A half-plane cut and an arc cut must both stay under a tenth of the nose. */
const CUT_UNDER = 0.1
/** The geometric disc control must land on its own closed form. The band holds
 *  the areal half-width estimator's residual bias on a curved mark — measured
 *  98-105 % across the four arms — and the Cartesian ruler this replaces, at
 *  53-63 %, falls outside it. */
const NIB_BAND = [0.75, 1.3]
/**
 * THE RESOLUTION BAR. Expressing the controls as a fraction of w is necessary
 * and NOT sufficient: the version recalibration 1 replaced read cut 2.0 px and
 * nib 5.0 px on a 6.5 px half-width — 0.31 w and 0.77 w, a ratio that looks
 * healthy and was useless, because three pixels on an integer grid cannot place
 * anything between them. So the separation is also required in BINS.
 */
const CONTROL_SEPARATION_BINS = 8
/**
 * THE DECISIVENESS BAR, WHICH IS THE ONE RECALIBRATION 2 EXISTS FOR.
 *
 * THE READING MUST BE FURTHER FROM THE CUT/NIB DECISION THAN ITS OWN SPREAD IS
 * WIDE. That is precisely what "this median is a measurement" has to mean for a
 * gate: not that the number is tight in the abstract, but that its noise cannot
 * reach across the line the verdict is taken at.
 *
 * ⚠ AN ABSOLUTE BAR — "IQR under half the cut → nib range" — WAS TRIED FIRST AND
 * IS WRONG, and it is worth naming because it looks more rigorous. It asks for
 * the same 0.15 w of precision from an arm whose end is 0.09 w long and from one
 * whose end is 2.1 w long. Desk Doodles reads 1.6-2.6 w across the word: a 0.93 w
 * spread that never once comes within 1.4 w of the decision. Failing that arm
 * would have been the gate reporting a defect in the SUBJECT for a property of
 * the BAR — the same class of error as the one being repaired.
 *
 * The ruler this file replaces fails this bar on both arms of the same frames,
 * which is the point: on `free-stroke-off` it reads a median 0.235 w against a
 * decision at 0.231 w with an IQR of 0.948 w. Its noise is two hundred times its
 * margin, and that is exactly how the same arm came to read 0.444 on one
 * playhead grid and 1.695 on another.
 */
const DECISION_AT = 0.5
/** Fewer than this and a median means nothing. */
const MIN_PLAYHEADS = 8

let pass = true
const rowsSeen = []
const say = (ok, label, detail) => {
  if (!ok) pass = false
  rowsSeen.push({ ok, label })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
const quart = (a, q) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]
}
const iqr = (a) => (a.length ? quart(a, 0.75) - quart(a, 0.25) : null)

async function inkMask(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(luma.length)
  for (let p = 0; p < luma.length; p++) m[p] = luma[p] < cut ? 1 : 0
  return { m, w: img.width, h: img.height }
}

/* ==========================================================================
 * THE RULER. Built once per engine off its finished frame, then asked about
 * any number of masks — real frames, synthetic controls, known-bad arms. That
 * split is what makes "the known-bad went through the IDENTICAL scoring path"
 * a fact about the code rather than a claim in a comment.
 * ========================================================================== */
function buildRuler({ fin, W, H, pts, strokeEndArc, total, scaleMul = 1 }) {
  /* ---- fit stroke space -> screen against the FINAL ink (searched, then
   * scored on how much of the path lands on ink — the closed-form solve was
   * wrong once, see `_probe-drawin-order.mjs`). */
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const sMinX = Math.min(...xs)
  const sMaxX = Math.max(...xs)
  const sMinY = Math.min(...ys)
  const sMaxY = Math.max(...ys)
  let bMinX = W, bMaxX = -1, bMinY = H, bMaxY = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (fin[y * W + x]) {
        if (x < bMinX) bMinX = x
        if (x > bMaxX) bMaxX = x
        if (y < bMinY) bMinY = y
        if (y > bMaxY) bMaxY = y
      }
  const cxS = (bMinX + bMaxX) / 2
  const cyS = (bMinY + bMaxY) / 2
  const cxP = (sMinX + sMaxX) / 2
  const cyP = (sMinY + sMaxY) / 2
  const sHi = (bMaxX - bMinX) / (sMaxX - sMinX)
  const mk = (sc, fl, dx = 0, dy = 0) => (p) => ({
    x: cxS + dx + (p.x - cxP) * sc,
    y: cyS + dy + (p.y - cyP) * sc * fl,
  })
  const score = (f, stride = 1) => {
    let on = 0
    let n = 0
    for (let i = 0; i < pts.length; i += stride) {
      const q = f(pts[i])
      const xi = Math.round(q.x)
      const yi = Math.round(q.y)
      if (xi >= 0 && xi < W && yi >= 0 && yi < H && fin[yi * W + xi]) on++
      n++
    }
    return on / n
  }

  /* ── RECALIBRATION 3, 2026-09-04 · THE ANCHOR IS SEARCHED, NOT GUESSED ─────
   *
   * ⚠ THIS FIT PASSED FOR A MONTH BY ACCIDENT, AND ONE PIXEL TOOK IT AWAY.
   *
   * The fit has four free parameters — scale, flip, and the two translations.
   * It searched two of them and took the other two from `cxS`/`cyS`, the
   * MIDPOINT OF THE INK BOUNDING BOX. A midpoint of extremes is decided by
   * exactly two pixels, so it is only as clean as the dirtiest pixel in the
   * mask, and `inkMask`'s cut is `paper − 45`, which is generous on purpose so
   * that the antialiased skirt of the mark counts as ink.
   *
   * MEASURED on this tree, on the frames re-shot 2026-09-04:
   *
   *   frame                       ink px    ink bbox y      fitOnInk
   *   run/free-stroke Aug-3      123,560     2 … 2003        97.3 %
   *   run/free-stroke Sep-4      122,852   827 … 1829         0.5 %
   *
   * Both frames draw the same word, the same size, in the same place — the
   * mark itself spans y 800…1200 in each. The difference is the PAPER GRID.
   *
   *   Aug-3: a vertical rule at x = 1095 sat under the cut for all 2001 rows,
   *          so bMinY/bMaxY were the top and bottom of the STAGE and their
   *          midpoint, 1002.5, happened to be the word's own centre. The fit
   *          was right because the contamination was symmetric.
   *   Sep-4: the grid renders lighter. Every rule now sits at luma 205-244 and
   *          is correctly excluded — except where a vertical and a horizontal
   *          rule CROSS and the two blends stack to 203, two units under the
   *          205 cut. ONE such pixel, at (1083, 1829), 660 px below the mark,
   *          dragged the anchor 326 px and put the whole path off the ink.
   *
   * F41 IS THE SAME PIXEL. Its note above records the `gate` capture "fits at
   * 0.5 % of the path on ink against `run`'s 100.0 %" and reads that as a
   * mis-fit of unknown cause; `gate/free-stroke/032.png` carries this identical
   * grid crossing at (1094, 1820), luma 203. So the hang F41 guarded against
   * was downstream of this, and this is where it came from.
   *
   * WHAT WAS NOT DONE, and why. Raising the ink cut would exclude the grid and
   * it would also redefine ink for the MEASUREMENT — `f(u)` is drawn ink over
   * finished ink, and its whole subject is the soft end of the mark. Moving
   * that threshold to fix a fit is moving the bar the gate exists to hold.
   * Dropping isolated pixels from the mask fixes this picture and not the next
   * one, where the crossing lands two pixels wide. Both are guesses about the
   * contamination. Searching the anchor makes no assumption about it at all.
   *
   * So the two translations are now searched over the same objective that
   * already decides scale and flip, seeded from the bbox and free to move over
   * half the ink's own extent, which is the largest error contamination of an
   * extreme can produce. Nothing is loosened: `ROW.fit` still demands 90 % of
   * the path on ink, and the `mis-scaled-fit` known-bad still gets the searched
   * anchor with a deliberately wrong scale and still has to come back FAIL.
   * The coarse pass is stepped at a quarter of the mark's own nominal width so
   * it cannot stride over the mark, and scored on a subsampled path because at
   * that step it is choosing a basin, not a fit. */
  const scales = (n) => Array.from({ length: n + 1 }, (_, i) => sHi * (0.55 + (0.45 * i) / n))
  const seedStep = Math.max(1, Math.round((HERO_INK_WIDTH_PX / 4) * sHi))
  let best = { sc: sHi, fl: 1, dx: 0, dy: 0, v: -1 }
  {
    const rx = (bMaxX - bMinX) / 2
    const ry = (bMaxY - bMinY) / 2
    const stride = Math.max(1, Math.round(pts.length / 120))
    for (const fl of [1, -1])
      for (const sc of scales(4))
        for (let dy = -ry; dy <= ry; dy += seedStep)
          for (let dx = -rx; dx <= rx; dx += seedStep) {
            const v = score(mk(sc, fl, dx, dy), stride)
            if (v > best.v) best = { sc, fl, dx, dy, v }
          }
  }
  best.v = score(mk(best.sc, best.fl, best.dx, best.dy))
  for (let step = seedStep; step >= 1; step >>= 1) {
    for (const sc of scales(80)) {
      const v = score(mk(sc, best.fl, best.dx, best.dy))
      if (v > best.v) best = { ...best, sc, v }
    }
    for (let walk = 0; walk < 64; walk++) {
      let moved = false
      for (const [ox, oy] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [step, -step], [-step, step], [-step, -step]]) {
        const v = score(mk(best.sc, best.fl, best.dx + ox, best.dy + oy))
        if (v > best.v) {
          best = { ...best, dx: best.dx + ox, dy: best.dy + oy, v }
          moved = true
        }
      }
      if (!moved) break
    }
  }
  // `scaleMul` exists ONLY for the known-bad fit arm below.
  const SC = best.sc * scaleMul
  const toScreen = mk(SC, best.fl, best.dx, best.dy)
  const fitOnInk = scaleMul === 1 ? best.v : score(toScreen)
  const totalPx = total * SC
  /* THE SCALE ANCHOR, FROM THE LAW AND NOT FROM THE PICTURE.
   * `HERO_INK_WIDTH_PX` is `computeSolidEffectiveThicknessPx(DEFAULT_SOLID_
   * PARAMS.thickness)` — the same function `inflateBuildImplicitGeometry` sizes
   * the mark with. Times the fitted `SC` it is the nib's half-width in SCREEN
   * pixels for this capture, whatever device scale factor it was taken at. It
   * is only the ANCHOR: what the measurement uses is the LOCAL areal width,
   * because the carve makes the drawn mark narrower than the nominal nib and it
   * is the DRAWN mark being judged. */
  const nominalHalfPx = (HERO_INK_WIDTH_PX / 2) * SC

  const spath = pts.map((p) => {
    const q = toScreen(p)
    return { x: q.x, y: q.y, arcPx: p.arc * SC, stroke: p.stroke }
  })

  /* ---- THE RIBBON FIELD. For every pixel near the path: the arc and offset of
   * its nearest path point, the stroke that owns it, and the distance to the
   * nearest point of a DIFFERENT stroke. Rasterised by stamping each segment's
   * neighbourhood, so it is linear in the path rather than quadratic. */
  const REACH = RHO_CAP_W * nominalHalfPx * 1.6
  const nRho = new Float32Array(W * H).fill(Infinity)
  const nArc = new Float32Array(W * H)
  const nStr = new Int16Array(W * H).fill(-1)
  const nRho2 = new Float32Array(W * H).fill(Infinity)
  const nStr2 = new Int16Array(W * H).fill(-1)
  for (let i = 1; i < spath.length; i++) {
    const a = spath[i - 1]
    const b = spath[i]
    if (a.stroke !== b.stroke) continue
    const vx = b.x - a.x
    const vy = b.y - a.y
    const L2 = vx * vx + vy * vy
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - REACH))
    const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x) + REACH))
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - REACH))
    const y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y) + REACH))
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let t = L2 > 0 ? ((x - a.x) * vx + (y - a.y) * vy) / L2 : 0
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const px = a.x + vx * t
        const py = a.y + vy * t
        const dd = Math.hypot(x - px, y - py)
        if (dd > REACH) continue
        const p = y * W + x
        if (dd < nRho[p]) {
          if (nStr[p] !== a.stroke && nStr[p] !== -1) {
            nRho2[p] = nRho[p]
            nStr2[p] = nStr[p]
          }
          nRho[p] = dd
          nArc[p] = a.arcPx + (b.arcPx - a.arcPx) * t
          nStr[p] = a.stroke
        } else if (a.stroke !== nStr[p] && dd < nRho2[p]) {
          nRho2[p] = dd
          nStr2[p] = a.stroke
        }
      }
  }

  /* The word's own half-width, areal and therefore curvature-free, used only to
   * size the windows; every reading is normalised by the LOCAL one. */
  let inkN = 0
  for (let p = 0; p < fin.length; p++) if (fin[p] && nStr[p] !== -1 && nRho[p] <= REACH) inkN++
  const wG = inkN / (2 * totalPx)

  const at = (arcPx) => {
    const arcU = arcPx / SC
    let i = 1
    while (i < pts.length && pts[i].arc < arcU) i++
    if (i >= pts.length) i = pts.length - 1
    const a = toScreen(pts[i - 1])
    const b = toScreen(pts[i])
    const seg = Math.hypot(b.x - a.x, b.y - a.y)
    const f = seg > 0 ? (arcPx - pts[i - 1].arc * SC) / seg : 0
    const T = seg > 0 ? { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } : { x: 1, y: 0 }
    return {
      P: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
      T,
      N: { x: -T.y, y: T.x },
      stroke: pts[i].stroke,
    }
  }

  const BIN = BIN_W * wG
  const ARC_W = ARC_WINDOW_W * wG
  const RHO_CAP = RHO_CAP_W * wG
  /**
   * ⚠ A RULER WHOSE OWN HALF-WIDTH IS ZERO IS NOT A SMALL RULER, IT IS NO RULER.
   *
   * `wG` is `inkN / (2 · totalPx)` — the ink this fitted path actually passes
   * through. When the fit lands the path OFF the mark, `inkN` is 0 and every
   * window derived from `wG` collapses to zero width with it.
   *
   * That is not a slow measurement, it is a NON-TERMINATING one. `measureArm`'s
   * curvature loop steps by `wG / 4`, so at `wG === 0` it reads
   * `for (a = d; a <= d; a += 0)` — a condition that never goes false and a
   * step that never advances, spinning inside `Math.hypot` at 99 % CPU.
   *
   * MEASURED 2026-08-28, which is the whole of F41. The `gate` capture fits at
   * 0.5 % of the path on ink against `run`'s 100.0 %, so its `wG` is already
   * 0.131 px against 14.0. The `mis-scaled-fit` known-bad arm then rebuilds this
   * ruler at `scaleMul: 0.8`, which pushes the last of the path off the ink:
   * `inkN` 0, `wG` 0, and the gate spun for 72 minutes on the SIXTH of seven
   * arms with no output past its first `reading …` line. The sample count had
   * nothing to do with it — 33 frames against 201 was a coincidence of which
   * capture happened to be mis-fitted, and this would hang at any size.
   *
   * `degenerate` is carried on the ruler rather than thrown here, because the
   * mis-scaled arm is a KNOWN-BAD and a degenerate result is the correct answer
   * for it. `ROW.fit` reads `fitOnInk`, which is computed above and stays true,
   * so the row that requires that arm to fail still fails on its own terms.
   */
  const degenerate = !(wG > 0) || !Number.isFinite(wG)

  /** The ribbon sample set at pen arc d. */
  const windowAt = (d, penStroke) => {
    const idx = []
    const P = at(d).P
    const r = ARC_W + RHO_CAP + 4
    const bx0 = Math.max(0, Math.floor(P.x - r))
    const bx1 = Math.min(W - 1, Math.ceil(P.x + r))
    const by0 = Math.max(0, Math.floor(P.y - r))
    const by1 = Math.min(H - 1, Math.ceil(P.y + r))
    let dropped = 0
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const p = y * W + x
        if (!fin[p] || nStr[p] === -1 || nRho[p] > RHO_CAP) continue
        const u = nArc[p] - d
        if (u < -ARC_W || u > ARC_W) continue
        if (nStr[p] !== penStroke || (nStr2[p] !== -1 && nRho2[p] <= SHARED_W * wG)) {
          dropped++
          continue
        }
        idx.push(p)
      }
    return { idx, dropped }
  }

  /**
   * f(u) over a sample set, binned in ARC offset, fitted non-increasing, and
   * read at F_HI and F_LO. Returns the span in px, plus where f crosses 0.5 —
   * which is where the PIXELS say the pen is, against where the reveal LAW says
   * it is, and a disagreement there is worth seeing rather than averaging away.
   */
  const transition = (idx, d, M, wLoc) => {
    const nb = Math.ceil((2 * ARC_W) / BIN) + 1
    const bF = new Float64Array(nb)
    const bM = new Float64Array(nb)
    for (const p of idx) {
      const b = Math.floor((nArc[p] - d + ARC_W) / BIN)
      if (b < 0 || b >= nb) continue
      bF[b]++
      if (M[p]) bM[b]++
    }
    /* THE MINIMUM POPULATION IS A FRACTION OF THE MARK, NOT A COUNT. A full bin
     * holds about `2·w·BIN` pixels; an eighth of that keeps the tails out
     * without cutting into the body at any capture scale. */
    const minPop = Math.max(1, 0.125 * 2 * wLoc * BIN)
    const U = []
    const V = []
    const Wt = []
    for (let b = 0; b < nb; b++)
      if (bF[b] >= minPop) {
        U.push(b * BIN - ARC_W + BIN / 2)
        V.push(bM[b] / bF[b])
        Wt.push(bF[b])
      }
    if (U.length < 12) return null
    // POOL-ADJACENT-VIOLATORS, fitting the best NON-INCREASING curve.
    const bv = []
    const bw = []
    const bn = []
    for (let i = 0; i < V.length; i++) {
      let v = V[i]
      let w2 = Wt[i]
      let n2 = 1
      while (bv.length && bv[bv.length - 1] < v) {
        const pv = bv.pop()
        const pw = bw.pop()
        const pn = bn.pop()
        v = (v * w2 + pv * pw) / (w2 + pw)
        w2 += pw
        n2 += pn
      }
      bv.push(v)
      bw.push(w2)
      bn.push(n2)
    }
    const g = []
    for (let i = 0; i < bv.length; i++) for (let j = 0; j < bn[i]; j++) g.push(bv[i])
    const head = g[0]
    const tail = g[g.length - 1]
    // The transition has to be INSIDE the window or the number is a window edge.
    if (!(head >= F_HI && tail <= F_LO)) return null
    const isoAt = (L) => {
      for (let i = 0; i + 1 < g.length; i++)
        if (g[i] >= L && g[i + 1] <= L) {
          const a = g[i]
          const b = g[i + 1]
          const t = a === b ? 0 : (a - L) / (a - b)
          return U[i] + (U[i + 1] - U[i]) * t
        }
      return U[U.length - 1]
    }
    return { tw: Math.max(0, isoAt(F_LO) - isoAt(F_HI)), uMid: isoAt(0.5), head, tail }
  }

  return { SC, fitOnInk, totalPx, nominalHalfPx, wG, BIN, ARC_W, degenerate, at, windowAt, transition, nRho, nArc, fin, W, H }
}

/**
 * The per-playhead readings for ONE arm. `maskFor(k, ctx)` supplies the drawn
 * mask; a real arm loads a PNG, a known-bad arm returns a synthetic one.
 */
async function measureArm(R, playheads, maskFor, opts = {}) {
  const rows = []
  const rejects = { ends: 0, fold: 0, crowded: 0, unreadable: 0, uncalibrated: 0, degenerate: 0 }
  /* THE F41 GUARD. Every window below is a multiple of `R.wG`, so a ruler with
   * no half-width cannot produce a reading — and the curvature loop cannot even
   * terminate. Refuse the whole arm once, by name, instead of per playhead: an
   * arm that measured nothing must be VISIBLE as such rather than look like an
   * arm whose playheads were all rejected on their merits. */
  if (R.degenerate) {
    rejects.degenerate = playheads.length
    return {
      rows,
      rejects,
      playheads: 0,
      degenerate: true,
      fitOnInk: R.fitOnInk,
      fitScale: R.SC,
      nominalHalfWidthPx: R.nominalHalfPx,
      wordHalfWidthPx: R.wG,
      binPx: R.BIN,
      measuredW: null,
      measuredIqrW: null,
      controlCutW: null,
      controlWipeW: null,
      controlNibW: null,
      controlSepBins: 0,
      penScore: null,
      penScoreIqr: null,
    }
  }
  for (const ph of playheads) {
    const { k, d, penStroke, sArc0, sArc1 } = ph
    if (d - sArc0 < STROKE_MARGIN_W * R.wG || sArc1 - d < STROKE_MARGIN_W * R.wG) {
      rejects.ends++
      continue
    }
    /* max |kappa| inside the window.
     *
     * ⚠ THE TANGENT IS A CHORD OVER ONE HALF-WIDTH, NOT A POLYLINE SEGMENT. The
     * hero strokes carry the shipped hand-feel wobble and are resampled at a
     * spacing of 4 units (~5 px), so a segment-to-segment tangent difference
     * measures the WOBBLE and reads curvature everywhere. The ink those points
     * generate is a field ~12 px thick and does not wiggle at 5 px; a chord of
     * one half-width is the scale the ribbon actually has.
     */
    let kMax = 0
    {
      const base = R.wG
      const chordT = (a) => {
        const p0 = R.at(Math.max(0, a - base / 2)).P
        const p1 = R.at(a + base / 2).P
        const L = Math.hypot(p1.x - p0.x, p1.y - p0.y)
        return L > 0 ? { x: (p1.x - p0.x) / L, y: (p1.y - p0.y) / L } : { x: 1, y: 0 }
      }
      for (let a = d - R.ARC_W; a + base <= d + R.ARC_W; a += R.wG / 4) {
        const t0 = chordT(a)
        const t1 = chordT(a + base)
        const dth = Math.abs(Math.atan2(t0.x * t1.y - t0.y * t1.x, t0.x * t1.x + t0.y * t1.y))
        kMax = Math.max(kMax, dth / base)
      }
    }
    if (RHO_CAP_W * R.wG * kMax > FOLD_MARGIN) {
      rejects.fold++
      continue
    }
    const { idx, dropped } = R.windowAt(d, penStroke)
    if (idx.length < 400 || dropped / (idx.length + dropped) > CROWD_CAP) {
      rejects.crowded++
      continue
    }

    /* THE LOCAL HALF-WIDTH, AREAL. In ribbon coordinates the ink count per unit
     * arc is exactly 2W however the mark curves (the curvature term cancels
     * between the two sides of the centreline), so this needs no tangent, no
     * ray and no threshold crossing. Measured over the BODY behind the pen,
     * where the mark is at full width by construction. */
    let nBody = 0
    for (const p of idx) {
      const u = R.nArc[p] - d
      if (u >= -3.0 * R.wG && u <= -1.0 * R.wG) nBody++
    }
    const wLoc = nBody / (2 * 2.0 * R.wG)

    /* ---- THE TWO SYNTHETIC CONTROLS, AT THIS PLAYHEAD, ON THIS SAMPLE SET.
     * Both are built from the FINISHED mask and the path alone, so they are
     * IDENTICAL for every arm at a given playhead — which is what makes it
     * sound to reject a playhead on them without favouring any arm. */
    const cutM = new Uint8Array(R.fin.length)
    for (const p of idx) if (R.nArc[p] <= d) cutM[p] = 1
    const { P, T } = R.at(d)
    const wipeM = new Uint8Array(R.fin.length)
    for (const p of idx) {
      const x = p % R.W
      const y = (p - x) / R.W
      if ((x - P.x) * T.x + (y - P.y) * T.y <= 0) wipeM[p] = 1
    }
    /* A disc of radius wLoc swept along the path first covers the ribbon point
     * (a, rho) when the pen reaches `a − √(r² − rho²)`. Computed from the two
     * numbers the field already holds rather than by rasterising a disc, which
     * would add half a pixel of error to a quantity of a few. */
    const nibM = new Uint8Array(R.fin.length)
    for (const p of idx) {
      const rho = R.nRho[p]
      if (rho <= wLoc && R.nArc[p] <= d + Math.sqrt(wLoc * wLoc - rho * rho)) nibM[p] = 1
    }

    const cut = R.transition(idx, d, cutM, wLoc)
    const wipe = R.transition(idx, d, wipeM, wLoc)
    const nib = R.transition(idx, d, nibM, wLoc)
    if (!cut || !wipe || !nib) {
      rejects.unreadable++
      continue
    }
    /* A PLAYHEAD WHOSE OWN CONTROLS DO NOT SEPARATE IS NOT A READING. The ruler
     * this replaces divides by (nib − cut) unconditionally, which is where its
     * 1e13 scores come from: a denominator of one bin. */
    const nibW = nib.tw / wLoc
    const cutW = cut.tw / wLoc
    if (
      (nib.tw - cut.tw) / R.BIN < CONTROL_SEPARATION_BINS ||
      nibW < NIB_BAND[0] * NIB_IDEAL_W ||
      nibW > NIB_BAND[1] * NIB_IDEAL_W ||
      cutW > CUT_UNDER * NIB_IDEAL_W
    ) {
      rejects.uncalibrated++
      continue
    }

    const M = await maskFor(k, { idx, d, cutM, wipeM, nibM })
    const real = R.transition(idx, d, M, wLoc)
    if (!real) {
      rejects.unreadable++
      continue
    }
    rows.push({
      k,
      dFrac: ph.dFrac,
      wLocPx: wLoc,
      windowPx: idx.length,
      droppedPx: dropped,
      measuredW: real.tw / wLoc,
      cutW,
      wipeW: wipe.tw / wLoc,
      nibW,
      penMidW: (real.uMid - 0) / wLoc,
      penScore: (real.tw - cut.tw) / (nib.tw - cut.tw),
    })
    if (opts.limit && rows.length >= opts.limit) break
  }
  const M = (f) => med(rows.map(f))
  return {
    rows,
    rejects,
    playheads: rows.length,
    fitOnInk: R.fitOnInk,
    fitScale: R.SC,
    nominalHalfWidthPx: R.nominalHalfPx,
    wordHalfWidthPx: R.wG,
    binPx: R.BIN,
    measuredW: M((r) => r.measuredW),
    measuredIqrW: iqr(rows.map((r) => r.measuredW)),
    controlCutW: M((r) => r.cutW),
    controlWipeW: M((r) => r.wipeW),
    controlNibW: M((r) => r.nibW),
    controlSepBins: rows.length ? (M((r) => r.nibW) - M((r) => r.cutW)) * (M((r) => r.wLocPx) / R.BIN) : 0,
    penScore: M((r) => r.penScore),
    penScoreIqr: iqr(rows.map((r) => r.penScore)),
  }
}

/* ==========================================================================
 * THE ROWS. Each is a pure predicate over a result object, so the SAME
 * function judges the real arm and the known-bad one.
 * ========================================================================== */
const ROW = {
  fit: (r) => r.fitOnInk > 0.9,
  enough: (r) => r.playheads >= MIN_PLAYHEADS,
  /** distance from the reading to the cut/nib decision, in half-widths */
  margin: (r) =>
    r.measuredW === null
      ? null
      : Math.abs(r.measuredW - (r.controlCutW + DECISION_AT * (r.controlNibW - r.controlCutW))),
  precision: (r) => r.measuredIqrW !== null && ROW.margin(r) > r.measuredIqrW,
  isNib: (r) => r.penScore > 0.5,
  isCut: (r) => r.penScore < 0.5,
  improved: (shipped, prior) => shipped.penScore - prior.penScore > 0.3,
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR} — run _probe-pentip-sweep.mjs first`)
    process.exit(2)
  }
  console.log(`reading ${DIR}\n`)

  /* ═══ PROVENANCE · F40 ═══════════════════════════════════════════════════
   *
   * ⚠ THE BARE INVOCATION GRADED AUGUST-3 FRAMES FOR 25 DAYS AND CALLED IT
   * GREEN. `--label` defaults to `run`, and `docs/verification/pentip/run` was
   * captured 2026-08-03. Nothing in this file ever asked how old that was, so
   * every verdict it printed described a build that no longer existed. A green
   * row on stale frames is not a weak signal, it is a false one.
   *
   * This runs BEFORE the engine loop on purpose: a capture that cannot be graded
   * should be refused in a second, not after minutes of measuring it.
   * DISPATCH §3 — a SKIP is not a pass, so the row is red when the comparison
   * cannot be made at all, never absent. */
  console.log("── PROVENANCE · does this evidence belong to this tree ───────")
  const capPng = newestCapture(DIR, /\.png$/)
  const libNewest = newestUnder(join(ROOT, "lib"))
  const rel = (f) => (f && f.startsWith(ROOT) ? relative(ROOT, f) : f)
  const stamp = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 16)
  const fresh = capPng.file !== null && libNewest.file !== null && libNewest.ms <= capPng.ms
  say(
    fresh,
    "PROVENANCE · every frame graded here post-dates every source file under lib/",
    capPng.file && libNewest.file
      ? fresh
        ? `newest frame ${rel(capPng.file)} ${stamp(capPng.ms)} · newest source ${rel(libNewest.file)} ${stamp(libNewest.ms)}`
        : `STALE BY ${((libNewest.ms - capPng.ms) / 3600000).toFixed(1)}h — newest frame ${rel(capPng.file)} ${stamp(capPng.ms)} ` +
          `but ${rel(libNewest.file)} was written ${stamp(libNewest.ms)}. Every verdict below describes a build that no longer ` +
          `exists. Re-capture with node scripts/verify/_probe-pentip-sweep.mjs --label=${LABEL}; do NOT relax this row.`
      : `no frames at ${rel(DIR)}, or no source under lib/ — the comparison cannot be made, so nothing below is trustworthy`,
  )
  /* THE EVIDENCE IS STALE, SO THERE IS NOTHING BELOW WORTH MEASURING. Exiting
   * here rather than grading on is what makes this a gate and not a warning
   * printed above a wall of PASS rows. */
  if (!fresh) {
    console.log(
      "\n⚠ NO VERDICT. The stored frames predate the code they would be judging,\n" +
        "  so no reading taken from them says anything about the current mark.",
    )
    console.log(`rows: ${rowsSeen.length}, failures: ${rowsSeen.filter((r) => !r.ok).length}`)
    process.exit(1)
  }
  console.log("")

  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const strokes = processedHeroStrokes()

  /* ---- the pen path, with per-point arc length and the stroke it belongs to */
  const pts = []
  const strokeEndArc = []
  let total = 0
  for (const s of strokes)
    for (let i = 1; i < s.points.length; i++)
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
  {
    let acc = 0
    let si = 0
    for (const s of strokes) {
      for (let i = 0; i < s.points.length; i++) {
        if (i > 0) acc += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
        pts.push({ x: s.points[i].x, y: s.points[i].y, arc: acc, stroke: si })
      }
      strokeEndArc.push(acc)
      si++
    }
  }

  const results = {}
  const knownBad = {}
  for (const engine of Object.keys(meta.engines)) {
    const samples = meta.engines[engine]
    const lastIdx = samples.length - 1
    const { m: fin, w: W, h: H } = await inkMask(join(DIR, engine, `${String(lastIdx).padStart(3, "0")}.png`))
    const R = buildRuler({ fin, W, H, pts, strokeEndArc, total })

    const playheads = []
    for (let k = 5; k < samples.length - 4; k++) {
      const phaseT = samples[k].phaseT
      const dFrac = revealDistanceFraction(strokes, phaseT, MODE, BLEND)
      const d = dFrac * R.totalPx
      const penStroke = R.at(d).stroke
      playheads.push({
        k,
        dFrac,
        d,
        penStroke,
        sArc0: (strokeEndArc[penStroke - 1] ?? 0) * R.SC,
        sArc1: strokeEndArc[penStroke] * R.SC,
      })
    }

    /* A BOUNDED CACHE, ON PURPOSE. Each mask is W·H bytes — 5.1 MB at this
     * capture size — and a dense sweep has hundreds of playheads, so an
     * unbounded Map is a gigabyte per arm. */
    const cache = new Map()
    const frameMask = async (k) => {
      if (!cache.has(k)) {
        if (cache.size >= 48) cache.delete(cache.keys().next().value)
        cache.set(k, (await inkMask(join(DIR, engine, `${String(k).padStart(3, "0")}.png`))).m)
      }
      return cache.get(k)
    }
    results[engine] = await measureArm(R, playheads, frameMask)

    /* ---- THE KNOWN-BAD ARMS, on the SAME ruler and the SAME playheads ----
     * Each replaces the frame with a mask built wrong in the exact way one row
     * is about. `ctx` carries the very control masks the row is judged against,
     * so there is no second implementation to drift. */
    if (engine === "free-stroke" || engine === PRIOR_ARM) {
      knownBad[`${engine}::arc-cut`] = await measureArm(R, playheads, async (k, ctx) => ctx.cutM)
      knownBad[`${engine}::half-plane-wipe`] = await measureArm(R, playheads, async (k, ctx) => ctx.wipeM)
      knownBad[`${engine}::disc-nib`] = await measureArm(R, playheads, async (k, ctx) => ctx.nibM)
      knownBad[`${engine}::few-playheads`] = await measureArm(R, playheads, frameMask, {
        limit: MIN_PLAYHEADS - 1,
      })
      const Rbad = buildRuler({ fin, W, H, pts, strokeEndArc, total, scaleMul: 0.8 })
      knownBad[`${engine}::mis-scaled-fit`] = await measureArm(
        Rbad,
        playheads.map((p) => ({ ...p, d: p.d * 0.8, sArc0: p.sArc0 * 0.8, sArc1: p.sArc1 * 0.8 })),
        frameMask,
      )
      /* AND THE ONE THAT MATTERS MOST: the ruler this file replaces, run on
       * these same frames. Its per-playhead spread is the known-bad for the
       * PRECISION row. */
      knownBad[`${engine}::cartesian-ruler`] = await cartesianRuler(R, playheads, frameMask)
    }

    const r = results[engine]
    console.log(`\n=== ${engine} ===`)
    /* AN ARM THAT KEPT NO PLAYHEADS HAS NO MEDIANS, AND EVERY LINE BELOW READS
     * ONE. `null.toFixed()` throws, and a throw here is a bare non-zero exit
     * with NO FAIL ROW against it — the gate would look like it merely errored
     * rather than like it found something. The row fires instead.
     *
     * The condition is "no readings", not "degenerate ruler", because both
     * arrive here and only one of them was ever about `wG`: on the `gate`
     * capture the real arm's ruler is fine by that test (`wG` 0.13) and still
     * loses all 24 playheads to the crowded-ribbon reject, since the fitted path
     * runs off the mark. Same missing numbers, same crash, one guard. */
    if (r.playheads === 0) {
      say(
        false,
        `${engine} — this arm kept NO playheads and measured nothing`,
        `fit ${r.fitScale.toFixed(4)} px/unit · ${(r.fitOnInk * 100).toFixed(1)} % of path on final ink · ` +
          `word half-width ${r.wordHalfWidthPx.toFixed(3)} px · rejected ${JSON.stringify(r.rejects)}` +
          (r.degenerate ? " · RULER DEGENERATE: wG is zero, every window collapses with it" : "") +
          `. Re-capture with node scripts/verify/_probe-pentip-sweep.mjs --label=${LABEL}`,
      )
      continue
    }
    console.log(`  fit ${r.fitScale.toFixed(4)} px/unit · ${(r.fitOnInk * 100).toFixed(1)} % of path on final ink`)
    console.log(`  THE RULER, DERIVED (every window a multiple of the mark's own half-width):`)
    console.log(`      nominal half-width (law × fit)   ${r.nominalHalfWidthPx.toFixed(2)} px`)
    console.log(`      AREAL half-width of the word     ${r.wordHalfWidthPx.toFixed(2)} px   (ink px / 2 · path px)`)
    console.log(
      `      arc window ±${ARC_WINDOW_W}w · rho cap ${RHO_CAP_W}w · bin ${BIN_W}w = ${r.binPx.toFixed(3)} px`,
    )
    console.log(
      `  PLAYHEADS ${r.playheads} kept · rejected: stroke ends ${r.rejects.ends} · ribbon folds (rho·k>${FOLD_MARGIN}) ${r.rejects.fold} · ` +
        `crowded ribbon ${r.rejects.crowded} · unreadable ${r.rejects.unreadable} · uncalibrated ${r.rejects.uncalibrated}`,
    )
    console.log(`  TERMINAL-EDGE TRANSITION (f = ${F_HI} -> ${F_LO}), per playhead then median:`)
    console.log(
      `      measured                       ${r.measuredW.toFixed(4)} w   IQR ${r.measuredIqrW.toFixed(4)} w`,
    )
    console.log(`      CONTROL  arc CUT               ${r.controlCutW.toFixed(4)} w`)
    console.log(`      CONTROL  half-plane WIPE       ${r.controlWipeW.toFixed(4)} w`)
    console.log(
      `      CONTROL  disc NIB              ${r.controlNibW.toFixed(4)} w   ` +
        `= ${((r.controlNibW / NIB_IDEAL_W) * 100).toFixed(0)} % of the closed form ${NIB_IDEAL_W.toFixed(4)} w`,
    )
    /* A SCORE ABOVE 1 IS NOT AN ERROR AND IS WORTH SAYING SO. The NIB control is
     * a HARD disc of one half-width; a real drawn end can round off over more
     * than that (Desk Doodles' rebuild-from-clipped-strokes tapers the edges so
     * the end comes to a point, which is longer than a semicircle). What the
     * score locates is a POSITION between two named shapes, and past the nib end
     * of that line still means "rounder than a hard disc", never "measured
     * wrong". */
    console.log(
      `      pen score (0 = cut, 1 = nib)   ${r.penScore.toFixed(3)}  IQR ${r.penScoreIqr.toFixed(3)}` +
        `${r.penScore > 1 ? "   (>1 = rounder than a HARD disc of one half-width)" : ""}`,
    )
    console.log(`   k   revealDist   w(px)   window  dropped   measured    cut     nib    score`)
    for (const q of r.rows)
      console.log(
        `  ${String(q.k).padStart(2)}   ${q.dFrac.toFixed(4)}     ${q.wLocPx.toFixed(1).padStart(5)}   ` +
          `${String(q.windowPx).padStart(6)}   ${String(q.droppedPx).padStart(6)}    ${q.measuredW.toFixed(4)}  ` +
          `${q.cutW.toFixed(4)}  ${q.nibW.toFixed(4)}  ${q.penScore.toFixed(3)}`,
      )
  }

  /* ---- CALIBRATION, ASSERTED BEFORE THE VERDICT ------------------------- */
  console.log("\n── CALIBRATION ───────────────────────────────────────────────")
  let calibrated = true
  for (const [engine, r] of Object.entries(results)) {
    if (r.playheads === 0) {
      say(
        false,
        `${engine} — CALIBRATION cannot be attempted on an arm with no readings`,
        `${(r.fitOnInk * 100).toFixed(1)} % of path on ink${r.degenerate ? " · ruler degenerate" : ""}`,
      )
      calibrated = false
      continue
    }
    say(ROW.fit(r), `${engine} — the stroke->screen fit is real`, `${(r.fitOnInk * 100).toFixed(1)} %`)
    say(ROW.enough(r), `${engine} — enough playheads inside the draw to judge`, `${r.playheads}`)
    const cutOk = r.controlCutW <= CUT_UNDER * NIB_IDEAL_W
    say(
      cutOk,
      `${engine} — CONTROL: an arc CUT reads as a cut`,
      `${r.controlCutW.toFixed(4)} w (must be <= ${(CUT_UNDER * NIB_IDEAL_W).toFixed(4)})`,
    )
    const wipeOk = r.controlWipeW <= CUT_UNDER * NIB_IDEAL_W
    say(
      wipeOk,
      `${engine} — CONTROL: a half-plane WIPE reads as a cut`,
      `${r.controlWipeW.toFixed(4)} w (must be <= ${(CUT_UNDER * NIB_IDEAL_W).toFixed(4)})`,
    )
    const ratio = r.controlNibW / NIB_IDEAL_W
    const nibOk = ratio >= NIB_BAND[0] && ratio <= NIB_BAND[1]
    say(
      nibOk,
      `${engine} — CONTROL: a disc NIB reads its own closed form`,
      `${r.controlNibW.toFixed(4)} w = ${(ratio * 100).toFixed(0)} % of ${NIB_IDEAL_W.toFixed(4)} w ` +
        `(band ${(NIB_BAND[0] * 100).toFixed(0)}-${(NIB_BAND[1] * 100).toFixed(0)} %; the Cartesian ruler this replaces reads 53-63 %)`,
    )
    const sepOk = r.controlSepBins >= CONTROL_SEPARATION_BINS
    say(
      sepOk,
      `${engine} — CONTROL: the ruler can RESOLVE the gap between them`,
      `${r.controlSepBins.toFixed(1)} bins of ${r.binPx.toFixed(3)} px (must be >= ${CONTROL_SEPARATION_BINS})`,
    )
    const precOk = ROW.precision(r)
    say(
      precOk,
      `${engine} — DECISIVE: the reading is further from the cut/nib line than its own spread`,
      `margin ${ROW.margin(r).toFixed(4)} w vs IQR ${r.measuredIqrW.toFixed(4)} w over ${r.playheads} playheads ` +
        `(decision at ${(r.controlCutW + DECISION_AT * (r.controlNibW - r.controlCutW)).toFixed(4)} w)`,
    )
    if (!cutOk || !wipeOk || !nibOk || !sepOk || !precOk || !ROW.fit(r) || !ROW.enough(r)) calibrated = false
  }

  /* ---- THE KNOWN-BAD INPUTS. EVERY ROW MUST FAIL ON ITS OWN. ------------- */
  console.log("\n── KNOWN-BAD INPUTS · every discriminating row, required to FAIL ──")
  /** Null-safe formatter. An arm that measured nothing has null medians, and a
   *  `.toFixed()` on one throws — which reads as the gate erroring rather than
   *  as the gate reporting. */
  const f3 = (v) => (v === null || v === undefined ? "n/a" : v.toFixed(3))
  /**
   * ⚠ A KNOWN-BAD THAT MEASURED NOTHING HAS NOT BEEN DEMONSTRATED.
   *
   * Every row here reads `!ok`, and a null score compares false against every
   * threshold — so an arm with no readings would sail through as "correctly
   * FAILS" while proving exactly nothing. That is the vacuous-control shape this
   * whole file exists to refuse. `arms` names the results the row depends on; if
   * any of them kept no playheads the row is RED, and it says which.
   */
  const mustFail = (name, ok, what, detail, arms = []) => {
    const empty = arms.filter((a) => !a || a.playheads === 0)
    if (empty.length) {
      say(false, `KNOWN-BAD ${name} — ${what} was NOT DEMONSTRATED`, `${empty.length} of ${arms.length} arms kept no playheads, so the row could not be exercised — a control that measured nothing is not a control that failed`)
      return
    }
    const good = !ok
    say(good, `KNOWN-BAD ${name} — ${what} correctly FAILS`, detail)
  }
  for (const base of ["free-stroke", PRIOR_ARM]) {
    if (!results[base]) continue
    const kb = (s) => knownBad[`${base}::${s}`]
    const cutArm = kb("arc-cut")
    const wipeArm = kb("half-plane-wipe")
    const nibArm = kb("disc-nib")
    mustFail(
      `${base}::arc-cut`,
      ROW.isNib(cutArm),
      `"reads as a NIB, not a CUT" on an arm whose frames ARE the arc cut`,
      `pen score ${f3(cutArm.penScore)} (row wants > 0.5)`,
      [cutArm],
    )
    mustFail(
      `${base}::half-plane-wipe`,
      ROW.isNib(wipeArm),
      `"reads as a NIB, not a CUT" on an arm whose frames ARE a spatial wipe`,
      `pen score ${f3(wipeArm.penScore)} (row wants > 0.5)`,
      [wipeArm],
    )
    mustFail(
      `${base}::disc-nib`,
      ROW.isCut(nibArm),
      `"the PARKED PRIOR still reads as a CUT" on a prior whose frames ARE the disc nib`,
      `pen score ${f3(nibArm.penScore)} (row wants < 0.5)`,
      [nibArm],
    )
    mustFail(
      `${base}::inverted-delta`,
      ROW.improved(cutArm, nibArm),
      `"the shipped tip is decisively nearer a NIB" with the two swapped`,
      `${f3(nibArm.penScore)} -> ${f3(cutArm.penScore)} (row wants a rise > 0.3)`,
      [cutArm, nibArm],
    )
    mustFail(
      `${base}::few-playheads`,
      ROW.enough(kb("few-playheads")),
      `"enough playheads to judge" on a truncated playhead list`,
      `${kb("few-playheads").playheads} playheads (row wants >= ${MIN_PLAYHEADS})`,
      /* 0 playheads would satisfy this row for a reason that has nothing to do
       * with the truncation it is testing. The truncated arm is meant to keep
       * MIN_PLAYHEADS - 1 of them, not none. */
      [kb("few-playheads")],
    )
    mustFail(
      `${base}::mis-scaled-fit`,
      ROW.fit(kb("mis-scaled-fit")),
      `"the stroke->screen fit is real" with the fit scaled to 0.8`,
      `${(kb("mis-scaled-fit").fitOnInk * 100).toFixed(1)} % of path on ink (row wants > 90 %)`,
    )
    const cart = kb("cartesian-ruler")
    mustFail(
      `${base}::cartesian-ruler`,
      ROW.precision(cart),
      `"DECISIVE" on THE RULER THIS FILE REPLACES, run on these same frames`,
      `median ${f3(cart.measuredW)} w, margin ${f3(ROW.margin(cart))} w, ` +
        `IQR ${f3(cart.measuredIqrW)} w over ${cart.playheads} playheads`,
      [cart],
    )
  }

  /* ---- THE VERDICT ------------------------------------------------------ */
  console.log("\n── VERDICT ───────────────────────────────────────────────────")
  if (!calibrated) {
    console.log(
      "⚠ THE CALIBRATION DID NOT HOLD. No verdict is reported: a gate whose\n" +
        "  negative control cannot fail proves nothing, and printing a PASS beside\n" +
        "  a collapsed control is exactly how this instrument went blind twice.",
    )
  } else {
    for (const [engine, r] of Object.entries(results)) {
      if (engine === PRIOR_ARM) continue
      say(
        ROW.isNib(r),
        `${engine} — the reveal's moving end reads as a NIB, not a CUT`,
        `pen score ${r.penScore.toFixed(3)} (measured ${r.measuredW.toFixed(4)} w between cut ${r.controlCutW.toFixed(4)} and nib ${r.controlNibW.toFixed(4)})`,
      )
    }
    const fs = results["free-stroke"]
    const dd = results["desk-doodles"]
    const prior = results[PRIOR_ARM]
    if (fs && dd)
      console.log(
        `\n  Free Stroke pen score ${fs.penScore.toFixed(3)}   vs   Desk Doodles pen score ${dd.penScore.toFixed(3)}`,
      )
    /* THE PARKED PRIOR IS THE POSITIVE CONTROL FOR THE FIX ITSELF. If the arm
     * captured with the tip shape OFF does not read as a CUT, then either the
     * fix is not what moved the number or the switch did not take — and either
     * way the after reading means nothing. */
    if (fs && prior) {
      console.log(
        `  Free Stroke, tip OFF (the parked prior) pen score ${prior.penScore.toFixed(3)}  ->  shipped ${fs.penScore.toFixed(3)}`,
      )
      say(
        ROW.isCut(prior),
        "CONTROL: the PARKED PRIOR still reads as a CUT",
        `pen score ${prior.penScore.toFixed(3)} (must be < 0.5, or the fix is not what moved the number)`,
      )
      say(
        ROW.improved(fs, prior),
        "the shipped tip is decisively nearer a NIB than the prior it replaces",
        `${prior.penScore.toFixed(3)} -> ${fs.penScore.toFixed(3)}`,
      )
    }
  }

  /* `--out=` EXISTS SO A HISTORICAL CAPTURE CAN BE RE-READ WITHOUT DESTROYING
   * THE RECORD IT WAS READ WITH. `docs/verification/pentip/run/pentip.json` is
   * where the 2.400 / 1.233 / 2.142 in HANDOFF-2026-08-02.md came from, and
   * overwriting it would delete the thing the reconciliation is about. */
  const OUT = join(DIR, arg("out", "pentip.json"))
  writeFileSync(OUT, JSON.stringify({ results, knownBad }, null, 2))
  console.log(`\njson: ${OUT}`)
  console.log(`rows: ${rowsSeen.length}, failures: ${rowsSeen.filter((r) => !r.ok).length}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

/* ==========================================================================
 * THE RULER THIS FILE REPLACES, KEPT RUNNABLE AS A KNOWN-BAD INPUT.
 *
 * A Cartesian disc of 2.5 half-widths about the pen point, projected onto one
 * tangent, binned at a quarter pixel, read as "last bin at or above F_HI, first
 * at or below F_LO". Whole file parked verbatim at
 * `_probe-pentip-cartesian-parked.mjs`; this is the measuring core of it, so the
 * PRECISION row has a real broken instrument to fail on rather than a synthetic
 * caricature of one.
 * ========================================================================== */
async function cartesianRuler(R, playheads, maskFor) {
  const OLD_BIN = 0.25
  const OLD_F_HI = 0.85
  const OLD_F_LO = 0.15
  const rows = []
  // The old file's `w`: the median contiguous ink half-width on a perpendicular
  // ray, taken a body-back before each stroke end.
  const halfWidth = (P, N, cap) => {
    const on = (x, y) => {
      const xi = Math.round(x)
      const yi = Math.round(y)
      return xi >= 0 && xi < R.W && yi >= 0 && yi < R.H && R.fin[yi * R.W + xi]
    }
    if (!on(P.x, P.y)) return 0
    let a = 0
    while (a < cap && on(P.x + N.x * (a + 0.5), P.y + N.y * (a + 0.5))) a += 0.5
    let b = 0
    while (b < cap && on(P.x - N.x * (b + 0.5), P.y - N.y * (b + 0.5))) b += 0.5
    return (a + b) / 2
  }
  const nh = R.nominalHalfPx
  const bodies = []
  for (const ph of playheads) {
    const q = R.at(Math.max(0, ph.sArc1 - 1.25 * nh))
    const w = halfWidth(q.P, q.N, 3.0 * nh)
    if (w > 0.25 * nh && w < 2.2 * nh) bodies.push(w)
  }
  bodies.sort((a, b) => a - b)
  const wPx = bodies[Math.floor(bodies.length / 2)] ?? nh
  const RAD = Math.max(6, Math.round(2.5 * wPx))
  for (const ph of playheads) {
    if (ph.d < 3 * RAD) continue
    const { P, N } = R.at(ph.d)
    const T = { x: N.y, y: -N.x }
    const M = await maskFor(ph.k)
    const nb = Math.ceil((2 * RAD) / OLD_BIN) + 1
    const bF = new Float64Array(nb)
    const bM = new Float64Array(nb)
    for (let dy = -RAD; dy <= RAD; dy++)
      for (let dx = -RAD; dx <= RAD; dx++) {
        if (dx * dx + dy * dy > RAD * RAD) continue
        const x = Math.round(P.x + dx)
        const y = Math.round(P.y + dy)
        if (x < 0 || x >= R.W || y < 0 || y >= R.H) continue
        const p = y * R.W + x
        if (!R.fin[p]) continue
        const u = Math.floor((dx * T.x + dy * T.y + RAD) / OLD_BIN)
        if (u < 0 || u >= nb) continue
        bF[u]++
        if (M[p]) bM[u]++
      }
    const minPop = Math.max(1, 0.125 * 2 * wPx * OLD_BIN)
    const f = new Array(nb).fill(null)
    for (let u = 0; u < nb; u++) if (bF[u] >= minPop) f[u] = bM[u] / bF[u]
    let iHi = -1
    for (let u = 0; u < nb; u++) if (f[u] !== null && f[u] >= OLD_F_HI) iHi = u
    if (iHi < 0) continue
    let iLo = -1
    for (let u = iHi + 1; u < nb; u++)
      if (f[u] !== null && f[u] <= OLD_F_LO) {
        iLo = u
        break
      }
    if (iLo < 0) continue
    const lerp = (i, dir, level) => {
      let j = i + dir
      while (j >= 0 && j < nb && f[j] === null) j += dir
      if (j < 0 || j >= nb) return i * OLD_BIN
      const a = f[i]
      const b = f[j]
      if (a === b) return i * OLD_BIN
      const t = (a - level) / (a - b)
      return (i + dir * Math.max(0, Math.min(1, t))) * OLD_BIN
    }
    rows.push({ k: ph.k, measuredW: (lerp(iLo, -1, OLD_F_LO) - lerp(iHi, +1, OLD_F_HI)) / wPx })
  }
  const vals = rows.map((r) => r.measuredW)
  /* ITS OWN CONTROLS, AS IT DEFINED THEM — a cut at ~0 and a nib at its closed
   * form — so the decision line it is judged against is ITS line, not this
   * file's. A known-bad has to fail on its own terms or it proves nothing. */
  return {
    rows,
    playheads: rows.length,
    halfWidthPx: wPx,
    discRadiusPx: RAD,
    measuredW: med(vals),
    measuredIqrW: iqr(vals),
    controlCutW: 0,
    controlNibW: Math.sqrt(1 - OLD_F_LO * OLD_F_LO) - Math.sqrt(1 - OLD_F_HI * OLD_F_HI),
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
