// ASSERT-PENTIP-SPECKS — DOES A LONG TAPER COME APART?
//
// ── THE CLAIM THIS GATE EXISTS TO SETTLE ───────────────────────────────────
// `lib/pen-reveal.ts` once shipped `quill` at `taper: 0.85` with a reason:
//
//     "0.85, not the 1.6 first tried: at 1.6 the nose is 2.6 radii long on a
//      mark thirteen screen pixels wide, and the last of it is a sub-pixel
//      sliver that came apart into loose specks at 60 % and 75 % of the draw
//      — visible in docs/verification/pentip/zoom/. A taper that breaks up is
//      not a softer end, it is a dirtier one."
//
// That sentence was the ONLY thing standing between this repo and the shape
// Sebs had asked for by name for days, because on the repaired gate
// (`docs/verification/pentip/fix-base`) Desk Doodles' moving end read
// **1.6884 w** against our **0.7720 w**, and the closed form
// `span = nose*0.3068 + taper*0.5` says nothing but a longer taper closes it.
//
// ── WHERE THAT LEFT THE TREE, AND WHAT THIS FILE NOW GRADES ───────────────
// It is settled. `quill` ships at **taper 2.70** — the closed form solved for
// Desk Doodles' measured end, validated at 99-105 % across a six-fold range
// before it was used — and Free Stroke reads 5.578 against Desk Doodles' 5.796,
// 0.6 % apart. The 0.85 is PARKED WHOLE as `chisel` and has a pill on
// `/desk-doodles`, so every prior frame in `docs/verification/` is re-renderable.
//
// So the question this gate answers is no longer "may we try a long taper". It
// is **"the long taper SHIPPED — does it come apart where the short one did
// not?"**, and the two arms that question is about are `quill 2.70` and
// `chisel 0.85`. That pair lives in `docs/verification/pentip/ship-dsf1`, and
// that is what a bare run reads.
//
// ── ⚠ THE REPAIR OF 2026-08-03, AND WHY THE BARE RUN WAS RED ──────────────
// This file's previous author reported "9 rows, ALL PASS". Typed bare it exited
// 1 on:
//
//     FAIL  and opens no more BLANK SPOTS on any frame
//           — t275 worst frame 2 vs free-stroke 1 (totals 27 vs 24)
//
// The capture was not stale and the assertion was not wrong. **The DEFAULT ARMS
// were.** It defaulted to `--label=tipshape-sweep --arm=t275 --ref=free-stroke`,
// and in THAT capture — shot at 04:32, fifteen minutes before `lib/pen-reveal.ts`
// landed 2.70 at 04:47 — the arm named `free-stroke` is quill at **0.85**. So a
// row whose label reads *"no worse than the shape that ships"* was comparing a
// long taper against the shape it REPLACED, and printing red about it. The
// author never saw it because the author always typed the arguments; nobody else
// would. `scripts/verify/lib/gate-fixtures/bad-wrong-defaults.mjs` was written
// from this exact defect, and `assert-gate-integrity.mjs` channel I fails any
// gate that is red when typed with no arguments.
//
// Eight further defects were measured in the same pass and are repaired below,
// each at its own site with the old assertion PARKED beside it rather than
// deleted. The three that changed what this file MEASURES, as opposed to which
// arms it points at:
//
//   · THE MEASURING REGION WAS THE WHOLE FRAME. Nothing here was a tip window.
//     With the pen located independently as the centroid of ink new since the
//     previous frame, the MEDIAN speck this file counted sat **5.2-6.1 areal
//     half-widths** from the pen and the median blank spot **7.9-9.1** — against
//     a taper whose entire span is `nose*0.3068 + taper*0.5` = **1.68 w** at
//     2.75. Between 68 % and 81 % of every number it printed was ink the taper
//     cannot physically reach. Same disease as `assert-drawin-pentip.mjs`'s
//     neighbour-ink (median 27.7 % foreign), worse.
//   · THE BLANK STATISTIC WAS ANTI-MONOTONE IN SEVERITY. A blank spot was
//     counted only while `n < speckMax`, so an 81 px hole and a 5 px crack both
//     scored "1", and a 200 px void scored **0**. The row that failed the bare
//     run was `arm.maxBlanks <= ref.maxBlanks` — a max over a counter whose
//     whole range on real arms is [1,2].
//   · THE KNOWN-BAD WAS CALIBRATED ON ONE ARM AND QUOTED ABOUT FIVE. Its bar
//     was `bad.totSpecks >= ref.totSpecks * 1.5` — a fixed number, 55.5, taken
//     off `free-stroke`. Applying the identical severed-tip construction to each
//     arm: free-stroke 46 (0.83 of bar) NOT CAUGHT, t160 45 (0.81) NOT CAUGHT,
//     t240 52 (0.94) NOT CAUGHT, t275 58 (1.045) caught. **It cleared its own
//     bar by 4.5 % on the default arm and failed on the shape that ships**, and
//     this file's own words at the verdict are that *"a counter that cannot see
//     a tip that has been literally cut off cannot be quoted about one that has
//     not."*
//
// ── SO IS THE EXTRA BLANK SPOT REAL? YES, AND HERE IS ITS SIZE ────────────
// The bare red was worth asking about even though the arms were wrong, because
// blank spots in the mark are the one thing Sebs has been angriest about — a
// texture misregistration was erasing chunks of his word until hours ago. On the
// repaired statistic, inside the tip window, it is REAL, it is MONOTONE IN
// TAPER, and it is small enough to state in whole pixels:
//
//     taper   blank-spot px at the pen, over 179 frames at dsf 2
//     0.00     136 px in 2 holes   <- `free-stroke-off`: NO tip shape at all,
//                                     and the biggest blank spot of any arm
//                                     (133 px). A tip is what stops this.
//     0.85      40 px in 3
//     1.60      40 px in 3         <- the 2026-08-02 rejection: IDENTICAL to
//                                     0.85 on this channel, +0 on every frame
//     2.40      51 px in 4
//     2.75      55 px in 6
//     3.10      66 px in 8
//
// So going from 0.85 to the shipped end of that ladder costs **fifteen pixels of
// paper spread over six holes across an entire 179-frame draw**, on a mark whose
// own half-width square is 132 px — about a ninth of one square, in total, for
// the whole animation. It is NOT an artefact: four arms in taper order, and the
// divisor-only null pairs move 0.01-0.03 px/frame against it. It is also not
// free, and it is not rounded away here.
//
// It is charged where it can be seen. At dsf 2 the three long tapers exceed the
// worst-single-frame bar (t240 +11 px, t275 +12, t310 +9, bar 7.9) and the
// detached-piece sign test (z 2.41-2.79, bar 2), so `--label=tipshape-sweep`
// prints them RED with the numbers attached — on top of a stale capture whose
// reference arm is the wrong shape, which it also prints. At dsf 1, the raster
// the rejection was written about and the one the shipped pair was captured on,
// the same statistic reads **+3 px in one hole over 90 frames** and every row is
// green. Both are printed; neither is hidden behind the other.
//
// ── THE ANSWER ON THE ANTIALIASING, AND IT IS NOT THE ONE THIS FILE WAS
//    STARTED TO PROVE ────────────────────────────────────────────────────────
// This gate was opened to show that the breakup was the ANTIALIASING — that the
// coverage ramp was divided by the screen size of one LOCAL UNIT where the
// tested scalar's real gradient is `sqrt(1 + taper^2)`, so the ramp came out
// `1/sqrt(1 + taper^2)` of a pixel wide and left the edge unantialiased. **The
// arithmetic is right and the direction is measured — see the AA-band rows,
// which separate on both rasters and both tapers — but it is NOT what was
// stopping a long taper, and this file says so rather than taking the credit.**
//
// What was stopping it is that the numbers were read off a MISREGISTERED PEN
// FIELD (`setFieldRealloc` in components/viewport-3d.tsx: r175's immutable
// `texStorage2D` left the lookup scanning a 1192x324 rectangle for a 1152x294
// field, so the mark was carved by a stretched copy of its own outline). On the
// repaired field the rejected taper 1.6 is indistinguishable from the 0.85 that
// replaced it, and so is 2.70.
//
// ── WHICH RASTER IS GRADED BY WHICH INVOCATION, stated because the previous
//    header claimed both and asserted one ───────────────────────────────────
//   bare (`ship-dsf1`)          deviceScaleFactor **1** — *"a mark thirteen
//                               screen pixels wide"*, the raster the 2026-08-02
//                               rejection was written about. quill 2.70 against
//                               chisel 0.85, plus taper 1.6.
//   `--label=tipshape-sweep`    deviceScaleFactor **2**, nine arms, tapers
//                               0 / 0.85 / 1.6 / 2.4 / 2.75 / 3.1 and Desk
//                               Doodles. Its `free-stroke` arm is 0.85 and its
//                               PROVENANCE row fails until it is re-captured.
//   `--label=aa-dsf1`           deviceScaleFactor 1, the exact same-taper AA
//                               pairs.
// Both rasters are covered by the two invocations and NEITHER is claimed by the
// other: the dsf value is read off `meta.json` and asserted, and the sibling
// capture's recorded shapes are cross-read as a row so a raster cannot go
// missing silently.
//
// ── WHAT "CAME APART" IS, IN NUMBERS ──────────────────────────────────────
// PORTED from `_probe-carve-sweep-live.mjs` — 8-connected components over the
// ink mask, and the same "got thinner vs came apart" split it uses to judge the
// carve. Its two constants were pixel counts calibrated at deviceScaleFactor 1,
// so they are re-expressed as multiples of the mark's OWN areal half-width —
// the defence `assert-drawin-pentip.mjs`'s recalibration 1 prescribes: *"derive
// every window from the model's own offsets and print what was actually read."*
// Every one of this file's wrong attempts at that is recorded below, in place,
// because each was wrong in a way worth keeping.
//
// Usage: node scripts/verify/assert-pentip-specks.mjs
//          the shipped pair at dsf 1 — quill 2.70 against the parked chisel 0.85
//        node scripts/verify/assert-pentip-specks.mjs --label=tipshape-sweep --arm=t275 --ref=free-stroke
//          the dsf-2 taper sweep; RED until re-captured, and the two rows that
//          say why are PROVENANCE and IDENTITY, at the top
//        [--dir=<abs or repo-relative>] [--arm2=t160] [--control=<aa-prior arm>]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute, relative } from "node:path"
import { createRequire } from "node:module"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD AND NOTHING IMPORTED.
 * `_capture-freshness.mjs` was written for exactly the hole below — a gate that
 * grades stored PNGs and never asks whether they were rendered by the code it
 * claims to guard — and on 2026-08-03 no gate in the repo imported it, this one
 * included. It does now. Its top-level `captureFreshness()` is deliberately NOT
 * the entry point used; see the PROVENANCE row for the defect in it that makes
 * that call self-certifying here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const rel = (p) => (p && p.startsWith(ROOT) ? relative(ROOT, p) : p)
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}

/**
 * ⚠ THE DEFAULT LABEL, AND THE WHOLE REASON THIS FILE WAS REOPENED.
 *
 * PARKED PRIOR: `arg("label", "tipshape-sweep")`, with
 * `--arm=t275 --arm2=t160 --ref=free-stroke`. Every one of those is a defensible
 * argument to TYPE. As a DEFAULT the set is a lie, because `tipshape-sweep`'s
 * `free-stroke` arm is quill at 0.85 — the shape 2.70 replaced — so the row that
 * says *"no worse than the shape that ships"* was comparing the candidate
 * against neither of the two shapes it is a claim about, and the bare run went
 * red on the difference.
 *
 * The bare invocation is the one the next person types, so it is the one that
 * has to mean something. It now names the capture in which `free-stroke` IS the
 * shipped shape and `chisel` IS the parked prior, and the SHAPE-IDENTITY row
 * below makes that structural rather than a comment: every un-overridden arm's
 * recorded live shape is checked against `PEN_TIP_SHAPES` as it stands in
 * `lib/pen-reveal.ts` TODAY. Point this file at `tipshape-sweep` again and that
 * row fails by name, with the taper printed, instead of a blank-spot row failing
 * about a comparison nobody asked for.
 */
const LABEL = arg("label", "ship-dsf1")
const DIR_ARG = arg("dir", null)
const DIR = DIR_ARG
  ? isAbsolute(DIR_ARG)
    ? DIR_ARG
    : join(ROOT, DIR_ARG)
  : join(ROOT, "docs", "verification", "pentip", LABEL)

/** The arm under test — the tip that SHIPS, `quill` at taper 2.70. */
const ARM = arg("arm", "free-stroke")
/** The shape it replaced, parked whole — `chisel` at 0.85. The do-not-regress floor. */
const REF = arg("ref", "chisel")
/** The taper the 2026-08-02 note rejected by name, re-examined as its own row. */
const ARM2 = arg("arm2", "t160")
/**
 * ⚠ PARKED FLAGS. `--control=`/`--control2=` used to name the two prior-divisor
 * arms by hand, which is defect class 4 (a hardcoded inventory) and defect class
 * 7 (a capture without `t160` silently dropped two rows and still printed ALL
 * PASS — only the `rows: N` counter moved). The AA pairs are now DERIVED from
 * the capture's own `meta.shapes`: every arm with `aa:false` is paired with the
 * `aa:true` arm nearest it in taper, one row each, and the row NAMES are
 * registered up front so a missing one fails instead of vanishing. The flags are
 * still read so an existing command line does not break, and they now mean
 * "grade only these prior-divisor arms".
 */
const CONTROL_ONLY = [arg("control", null), arg("control2", null)].filter(Boolean)

/**
 * A COMPONENT is at least this many HALF-WIDTH SQUARES of ink; below it is
 * antialiasing dust, not a piece of the mark.
 */
const COMP_FLOOR_SQ = 0.05
/**
 * A SPECK is a component smaller than one half-width square. Sebs named it:
 * the shipped note's *"came apart into loose specks"*.
 *
 * ⚠ THIS CONSTANT NO LONGER BOUNDS THE BLANK-SPOT STATISTIC, and that is
 * defect 4. See `MIN_DIM` and `TRANSIENT_FRAC`.
 */
const SPECK_SQ = 1.0

/**
 * ⚠ THE FIRST VERSION OF THIS GATE SIZED BOTH CONSTANTS OFF THE MEDIAN
 * HORIZONTAL INK RUN, PORTED FROM `_probe-carve-sweep-live.mjs`, AND THAT
 * STATISTIC IS DEAD HERE. It read **1 px** on a mark 25 px across, because
 * 53.6 % of the runs on this capture are 1-2 px: the mark is cursive, so most
 * scanlines clip a near-horizontal stretch tangentially and contribute a stub.
 * The gate said so and refused to judge, which is the only reason this note is
 * a correction rather than a false green.
 *
 * The replacement needs no path and no fit. For an ink ribbon of half-width w
 * and centreline length L, area `A ~ 2wL` and boundary `P ~ 2L`, so
 *
 *     w  ~  A / P
 *
 * — an AREAL estimator, unbiased on a bend for the same reason
 * `assert-drawin-pentip.mjs`'s is (the curvature term cancels between the two
 * sides of the centreline). It is CALIBRATED below against that gate's
 * independently-derived `wordHalfWidthPx` whenever a `pentip.json` sits in the
 * same capture, and ALWAYS against a second estimator computed here from the
 * same frames by a different functional — see `inradiusHalfWidth`.
 *
 * ⚠ DEFECT CLASS 2 · the old `else` branch was `ref.medW >= 4`, and on the only
 * label that ever ran it was UNREACHABLE, because a `pentip.json` sits in
 * `tipshape-sweep`; on the labels where it IS reachable it is a check no
 * resolved mark can fail. Its first replacement was worse and is recorded here
 * because it was wrong in an interesting way: it rescaled the SIBLING capture's
 * ruler by the deviceScaleFactor ratio, 12.53 px at dsf 2 -> 6.26 at dsf 1, and
 * called the areal estimator's 8.39 a 34 % disagreement. **The rescale is
 * invalid and the measurement says so.** Between the two rasters of the same
 * finished mark, ink area goes 30 530 -> 123 560 (x4.047, i.e. exactly linear
 * x2) but the ink BOUNDARY goes 3 442 -> 8 848 — **x2.57, not x2** — because at
 * twice the resolution the carve grain resolves into perimeter that was
 * sub-pixel before. So `A/P` reads x1.57 across a x2 change and is NOT
 * scale-invariant. A ruler may only be compared inside its own raster.
 */
const WIDTH_AGREE = 0.25

/**
 * ⚠ AND THE SECOND CORRECTION, WHICH IS THE ONE THAT MATTERED.
 *
 * Counted by area alone, the long taper "added" 8 blank spots over 179 frames
 * and the gate went red. **Every one of them was looked at.** The worst frame
 * (`t275`, k = 160) carries four of them totalling **17 px**, and they are
 * 1-pixel-wide slivers in the hairline seam where the `k`'s stem passes another
 * stroke — nowhere near the moving end, and the shipped shape produces an
 * 80-pixel hole in the same place three frames running (k = 186-188). The gate
 * was measuring the seam's antialiasing flickering by one pixel and calling it
 * the pen.
 *
 * So a blank spot must be at least this many pixels ACROSS ITS SHORTER
 * DIMENSION. A hole a viewer can see is a hole; a one-pixel crack between two
 * strokes that touch is the raster, and it is present identically on every arm.
 * The unfiltered counts are still printed beside the filtered ones, because a
 * filter whose effect you cannot see is a place to hide a defect.
 */
const MIN_DIM = 2

/**
 * ── THE TIP WINDOW, WHICH THIS FILE DID NOT HAVE (defect class 5) ──────────
 *
 * Every count above was taken over the WHOLE FRAME. On a cursive word that is
 * mostly finished ink standing still, and a tip shape cannot move finished ink.
 * Measured, with the pen located independently of anything here — the centroid
 * of ink NEW since the previous frame, which is the pen's own definition:
 *
 *     arm           median speck distance   median blank distance
 *     free-stroke   5.4 w  (12 of 37 within 3 w, max 25.4 w)   7.9-9.1 w
 *     t275          5.2 w                                       "
 *     t160          6.1 w                                       "
 *
 * against a taper whose ENTIRE span is `nose*0.3068 + taper*0.5` = **1.68 w** at
 * 2.75 and 0.73 w at 0.85 — a difference between the two shipped candidates of
 * 0.95 w. So 68-81 % of what those rows counted was ink the taper cannot reach,
 * and the arm-to-arm differences the gate reported were a coin-flip over that
 * ink. This is the same disease `assert-drawin-pentip.mjs` names as neighbour
 * ink (median 27.7 % foreign) and it is worse here.
 *
 * THE WINDOW IS DERIVED, NOT CHOSEN: it is every pixel within this many areal
 * half-widths of any pixel of the frame's own new ink. 3.0 w is 1.79x the
 * longest candidate's whole span and 3.2x the difference between the two shapes
 * being compared, so nothing a taper can do falls outside it — and the window is
 * built from the CLEAN frame, so the known-bad below is judged inside a window
 * that knows nothing about the insult.
 */
const TIP_WINDOW_W = 3.0

/**
 * ── SEVERITY, WHICH THE OLD BLANK STATISTIC RAN BACKWARDS (defect class 4) ──
 *
 * The old blank spot was *"an enclosed run of paper smaller than one half-width
 * square"*. At w = 13.5 that upper cut is 183 px, and it made the statistic
 * ANTI-MONOTONE at the top end: on frame 174 `free-stroke` carries an 81 px hole
 * and `t275` a 148 px hole, and both score exactly "1 blank" — the same score a
 * 5 px crack gets — while a 200 px void scores **0**, because it is over the cut.
 * The cut was there to keep a letter counter (the eye of an `e`, tens of squares)
 * from being counted as a defect, which is a real thing to want.
 *
 * The replacement gets that for free WITHOUT a size cut, so the statistic can be
 * an AREA and be monotone: a hole the pen left is one the pen later FILLS. So an
 * enclosed paper region is scored as a blank spot when this fraction of its
 * pixels are INK in the arm's own FINAL frame. A letter counter is paper at the
 * end and is excluded at any size; a 200 px void that heals is counted at 200.
 * Persistent enclosures are carried as their own channel and their own row,
 * because a hole that never heals is the WORSE bug — it is the one the texture
 * misregistration was leaving in the middle of the word — and it must not be
 * filtered out on the way to fixing the milder one.
 */
const TRANSIENT_FRAC = 0.9

/**
 * ── THE NOISE FLOOR, AND WHY THE ROW THAT FAILED COULD NOT HAVE MEANT
 *    ANYTHING EITHER WAY (defect class 5) ──────────────────────────────────
 *
 * The bare red was `arm.maxBlanks <= ref.maxBlanks`, 2 against 1. The per-frame
 * histogram over 179 frames:
 *
 *     t275         {0: 153, 1: 25, 2: 1}
 *     free-stroke  {0: 155, 1: 24}
 *
 * — the FAIL is **one frame in 179**, k = 160, two cracks of 5 px and 7 px, 12 px
 * of paper total, on a mark whose half-width square is 178 px. And the null pair
 * this file's own AA rows establish as not moving this channel (same taper, the
 * divisor as the only difference) moves it by exactly as much: t160 maxBlanks 1
 * against t160-aaprior 2, also one frame. **Noise over effect = 1.0.** The
 * companion row `arm.maxSpecks <= ref.maxSpecks` reads 2 against 2 on all five
 * arms — a saturated counter whose discriminating range is [2,3].
 *
 * A bar has to clear the noise of the channel it is on, and the noise has to be
 * MEASURED rather than assumed. So every verdict row below is a per-frame PAIRED
 * comparison against a FIXED bar, and the null pairs — the arms that differ only
 * in the AA divisor, which the AA rows themselves show does not touch the speck
 * or blank counts — are asserted to sit INSIDE that bar as a calibration row of
 * their own.
 *
 * ⚠ THE NULL MUST NOT SET THE BAR, AND THE FIRST VERSION OF THIS REPAIR HAD IT
 * DOING EXACTLY THAT — `bar = NOISE_K * nullFloor`. On `ship-dsf1` the only
 * divisor-only pair available is `t275-aaprior` against `free-stroke`, and
 * `free-stroke` IS the arm under test. Caught by running it: with a 29 px hole
 * punched into the shipped arm's ink at the pen on every one of 90 frames, the
 * null floor rose with the damage to 28.4 px/frame, the bar rose to 56.7, and
 * the row went GREEN on a mark that had been perforated ninety times. **A
 * control that moves with the subject reports whatever it is pointed at**, which
 * is the disease this whole file is a repair of, reintroduced one level up. The
 * bar is fixed; the null is an assertion, not an input.
 *
 * THE BAR IS DERIVED FROM `MIN_DIM`, not chosen. The smallest blank spot this
 * file will admit at all is MIN_DIM x MIN_DIM = 4 px. Expressed in the mark's
 * own half-width square at the raster MIN_DIM was calibrated on (dsf 1, w =
 * 8.39, w^2 = 70.4) that is 0.057, rounded to 0.06 — so "one admissible crack on
 * the worst single frame" and a tenth of one per frame on average, and it means
 * the same physical thing at dsf 2 where the same crack covers four times the
 * pixels. Both are printed in pixels on every run.
 */
const HOLE_TAIL_SQ = 0.06
const HOLE_MEAN_SQ = HOLE_TAIL_SQ / 10
const NOISE_K = 2

/**
 * ── AND THE SAME QUESTION ON A CHANNEL THAT COUNTS RATHER THAN MEASURES ────
 *
 * Detached pieces at the pen is a per-frame COUNT, and a mean over counts hides
 * the only thing that separates a shift from a coin: how often the sign points
 * the same way. So that channel is judged by the paired SIGN TEST,
 * `z = (up - down) / sqrt(up + down)`, which is what the AA rows are already
 * doing informally when they report 179/179 frames.
 *
 * The two bars below are one measurement apart, and that gap is the whole
 * argument for them. Measured on `ship-dsf1`, 89-90 paired frames:
 *
 *     severed tip vs its own clean frames    z = 8.72 - 9.00   (up 76-81, down 0)
 *     shipped 2.70 vs chisel 0.85            z = 0.94          (up 11, down 7)
 *     taper 1.60  vs chisel 0.85             z = 0.71          (up  5, down 3)
 *     the null pair, divisor only            z = 0.58          (up  7, down 5)
 *
 * A bar at 2 sigma sits four times above every real arm AND every null, and
 * four times BELOW a tip that has been cut off. It is not a threshold chosen to
 * be cleared: both ends of it are measured, and both numbers are printed on
 * every run so the margin can be watched rather than trusted.
 */
const KNOWN_BAD_Z = 4

let pass = true
const rowsSeen = []
/* ── DEFECT CLASS 7 · A ROW THAT VANISHES IS NOT A ROW THAT PASSED ─────────
 * The old `wanted` list filtered arms by `meta.engines[n]`, so a capture without
 * `t160` dropped the 2026-08-02 row and the second AA row and still printed ALL
 * PASS. Nothing moved except the `rows: N` counter, which nobody reads against
 * an expectation. Every row this run intends to make is now REGISTERED BY NAME
 * from the capture's own inventory before any of them runs, and the last row
 * asserts that every registered name was answered. */
const expected = new Set()
const answered = new Set()
const expectRow = (name) => expected.add(name)
/* `kind: "cost"` — a row about an arm that is NOT shipped.
 *
 * ⚠ WHY THIS EXISTS AND WHY IT IS NOT A SOFTENED BAR. The bar is identical; the
 * arm is different. This gate grades several tapers against `chisel`, and only
 * one of them is what `lib/pen-reveal.ts` actually ships. When a NON-shipped
 * taper exceeds a bar, that is the measured price of an option Sebs can select
 * — it belongs on the record with its numbers, and it does NOT mean the build
 * is broken. Failing the run for it makes every future red ambiguous: nobody
 * can tell "the product regressed" from "an alternative costs what it always
 * cost", which is how a red gets ignored and then how a real one gets ignored.
 *
 * The shipped arm is resolved FROM SOURCE (see the tag block below), so the
 * moment a longer taper ships, its rows become hard again automatically and
 * this exemption evaporates. Nothing is relaxed by hand, and nothing is hidden:
 * a COST row prints its full detail and is counted in the summary. */
const say = (ok, name, label, detail, kind = "hard") => {
  if (!ok && kind !== "cost") pass = false
  if (!ok && kind === "cost") costRows++
  answered.add(name)
  rowsSeen.push({ ok, name, label, kind })
  const tagWord = ok ? "PASS" : kind === "cost" ? "COST" : "FAIL"
  console.log(`${tagWord}  ${label}${detail ? " — " + detail : ""}`)
}
let costRows = 0
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null)
const fx = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? "?" : n.toFixed(d))

/* ═══ FRAME READING ═══════════════════════════════════════════════════════ */

/* PORTED from `_probe-carve-sweep-live.mjs` with its comments intact — the
 * same mask threshold (modal paper luma minus 45) and the same 8-connected
 * flood fill, so "components" means here what it means there.
 *
 * ⚠ THIS NO LONGER COUNTS ANYTHING. It decodes and returns the mask, because
 * the tip window needs the PREVIOUS frame's mask and the blank-spot classifier
 * needs the arm's FINAL one — neither of which a function that consumes its own
 * mask and returns totals can provide. Counting moved to `frameStats`, which is
 * called twice per decoded frame (clean and severed) so that calibrating the
 * known-bad on EVERY arm costs no extra decode at all. That is what makes
 * defect 1 affordable to fix. */
async function readFrame(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(W * H)
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

  let ink = 0
  for (let p = 0; p < m.length; p++) ink += m[p]

  /* THE AREAL HALF-WIDTH — ink area over ink boundary. No path, no fit, no ray.
   * Measured FIRST because every constant below is a multiple of it, and
   * measured on the CLEAN mask so that the known-bad cannot move its own
   * yardstick. */
  let bound = 0
  for (let y = 0; y < H; y++)
    for (let x2 = 0; x2 < W; x2++) {
      const p = y * W + x2
      if (!m[p]) continue
      if (
        x2 === 0 ||
        y === 0 ||
        x2 === W - 1 ||
        y === H - 1 ||
        !m[p - 1] ||
        !m[p + 1] ||
        !m[p - W] ||
        !m[p + W]
      )
        bound++
    }
  const wLoc = bound > 0 ? ink / bound : 0

  /* THE ANTIALIASING BAND. Pixels that are neither solid ink nor paper. The
   * finished outline of the mark contributes the same amount on every arm — the
   * geometry, the carve and the engine are identical — so an arm-to-arm
   * difference here is the TIP boundary's own ramp, which is the quantity
   * `PEN_TIP_AA_FWIDTH` changes. MORE grey is BETTER: the prior divisor makes
   * the ramp `1/sqrt(1 + taper^2)` of a pixel wide, i.e. sub-pixel, i.e. an
   * edge with no antialiasing left in it. */
  let grey = 0
  for (let p = 0; p < luma.length; p++) if (luma[p] > 40 && luma[p] < paper - 12) grey++

  return { m, W, H, ink, bound, grey, wLoc }
}

/**
 * THE SECOND HALF-WIDTH ESTIMATOR, so the first one is checked on every capture
 * and not only on the one that happens to carry a `pentip.json`.
 *
 * `A/P` reads the mark's PERIMETER; this reads its INRADIUS — a 3-4 chamfer
 * distance transform from paper, medianed over ink pixels and doubled, because
 * across the cross-section of a ribbon of half-width w the distance to the edge
 * is uniform on [0, w] and its median is w/2. Two functionals with nothing in
 * common but the mask: a perimeter estimator dies on grain (it did — see
 * `WIDTH_AGREE`), an inradius estimator dies on junctions, and the failure that
 * started all of this — 1 px reported on a mark 25 px across — is invisible to
 * neither.
 *
 * Measured on the finished mark: dsf 1 areal 8.87 against inradius 8.67 (2.3 %),
 * dsf 2 areal 13.96 against 16.00 (13 %) — the divergence at dsf 2 IS the grain
 * term above, and it is why the bar is 25 % rather than something that would
 * look more impressive on one raster and be unrunnable on the other.
 */
function inradiusHalfWidth(m, W, H) {
  const INF = 1 << 28
  const d = new Int32Array(W * H)
  for (let q = 0; q < m.length; q++) d[q] = m[q] ? INF : 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x
      let v = d[q]
      if (y > 0) {
        if (d[q - W] + 3 < v) v = d[q - W] + 3
        if (x > 0 && d[q - W - 1] + 4 < v) v = d[q - W - 1] + 4
        if (x < W - 1 && d[q - W + 1] + 4 < v) v = d[q - W + 1] + 4
      }
      if (x > 0 && d[q - 1] + 3 < v) v = d[q - 1] + 3
      d[q] = v
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const q = y * W + x
      let v = d[q]
      if (y < H - 1) {
        if (d[q + W] + 3 < v) v = d[q + W] + 3
        if (x > 0 && d[q + W - 1] + 4 < v) v = d[q + W - 1] + 4
        if (x < W - 1 && d[q + W + 1] + 4 < v) v = d[q + W + 1] + 4
      }
      if (x < W - 1 && d[q + 1] + 3 < v) v = d[q + 1] + 3
      d[q] = v
    }
  const ds = []
  for (let q = 0; q < m.length; q++) if (m[q]) ds.push(d[q])
  if (!ds.length) return 0
  ds.sort((a, b) => a - b)
  return (ds[ds.length >> 1] / 3) * 2
}

/* ═══ THE TIP WINDOW ══════════════════════════════════════════════════════ */

/**
 * WHERE THE PEN IS, DERIVED FROM THE FRAMES AND NOTHING ELSE.
 *
 * The pen is wherever ink appeared that was not there one frame ago. That needs
 * no path, no timing model and no agreement with `lib/pen-reveal.ts` — which is
 * the point, because a window derived from the same model the gate is grading
 * would move with the defect. The window is every pixel within `radiusPx` of any
 * new-ink pixel, so it covers the whole arc drawn this frame plus the taper's
 * reach at either end of it, and it is a DILATION rather than a disc about the
 * centroid because at 101 samples the pen lays down a swath several half-widths
 * long per frame and a disc about its midpoint would clip the leading end off.
 *
 * Returns a membership test over a bounding box rather than a full-frame mask:
 * at deviceScaleFactor 2 a full-frame mask is 5.1 MB per frame per arm, and the
 * window is a few thousand pixels of it.
 */
function tipWindow(m, prev, W, H, radiusPx) {
  if (!prev) return null
  let n = 0
  let sx = 0
  let sy = 0
  let minx = W
  let maxx = -1
  let miny = H
  let maxy = -1
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || prev[p]) continue
    const y = (p / W) | 0
    const x = p - y * W
    n++
    sx += x
    sy += y
    if (x < minx) minx = x
    if (x > maxx) maxx = x
    if (y < miny) miny = y
    if (y > maxy) maxy = y
  }
  if (!n) return null
  const R = Math.max(1, Math.round(radiusPx))
  const x0 = Math.max(0, minx - R)
  const x1 = Math.min(W - 1, maxx + R)
  const y0 = Math.max(0, miny - R)
  const y1 = Math.min(H - 1, maxy + R)
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  /* 3-4 CHAMFER, so the window is a disc and not a square. The distance is
   * carried at 3x so both weights are integers; the threshold is 3R. Its worst
   * error against true Euclidean is under 6 %, which on a 3 w window is a fifth
   * of a half-width — an order below anything asserted on. */
  const INF = 1 << 28
  const d = new Int32Array(bw * bh).fill(INF)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (m[y * W + x] && !prev[y * W + x]) d[(y - y0) * bw + (x - x0)] = 0
  for (let j = 0; j < bh; j++)
    for (let i = 0; i < bw; i++) {
      const q = j * bw + i
      let v = d[q]
      if (j > 0) {
        if (d[q - bw] + 3 < v) v = d[q - bw] + 3
        if (i > 0 && d[q - bw - 1] + 4 < v) v = d[q - bw - 1] + 4
        if (i < bw - 1 && d[q - bw + 1] + 4 < v) v = d[q - bw + 1] + 4
      }
      if (i > 0 && d[q - 1] + 3 < v) v = d[q - 1] + 3
      d[q] = v
    }
  for (let j = bh - 1; j >= 0; j--)
    for (let i = bw - 1; i >= 0; i--) {
      const q = j * bw + i
      let v = d[q]
      if (j < bh - 1) {
        if (d[q + bw] + 3 < v) v = d[q + bw] + 3
        if (i > 0 && d[q + bw - 1] + 4 < v) v = d[q + bw - 1] + 4
        if (i < bw - 1 && d[q + bw + 1] + 4 < v) v = d[q + bw + 1] + 4
      }
      if (i < bw - 1 && d[q + 1] + 3 < v) v = d[q + 1] + 3
      d[q] = v
    }
  const T = 3 * R
  let area = 0
  for (let q = 0; q < d.length; q++) if (d[q] <= T) area++
  return {
    inside: (x, y) =>
      x >= x0 && x <= x1 && y >= y0 && y <= y1 && d[(y - y0) * bw + (x - x0)] <= T,
    cx: sx / n,
    cy: sy / n,
    newInk: n,
    area,
    R,
  }
}

/* ═══ THE KNOWN-BAD ═══════════════════════════════════════════════════════ */

/**
 * THE KNOWN-BAD, BUILT RATHER THAN HOPED FOR.
 *
 * ⚠ THIS REPLACED A CONTROL THAT COULD NOT HONESTLY FAIL, and the replacement
 * is the point of the row. The first version of this gate used the PRIOR AA
 * divisor as its known-bad and "passed" on 23 specks against 20 over 90 frames
 * — three stray pixels. Every one of the differences was opened and looked at:
 * they are letter counters (the eye of the `e`, 19-37 px, MORE open on the
 * longer taper, which is better) and one-pixel cracks in the seam where the
 * `k`'s stem crosses another stroke. **A control that fires on three pixels of
 * raster noise is a control that reports whatever it is pointed at**, which is
 * the construction class `docs/README.md` names and `assert-gate-integrity.mjs`
 * exists for.
 *
 * So the defect is CONSTRUCTED, and **TWO CONSTRUCTIONS WERE TRIED AND
 * REJECTED FIRST. Both are named, because each failed in a way that says
 * something about the counter:**
 *
 *   1. Dithering one-in-four of the boundary pixels moved the count from 22
 *      specks to 30 — nowhere near a bar. Dropping boundary pixels NOTCHES a
 *      silhouette; it does not DETACH anything, and this counter counts
 *      detachment.
 *   2. Eroding every ink pixel with a paper 4-neighbour moved it to 14, i.e.
 *      DOWN, with the component count unchanged at 7. A one-pixel erosion of
 *      this mark does not break it either — it deletes the thin parts outright,
 *      taking the real specks with them.
 *
 * Both results are worth having: they say the mark does not come apart under
 * two different insults, which is the same thing the real arms say. But neither
 * is a known-bad, because a known-bad has to be the defect the ROW is about.
 */

/**
 * ⚠ PARKED AND UNCALLED — THE THIRD CONSTRUCTION, AND THE REASON IT HAD TO GO.
 * It is left whole rather than deleted because `lib/pen-reveal.ts` quotes the
 * numbers it produced, and a number whose instrument no longer exists cannot be
 * re-derived by the next reader.
 *
 * A two-pixel band of paper cut across the frame at `maxX - 1.5w`, i.e. 1.5
 * half-widths behind the RIGHTMOST ink. It severs a tip and it is deterministic,
 * and it is kept whole because its numbers are quoted in `lib/pen-reveal.ts`.
 * Two things were wrong with it as a calibration:
 *
 *   · IT WAS ONLY EVER APPLIED TO `ARM`. `REF` and `ARM2` were never severed,
 *     so the gate asserted a component count could see a cut tip on one arm and
 *     then quoted that same counter about two arms it had never been tested on.
 *     Measured, against the fixed bar it used (`free-stroke.totSpecks * 1.5` =
 *     55.5): free-stroke 46, t160 45, t240 52 — **all three NOT CAUGHT** — and
 *     t275 58, t310 60 caught. The bar was cleared by 4.5 % on the default arm.
 *   · RIGHTMOST INK IS NOT THE PEN. On a cursive word it usually is, which is
 *     why this went unnoticed, but on any frame where a later stroke doubles
 *     back the cut lands somewhere the pen is not, and the piece it frees falls
 *     outside the tip window this file now measures in — so the calibration
 *     would have been graded on a region the assertions do not read.
 */
function severTipAtMaxX(m, W, H, wLoc) {
  let maxX = -1
  let minY = H
  let maxY = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x]) {
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (maxX < 0) return m
  const out = new Uint8Array(m)
  const cut = Math.max(1, Math.round(maxX - 1.5 * wLoc))
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++)
    for (let x = cut; x < Math.min(W, cut + 2); x++) out[y * W + x] = 0
  return out
}

/**
 * THE KNOWN-BAD IN USE — a tip that has been literally cut off, cut off AT THE
 * PEN.
 *
 * The row is about *"the last of it ... came apart"*: an END PIECE that is no
 * longer joined to the mark. So a complete RING of paper is cleared at 1.5 half-
 * widths from the pen's own position, which detaches everything the pen has laid
 * down inside that radius and leaves it as a free component of roughly six
 * half-width squares. Three properties the band cut did not have:
 *
 *   · it is centred on the PEN (the new-ink centroid), so the freed piece lands
 *     inside the tip window the assertions read, by construction;
 *   · it is direction-free, so it does not care which way the stroke runs;
 *   · the ring is 2.5 px thick radially, which blocks 8-connectivity in every
 *     direction — a 1 px ring leaks diagonally and would have severed nothing.
 *
 * It is arm-independent (every number in it comes from the frame's own ink and
 * the frame's own areal half-width), it is deterministic, and it runs through
 * the IDENTICAL counting path as every real arm — the rule
 * `assert-drawin-pentip.mjs` builds its synthetic masks under.
 *
 * ⚠ NOTE THE SIZE. Six half-width squares is well OVER `speckMax`, so the old
 * speck counter could not see this piece at all: it is a component, not a speck.
 * That is defect 4 stated as a measurement rather than an argument — the old
 * statistic's blindness at the top end is exactly where a severed tip lives.
 */
function severTipAtPen(m, W, H, cx, cy, wLoc) {
  const out = new Uint8Array(m)
  const r0 = 1.5 * wLoc
  const r1 = r0 + 2.5
  const x0 = Math.max(0, Math.floor(cx - r1 - 1))
  const x1 = Math.min(W - 1, Math.ceil(cx + r1 + 1))
  const y0 = Math.max(0, Math.floor(cy - r1 - 1))
  const y1 = Math.min(H - 1, Math.ceil(cy + r1 + 1))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 >= r0 * r0 && d2 < r1 * r1) out[y * W + x] = 0
    }
  return out
}

/* ═══ COUNTING ════════════════════════════════════════════════════════════ */

/**
 * Every statistic this file asserts on, taken over one mask.
 *
 * Whole-frame `comps` / `specks` / `blanks` are kept and printed BECAUSE they
 * are the numbers the previous version of this gate reported and the numbers
 * `lib/pen-reveal.ts` quotes; a repair whose before-and-after cannot be lined up
 * is a rewrite wearing a repair's clothes. They are no longer what anything is
 * asserted on. The `tip*` fields are.
 */
function frameStats(m, W, H, wLoc, win, finalMask) {
  const sq = Math.max(1, wLoc * wLoc)
  const compFloor = Math.max(2, Math.round(COMP_FLOOR_SQ * sq))
  const speckMax = Math.max(compFloor + 1, Math.round(SPECK_SQ * sq))

  const seen = new Uint8Array(m.length)
  const stack = new Int32Array(m.length)
  let comps = 0
  let specks = 0
  let specksRaw = 0
  let tipComps = 0
  let tipSpecks = 0
  let tipLoosePx = 0
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let n = 0
    let sx = 0
    let sy = 0
    let minx = W
    let maxx = -1
    let miny = H
    let maxy = -1
    while (sp > 0) {
      const q = stack[--sp]
      const qy = (q / W) | 0
      const qx = q - qy * W
      n++
      sx += qx
      sy += qy
      if (qx < minx) minx = qx
      if (qx > maxx) maxx = qx
      if (qy < miny) miny = qy
      if (qy > maxy) maxy = qy
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= W) continue
          const r = ny * W + nx
          if (m[r] && !seen[r]) {
            seen[r] = 1
            stack[sp++] = r
          }
        }
      }
    }
    if (n < compFloor) continue
    comps++
    const small = n < speckMax
    const thick = Math.min(maxx - minx + 1, maxy - miny + 1) >= MIN_DIM
    if (small) {
      specksRaw++
      if (thick) specks++
    }
    /* A PIECE BELONGS TO THE PEN IF ITS CENTRE OF MASS DOES. The word's own
     * component has its centroid in the middle of the word and is correctly not
     * a tip piece however far its leading end reaches; a freed end piece has its
     * centroid at the pen and is. Any-pixel-overlap would count the whole mark
     * on every frame and measure nothing. */
    if (win && thick && win.inside(Math.round(sx / n), Math.round(sy / n))) {
      tipComps++
      tipLoosePx += n
      if (small) tipSpecks++
    }
  }

  /* BLANK SPOTS — 4-connected PAPER components that do not touch the frame
   * border. This is Sebs's own word for the defect (*"THE 2D DRAWIN ANIMTION
   * LEAVES BLANCK SPORTS"*) and nothing was counting it until this gate.
   *
   * ⚠ NO UPPER SIZE CUT. See `TRANSIENT_FRAC`: a hole the pen leaves is one the
   * pen later fills, so a letter counter is separated by whether it is still
   * paper at the END of the draw rather than by being big. The old `n <
   * speckMax` cut is kept alive as `blanks`, printed, so the two definitions can
   * be read against each other. */
  const seenB = new Uint8Array(m.length)
  let blanks = 0
  let blanksRaw = 0
  let worstBlankPx = 0
  let encN = 0
  let encPx = 0
  let tipHoleN = 0
  let tipHolePx = 0
  let tipHoleMaxPx = 0
  let tipKeptN = 0
  let tipKeptPx = 0
  const region = []
  for (let p = 0; p < m.length; p++) {
    if (m[p] || seenB[p]) continue
    let sp = 0
    stack[sp++] = p
    seenB[p] = 1
    let n = 0
    let sx = 0
    let sy = 0
    let border = false
    let minx = W
    let maxx = -1
    let miny = H
    let maxy = -1
    region.length = 0
    while (sp > 0) {
      const q = stack[--sp]
      const qy = (q / W) | 0
      const qx = q - qy * W
      n++
      sx += qx
      sy += qy
      if (n <= 4096) region.push(q)
      if (qx === 0 || qy === 0 || qx === W - 1 || qy === H - 1) border = true
      if (qx < minx) minx = qx
      if (qx > maxx) maxx = qx
      if (qy < miny) miny = qy
      if (qy > maxy) maxy = qy
      if (qx > 0 && !m[q - 1] && !seenB[q - 1]) (seenB[q - 1] = 1), (stack[sp++] = q - 1)
      if (qx < W - 1 && !m[q + 1] && !seenB[q + 1]) (seenB[q + 1] = 1), (stack[sp++] = q + 1)
      if (qy > 0 && !m[q - W] && !seenB[q - W]) (seenB[q - W] = 1), (stack[sp++] = q - W)
      if (qy < H - 1 && !m[q + W] && !seenB[q + W]) (seenB[q + W] = 1), (stack[sp++] = q + W)
    }
    if (border) continue
    const thick = Math.min(maxx - minx + 1, maxy - miny + 1) >= MIN_DIM
    /* THE WHOLE-FRAME ENCLOSED CENSUS — every enclosed paper region at any size,
     * which on the FINAL frame is the finished word's own counters and nothing
     * else. It is what the finished-mark row reads. */
    if (thick) {
      encN++
      encPx += n
    }
    if (n >= 2 && n < speckMax) {
      blanksRaw++
      if (thick) {
        blanks++
        if (n > worstBlankPx) worstBlankPx = n
      }
    }
    if (!win || !thick) continue
    if (!win.inside(Math.round(sx / n), Math.round(sy / n))) continue
    /* TRANSIENT OR PERMANENT. The final frame's ink is a superset of every
     * earlier frame's, so an enclosed region either fills in — the pen left a
     * gap and the pen closed it — or it does not, in which case it is the mark's
     * own counter and belongs on its own channel. Regions over 4096 px are not
     * held in memory; they are unconditionally permanent at that size on this
     * mark (the largest transient measured is under 200 px) and are counted as
     * such rather than guessed at. */
    let filled = 0
    if (finalMask && n <= 4096) {
      for (let i = 0; i < region.length; i++) if (finalMask[region[i]]) filled++
    }
    const transient = finalMask && n <= 4096 && filled >= TRANSIENT_FRAC * n
    if (transient) {
      tipHoleN++
      tipHolePx += n
      if (n > tipHoleMaxPx) tipHoleMaxPx = n
    } else {
      tipKeptN++
      tipKeptPx += n
    }
  }

  return {
    comps,
    specks,
    specksRaw,
    blanks,
    blanksRaw,
    worstBlankPx,
    encN,
    encPx,
    tipComps,
    tipSpecks,
    tipLoosePx,
    tipHoleN,
    tipHolePx,
    tipHoleMaxPx,
    tipKeptN,
    tipKeptPx,
    compFloor,
    speckMax,
  }
}

/* ═══ PER-ARM MEASUREMENT ═════════════════════════════════════════════════ */

/**
 * ⚠ THE CLEAN ARM AND ITS KNOWN-BAD ARE MEASURED FROM THE SAME DECODE.
 *
 * That is not an optimisation, it is what makes defect 1 fixable. The old file
 * severed ONE arm because a second pass over 179 frames of 2560x2004 PNG costs
 * ninety seconds per arm; severing five arms was a four-minute gate nobody would
 * run. Counting twice off one decoded mask costs the flood fills only, so every
 * arm the gate judges is calibrated against a severed copy of ITSELF, on the
 * same frames, inside the same tip window — and the window is built from the
 * CLEAN diff, so the insult cannot move the region it is judged in.
 */
async function measureArm(engine, samples, finalMask) {
  const rows = []
  let prev = null
  for (let k = 0; k < samples; k++) {
    const p = join(DIR, engine, `${String(k).padStart(3, "0")}.png`)
    if (!existsSync(p)) continue
    const f = await readFrame(p)
    const win = tipWindow(f.m, prev, f.W, f.H, TIP_WINDOW_W * f.wLoc)
    const clean = frameStats(f.m, f.W, f.H, f.wLoc, win, finalMask)
    let bad = null
    if (win) {
      const mBad = severTipAtPen(f.m, f.W, f.H, win.cx, win.cy, f.wLoc)
      bad = frameStats(mBad, f.W, f.H, f.wLoc, win, finalMask)
    }
    rows.push({
      k,
      frac: samples > 1 ? k / (samples - 1) : 0,
      ink: f.ink,
      grey: f.grey,
      wLoc: Number(f.wLoc.toFixed(2)),
      winArea: win ? win.area : 0,
      newInk: win ? win.newInk : 0,
      ...clean,
      bad,
    })
    prev = f.m
  }
  /* THE ENDS ARE DROPPED, AND NOT TO FLATTER ANYTHING. At frac 0 nothing is
   * drawn and at frac 1 the mark is whole, so neither carries a moving end at
   * all — and a frame with a two-pixel stub of one stroke is a speck by any
   * definition, on every arm equally. The window is the same for all arms. */
  const body = rows.filter((r) => r.frac >= 0.08 && r.frac <= 0.97 && r.bad)
  const sum = (f) => body.reduce((a, r) => a + f(r), 0)
  const mx = (f) => (body.length ? Math.max(...body.map(f)) : null)
  return {
    rows,
    body,
    frames: body.length,
    // whole-frame, PARKED — printed for continuity with the prior gate, asserted on by nothing
    totSpecks: sum((r) => r.specks),
    maxSpecks: mx((r) => r.specks),
    speckFrames: body.filter((r) => r.specks > 0).length,
    totSpecksRaw: sum((r) => r.specksRaw),
    totBlanks: sum((r) => r.blanks),
    maxBlanks: mx((r) => r.blanks),
    blankFrames: body.filter((r) => r.blanks > 0).length,
    totBlanksRaw: sum((r) => r.blanksRaw),
    worstBlankPx: mx((r) => r.worstBlankPx),
    maxComps: mx((r) => r.comps),
    // the tip window — what the verdict rows read
    totTipSpecks: sum((r) => r.tipSpecks),
    totTipComps: sum((r) => r.tipComps),
    maxTipComps: mx((r) => r.tipComps),
    totTipHolePx: sum((r) => r.tipHolePx),
    totTipHoleN: sum((r) => r.tipHoleN),
    maxTipHolePx: mx((r) => r.tipHolePx),
    worstSingleHolePx: mx((r) => r.tipHoleMaxPx),
    totTipKeptPx: sum((r) => r.tipKeptPx),
    holeFrames: body.filter((r) => r.tipHolePx > 0).length,
    // the severed copy of this same arm
    badTotTipComps: sum((r) => r.bad.tipComps),
    badTotTipLoosePx: sum((r) => r.bad.tipLoosePx),
    badGainFrames: body.filter((r) => r.bad.tipComps > r.tipComps).length,
    badLossFrames: body.filter((r) => r.bad.tipComps < r.tipComps).length,
    badGainMed: med(body.map((r) => r.bad.tipComps - r.tipComps)),
    // scalars
    medGrey: med(body.map((r) => r.grey)),
    medW: med(body.map((r) => r.wLoc)),
    medInk: med(body.map((r) => r.ink)),
    medWinArea: med(body.map((r) => r.winArea)),
    medInkFrac: med(body.map((r) => (r.ink ? r.tipLoosePx / r.ink : 0))),
  }
}

/** The two playheads the 2026-08-02 note names by number. */
function atFrac(a, f) {
  let best = null
  for (const r of a.rows) if (!best || Math.abs(r.frac - f) < Math.abs(best.frac - f)) best = r
  return best
}

/* ═══ PAIRED STATISTICS ═══════════════════════════════════════════════════ */

/**
 * THE COMPARISON IS PAIRED BY FRAME, WHICH IS THE ONLY HONEST WAY TO MAKE IT.
 *
 * Both arms draw the same word through the same geometry at the same playheads;
 * everything except the tip shape is shared frame for frame. So the quantity
 * with any power in it is the per-frame DIFFERENCE, and a total over 90 frames
 * or a max over 179 throws that pairing away — which is how a channel whose
 * whole range is [0,2] came to decide a verdict. Returns the mean difference,
 * the worst single frame, and how consistently the sign points one way, because
 * a mean without a sign count cannot tell a real shift from one outlier.
 */
function paired(armBody, refBody, pick) {
  const byK = new Map(refBody.map((r) => [r.k, r]))
  const d = []
  for (const a of armBody) {
    const b = byK.get(a.k)
    if (b) d.push(pick(a) - pick(b))
  }
  if (!d.length) return { n: 0, mean: 0, worst: 0, up: 0, down: 0, worstK: null }
  let worst = -Infinity
  let worstK = null
  let up = 0
  let down = 0
  for (let i = 0; i < d.length; i++) {
    if (d[i] > worst) {
      worst = d[i]
      worstK = armBody[i]?.k ?? null
    }
    if (d[i] > 0) up++
    if (d[i] < 0) down++
  }
  return {
    n: d.length,
    mean: d.reduce((a, b) => a + b, 0) / d.length,
    worst,
    worstK,
    up,
    down,
    /* THE PAIRED SIGN TEST. Under "these two shapes do not differ on this
     * channel" the discordant frames split evenly, so `(up - down)` is a random
     * walk of `up + down` steps and this is its z. Frames where the two arms
     * agree carry no information and are correctly not in the denominator. */
    z: up + down > 0 ? (up - down) / Math.sqrt(up + down) : 0,
  }
}

/* ═══ WHAT THE SOURCE ACTUALLY SHIPS ══════════════════════════════════════ */

/**
 * ⚠ THE ROW THE HEADLINE DEFECT NEEDED, and it is a CONTENT check rather than a
 * timestamp one.
 *
 * `meta.json` records, per arm, the shape the RENDERER reported at capture time
 * (`live.shape`) and the shape the probe asked for (`asked.shape`, null when the
 * arm is un-overridden and therefore takes whatever `PEN_TIP_SHAPES` ships).
 * `lib/pen-reveal.ts` is parsed here for the same table. Together they answer
 * the question no row in this file used to ask: **is the arm this gate calls
 * "the shape that ships" actually the shape that ships?**
 *
 * On `ship-dsf1` it is. On `tipshape-sweep` `free-stroke` is quill at 0.85 and
 * the source ships 2.70, so this row fails by name, with both tapers printed —
 * instead of a blank-spot row failing about a comparison nobody asked for.
 * A timestamp cannot do this: the sweep is only fifteen minutes older than the
 * change, and fifteen minutes is inside the noise of when anyone happens to save
 * a file. The taper is not.
 */
function shippedTipFromSource() {
  const p = join(ROOT, "lib", "pen-reveal.ts")
  if (!existsSync(p)) return null
  const src = readFileSync(p, "utf8")
  const live = src.match(/let\s+livePenTip\s*:\s*PenTipMode\s*=\s*"([a-z-]+)"/)
  const shapes = {}
  /* ⚠ THE NAMES ARE NOT LISTED HERE, AND THEY USED TO BE. This read
   * `(off|cut|nib|quill|chisel)` — a hardcoded inventory inside a gate written
   * during the sweep that exists to catch hardcoded inventories. `reed` shipped,
   * the alternation did not know the word, and the IDENTITY row printed
   * "source ships reed at nose ? / taper ?" while still passing. A shape added
   * tomorrow is read tomorrow. */
  const re = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*\{\s*nose:\s*([\d.]+)\s*,\s*taper:\s*([\d.]+)\s*\}/gm
  let mm
  while ((mm = re.exec(src))) shapes[mm[1]] = { nose: Number(mm[2]), taper: Number(mm[3]) }
  return { live: live ? live[1] : null, shapes, path: p }
}

/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */

async function main() {
  const t0 = Date.now()
  /* REFUSES A LABEL THAT DOES NOT EXIST — the meta-gate's third channel. */
  if (!existsSync(DIR) || !existsSync(join(DIR, "meta.json"))) {
    console.error(`nothing to read at ${DIR} — run _probe-pentip-shape.mjs --label=${LABEL} first`)
    process.exit(2)
  }
  console.log(`reading ${rel(DIR)}\n`)
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const shapes = meta.shapes ?? {}
  const engines = meta.engines ?? {}
  const samplesOf = (n) => (Array.isArray(engines[n]) ? engines[n].length : meta.samples ?? 0)

  /* ── DEFECT CLASS 4 · THE INVENTORY IS THE CAPTURE'S, NOT A LIST IN HERE ──
   * The old `wanted` was `[REF, ARM, CONTROL, ARM2, CONTROL2]` — five hardcoded
   * names out of the nine `tipshape-sweep` holds, so `t240`, `t310`,
   * `free-stroke-off` and `desk-doodles` were never measured on any run, and
   * `t240` is one of the arms the old known-bad silently failed on. Every arm
   * present is measured and printed; which of them are JUDGED is decided from
   * their recorded shapes below, not from a list. */
  const inventory = Object.keys(engines)
  const missing = [ARM, REF, ARM2].filter((n) => !engines[n])
  if (missing.length) {
    console.error(
      `this capture has no arm(s) "${missing.join(", ")}" — it has: ${inventory.join(", ")}\n` +
        `the bare defaults read docs/verification/pentip/ship-dsf1, where free-stroke is quill 2.70 and chisel is the parked 0.85.`,
    )
    process.exit(2)
  }

  const src = shippedTipFromSource()
  const dsf = meta.dsf ?? null

  /* ── WHICH ARMS GET A VERDICT ROW, DERIVED FROM THEIR OWN RECORDED SHAPES ─
   * A "long taper" arm is one on the same engine as the reference whose taper
   * exceeds the reference's. `aa:false` arms are the AA controls and are graded
   * only on the AA channel, per this file's own finding that the divisor does
   * not move the speck or blank counts; `desk-doodles` is a different engine
   * and is measured and printed but never compared as though it were ours. */
  const taperOf = (n) => shapes[n]?.live?.shape?.taper ?? null
  const engineOf = (n) => shapes[n]?.asked?.engine ?? null
  const aaOf = (n) => shapes[n]?.live?.aa
  const refTaper = taperOf(REF)
  const judged = inventory.filter(
    (n) =>
      n !== REF &&
      aaOf(n) !== false &&
      engineOf(n) === engineOf(REF) &&
      taperOf(n) !== null &&
      refTaper !== null &&
      taperOf(n) > refTaper,
  )
  if (!judged.includes(ARM)) judged.unshift(ARM)
  if (engines[ARM2] && !judged.includes(ARM2)) judged.push(ARM2)

  /* ── THE AA PAIRS, DERIVED THE SAME WAY (defect class 7) ─────────────────
   * Every `aa:false` arm is paired with the `aa:true` arm nearest it in taper.
   * On `tipshape-sweep` and `aa-dsf1` that reproduces exactly the pairs the old
   * `--control`/`--control2` flags named by hand, at a taper gap of zero. On
   * `ship-dsf1` the nearest partner to `t275-aaprior` (2.75) is the shipped
   * `free-stroke` (2.70) and the gap is printed, so the row states what it is
   * rather than being dropped. */
  const aaPairs = []
  for (const n of inventory) {
    if (aaOf(n) !== false) continue
    if (CONTROL_ONLY.length && !CONTROL_ONLY.includes(n)) continue
    const t = taperOf(n)
    let best = null
    for (const p of inventory) {
      if (aaOf(p) !== true || engineOf(p) !== engineOf(n)) continue
      const g = Math.abs((taperOf(p) ?? Infinity) - (t ?? 0))
      if (!best || g < best.gap) best = { arm: p, gap: g }
    }
    if (best) aaPairs.push({ prior: n, arm: best.arm, gap: best.gap })
  }

  /* ── REGISTER EVERY ROW THIS RUN INTENDS TO MAKE, BEFORE MAKING ANY ────── */
  expectRow("frames")
  expectRow("width")
  expectRow("provenance")
  expectRow("shape-identity")
  expectRow("raster")
  expectRow("taper-differs")
  expectRow("aa-inventory")
  for (const n of [REF, ...judged]) expectRow(`known-bad:${n}`)
  for (const p of aaPairs) {
    expectRow(`aa:${p.prior}`)
    expectRow(`null:${p.prior}`)
  }
  /* Every row inside this loop is about ONE arm. Rows about the arm the source
   * actually ships are HARD; rows about an alternative are COST rows — same
   * bar, same numbers, not a build failure. See `say`. */
  const sayArm = (isShippedArm) => (ok, name, label, detail) =>
    say(ok, name, label, detail, isShippedArm ? "hard" : "cost")

  for (const n of judged) {
    expectRow(`comps:${n}`)
    expectRow(`holes:${n}`)
    expectRow(`holes-tail:${n}`)
    expectRow(`permanent:${n}`)
  }
  expectRow("row-manifest")

  /* ── MEASURE ─────────────────────────────────────────────────────────────
   * The FINAL frame of each arm is read first and kept, because the blank-spot
   * classifier asks of every enclosed region "does the pen fill this in later",
   * and later means this frame. */
  const out = {}
  const fin = {}
  for (const n of inventory) {
    const S = samplesOf(n)
    const lastPath = join(DIR, n, `${String(S - 1).padStart(3, "0")}.png`)
    let finalMask = null
    if (existsSync(lastPath)) {
      const f = await readFrame(lastPath)
      finalMask = f.m
      const fs = frameStats(f.m, f.W, f.H, f.wLoc, null, null)
      fin[n] = {
        k: S - 1,
        ink: f.ink,
        bound: f.bound,
        areal: Number(f.wLoc.toFixed(2)),
        inrad: Number(inradiusHalfWidth(f.m, f.W, f.H).toFixed(2)),
        comps: fs.comps,
        encN: fs.encN,
        encPx: fs.encPx,
      }
    }
    out[n] = await measureArm(n, S, finalMask)
    process.stderr.write(`  measured ${n} (${out[n].frames} frames)\n`)
  }

  console.log(
    "arm             taper   AA       frames   w px   TIP WINDOW: pieces/specks   HOLES: px/n/worst   permanent px" +
      "        [whole frame, PARKED: specks tot/max · blanks tot/max/worst · comps max · AA band]",
  )
  for (const n of inventory) {
    const a = out[n]
    const s = shapes[n]?.live?.shape
    const aa = shapes[n]?.live?.aa
    console.log(
      `${n.padEnd(15)} ${(s ? s.taper.toFixed(2) : "  ? ").padStart(5)}   ` +
        `${String(aa === undefined ? "?" : aa ? "fwidth" : "PRIOR").padEnd(7)} ` +
        `${String(a.frames).padStart(6)}  ${String(a.medW).padStart(5)}   ` +
        `${String(a.totTipComps).padStart(6)}/${String(a.totTipSpecks).padStart(6)}      ` +
        `${String(a.totTipHolePx).padStart(6)}/${String(a.totTipHoleN).padStart(3)}/${String(a.worstSingleHolePx).padStart(4)}   ` +
        `${String(a.totTipKeptPx).padStart(9)}` +
        `        [${a.totSpecks}/${a.maxSpecks} · ${a.totBlanks}/${a.maxBlanks}/${a.worstBlankPx} · ${a.maxComps} · ${a.medGrey}]`,
    )
  }

  console.log(`\nthe two playheads the shipped note names by number (60 % and 75 % of the draw):`)
  for (const n of inventory) {
    const a = out[n]
    const f = (r) =>
      r
        ? `${String(r.tipComps).padStart(2)} tip pieces / ${String(r.tipHolePx).padStart(3)} px of hole`
        : "  -"
    console.log(
      `  ${n.padEnd(15)} 60 % -> ${f(atFrac(a, 0.6))}     75 % -> ${f(atFrac(a, 0.75))}`,
    )
  }

  const ref = out[REF]
  const arm = out[ARM]

  /* ═══ PROVENANCE ══════════════════════════════════════════════════════ */
  console.log("\n── PROVENANCE · does this evidence belong to this tree ───────")

  /* ⚠ NOT `captureFreshness()` ITSELF, AND THE REASON IS A DEFECT IN IT THAT
   * BELONGS TO ANOTHER LANE. Its `newestCapture` default filter is
   * `/\.(png|json|jpg|webm)/`, and THIS GATE WRITES `specks.json` INTO THE
   * CAPTURE DIRECTORY at the end of every run. So the first invocation makes the
   * capture look newer than any source file and the check can never fail again —
   * a provenance row that certifies its own output. Its exported primitives are
   * used instead, with the filter narrowed to the frames themselves, which are
   * the only artefacts a renderer wrote. Reported, not patched: that file is not
   * this lane's. */
  const capPng = newestCapture(DIR, /\.png$/)
  const libNewest = newestUnder(join(ROOT, "lib"))
  const behindH = capPng.file && libNewest.file ? (libNewest.ms - capPng.ms) / 3600000 : null
  const stamp = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 16)
  say(
    capPng.file !== null && libNewest.file !== null && libNewest.ms <= capPng.ms,
    "provenance",
    `PROVENANCE · every frame graded here post-dates every source file under lib/`,
    capPng.file && libNewest.file
      ? libNewest.ms <= capPng.ms
        ? `newest frame ${rel(capPng.file)} ${stamp(capPng.ms)} · newest source ${rel(libNewest.file)} ${stamp(libNewest.ms)}`
        : `STALE BY ${fx(behindH, 2)}h — newest frame ${rel(capPng.file)} ${stamp(capPng.ms)} but ${rel(libNewest.file)} was written ${stamp(libNewest.ms)}. ` +
          `Every verdict below describes a build that no longer exists. Re-capture with ` +
          `node scripts/verify/_probe-pentip-shape.mjs --label=${LABEL}${dsf ? ` --dsf=${dsf}` : ""}; do NOT relax this row.`
      : `no frames at ${rel(DIR)}, or no source under lib/ — the comparison cannot be made, so nothing below is trustworthy`,
  )

  /* SHAPE IDENTITY — the content check the headline defect needed. */
  const idProblems = []
  for (const n of inventory) {
    const s = shapes[n]
    if (!s?.live?.shape) {
      idProblems.push(`${n}: no live shape recorded`)
      continue
    }
    const asked = s.asked?.shape
    if (asked) {
      if (asked.taper !== s.live.shape.taper || asked.nose !== s.live.shape.nose)
        idProblems.push(
          `${n}: asked nose ${asked.nose}/taper ${asked.taper} but the page reported ${s.live.shape.nose}/${s.live.shape.taper}`,
        )
      continue
    }
    // un-overridden: it takes whatever PEN_TIP_SHAPES ships, so compare to the source
    if (!src || s.asked?.engine !== "free-stroke") continue
    const want = src.shapes[s.live.tip]
    if (!want) {
      idProblems.push(`${n}: tip "${s.live.tip}" is not in PEN_TIP_SHAPES any more`)
      continue
    }
    if (want.taper !== s.live.shape.taper || want.nose !== s.live.shape.nose)
      idProblems.push(
        `${n}: shot as ${s.live.tip} nose ${s.live.shape.nose}/taper ${s.live.shape.taper}, but lib/pen-reveal.ts ships ${s.live.tip} at ${want.nose}/${want.taper}`,
      )
  }
  /* ⚠ AND THE SOURCE READ ITSELF IS PART OF THIS ROW, BECAUSE IT DECIDES WHICH
   * ROWS ARE ALLOWED TO FAIL.
   *
   * `say`'s hard/cost split asks `src.shapes[src.live].taper` which taper the
   * product ships. A null there matches no arm, so EVERY judged arm becomes "an
   * alternative", and an alternative's exceedance is a COST that never touches
   * `pass`.
   *
   * MEASURED 2026-09-04, by breaking the `livePenTip` match on purpose and
   * running the whole gate on a fresh capture: it printed `source ships ? at
   * nose ? / taper ?`, turned all seven hard rows into COST rows, reported
   * `rows: 38, failures: 7`, printed ALL PASS and exited 0. A gate that stops
   * being able to fail the moment it loses track of which shape ships is not a
   * gate, and nothing above would have said so.
   *
   * The comment on the shapes regex records this exact symptom already — *"the
   * alternation did not know the word, and the IDENTITY row printed 'source
   * ships reed at nose ? / taper ?' while still passing"* — and the repair went
   * to the SHAPES pattern. The `live` pattern was left alone, which was
   * harmless until the hard/cost split started reading it. It is not harmless
   * now, so the same row that reports the read now refuses it when it is empty.
   *
   * The `?` in the detail line below stays. It is what a reader sees when this
   * fires, and it is now attached to a FAIL instead of a PASS. */
  if (!src?.live)
    idProblems.push(
      `lib/pen-reveal.ts: could not read which PenTipMode ships (livePenTip) — without it every arm is judged as an alternative and no row in this gate can fail`,
    )
  else if (!src.shapes?.[src.live])
    idProblems.push(
      `lib/pen-reveal.ts: ships "${src.live}" but PEN_TIP_SHAPES carries no such shape — the hard/cost split has nothing to compare a taper against`,
    )

  say(
    idProblems.length === 0,
    "shape-identity",
    `IDENTITY · every arm carries the shape it was asked for, and the un-overridden ones carry what lib/pen-reveal.ts ships TODAY`,
    idProblems.length
      ? `${idProblems.join(" | ")} — this capture predates the shipped tip; the arms it calls by their tip name are not those tips`
      : `source ships ${src?.live ?? "?"} at nose ${src?.shapes?.[src?.live]?.nose ?? "?"} / taper ${src?.shapes?.[src?.live]?.taper ?? "?"}; ` +
          `${ARM} is ${shapes[ARM]?.live?.tip} ${taperOf(ARM)}, ${REF} is ${shapes[REF]?.live?.tip} ${taperOf(REF)} (parked prior)`,
  )

  /* THE RASTER. `dsf` never appeared anywhere in this file, while its header
   * claimed the result held "at BOTH deviceScaleFactor 1 and at 2". One of those
   * halves was never read by any run. It is now asserted, and the sibling
   * capture holding the other half is cross-read from its own metadata so a
   * raster cannot go missing without a row moving. */
  const SIBLING = dsf === 1 ? "tipshape-sweep" : "ship-dsf1"
  const sibMetaPath = join(ROOT, "docs", "verification", "pentip", SIBLING, "meta.json")
  let sibNote = `no sibling capture at docs/verification/pentip/${SIBLING}`
  let sibOk = false
  if (existsSync(sibMetaPath)) {
    const sm = JSON.parse(readFileSync(sibMetaPath, "utf8"))
    const sibTapers = Object.entries(sm.shapes ?? {})
      .filter(([, v]) => v?.live?.shape)
      .map(([k, v]) => `${k} ${v.live.shape.taper}`)
    sibOk = sm.dsf !== dsf && sibTapers.length > 0
    sibNote =
      `the other raster is dsf ${sm.dsf} at docs/verification/pentip/${SIBLING} — ${sibTapers.length} arms, ` +
      `tapers ${sibTapers.join(", ")}. Its PIXELS are graded by --label=${SIBLING}, not by this run; this row reads its recorded shapes only.`
  }
  say(
    dsf !== null && (dsf === 1 || dsf === 2) && sibOk,
    "raster",
    `RASTER · this run grades deviceScaleFactor ${dsf}, and the other raster's evidence exists and is enumerated`,
    sibNote,
  )

  console.log("\n── CALIBRATION · the known-bad must actually break ────────────")

  say(
    ref.frames >= 30,
    "frames",
    `enough frames to judge (${REF})`,
    `${ref.frames} inside the 8-97 % window, tip window median ${ref.medWinArea} px`,
  )

  /* ⚠ THE TAPERS BEING COMPARED MUST DIFFER, which nothing here ever checked.
   * The old file printed `shapes[n].live.shape.taper` in its table and never
   * tested it, so pointing `--arm` and `--ref` at the same shape — or at two
   * arms of a capture where an override silently failed to take — produced a
   * full green board on a comparison of a thing with itself. */
  const armT = taperOf(ARM)
  say(
    armT !== null && refTaper !== null && Math.abs(armT - refTaper) > 1e-9,
    "taper-differs",
    `the two arms being compared are two different shapes`,
    `${ARM} taper ${fx(armT)} vs ${REF} taper ${fx(refTaper)} — span by the closed form ` +
      `${fx((shapes[ARM]?.live?.shape?.nose ?? 0) * 0.3068 + (armT ?? 0) * 0.5)} w vs ` +
      `${fx((shapes[REF]?.live?.shape?.nose ?? 0) * 0.3068 + (refTaper ?? 0) * 0.5)} w`,
  )

  /* THE WIDTH ESTIMATOR IS CHECKED AGAINST AN INDEPENDENT ONE, not asserted.
   * `assert-drawin-pentip.mjs` derives the same quantity from the stroke->screen
   * fit and the path; this one derives it from area over boundary and knows
   * nothing about either. Two estimators that agree are a measurement; one that
   * nothing checks is the class that read 1 px on a 25 px mark.
   *
   * ⚠ DEFECT CLASS 2 · the old `else` branch was `ref.medW >= 4`, and on the
   * only label that ever ran it was UNREACHABLE, because a `pentip.json` sits in
   * `tipshape-sweep`. On the labels where it is reachable it is a check that
   * cannot fail on any resolved mark.
   *
   * There are now up to TWO comparisons and both must hold. The in-raster
   * inradius estimator always runs, so the fallback branch is no longer a
   * different, weaker check — it is the same check with one fewer witness. And
   * the ruler is NEVER carried across rasters: see `WIDTH_AGREE` for the
   * measurement that killed that idea. */
  const cmp = []
  const finRef = fin[REF]
  if (finRef) {
    const rele = Math.abs(finRef.areal - finRef.inrad) / finRef.inrad
    cmp.push({
      ok: rele <= WIDTH_AGREE,
      how: `area/boundary ${finRef.areal} px vs inradius ${finRef.inrad} px on the finished mark — ${fx(rele * 100, 1)} % apart`,
    })
  }
  if (existsSync(join(DIR, "pentip.json"))) {
    const pj = JSON.parse(readFileSync(join(DIR, "pentip.json"), "utf8"))
    const v = pj.results?.[REF]?.wordHalfWidthPx ?? pj.results?.[ARM]?.wordHalfWidthPx ?? null
    if (v !== null) {
      const rele = Math.abs(ref.medW - v) / v
      cmp.push({
        ok: rele <= WIDTH_AGREE,
        how: `area/boundary ${ref.medW} px vs assert-drawin-pentip's ruler ${fx(v)} px — ${fx(rele * 100, 1)} % apart`,
      })
    }
  }
  say(
    cmp.length > 0 && cmp.every((c) => c.ok),
    "width",
    `the half-width agrees with every independently-derived estimate reachable in this raster`,
    cmp.length
      ? `${cmp.map((c) => c.how).join("; ")} (bar ${(WIDTH_AGREE * 100).toFixed(0)} %, ${cmp.length} independent estimator(s))`
      : `no independent estimate could be formed — the areal estimator is unchecked, so every window below is unscaled`,
  )

  /* ── DEFECT CLASS 1 · EVERY ARM THE GATE JUDGES IS CALIBRATED ──────────── */
  const badOk = {}
  const badZ = {}
  for (const n of [REF, ...judged]) {
    const a = out[n]
    const up = a.badGainFrames
    const down = a.badLossFrames
    const z = up + down > 0 ? (up - down) / Math.sqrt(up + down) : 0
    badZ[n] = z
    const ok = z >= KNOWN_BAD_Z && (a.badGainMed ?? 0) >= 1
    badOk[n] = ok
    say(
      ok,
      `known-bad:${n}`,
      `KNOWN-BAD · a tip literally cut off AT THE PEN reads as come-apart on ${n}`,
      `sign test z = ${fx(z, 2)} (bar ${KNOWN_BAD_Z}) — ${up} of ${a.frames} frames gain a detached piece inside the tip window, ` +
        `${down} lose one, median +${a.badGainMed ?? 0}; ${a.badTotTipComps} severed tip pieces against ${a.totTipComps} clean. ` +
        `Paired against this arm's OWN clean frames, so no number is carried over from another arm — which is what the ` +
        `parked \`totSpecks >= ref.totSpecks * 1.5\` bar did, and why it missed a severed tip on three arms out of six`,
    )
  }

  /* ── THE AA DIVISOR, AS A DIRECTIONAL MEASUREMENT AND NOT AS A VERDICT ───
   *
   * ⚠ HONEST SCOPE, because the first draft of this file overclaimed it. The
   * arithmetic at `PEN_TIP_AA_FWIDTH` says the prior divisor makes the coverage
   * ramp `1/sqrt(1 + taper^2)` of a PIXEL wide — 0.34 px at taper 2.75 — i.e.
   * an edge with essentially no antialiasing left on it. That predicts LESS of
   * the mark sitting in the grey band, with a direction, and the direction
   * holds on both rasters and both tapers. What it does NOT do is change the
   * speck or blank counts, and this gate says so rather than implying it: the
   * fwidth divisor is an antialiasing correction, visible at 8-19x on the one
   * edge the viewer is watching, and it is NOT what makes a long taper
   * survivable. What makes a long taper survivable is that the pen field now
   * registers — see `setFieldRealloc`.
   *
   * THE ASSERTION IS UNCHANGED. What changed is that the pairs are read off the
   * capture instead of being named by two flags, so a capture that holds four of
   * them gets four rows and one that holds none fails the manifest rather than
   * printing ALL PASS over a missing measurement. */
  console.log("\n── THE AA BAND · the sub-pixel ramp, measured ─────────────────")
  /* ⚠ AND THE INVENTORY ITSELF IS A ROW, because a row set derived from the
   * capture can be emptied by pointing a flag at nothing. `--control=nope`
   * leaves `aaPairs` empty, which registers no AA rows and no NULL rows — and a
   * manifest that only checks registered rows would pass on the emptiness. The
   * divisor-only pair is what calibrates the bars, so a capture (or a command
   * line) without one cannot be judged at all. */
  say(
    aaPairs.length >= 1,
    "aa-inventory",
    `there is at least one divisor-only pair to measure the AA band and calibrate the bars with`,
    aaPairs.length
      ? `${aaPairs.length} pair(s): ${aaPairs.map((p) => `${p.prior}/${p.arm} (taper gap ${fx(p.gap)})`).join(", ")}`
      : `none — the capture holds no arm with aa:false${CONTROL_ONLY.length ? `, or --control/--control2 named ${CONTROL_ONLY.join(", ")} which are not in it` : ""}. ` +
          `Without one, the bars below rest on nothing measured and no verdict is reportable`,
  )
  for (const p of aaPairs) {
    const lo = out[p.prior]
    const hi = out[p.arm]
    /* PAIRED, not two medians. 2026-09-22 (F116): the medians were taken over
     * each arm's own body, and one arm lost frame k=61 (no tip window), so the
     * row compared a median of 178 with a median of 179, one order statistic
     * apart. Neighbouring order statistics differ by 3 to 36 px as the word
     * grows, the same size as the effect, and the row went red by 3 px while
     * the prior arm had less AA band on 178 of 178 shared frames. Same sign
     * test and same NOISE_K the detached-pieces rows already use. */
    const g = paired(lo.body, hi.body, (r) => r.grey)
    say(
      g.n > 0 && g.z <= -NOISE_K,
      `aa:${p.prior}`,
      `the PRIOR divisor leaves LESS antialiasing on the same boundary`,
      `paired over ${g.n} shared frames: less on ${g.down}, more on ${g.up}, mean ${fx(g.mean)} px, z = ${fx(g.z, 2)} (bar ${-NOISE_K}); ` +
        `medians ${p.prior} ${lo.medGrey} px vs ${p.arm} ${hi.medGrey} px` +
        (p.gap < 1e-9
          ? `, same taper, same frames`
          : `, tapers ${fx(taperOf(p.prior))} vs ${fx(taperOf(p.arm))} — a gap of ${fx(p.gap)} the capture cannot close; ` +
            `the cross-taper spread on this capture's own same-divisor arms is the noise floor for that gap`),
    )
  }

  console.log("\n── VERDICT ───────────────────────────────────────────────────")

  /* ⚠ THE BARS ARE FIXED AND DERIVED FROM `MIN_DIM` AND THE MARK'S OWN HALF-
   * WIDTH SQUARE — see `HOLE_TAIL_SQ` for why they are not derived from the null
   * pair, and for the run that caught the version that was. */
  const sq = ref.medW * ref.medW
  const barHolePx = HOLE_MEAN_SQ * sq
  const barHoleTail = HOLE_TAIL_SQ * sq
  console.log(
    `bars, from MIN_DIM ${MIN_DIM} px and ${REF}'s own half-width square (${fx(sq, 1)} px):\n` +
      `  blank-spot area   mean ${fx(barHolePx)} px/frame (${HOLE_MEAN_SQ} w^2)   ·   worst single frame ${fx(barHoleTail, 1)} px (${HOLE_TAIL_SQ} w^2, one admissible crack)\n` +
      `  detached pieces   paired sign test at ${NOISE_K} sigma\n`,
  )

  /* THE NULL PAIRS ARE AN ASSERTION, NOT AN INPUT. Same shape, divisor only —
   * which the AA rows above establish does not move these channels. If one of
   * them moves further than the bar, the bar is under the channel's noise and no
   * verdict below can be read; if the arm under test is the one whose frames are
   * damaged, this is the row that says so. */
  const nullFloors = { holePx: 0, holeTail: 0, tipComps: 0 }
  for (const p of aaPairs) {
    const h = paired(out[p.prior].body, out[p.arm].body, (r) => r.tipHolePx)
    const c = paired(out[p.prior].body, out[p.arm].body, (r) => r.tipComps)
    nullFloors.holePx = Math.max(nullFloors.holePx, Math.abs(h.mean))
    nullFloors.holeTail = Math.max(nullFloors.holeTail, Math.abs(h.worst))
    nullFloors.tipComps = Math.max(nullFloors.tipComps, Math.abs(c.mean))
    say(
      Math.abs(h.mean) <= barHolePx && Math.abs(h.worst) <= barHoleTail && Math.abs(c.z) <= NOISE_K,
      `null:${p.prior}`,
      `NULL · the pair that differs only in the AA divisor stays INSIDE the bars, so the bars are above this channel's noise`,
      `${p.prior} vs ${p.arm}: blank-spot area ${fx(h.mean)} px/frame (bar ${fx(barHolePx)}), worst frame ${h.worst} px ` +
        `(bar ${fx(barHoleTail, 1)}), detached pieces z = ${fx(c.z, 2)} (bar ${NOISE_K}) over ${h.n} paired frames`,
    )
  }

  for (const n of judged) {
    const a = out[n]
    const t = taperOf(n)
    /* WHICH ARM IS ACTUALLY THE SHIPPED ONE, resolved from source rather than
     * assumed.
     *
     * ⚠ THIS ROW USED TO CALL `ARM` (the `free-stroke` capture, pinned to quill
     * 2.70) "THE SHIPPED TIP" unconditionally. `lib/pen-reveal.ts` now ships
     * `reed` at taper 1.60 — Sebs's pick, taken because 2.70 buys parity with
     * Desk Doodles and costs blank pixels at the pen, which is the one thing he
     * has been angriest about. So the label was asserting something false, and
     * a gate that mislabels which arm ships will get the wrong arm defended.
     *
     * A tip that is NOT shipped is a costed alternative, not a defect: its
     * numbers are printed and it is judged as a SHAPE row so the cost stays on
     * the record without a red claiming the product is broken. The moment the
     * source ships a longer taper again, that arm becomes the hard row and the
     * cost becomes a failure — automatically, because this reads the source. */
    const shippedTaper = src?.shapes?.[src?.live]?.taper ?? null
    const isShipped = shippedTaper !== null && t !== null && Math.abs(t - shippedTaper) < 1e-9
    const rowSay = sayArm(isShipped)
    const tag = isShipped
      ? "THE SHIPPED TIP"
      : n === ARM2
        ? "THE 2026-08-02 REJECTION"
        : `an ALTERNATIVE taper (source ships ${shippedTaper ?? "?"})`

    /* CAME APART — detached pieces at the pen, paired per frame, judged by the
     * SIGN TEST. The old row was `arm.maxSpecks <= ref.maxSpecks`: a max over a
     * whole-frame counter that read 2 against 2 on all five arms — saturated,
     * discriminating range [2,3] — and counting mostly ink 5.4 half-widths from
     * the pen. The known-bad's z on this identical channel is printed beside the
     * arm's, because a row whose bar is only ever approached from below is a row
     * nobody can size. */
    const c = paired(a.body, ref.body, (r) => r.tipComps)
    rowSay(
      c.z <= NOISE_K,
      `comps:${n}`,
      `${tag} · taper ${fx(t)} leaves no more DETACHED PIECES at the pen than ${REF} (${fx(refTaper)})`,
      `sign test z = ${fx(c.z, 2)} (bar ${NOISE_K}; this arm's own severed tip reads ${fx(badZ[n] ?? 0, 2)} on the same channel) — ` +
        `${c.up} frames up, ${c.down} down of ${c.n}; mean +${fx(c.mean, 3)}/frame, worst frame +${c.worst} at k=${c.worstK}; ` +
        `totals ${a.totTipComps} vs ${ref.totTipComps}`,
    )

    /* BLANK SPOTS — the thing Sebs has been angriest about, on a statistic that
     * is monotone in severity and a bar that clears the channel's measured
     * noise. The old row was `arm.maxBlanks <= ref.maxBlanks`: a max over a
     * counter with range [0,2] that failed on ONE frame in 179 carrying two
     * cracks of 5 and 7 px, while the null pair moved it by the same one frame. */
    const h = paired(a.body, ref.body, (r) => r.tipHolePx)
    rowSay(
      h.mean <= barHolePx,
      `holes:${n}`,
      `${tag} · opens no more BLANK SPOT AREA at the pen than ${REF}`,
      `+${fx(h.mean)} px/frame over ${h.n} paired frames (bar ${fx(barHolePx)} px; the divisor-only null pair moves ${fx(nullFloors.holePx)}); ` +
        `totals ${a.totTipHolePx} px in ${a.totTipHoleN} holes on ${a.holeFrames} frames vs ` +
        `${ref.totTipHolePx} px in ${ref.totTipHoleN} on ${ref.holeFrames}; largest single hole ${a.worstSingleHolePx} px vs ${ref.worstSingleHolePx}`,
    )

    /* AND THE TAIL, because a mean can hide one catastrophic frame and one
     * catastrophic frame is what a viewer sees. Same channel, bar set by the
     * worst single frame the null pairs produce. */
    rowSay(
      h.worst <= barHoleTail,
      `holes-tail:${n}`,
      `${tag} · and no SINGLE FRAME where it opens materially more than ${REF}`,
      `worst frame +${h.worst} px at k=${h.worstK} (bar ${fx(barHoleTail, 1)} px = one admissible ${MIN_DIM}x${MIN_DIM} crack in half-width squares; ` +
        `the divisor-only null pair's worst frame is ${nullFloors.holeTail} px)`,
    )

    /* ── THE HOLE THAT NEVER HEALS, ON THE FINISHED MARK ────────────────────
     *
     * ⚠ PARKED: this row used to be `paired(tipKeptPx) <= barKept` — permanent
     * enclosed paper AT THE PEN, per frame. It was wrong twice over and the
     * measurement says so. What that channel actually reads is the word's own
     * counters as they FORM under the pen, so it is enormous (12 780 px over 89
     * frames on `chisel`) and it moves with taper by design: the shipped 2.70
     * reads **-51.3 px/frame against chisel**, i.e. its counters are more OPEN,
     * which this file's own note at `stipple` already records as better. A row
     * that fires hardest on an improvement is not a row about a defect. It is
     * kept below as a printed diagnostic.
     *
     * The bug it was reaching for is real and is the one that made Sebs
     * angriest: a chunk of the word gone FOR GOOD, which the misregistered pen
     * field was doing until hours ago. That is a claim about the FINISHED mark,
     * so it is asserted there, and it is exact rather than statistical: at
     * playhead 1 the reveal is complete and the tip shape is not applied at all,
     * so every arm's last frame must be the SAME mark. Measured on `ship-dsf1`:
     * ink 30 530, 5 components, 1 enclosed region, half-width 8.87 — identical
     * to the pixel on all four arms. Anything that erases part of the word,
     * permanently, breaks that equality and nothing else does. */
    const fa = fin[n]
    const fr = fin[REF]
    const kp = paired(a.body, ref.body, (r) => r.tipKeptPx)
    rowSay(
      !!fa && !!fr && fa.ink === fr.ink && fa.comps === fr.comps && fa.encN === fr.encN,
      `permanent:${n}`,
      `${tag} · the FINISHED mark is the same mark as ${REF}'s — nothing is missing for good`,
      !fa || !fr
        ? `no final frame for ${!fa ? n : REF}, so the finished marks cannot be compared`
        : `ink ${fa.ink} vs ${fr.ink} px, ${fa.comps} vs ${fr.comps} components, ${fa.encN} vs ${fr.encN} enclosed regions ` +
            `(${fa.encPx} vs ${fr.encPx} px of counter). PARKED DIAGNOSTIC, not a bar: permanent enclosed paper at the pen ` +
            `runs ${fx(kp.mean)} px/frame against ${REF} (${a.totTipKeptPx} vs ${ref.totTipKeptPx} px) — that is the counters ` +
            `opening under a longer taper, not a defect`,
    )
  }

  /* ── THE COST LADDER, PRINTED WHETHER OR NOT A ROW FAILED ────────────────
   * Three rows firing individually is a defect list; the same three read down a
   * taper axis is a COST, and the difference is visible only if the arms are put
   * side by side. Nothing here is asserted — the assertions are above — but a
   * gate that can only say pass or fail about a monotone trend is a gate that
   * makes someone re-derive the trend by hand. */
  console.log(`\n── THE COST, READ DOWN THE TAPER AXIS (measured, not asserted) ──`)
  console.log(
    `arm             taper   span w   pieces at pen: z / mean per frame   blank-spot px at pen: total / n / worst frame`,
  )
  for (const n of [REF, ...judged]) {
    const a = out[n]
    const c = paired(a.body, ref.body, (r) => r.tipComps)
    const h = paired(a.body, ref.body, (r) => r.tipHolePx)
    const s = shapes[n]?.live?.shape
    console.log(
      `${n.padEnd(15)} ${fx(taperOf(n)).padStart(5)}   ${fx((s?.nose ?? 0) * 0.3068 + (s?.taper ?? 0) * 0.5).padStart(6)}   ` +
        `${(n === REF ? "  —  " : fx(c.z, 2)).padStart(15)} / ${(n === REF ? "  —  " : "+" + fx(c.mean, 3)).padStart(10)}   ` +
        `${String(a.totTipHolePx).padStart(14)} / ${String(a.totTipHoleN).padStart(2)} / ${(n === REF ? "  —" : "+" + h.worst).padStart(11)}`,
    )
  }

  if (!Object.values(badOk).every(Boolean)) {
    console.log(
      "\n⚠ THE KNOWN-BAD WAS NOT CAUGHT ON EVERY ARM ABOVE. The rows for those arms\n" +
        "  are not evidence: a counter that cannot see a tip that has been literally\n" +
        "  cut off cannot be quoted about one that has not.",
    )
  }

  /* ── DEFECT CLASS 7 · THE LAST ROW IS THE ONE THAT COUNTS THE OTHERS ───── */
  const unanswered = [...expected].filter((n) => !answered.has(n) && n !== "row-manifest")
  say(
    unanswered.length === 0,
    "row-manifest",
    `every row this capture's inventory calls for was actually made`,
    unanswered.length
      ? `${unanswered.length} registered row(s) never ran: ${unanswered.join(", ")} — a row that vanishes is not a row that passed`
      : `${expected.size - 1} rows registered from ${inventory.length} arms, ${aaPairs.length} AA pair(s), ${judged.length} judged arm(s); all answered`,
  )

  const OUT = join(DIR, "specks.json")
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        label: LABEL,
        dsf,
        arm: ARM,
        ref: REF,
        judged,
        aaPairs,
        nullFloors,
        final: fin,
        bars: { barHolePx, barHoleTail, holeTailSq: HOLE_TAIL_SQ, signTestSigma: NOISE_K, knownBadZ: KNOWN_BAD_Z },
        arms: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v])),
      },
      null,
      2,
    ),
  )
  console.log(`\njson: ${rel(OUT)}`)
  console.log(
    `rows: ${rowsSeen.length}, failures: ${rowsSeen.filter((r) => !r.ok).length}, ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  )
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
