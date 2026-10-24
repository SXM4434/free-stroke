// GATE REWRITE, TESTED. Runs the CURRENT gate 4/5 and the PROPOSED gate 4a/5'/6
// (hero-beat-storyboard.md §8) over the same per-frame series, on both films and
// on synthetic negative controls.
//
// Why this exists: §8 proposes deleting a clause from a passing craft gate and
// inverting another. That is the highest-risk edit in the board, because a gate
// that is loosened and never re-tested is a gate that has been deleted. The
// claim to prove is not "the new gate passes" — it is:
//
//   the OLD gates ACCEPT the beat with no moment and REJECT the one with a moment
//   the NEW gates REJECT the beat with no moment and ACCEPT the one with a moment
//   the NEW gates STILL REJECT the defects the old gates were written to catch
//
// The third line is the one that matters. Gate 4's whole reason for existing is
// the two-canvas crossfade that mis-registered (hero-2d-to-3d-transition.md §3).
// Deleting the extent clause must not let that back in. So the mis-registered
// swap is synthesised here and required to FAIL, along with two more ways of
// faking a moment: a hard cut to a blank frame, and a one-frame blink.
//
// Substrate: docs/storyboard/measured/*.tsv — per-frame ink bbox + mean ink
// luminance over the composited films, from tools/measure.mjs. Both films are
// measured by the same code at the same resolution, which is the only reason a
// like-for-like comparison is possible at all.
//
// THE CRITERIA ARE NOT DEFINED HERE. They live in
// `scripts/verify/lib/hero-moment.mjs`, which the SHIPPED gate
// (`scripts/verify/assert-hero-transition.mjs`) also calls. That is deliberate
// and it is what makes this file worth running: the four synthetic negative
// controls below only prove the shipped gate is sound if they exercise the
// shipped gate's own code. A second copy of a criterion is a criterion nobody
// tested.
//
// Usage: node docs/storyboard/tools/assert-moment.mjs
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  momentStats,
  spacingBand,
  priorRegistrationGate,
  registrationGate,
  momentGate,
  sliverGate,
  stillnessGate,
  priorStillnessGate,
} from "../../../scripts/verify/lib/hero-moment.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const MEASURED = join(HERE, "..", "measured")

const load = (name) =>
  readFileSync(join(MEASURED, name), "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => {
      const [f, t, n, w, h, cx, cy, y0, y1, mean] = l.split("\t").map(Number)
      return { f, t, n, w, h, cx, cy, mean }
    })

const slice = (rows, a, b) => rows.filter((r) => r.f >= a && r.f <= b)
const median = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)]

/* -- the measurements every gate reads --------------------------------------
 *
 * The extent / registration / moment / stillness quantities come from the
 * SHARED module. Only the tonal series is computed here, because the two
 * consumers read different tonal signals: the shipped gate uses interior ink
 * SD off real frames, and these films carry mean ink luminance instead. Same
 * shape of test on the same kind of signal — labelled as a PROXY wherever it is
 * reported, never presented as the live gate's own number. */

function stats(win) {
  const s = momentStats(win)

  const tone = win.map((r) => r.mean)
  const span = Math.max(...tone) - Math.min(...tone)
  let biggestStep = 0
  for (let i = 1; i < tone.length; i++) {
    biggestStep = Math.max(biggestStep, Math.abs(tone[i] - tone[i - 1]))
  }

  return { ...s, span, biggestStep }
}

/* -- the gates --------------------------------------------------------------
 * Everything except the tonal proxy is the shipped implementation, imported. */

const OLD = (s) => [
  priorRegistrationGate(s),
  {
    id: "5 ",
    name: "the change is gradual, not a cut  [PRIOR, tonal proxy]",
    pass: s.span > 4 && s.biggestStep < s.span * 0.45,
    detail: `tonal span ${s.span.toFixed(1)}, largest step ${s.biggestStep.toFixed(1)} (needs < ${(s.span * 0.45).toFixed(1)})`,
  },
]

const NEW = (s) => [
  {
    id: "4a",
    name: "REGISTRATION holds (bbox centre never jumps)  [as written in §8]",
    pass: s.maxCentreJump < 2,
    detail: `max centre shift ${s.maxCentreJump.toFixed(2)} px (needs < 2)`,
  },
  registrationGate(s),
  momentGate(s),
  sliverGate(s),
]

const STILL = (rows, n = 20) => [priorStillnessGate(rows, n), stillnessGate(rows, n)]

/* -- subjects --------------------------------------------------------------- */

const traced = load("traced.tsv")
const heroV2 = load("hero-v2.tsv")

// A synthetic frame series: flat at `w`, collapsing to `floor` for `dwell`
// frames, then back. `shift` displaces the centre at the collapse — a layer
// swap. The point of these is that a gate which cannot fail proves nothing.
const synth = ({ w = 410, floor = 14, dwell = 2, shift = 0, shiftY = 0, tone = 37 }) => {
  const out = []
  let f = 0
  const push = (ww, cx, cy, mean, ink) =>
    out.push({ f: f++, t: f / 30, n: ink, w: ww, h: 91, cx, cy, mean })
  for (let i = 0; i < 6; i++) push(w, 479, 269, tone, 11423)
  push(355, 479, 269, tone, 9952)
  push(135, 479, 269, tone + 4, 3988)
  for (let i = 0; i < dwell; i++)
    push(floor, 479 + shift, 269 + shiftY, 99, floor === 0 ? 0 : 410)
  push(238, 479 + shift, 269 + shiftY, tone + 6, 4967)
  push(384, 479 + shift, 269 + shiftY, tone + 4, 7761)
  for (let i = 0; i < 6; i++) push(w, 479 + shift, 269 + shiftY, tone, 11423)
  return out
}

const SUBJECTS = [
  {
    label: "ORIGINAL FLIP — the turn out (flat logo -> 3D card)",
    src: "desk-doodles-traced.webm f140-168",
    win: slice(traced, 140, 168),
    verdict: "MUST BE ACCEPTED — this is the only thing in the project with a moment",
  },
  {
    label: "ORIGINAL FLIP — the turn back (3D card -> flat logo)",
    src: "desk-doodles-traced.webm f225-248",
    win: slice(traced, 225, 248),
    verdict: "MUST BE ACCEPTED — the round trip closes",
  },
  {
    label: "CURRENT BEAT — the emerge, camera parked",
    src: "desk-doodles-hero-v2.webm f88-108",
    win: slice(heroV2, 88, 108),
    verdict: "MUST BE REJECTED — 'not ugly, just lame'",
    note:
      "Gate 5 reads FAIL here only because this film is a REAL-TIME capture made\n" +
      "  while the 1.1s reveal stall was live (explainer 18): its 0.54s emerge got\n" +
      "  zero rendered frames, so a 0.43s tonal ramp is recorded as one 20-luma\n" +
      "  step. On the seek-based scrub capture the shipped gates pass 7/7 — run\n" +
      "  `node scripts/verify/assert-hero-transition.mjs --label=after`. The\n" +
      "  EXTENT verdict is unaffected and is the one that matters: this beat has\n" +
      "  no moment in either capture. See tools/spacing-emerge.mjs.",
  },
  {
    label: "NEGATIVE CONTROL — mis-registered layer swap (+6 px at the collapse)",
    src: "synthetic",
    win: synth({ shift: 6 }),
    verdict: "MUST BE REJECTED — this is the defect gate 4 was written to catch",
  },
  {
    label: "NEGATIVE CONTROL — layer swap offset VERTICALLY (+6 px at the collapse)",
    src: "synthetic",
    win: synth({ shiftY: 6 }),
    verdict: "MUST BE REJECTED — the axis split must not open a vertical hole",
  },
  {
    label: "NEGATIVE CONTROL — hard cut, 2 blank frames",
    src: "synthetic",
    win: synth({ floor: 0 }),
    verdict: "MUST BE REJECTED — the 0.035 clamp exists so this can never happen",
  },
  {
    label: "NEGATIVE CONTROL — one-frame blink",
    src: "synthetic",
    win: synth({ dwell: 1 }),
    verdict: "MUST BE REJECTED — 33 ms reads as a dropped frame, not a beat",
  },
]

/* -- run -------------------------------------------------------------------- */

/* ROW WORDS, F113 2026-09-22. Most FAIL rows this file printed were the result it
 * exists to show: a known-bad subject rejected, or a retired gate rejecting the
 * flip it was retired for. `failedAtZero` in `scripts/verify/run-battery.mjs`
 * reads any line-start FAIL row at exit 0 as red, so a SOUND run read red and a
 * real red could not be told from the expected ones. A row that fails where
 * failing is the recorded expectation now prints `PASS  KNOWN-BAD ... correctly
 * FAILS`, with the reason. A row that fails where nothing expects it still
 * prints FAIL. The exit code is the truth table's, exactly as before. */
const line = (g, knownBad = null) =>
  g.pass || !knownBad
    ? `  ${g.pass ? "PASS" : "FAIL"}  ${g.id}  ${g.name}\n            ${g.detail}`
    : `  PASS  KNOWN-BAD ${g.id}  ${g.name}  correctly FAILS: ${knownBad}\n            ${g.detail}`
/** Why a FAILED row is expected here, or null when a failure would be real.
 *  `graded` is whether the row is in the §8+hard set the truth table grades. */
const expectedRejection = (want, graded, retiredWhy) =>
  !want ? "this subject must be rejected" : graded ? null : retiredWhy
const table = []

for (const s of SUBJECTS) {
  const st = stats(s.win)
  console.log(`\n${"=".repeat(78)}\n${s.label}\n  ${s.src}   ${s.verdict}\n${"=".repeat(78)}`)
  if (s.note) console.log(`\n  NOTE: ${s.note}`)
  console.log("\n  -- gates AS SHIPPED --")
  const want = s.verdict.startsWith("MUST BE ACCEPTED")
  const oldG = OLD(st)
  const retiredOld = "the shipped gate rejects the flip that has a moment, which is why §8 replaces it"
  oldG.forEach((g) => console.log(line(g, expectedRejection(want, false, retiredOld))))
  console.log("\n  -- gates AS PROPOSED (storyboard §8) --")
  const newG = NEW(st)
  const retired4a = "4a as written in §8 is the clause this run replaced with 4x"
  // newG[0] is 4a, outside the graded set; newG[1..3] are 4x, 5' and 5h.
  newG.forEach((g, i) => console.log(line(g, expectedRejection(want, i > 0, retired4a))))
  if (st.halfAt !== null) {
    console.log(
      `\n  spacing: extent value-half at ${(100 * st.halfAt).toFixed(1)}% of the move   ${spacingBand(st.halfAt)}`,
    )
  }
  table.push({
    label: s.label,
    // §8 as written: 4a (bbox centre) + 5'.
    neu: [newG[0], newG[2]].every((g) => g.pass),
    // §8 with the corrections this run forced: 4x (axis-split) + 5' + 5h.
    hard: [newG[1], newG[2], newG[3]].every((g) => g.pass),
    old: oldG.every((g) => g.pass),
    want,
  })
}

console.log(`\n${"=".repeat(78)}\nTHE FINAL HOLD — does the camera stop?\n${"=".repeat(78)}`)
// The original film is the reference and its hold must stop. The current beat is
// the one that MUST BE REJECTED, so its hold failing is that rejection.
for (const [name, rows, knownBad] of [
  ["ORIGINAL  desk-doodles-traced.webm", traced, null],
  ["CURRENT   desk-doodles-hero-v2.webm", heroV2, "the current beat must be rejected, and its hold does not stop"],
]) {
  console.log(`\n  ${name}`)
  STILL(rows).forEach((g) => console.log(line(g, knownBad)))
}

console.log(`\n${"=".repeat(78)}\nTRUTH TABLE\n${"=".repeat(78)}`)
console.log(
  `\n${"subject".padEnd(56)} ${"shipped".padEnd(8)} ${"§8".padEnd(8)} ${"§8+hard".padEnd(8)} wanted`,
)
let sound = true
for (const r of table) {
  const v = (b) => (b ? "accept" : "REJECT")
  console.log(
    `${r.label.slice(0, 55).padEnd(56)} ${v(r.old).padEnd(8)} ${v(r.neu).padEnd(8)} ${v(r.hard).padEnd(8)} ${v(r.want)}`,
  )
  if (r.hard !== r.want) sound = false
}
console.log(
  `\n${sound ? "SOUND" : "NOT SOUND"} — the §8 gate set (with the hardening clauses) agrees with every wanted verdict.`,
)
process.exit(sound ? 0 : 1)
