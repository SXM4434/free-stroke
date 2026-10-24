// PASS/FAIL over the frames verify-screen-layers.mjs captured.
//
// Split from the capture on purpose (see docs/README.md): capturing is cheap and
// rerunnable, asserting is where "this option reads" and "this option is not
// just the one next to it" get settled.
//
// The one measurement here that did not exist before this pass is CROSS-RAIL
// distance. `nnDist` in the capture report compares a preset only with its own
// rail, so a preset that had been changed to fix its motion could still be a
// duplicate of a STATIC preset at rest and nothing would say so — which is
// exactly the question docs/research/ascii-glyph-resolution-and-temporal-
// stability.md §7 left open about dotScreen-crawl vs halftone-static.
//
// Usage: node scripts/verify/assert-screen-layers.mjs --label=final
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { captureFreshness } from "./_capture-freshness.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
/**
 * ⚠ THE DEFAULT LABEL IS DERIVED, NOT TYPED.
 *
 * This read `arg("label", "final")`, and `final/` was shot on 2026-08-04. By
 * 2026-09-04 the sources it grades had moved on by 733 hours and the gate could
 * only report PROVENANCE, forever, because the one directory it would look at
 * was frozen in its own source. Re-shooting `final/` is not the fix either:
 * 3,818 files are tracked under this tree and one sibling is named
 * `same-as-final-DO-NOT-CITE`, so overwriting it destroys a record somebody
 * deliberately kept.
 *
 * Same defect and same fix as `assert-fusion-combo-liveness`, which carries the
 * fuller note: a hand-written default is right on the day it is typed and wrong
 * from the next capture onward. The newest directory holding a `console-errors.json`
 * wins, `--label=` still names one explicitly, and every stored label stays
 * readable rather than being deleted.
 */
const newestLabel = () => {
  const base = join(ROOT, "docs", "verification", "screen-layers")
  if (!existsSync(base)) return "final"
  const shot = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, "console-errors.json")))
    .map((e) => ({ name: e.name, at: statSync(join(base, e.name, "console-errors.json")).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  return shot.length ? shot[0].name : "final"
}
const LABEL = arg("label", newestLabel())
const OUT = join(ROOT, "docs", "verification", "screen-layers", LABEL)

let fails = 0, warns = 0
const pass = (m) => console.log("PASS  " + m)
const fail = (m) => { console.log("FAIL  " + m); fails++ }
const warn = (m) => { console.log("WARN  " + m); warns++ }

/* ── A MISSING CAPTURE IS A VERDICT, NOT A STACK TRACE ─────────────────────
 *
 * This line used to be a bare `JSON.parse(readFileSync(...))`. With no capture
 * at `<label>/` it threw an unhandled ENOENT and the process died printing a
 * Node stack trace and **ZERO PASS/FAIL rows**.
 *
 * Measured 2026-08-07 in a lane tree built without `docs/verification/`: ten of
 * the thirty-nine model gates went red for exactly this reason, and nine of them
 * printed a readable `no capture at <path> — run <script> first`. This one
 * printed `Error: ENOENT ... at async ModuleJob.run`. In `run-battery.mjs`'s red
 * summary both shapes collapse to the same line — "(no FAIL row — non-zero exit
 * without one)" — so the operator cannot tell a MISSING CAPTURE from a SUBJECT
 * THAT FAILED without opening the gate by hand.
 *
 * That distinction is the whole point of the meta-gate's channel B
 * (`assert-gate-integrity.mjs`): "a `.catch(() => exit(1))` explicitly does not
 * count: that says the script CRASHED, never that the subject failed." A bare
 * ENOENT is that crash, arrived at by omission rather than by a catch.
 *
 * ⚠ THIS DOES NOT RELAX THE BAR. Missing evidence still exits NON-ZERO, so
 * channel C ("a stored-evidence gate must refuse missing evidence") is answered
 * exactly as before — it is now answered with a row that says which file was
 * missing and how to make it. */
const REPORT = join(OUT, "report.json")
if (!existsSync(REPORT)) {
  fail(
    `no capture at ${REPORT.replace(ROOT + "/", "")} — this gate grades STORED frames and there are none for ` +
      `--label=${LABEL}. Run: node scripts/verify/verify-screen-layers.mjs --label=${LABEL}`,
  )
  console.log(`\n1 row · 1 FAILURE — no evidence to grade (this is a refusal, not a verdict on the subject).`)
  process.exit(1)
}
const report = JSON.parse(readFileSync(REPORT, "utf8"))

async function lum(p) {
  const img = await loadImage(p)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  const L = new Float32Array(img.width * img.height)
  for (let i = 0, q = 0; i < d.length; i += 4, q++) {
    L[q] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  }
  return L
}
const dist = (a, b) => {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return s / n
}

const modes = [...new Set(report.map((r) => r.mode))]

/* ── MOTION EVIDENCE, for the one question a STILL cannot answer ───────────
 *
 * The cross-rail test below pools `ascii` with `animatedAscii` and reports the
 * closest pair. On the shipping evidence that pair is `codeMarks` (static) vs
 * `terminalFlicker` (animated) at Δ 5.891, which it called a WARN — under the
 * 6.0 line, over the 1.0 "same frame" line — and a WARN decides nothing.
 *
 * READ THE TWO PRESETS AND THE WARN EXPLAINS ITSELF. `terminalFlicker.applies`
 * is `codeMarks.applies` PLUS the animation: same `asciiCharset: "custom"`, same
 * `asciiCellSize: 17`, same `asciiLockMode: "screen"` (lib/style-system.ts:1574
 * and :1687). It IS the animated sibling of that preset. Two siblings looking
 * alike in a FROZEN FRAME is not a duplicate — it is what "the animated version
 * of Code Marks" means, and the 5.891 residual is only the two dials
 * terminalFlicker leaves at their defaults.
 *
 * So the still-frame distance is the wrong axis for a static/animated pair, and
 * the right one is: DO THEY DIFFER IN TIME? That is a real, decidable question
 * with evidence already on disk. When the closest pair spans the two families,
 * this file now judges it on motion instead of warning about pixels — and if no
 * motion evidence exists it FAILS saying so, because "we did not look" must not
 * read the same as "it is fine". */
/** How close two captures must be to count as the same build. */
const SAME_BUILD_HOURS = 24
const REPORT_MS = statSync(REPORT).mtimeMs

function motionEvidence() {
  const out = new Map()
  const refused = []
  const admitted = []
  const own = join(OUT, "motion-report.json")
  if (existsSync(own)) {
    for (const r of JSON.parse(readFileSync(own, "utf8"))) {
      if (!r.preset) continue
      const moves = (r.spanDelta ?? 0) > 1.0 || (r.meanDelta ?? 0) > 0.5
      out.set(r.preset, { source: "this pass's motion-report.json", moves, detail: `span ${r.spanDelta}, mean Δ ${r.meanDelta}` })
    }
  }
  // assert-layer-flicker samples at the true display rate, which is the only
  // instrument here that can tell a slow travel from a dead one (its own header
  // explains why a 2-6 fps screenshot loop cannot). Newest label wins.
  //
  /* ⚠ AND IT IS NOW ADMITTED ON AGE, NOT BORROWED AND THEN COMPLAINED ABOUT.
   *
   * The staleness rule used to live a hundred lines below this, as a row that
   * fired for every layer-flicker file LOADED. That is not the thing worth
   * asserting. Measured on the 2026-09-04 capture: this file supplied nine
   * texture presets, the run reached three cross-family verdicts, and all three
   * were decided on THIS pass's own motion-report. So the gate went red over a
   * 166.1 h gap in evidence that no verdict had touched — while the same
   * evidence would have been used silently, red row and all, if a verdict had
   * needed it, because loading and using were never connected.
   *
   * Stale evidence is not evidence. It is refused at the door, and the presets
   * it would have covered simply have none — at which point §3's existing
   * `!ev` branch fails BY NAME and tells the operator which capture to re-run.
   * That is strictly stronger than the old row: it fails when the stale number
   * is load-bearing, and it stays quiet when nothing rests on it. Verified by
   * mutation, not by reading: with `terminalFlicker` removed from this pass's
   * motion-report and only the 166 h-old flicker report to fall back on, the
   * three ascii cross-family rows go red with "NO MOTION EVIDENCE". */
  const fdir = join(ROOT, "docs", "verification", "layer-flicker")
  if (existsSync(fdir)) {
    const cands = readdirSync(fdir)
      .map((d) => join(fdir, d, "flicker-report.json"))
      .filter((p) => existsSync(p))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    if (cands.length) {
      const src = cands[0].replace(ROOT + "/", "")
      const gapH = Math.abs(statSync(cands[0]).mtimeMs - REPORT_MS) / 3600000
      const rows = JSON.parse(readFileSync(cands[0], "utf8")).filter((r) => r.preset && !out.has(r.preset))
      if (gapH < SAME_BUILD_HOURS) {
        for (const r of rows) {
          out.set(r.preset, {
            source: src,
            moves: !r.broken && r.verdict !== "DEAD" && (r.spanD ?? 0) > 1.0,
            detail: r.broken ? `sampler broken — ${r.broken}` : `${r.verdict}, span ${r.spanD} at ${r.fps} fps`,
          })
        }
        admitted.push({ src, gapH, presets: rows.map((r) => r.preset) })
      } else {
        refused.push({ src, gapH, presets: rows.map((r) => r.preset) })
      }
    }
  }
  return { out, refused, admitted }
}
const { out: MOVES, refused: REFUSED_EVIDENCE, admitted: ADMITTED_EVIDENCE } = motionEvidence()

/* ── TWO BUILDS, ONE VERDICT (class 6) ─────────────────────────────────────
 *
 * `motionEvidence()` above joins THIS pass's report.json to whichever
 * layer-flicker/<label>/flicker-report.json is newest, and the only selection
 * rule is "newest label wins". On the shipping evidence that fuses a report.json
 * from 2026-07-29 with a flicker-report.json from 2026-08-02 — two builds 3.6
 * days apart — into a single PASS about whether a preset that looks like its
 * sibling at rest is separated in time. The still-frame half and the motion half
 * are then statements about different code, and the join is silent about it.
 *
 * Neither timestamp was ever compared with the other, or with lib/. Both are now
 * asserted: the evidence must post-date the source it grades, and the two halves
 * must belong to the same build. */
{
  const fresh = captureFreshness(OUT, {
    subjects: ["lib/style-system.ts", "lib/style-shader.ts", "lib/texture-shader.ts", "lib/dither-shader.ts", "lib/ascii-shader.ts"],
    recapture: `node scripts/verify/verify-screen-layers.mjs --label=${LABEL}`,
  })
  fresh.ok ? pass(fresh.label + " — " + fresh.detail) : fail(fresh.label + " — " + fresh.detail)

  for (const a of ADMITTED_EVIDENCE) {
    pass(
      `the motion half and the still half of this verdict come from the same build — ` +
        `report.json ${new Date(REPORT_MS).toLocaleString()} vs ${a.src} ` +
        `${new Date(statSync(join(ROOT, a.src)).mtimeMs).toLocaleString()} (${a.gapH.toFixed(1)}h apart, under the ${SAME_BUILD_HOURS}h line) — ` +
        `${a.presets.length} preset(s) admitted from it`,
    )
  }
  for (const r of REFUSED_EVIDENCE) {
    pass(
      `REFUSED stale motion evidence: ${r.src} is ${r.gapH.toFixed(1)}h from this capture, over the ${SAME_BUILD_HOURS}h ` +
        `same-build line, so its ${r.presets.length} preset(s) are NOT admitted — ${r.presets.join(", ")}. ` +
        `A preset could have stopped moving in that gap and a "close at rest but separated IN TIME" verdict built on it ` +
        `would read green. Nothing below may lean on it; any pair that needs one now fails by name. ` +
        `Re-shoot: node scripts/verify/assert-layer-flicker.mjs`,
    )
  }

  /* ═══ AND A RED ROW ABOVE A WALL OF PASS ROWS IS READ AS "PASS WITH A NOTE" ══
   *
   * The row above has been correct and ignored. Measured 2026-08-28, bare run:
   * it printed `STALE BY 566.4h` and then **18 PASS rows** about `screen-layers/
   * final`, captured 2026-08-04. Lane N4 measured the same shape from the other
   * side and put a number on it: *"93 PASS rows on the scoreboard describe the
   * 08-04 build, not this commit."* Those 18 are part of that 93.
   *
   * `_capture-freshness.mjs`'s own header already called this out before either
   * of us: *"A warning that the evidence is stale, printed above a wall of PASS
   * rows, is read as 'PASS with a note' — this repo has shipped that shape
   * before and it is how the ten-hour gap survived."* It was right, and this
   * file was the shape it was describing.
   *
   * So the gate stops here instead of grading on. THIS GATE CANNOT RECAPTURE —
   * it opens no browser and writes nothing into `OUT`; only
   * `verify-screen-layers.mjs` can refresh it. Exiting is what makes this a
   * gate rather than a note. */
  if (!fresh.ok) {
    console.log(
      "\n⚠ NO VERDICT. The stored evidence predates the code it would be judging, so\n" +
        "  the rows that used to follow described a build that no longer exists. They are\n" +
        "  not printed, because a PASS nobody can act on is worse than no row at all.",
    )
    console.log(`\nFAILURES: ${fails}`)
    process.exit(1)
  }
}

const ANIMATED_RAILS = new Set(["animatedTexture", "animatedDither", "animatedAscii", "animatedFusion"])
const railOf = (k) => k.split("|")[1]
const presetOf = (k) => k.split("|")[0]

/* --- 1. every option must do something ----------------------------------
 *
 * 2.0 is the repo's own stated perceptual floor for mean delta on a dark
 * subject (scripts/verify/diff-frames.mjs: "meanΔ < 2 on an 0-255 scale is
 * below the perceptual floor on a dark surface").
 *
 * ⚠ THE TEXTURE RAIL WAS EXEMPT FROM THIS AND IS NOT ANY MORE (2026-08-01).
 * The exemption read "Texture is reported rather than failed: it is measurably
 * below the floor on the glossy-dark materials and that is a known, documented
 * gap" — which is a WARN standing in for an open defect, and a WARN does not
 * fail a sweep. Two things changed:
 *   · the gap was measured on this tree rather than taken from the docs. Rod
 *     read dOff 0.93-4.08 across twelve presets, so ONE preset (Fine Grain) was
 *     under the floor and the rest were merely faint — the docs' "Rod's whole
 *     rail measures below the perceptual floor" overstates it.
 *   · it was then diagnosed and worked: the dark-body lift and the clearcoat
 *     channel in lib/texture-shader.ts carry Rod's eleven others to 3.46-4.81,
 *     and Fine Grain's own suppression is a resolution limit, not a contrast
 *     one (its lattice is chosen from the pixel footprint now: 0.93 -> 1.54).
 * Fine Grain on Rod is therefore a real, named red row rather than a class-wide
 * exemption, and it can no longer be lost by being a warning.
 *
 * ⚠ AND FOR A MONTH IT WAS A RED ROW ABOUT THE WRONG NUMBER (2026-09-04).
 *
 * The floor is quoted from `diff-frames.mjs`, and that file's first sentence
 * says what it averages over: *"over pixels where either frame has ink
 * (alpha > 20)"*. `dOff` averaged over the whole crop, paper included. Every
 * screen layer only ever touches the form, so the two differ by exactly the
 * ink fraction — measured over the 132 graded rows, paper contributes
 * 0.000-0.032 against an ink delta of 14-90 — and the ink fraction belongs to
 * the MODE, not the effect: rod 0.131 · extrude 0.326 · solid 0.343 ·
 * inflate 0.485. Rod's dOff sits 1/0.131 = 7.6x below its own ink value against
 * Inflate's 2.1x, so one absolute floor was four different bars and Rod was
 * marked 3.7x harder than Inflate for being thin.
 *
 * rod/texture/fineGrain: dOff 1.917, dInk 14.579. Seven times over the floor on
 * the floor's own scale, and visibly speckled beside the OFF crop. The red row
 * was the ruler, not the preset. Note also that `metrics()` had ink-masked
 * every other field in the row — ink, mean, sd, edge, levels — since it was
 * written. `dOff` was the one number on a different scale and the only one with
 * a bar quoted against it.
 *
 * THE BAR IS UNTOUCHED AT 2.0 AND IT STILL REDDENS. Calibrated on Rod with the
 * option present and dead (textureIntensity 0): dInk 0.000 on 12 of 12 texture
 * presets. What this row does NOT catch is the relief-parked prior
 * (uFsTexBump 0, fineGrain dInk 8.357) — that was only ever caught here by the
 * dilution, by accident, and `assert-texture-relief.mjs` owns it deliberately
 * with a shipped-vs-parked comparison whose subtraction cancels the ink
 * fraction outright.
 *
 * 🔴 THE SAME DILUTION IS STILL UNDER §3 BELOW, AND IT IS LEFT THERE ON PURPOSE.
 *
 * §3's `dist()` divides by every pixel in the crop too, so its 1.0 and 6.0
 * lines are 3.7x stricter on Rod than on Inflate for the same reason. It shows:
 * the closest-pair distance tracks the mode's ink fraction, not the presets.
 * Same capture, closest cross-rail pair per mode, raw and over ink fraction:
 *
 *     inflate 0.489   21.85 · 24.35 · 10.55   ->   44.7 · 49.8 · 21.6
 *     solid   0.343   22.87 · 19.92 ·  4.92   ->   66.7 · 58.1 · 14.3
 *     extrude 0.329   14.23 ·  8.24 ·  5.98   ->   43.2 · 25.0 · 18.2
 *     rod     0.132    4.76 ·  1.95 ·  1.74   ->   36.1 · 14.7 · 13.2
 *
 * Every row that lands near a line is a Rod row, in all three rails, and Rod
 * joins the pack the moment the denominator is fixed. But §1's floor is CITED
 * — `diff-frames.mjs` says in its own first sentence what it averages over, so
 * correcting §1's scale is forced BY the citation, not chosen. §3's two lines
 * have no such source: they were tuned against these diluted numbers
 * themselves. Re-scaling them without re-deriving them would only widen every
 * distance and silence warnings, which is relaxing a bar, and that is the one
 * thing this file may not do. The rod texture WARN below is real under the
 * ruler as it stands and stays.
 */
const UNMASKED = report.filter((r) => r.rail !== "off" && r.dInk === undefined)
if (UNMASKED.length) {
  /* A capture that predates `dInk` cannot be graded on this scale, and falling
   * back to `dOff` would silently reinstate the bug this row exists to remove.
   * Refuse by name — a missing measurement is not a passing one. */
  fail(
    `${UNMASKED.length} of ${report.length} row(s) carry no dInk — this capture predates the ink-masked ` +
      `measure and the 2.0 floor cannot be applied to its dOff. ` +
      `Re-capture: node scripts/verify/verify-screen-layers.mjs --label=${LABEL} --only=stills`,
  )
} else {
  let worst = { d: Infinity, who: "" }
  for (const r of report) {
    if (r.rail === "off") continue
    if (r.dInk < worst.d) worst = { d: r.dInk, who: `${r.mode}/${r.rail}/${r.preset}` }
    if (r.dInk < 2.0) {
      fail(
        `${r.mode}/${r.rail}/${r.preset} does nothing — dInk ${r.dInk} < 2.0 (the repo's own perceptual floor, ` +
          `on the ink-masked scale diff-frames.mjs measured it on; whole-crop dOff ${r.dOff} over ink fraction ${r.inkMaskFrac})`,
      )
    }
  }
  if (!fails) {
    pass(
      `EVERY rail option, texture included, clears the perceptual floor — ${report.length - modes.length} graded ` +
        `option(s), weakest ${worst.who} at dInk ${worst.d} against the 2.0 floor (${(worst.d / 2).toFixed(1)}x). ` +
        `Known-bad: the same presets with the option dead read dInk 0.000`,
    )
  }
}

/* --- 2. the form must survive ------------------------------------------- */
// levels < 2 means the ink collapsed to one flat tone: a silhouette, not a
// treatment. This is the check that would have caught the over-narrow tone
// window that sent three Extrude presets entirely to paper.
for (const r of report) {
  if (r.rail === "off") continue
  if (r.levels < 2) fail(`${r.mode}/${r.rail}/${r.preset} flattened the form — levels ${r.levels}`)
}

/* --- 3. cross-rail distinctness -----------------------------------------
 *
 * ⚠ THE PAIR LIST WAS TWO ENTRIES AND THE RAIL IT MOST NEEDED WAS NOT ONE
 *   (class 4).
 *
 *   It read: [["dither","animatedDither"], ["ascii","animatedAscii"]].
 *   The shipping report.json carries 68 rows of which 24 — 35% — are `texture`,
 *   and not one of them was ever compared to a sibling. Their entire treatment
 *   was `dOff >= 2.0` (does it differ from OFF) and `levels >= 2` (did the form
 *   survive). Both of those are satisfied by twelve presets that are identical
 *   to each other, which is the exact defect this section exists to find:
 *   §1 asks "does this option do something", §3 asks "is it the one next to it".
 *   A third of the rail only ever got the first question.
 *
 *   `ANIMATED_RAILS` above already NAMES `animatedTexture` and `animatedFusion`.
 *   The loop could never reach either, so those two entries were documentation
 *   for code that did not exist.
 *
 *   The list is now DERIVED from the rails actually present in the report, so a
 *   new rail is covered the day it appears instead of the day someone remembers
 *   to add it here. */
const CROPS = join(OUT, "crops")
const railsPresent = new Set(report.map((r) => r.rail))
const RAIL_PAIRS = [...ANIMATED_RAILS]
  .map((anim) => {
    // "animatedDither" -> "dither"
    const base = anim.replace(/^animated/, "")
    return [base.charAt(0).toLowerCase() + base.slice(1), anim]
  })
  .filter(([base, anim]) => railsPresent.has(base) || railsPresent.has(anim))
const railsCovered = new Set(RAIL_PAIRS.flat())
const railsUngraded = [...railsPresent].filter((r) => r !== "off" && !railsCovered.has(r))
if (railsUngraded.length) {
  fail(
    `rails present in report.json that NO cross-rail distinctness check reaches: ${railsUngraded.join(", ")} — ` +
      `those presets are only ever compared with OFF, never with each other, so twelve identical ones would pass`,
  )
} else {
  pass(`cross-rail distinctness covers every rail in the report (${RAIL_PAIRS.map((p) => p.join("+")).join(", ")})`)
}
for (const mode of modes) {
  for (const fams of RAIL_PAIRS) {
    const rows = report.filter((r) => r.mode === mode && fams.includes(r.rail))
    const cache = new Map()
    for (const r of rows) {
      const p = join(CROPS, `${mode}_${r.rail}_${r.preset}_macro.png`)
      if (existsSync(p)) cache.set(r.preset + "|" + r.rail, await lum(p))
    }
    const keys = [...cache.keys()]
    let worst = { d: Infinity, a: "", b: "" }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const d = dist(cache.get(keys[i]), cache.get(keys[j]))
        if (d < worst.d) worst = { d, a: keys[i], b: keys[j] }
      }
    }
    const label = `${mode} ${fams[0]}+${fams[1]}`
    const crossFamily =
      ANIMATED_RAILS.has(railOf(worst.a)) !== ANIMATED_RAILS.has(railOf(worst.b))
    if (worst.d < 1.0) {
      fail(`${label}: ${worst.a} and ${worst.b} are the SAME FRAME (Δ ${worst.d.toFixed(3)})`)
    } else if (worst.d >= 6.0) {
      pass(`${label}: closest pair across both rails Δ ${worst.d.toFixed(2)} (${worst.a} vs ${worst.b})`)
    } else if (crossFamily) {
      // A static preset and its animated sibling. The still is allowed to be
      // close; the MOTION is not. Decide it, do not warn about it.
      const animKey = ANIMATED_RAILS.has(railOf(worst.a)) ? worst.a : worst.b
      const stillKey = animKey === worst.a ? worst.b : worst.a
      const ev = MOVES.get(presetOf(animKey))
      if (!ev) {
        fail(
          `${label}: ${worst.a} vs ${worst.b} are Δ ${worst.d.toFixed(3)} apart at rest and there is NO MOTION EVIDENCE ` +
            `for ${presetOf(animKey)} on disk — run assert-layer-flicker.mjs, or verify-screen-layers.mjs --only=motion. ` +
            `A pair this close is only distinct if the animated one animates, and nobody has measured whether it does.`,
        )
      } else if (!ev.moves) {
        fail(
          `${label}: ${presetOf(animKey)} is Δ ${worst.d.toFixed(3)} from the static ${presetOf(stillKey)} at rest AND DOES NOT MOVE ` +
            `(${ev.detail}, ${ev.source}) — that is a duplicate wearing the animated rail's name`,
        )
      } else {
        pass(
          `${label}: ${presetOf(animKey)} sits Δ ${worst.d.toFixed(3)} from the static ${presetOf(stillKey)} at rest — which is correct, it is ` +
            `that preset's animated sibling — and it is separated IN TIME: ${ev.detail} (${ev.source})`,
        )
      }
    } else {
      warn(`${label}: closest pair ${worst.a} vs ${worst.b} — Δ ${worst.d.toFixed(3)}, and they are on the SAME rail, so time cannot separate them`)
    }
  }
}

/* --- 4. motion, if a motion report is present --------------------------- */
const mp = join(OUT, "motion-report.json")
if (existsSync(mp)) {
  const motionRows = JSON.parse(readFileSync(mp, "utf8"))
  /* THE BARE-REVEAL CONTROL — see `verify-screen-layers.mjs`'s MOTION list.
   * Its deltas are the draw with NO effect on it, so anything the strobe
   * predicate reads here belongs to the reveal, not to a preset. */
  const ctrl = motionRows.find((x) => x.cell === "reveal_control")
  const strobeOf = (deltas) => {
    if (!Array.isArray(deltas) || deltas.length < 4) return null
    const m = deltas.reduce((a, v) => a + v, 0) / deltas.length
    const sd = Math.sqrt(deltas.reduce((a, v) => a + (v - m) ** 2, 0) / deltas.length)
    return { m, sd, lo: Math.min(...deltas), fires: sd > m && Math.min(...deltas) === 0 }
  }
  const ctrlActive =
    ctrl && Array.isArray(ctrl.deltas) && Number.isInteger(ctrl.restFromIndex)
      ? ctrl.deltas.slice(0, ctrl.restFromIndex)
      : ctrl?.deltas
  const ctrlStrobe = strobeOf(ctrlActive)
  if (!ctrl) {
    warn(
      "motion/reveal_control is MISSING from this capture — the strobe test on the reveal cells has no control " +
        `and cannot separate the effect from the draw. Re-capture: node scripts/verify/verify-screen-layers.mjs --label=${LABEL} --only=motion`,
    )
  } else {
    pass(
      `motion/reveal_control · the draw ALONE reads sd ${ctrlStrobe.sd.toFixed(3)} vs mean ${ctrlStrobe.m.toFixed(3)}, floor ${ctrlStrobe.lo.toFixed(3)}` +
        ` — strobe signature ${ctrlStrobe.fires ? "FIRES" : "silent"} with no effect on screen`,
    )
  }
  for (const r of motionRows) {
    if (r.cell === "reveal_control") continue
    // A slow effect and a dead one are identical in frame-to-frame delta, so
    // travel is judged on span.
    if (r.spanDelta !== undefined && r.spanDelta < 5.0) {
      warn(`motion/${r.cell} barely travels — span ${r.spanDelta}`)
    }
    /* A one-shot has to end — JUDGED ON A WINDOW THE CAPTURE DERIVED FROM THE
     * MODEL, and refused outright if that window does not exist.
     *
     * ⚠ THIS ROW WAS RED ABOUT A PULSE THAT STOPS. The capture used to call the
     * last 20 % of the frames "rest", which is a claim about INDICES against a
     * lifetime measured in SECONDS at an uncontrolled frame cadence. On
     * `final/`, dit_pulse's deltas ran … 4.149 · 3.346 · 14.501 and then EIGHT
     * consecutive 0.000s — the layer becomes exactly static, the same reading
     * `dit_reveal` and `asc_reveal` give the instant their reveal completes —
     * and the index window opened three frames before that. The mean of the
     * three live frames and eight dead ones is 2.0, and the row printed "a
     * one-shot that never stops".
     *
     * `verify-screen-layers.mjs` now times the frames, records which frame the
     * reveal completed on, and starts the window one whole `PULSE_LIFETIME`
     * (lib/style-clock.ts) after it. Both numbers are in the report, so this
     * side can say what it read — and a capture too short to contain a rest
     * window is a FAILURE OF EVIDENCE, not a silent pass. */
    if (r.preset === "completionPulseDither") {
      const derived = r.restFrames !== undefined
      if (!derived) {
        fail(
          `motion/${r.cell} — this capture predates the derived rest window (no restFrames/pulseLifetimeSec in the report). ` +
            `Re-capture: node scripts/verify/verify-screen-layers.mjs --label=${LABEL} --only=motion`,
        )
      } else if (!r.restFrames) {
        fail(
          `motion/${r.cell} — NO REST WINDOW in this capture: the clip is ${r.clipSec}s and the pulse's own ` +
            `lifetime is ${r.pulseLifetimeSec}s from completion at ${r.completionSec}s. Nothing here can say whether the one-shot ends.`,
        )
      } else if (r.restMeanDelta !== null && r.restMeanDelta > 0.5) {
        fail(
          `motion/${r.cell} is a one-shot that never stops — rest Δ ${r.restMeanDelta} over ${r.restFrames} frame(s) ` +
            `starting ${r.restStartsSecAfterCompletion}s after completion (pulse lifetime ${r.pulseLifetimeSec}s)`,
        )
      } else {
        /* AND SAY HOW HARD IT LANDS, on the same row, because the window fix
         * that made this row honest also took the landing frame out of it.
         *
         * The rest window used to be picked by the LATER end of each frame
         * interval, so it swallowed the one interval containing the expiry
         * instant — the frame on which the pulse stops. That single 9.462
         * against eleven exact 0.000s is what made this row read "never stops"
         * about a pulse that stops dead (see verify-screen-layers.mjs). The
         * window now takes intervals that lie WHOLLY in the rest period, which
         * is the only reading of "rest" a per-frame delta supports.
         *
         * That frame is not noise and it is not this row's question, so it is
         * measured and printed rather than dropped. A one-shot that ends by
         * jumping is a real defect, and this one has been isolated to ONE
         * condition: components/viewport-3d.tsx runs the threshold sweep under
         * `if (ditT.active && ditherDirection === "static")`, so at expiry a
         * sweep sitting at -0.1030 goes to 0 in a single frame — 16x a normal
         * 60 fps frame — and the phase `evaluateLayerTime` deliberately parks
         * at `PULSE_LIFETIME * speed`, for this exact reason, is discarded
         * before anything reads it. Measured by A/B on the same crop: with the
         * direction non-static the cell reads 0.0000 through the pulse and
         * across expiry, which both proves the sweep is the only visible
         * channel and rules out the `pulseEnvelope` cutoff step as the cause.
         *
         * NO BAR IS INVENTED HERE. This file cannot fix that condition and a
         * threshold nobody can act on is how an unactionable WARN gets written
         * — its own §7 note says so. The number is printed on the row instead,
         * with its own live tail beside it, so the next reader has it. */
        const land =
          r.expiryDelta === null || r.expiryDelta === undefined
            ? ""
            : ` · it LANDS at Δ ${r.expiryDelta} on frame ${r.expiryIndex}, the interval the expiry instant falls in` +
              (r.liveTailMeanDelta
                ? ` — ${(r.expiryDelta / r.liveTailMeanDelta).toFixed(1)}x its own live tail (mean ${r.liveTailMeanDelta} over the 5 frames before it)`
                : "")
        pass(
          `motion/${r.cell} is a one-shot that ENDS — rest Δ ${r.restMeanDelta} over ${r.restFrames} frame(s) ` +
            `from ${r.restStartsSecAfterCompletion}s after completion, i.e. one full pulse lifetime (${r.pulseLifetimeSec}s) later${land}`,
        )
      }
    }
    /* Long stillness punctuated by one huge jump is a strobe, not motion —
     * JUDGED WHILE THE EFFECT IS RUNNING, not across the capture's own dead
     * tail.
     *
     * ⚠ THE OLD SUBJECT WAS THE WHOLE CLIP, and on a reveal-synced cell that
     * clip is a ramp followed by a deliberate hold in which the effect is
     * SUPPOSED to be exactly still. Those zeros put `minDelta` at 0 and inflate
     * `sd` above `mean` by construction, so `dit_reveal`, `dit_pulse` and
     * `asc_reveal` all warned "strobe signature" — three of the four
     * reveal-driven cells in the sweep — for doing precisely what every other
     * row in this file demands of them. A test that fires on correct behaviour
     * is noise, and this file's own §3 makes that argument about WARN already.
     *
     * The bar is untouched (`sd > mean` with a zero floor). What changed is the
     * window: the deltas before the rest window opens, i.e. the frames in which
     * the effect is live. A continuous cell has no rest window and is judged
     * over everything, exactly as before. */
    const active =
      r.reveal && Array.isArray(r.deltas) && Number.isInteger(r.restFromIndex)
        ? r.deltas.slice(0, r.restFromIndex)
        : r.deltas
    const s = strobeOf(active)
    if (s && r.preset !== "terminalFlicker") {
      /* ON A REVEAL CELL THE PREDICATE IS DIFFERENTIAL AGAINST THE CONTROL, and
       * that is not a softer bar — it is the only way the statistic answers the
       * question it is asked. The delta here is (new ink arriving) + (the effect
       * moving); the predicate fires on the first term whether or not the second
       * is doing anything. Measured: the bare-reveal control fires it too. So a
       * reveal cell strobes when it fires AND the control does not — which still
       * catches a genuinely strobing reveal effect, and stops reporting three of
       * the four reveal presets for behaving correctly. Continuous cells are
       * judged exactly as before, against nothing. */
      const differential = r.reveal && ctrlStrobe
      if (s.fires && (!differential || !ctrlStrobe.fires)) {
        warn(
          `motion/${r.cell} strobe signature — sd ${s.sd.toFixed(3)} > mean ${s.m.toFixed(3)}, floor 0` +
            ` (over the ${active.length} frame(s) the effect is live${r.reveal ? `, of ${r.deltas.length}; the bare-reveal control does NOT fire` : ""})`,
        )
      } else if (s.fires && differential) {
        pass(
          `motion/${r.cell} · the strobe signature is the DRAW's, not this preset's — cell sd ${s.sd.toFixed(3)}/mean ${s.m.toFixed(3)}` +
            ` and the bare-reveal control reads sd ${ctrlStrobe.sd.toFixed(3)}/mean ${ctrlStrobe.m.toFixed(3)}, both with a zero floor`,
        )
      }
    } else if (!Array.isArray(active)) {
      // No per-frame deltas in this capture — say so rather than skipping.
      warn(`motion/${r.cell} — no per-frame deltas in the report, the strobe test could not run`)
    }
  }
}

/* ⚠ THE WARNINGS COULD NOT FAIL THE RUN (class 7).
 *
 *   `warn()` incremented `warns` and the exit line was `process.exit(fails ? 1 : 0)`.
 *   So the two conditions that only ever warn —
 *     · "barely travels" (span < 5.0), the slow-vs-dead discriminant
 *     · "strobe signature" (sd > mean with a zero floor)
 *   — could never turn this sweep red however many presets tripped them. Which
 *   makes them print statements. This file's own §3 already made the opposite
 *   choice for the same reason ("a WARN decides nothing"), and left these two
 *   behind.
 *
 *   They now carry the exit code. The WARN word is kept because it is accurate
 *   about severity and the output stays readable, but severity and consequence
 *   are no longer allowed to disagree. */
console.log(
  `\n${fails ? "FAILURES: " + fails : "no failures"}${warns ? `  ·  WARNINGS: ${warns} (these now carry the exit code — a warning that cannot fail the run is a print statement)` : ""}`,
)
/* ⚠ AND THE VERDICT LINE HAS TO BE SHAPED LIKE A VERDICT (2026-09-04).
 *
 * `warns` has carried the exit code since the §7 note below the WARN rows, and
 * the day the last FAIL row went green this file started doing the one thing
 * its own header condemns: exiting 1 with NOTHING a scoreboard reader can
 * parse. `assert-gate-integrity` channel B read it exactly as the header
 * predicted — *"assert-screen-layers.mjs · bare run exits 1 · (no FAIL row —
 * non-zero exit without one)"* — which is its signature for a gate that
 * CRASHED rather than one whose subject failed. This file's own note about a
 * bare ENOENT makes that argument in full: *"the operator cannot tell a
 * MISSING CAPTURE from a SUBJECT THAT FAILED without opening the gate by
 * hand."* A warning-only red is the third case that was indistinguishable.
 *
 * So the summary is a row when the run is red. `warns` keeps the WARN word,
 * which is accurate about severity, and the count line above still separates
 * hard failures from warnings — nothing is recounted or renamed. What changes
 * is that a red run now always says so in a line that parses. */
const red = fails || warns
console.log(
  !red
    ? "ALL ASSERTIONS PASS"
    : `FAIL  SCREEN-LAYER PROBLEMS PRESENT — ${fails} hard failure(s) and ${warns} warning(s), and warnings carry the exit code here`,
)
process.exit(red ? 1 : 0)
