// MEASURE-DRAWIN-PACING — what the hero beat's draw-in does, against what the
// app's own reveal does, as numbers rather than as an opinion.
//
// Sebs: "the drawing in animation is god awful for 2D — we have such a
// beautiful system that draws them in 3D in the free stroke app", and "the
// fucking drawing is fast and janky". FAST and JANKY are two different faults
// and only one of them is in this file: this one measures PACING, in plain
// node, off the real modules. Frame delivery is measured on the real page by
// `measure-drawin-frames.mjs`, because a stall has no representation here.
//
// NOTHING IN HERE TOUCHES A BROWSER. Every number is produced by the same
// functions the page calls: `lib/stroke-processing.ts` builds the strokes,
// `lib/pen-reveal.ts` answers "how far has the pen got", `lib/hero-motion.ts`
// answers "what time is it".
//
// CALIBRATION. Run with `--control` to feed the same instrument a word whose
// timestamps are perfectly uniform in ARC LENGTH — a pen that never varied its
// speed. Every timing-character number must collapse to ~0 there. A reading
// that survives the control is measuring something other than pen timing.
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes, rawHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const {
  penTimeDistanceFraction,
  measureTimingCharacter,
  measurePenRecord,
  revealDistanceFraction,
} = loadTs("lib/pen-reveal.ts")
const { DEFAULT_HERO_MOTION, drawEase } = loadTs("lib/hero-motion.ts")

const CONTROL = process.argv.includes("--control")
/** Which pen clock to measure. `--clock=uniform` is the PARKED PRIOR — the flat
 *  12 ms/point stamp — and is the second, structural negative control: it must
 *  reproduce the before-numbers quoted in lib/pen-reveal.ts. */
const CLOCK = (process.argv.find((a) => a.startsWith("--clock=")) ?? "--clock=lognormal").split("=")[1]

/* ---------------------------------------------------------------- */
/*  The control: a hand that never changed speed.                    */
/*                                                                   */
/*  Re-stamps every processed point so that t advances in exact       */
/*  proportion to arc length, across the WHOLE word — no in-air gaps, */
/*  no acceleration. penTimeDistanceFraction(u) must then equal u.    */
/* ---------------------------------------------------------------- */
function uniformSpeedControl(strokes) {
  let total = 0
  for (const s of strokes) {
    for (let i = 1; i < s.points.length; i++) {
      total += Math.hypot(
        s.points[i].x - s.points[i - 1].x,
        s.points[i].y - s.points[i - 1].y,
      )
    }
  }
  const SPAN_MS = 14000
  let acc = 0
  return strokes.map((s) => ({
    ...s,
    points: s.points.map((p, i) => {
      if (i > 0) {
        acc += Math.hypot(p.x - s.points[i - 1].x, p.y - s.points[i - 1].y)
      }
      return { ...p, t: (acc / total) * SPAN_MS }
    }),
  }))
}

const rawStrokes = rawHeroStrokes(CLOCK)
const base = processedHeroStrokes(undefined, CLOCK)
const strokes = CONTROL ? uniformSpeedControl(base) : base
const noHandFeel = processedHeroStrokes({ wobble: 0, endpoint: "clean" }, CLOCK)

const n = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "—")
const rows = []
const fail = []

console.log(`\n=== DRAW-IN PACING ${CONTROL ? "— UNIFORM-SPEED CONTROL" : ""} ===\n`)

/* ---- 1. What the recording says --------------------------------- */
const rec = measurePenRecord(strokes)
const recRaw = measurePenRecord(
  rawStrokes.map((s) => ({ points: s.points, cornerCount: 0 })),
)
console.log("1 · THE RECORDING")
console.log(`   strokes                    ${rec.strokes}`)
console.log(`   points (processed)         ${strokes.reduce((a, s) => a + s.points.length, 0)}`)
console.log(`   recorded duration          ${n(rec.durationSec)} s   (raw, pre-processing ${n(recRaw.durationSec)} s)`)
console.log(`   pen in the air             ${n(rec.airSec)} s  = ${n((100 * rec.airSec) / rec.durationSec, 1)} % of the record`)
console.log(`   clock                      ${CLOCK}`)
console.log(`   total pen travel           ${n(rec.totalLength, 1)} stroke units`)
console.log(`   mean speed, pen down       ${n(rec.meanSpeedDown, 1)} units/s`)

/* ---- 1b. IS THE PEN MOVING AT A CONSTANT SPEED ACROSS THE WORD? -----------
 *
 * THE SINGLE MOST DIAGNOSTIC NUMBER IN THIS FILE.
 *
 * `docs/research/handwriting-variability.md` §2, restated in
 * `lib/pen-kinematics.ts`: the active duration of one lognormal is
 * `T = 2 e^mu sinh(3 sigma)` and "depends only on the WRITER's mu and sigma,
 * not on the amplitude — which is the model saying that a bigger stroke is
 * executed FASTER rather than for LONGER."
 *
 * So a real hand's stroke duration tracks the number of ballistic
 * sub-movements, NOT the stroke's length. A machine's tracks length exactly.
 * Pearson r between per-stroke duration and per-stroke arc length therefore
 * separates the two, and 1.000 is the machine.
 */
function pearson(xs, ys) {
  const k = xs.length
  if (k < 3) return NaN
  const mx = xs.reduce((a, b) => a + b, 0) / k
  const my = ys.reduce((a, b) => a + b, 0) / k
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < k; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN
}
const perStroke = strokes
  .filter((s) => s.points.length >= 2)
  .map((s) => {
    const pts = s.points
    let len = 0
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    return { len, dur: (pts[pts.length - 1].t - pts[0].t) / 1000 }
  })
const rLenDur = pearson(
  perStroke.map((s) => s.len),
  perStroke.map((s) => s.dur),
)
const speeds = perStroke.filter((s) => s.dur > 0).map((s) => s.len / s.dur)
const spdMin = Math.min(...speeds)
const spdMax = Math.max(...speeds)
console.log("\n1b · IS THE PEN AT A CONSTANT SPEED ACROSS THE WORD?")
console.log(`   r(stroke length, stroke duration)   ${n(rLenDur, 4)}   (1.0000 = a machine)`)
console.log(`   per-stroke speed spread             ${n(spdMin, 1)} … ${n(spdMax, 1)} units/s  (×${n(spdMax / spdMin, 2)})`)
console.log(`   the model's claim: duration is set by mu/sigma, not by length —`)
console.log(`   so a real hand's r is well below 1 and its speed spread is wide.`)
rows.push({
  id: "not-a-machine",
  what: "stroke duration is NOT a pure function of stroke length (r < 0.98)",
  got: `r = ${n(rLenDur, 4)}`,
  ok: rLenDur < 0.98,
})
rows.push({
  id: "speed-spread",
  what: "the fastest stroke is at least 1.6× the slowest",
  got: `×${n(spdMax / spdMin, 2)}`,
  ok: spdMax / spdMin >= 1.6,
})

// REPORTED, NOT ASSERTED. `handwriting-variability.md` §3 gives K_t = 0.06 s
// as the value at which "the superposition of the strokes is lost", but K_t is
// the INTER-COMPONENT onset inside one continuous movement — which the model
// already owns via `interOnset` — and not the pen-UP gap between two separate
// acts of the hand. Asserting the hero's 60 ms pen-lift against it would be
// citing a number for something it does not measure. The figure is printed
// because it is the only inter-stroke timing the page authors, and a reader
// should see it; it is not scored.
console.log(`   pen-up gaps                          ${rec.strokes - 1} lifts, ${n(rec.airSec)} s total`)

/* ---- 2. Timing character ---------------------------------------- */
const tcRaw = measureTimingCharacter(
  rawStrokes.map((s) => ({ points: s.points, cornerCount: 0 })),
)
const tcNoHF = measureTimingCharacter(noHandFeel)
const tc = measureTimingCharacter(strokes)
console.log("\n2 · TIMING CHARACTER  (max |pen distance − constant speed|, as a fraction of the word)")
console.log(`   raw synthesised t          ${n(tcRaw.maxDeviation * 100, 2)} %`)
console.log(`   processed, hand-feel OFF   ${n(tcNoHF.maxDeviation * 100, 2)} %   (no Sigma-Lognormal retime)`)
console.log(`   processed, AS SHIPPED      ${n(tc.maxDeviation * 100, 2)} %   present=${tc.present}`)
console.log(`   threshold for the toggle to render differently at all: 1.00 %`)

rows.push({
  id: "character-present",
  what: "the shipped hero word has timing character the Natural/Authentic toggle can express",
  got: `${n(tc.maxDeviation * 100, 2)} %`,
  ok: tc.present,
})
/* THE STRUCTURAL NEGATIVE CONTROL: the same word on the PARKED clock.
 *
 * `--clock=uniform` is the flat 12 ms/point stamp this page shipped until
 * 2026-07-31. Running it here, in the same process, means the "before" number
 * is re-measured every run rather than quoted from a comment that can rot — and
 * it is what makes the improvement a comparison instead of a claim. */
const tcPrior = measureTimingCharacter(processedHeroStrokes(undefined, "uniform"))
console.log(`   the PARKED uniform clock   ${n(tcPrior.maxDeviation * 100, 2)} %   (12 ms/point, the prior ship)`)
rows.push({
  id: "clock-earns-it",
  what: "the Sigma-Lognormal clock carries at least twice the character of the parked uniform one",
  got: `${n(tc.maxDeviation * 100, 2)} % vs ${n(tcPrior.maxDeviation * 100, 2)} %`,
  ok: CLOCK === "uniform" ? true : tc.maxDeviation > tcPrior.maxDeviation * 2,
})

/* ---- 3. The two clocks ------------------------------------------ */
const drawSec = DEFAULT_HERO_MOTION.beats.draw
const blend = DEFAULT_HERO_MOTION.drawLinearBlend
console.log("\n3 · THE TWO CLOCKS")
console.log(`   the app's own Play         ${n(rec.durationSec)} s   (playhead = wall clock / recorded duration)`)
console.log(`   the hero beat's draw       ${n(drawSec)} s   (playhead = drawEase(u, ${blend}))`)
console.log(`   compression                ${n(rec.durationSec / drawSec, 2)}×  faster than the pen`)
console.log(`   mean rendered pen speed    ${n(rec.totalLength / drawSec, 1)} units/s on the hero`)
console.log(`                              ${n(rec.meanSpeedDown, 1)} units/s in the record`)

/* HOW FAST IS TOO FAST — and the number is SOURCED, not picked.
 *
 * `docs/research/handwriting-variability.md` §3, from Djioua & Plamondon's
 * parameter-extraction report: "Movement time is typically **100–500 ms**, with
 * the velocity peak about 100 ms after t0." Below that band a stroke is no
 * longer a ballistic hand movement — there is no hand that produces one.
 *
 * So the criterion is not "how many times faster than the recording", which is
 * a taste call nobody has measured; it is: DOES THE SHORTEST STROKE STILL TAKE
 * AS LONG AS THE SHORTEST REAL HAND MOVEMENT. That is checkable, it is
 * somebody else's number, and it converts straight into the beat length the
 * timeline would have to give the draw.
 */
const HUMAN_MIN_STROKE_SEC = 0.1
const compression = rec.durationSec / drawSec
const strokeDurs = perStroke.map((s) => s.dur).filter((d) => d > 0).sort((a, b) => a - b)
const shortestSec = strokeDurs[0] ?? 0
const medianSec = strokeDurs[Math.floor(strokeDurs.length / 2)] ?? 0
const shortestOnScreen = shortestSec / compression
const medianOnScreen = medianSec / compression
console.log(`   shortest stroke              ${n(shortestSec)} s recorded → ${n(shortestOnScreen * 1000, 1)} ms on screen`)
console.log(`   median stroke                ${n(medianSec)} s recorded → ${n(medianOnScreen * 1000, 1)} ms on screen`)
console.log(`   the literature's floor for a real hand movement: ${HUMAN_MIN_STROKE_SEC * 1000} ms`)
console.log(`   draw beat that would clear it, SHORTEST stroke:  ${n(rec.durationSec * (HUMAN_MIN_STROKE_SEC / shortestSec))} s`)
console.log(`   draw beat that would clear it, MEDIAN stroke:    ${n(rec.durationSec * (HUMAN_MIN_STROKE_SEC / medianSec))} s`)
rows.push({
  id: "human-speed",
  what: `the shortest stroke still takes >= ${HUMAN_MIN_STROKE_SEC * 1000} ms on screen (research §3's movement-time floor)`,
  got: `${n(shortestOnScreen * 1000, 1)} ms at ${n(compression, 2)}× compression`,
  ok: shortestOnScreen >= HUMAN_MIN_STROKE_SEC,
})

/* ---- 4. Do the three reveal modes actually LOOK different? ---------------
 *
 * The claim the product makes is that Authentic replays the speed the mark was
 * drawn at. The test is not "is the number non-zero" but "is the pen tip in a
 * DIFFERENT PLACE than a constant-speed sweep would put it, by enough to see".
 *
 * The threshold is the repo's own and is not invented here:
 * `TIMING_CHARACTER_THRESHOLD = 0.01` — "below this, Natural and Authentic
 * differ by less than a pixel on screen" (lib/pen-reveal.ts, ported from
 * components/viewport-3d.tsx:2238). Reported in ink diameters as well, because
 * a fraction of total travel is not a quantity anybody can picture.
 */
const HYBRID_BLEND = 0.4 // components/viewport-3d.tsx:3706 — the shipped default
const inkDia = 22 // lib/flat-ink.ts:59, INK_DIAMETER_IN_STROKE_SPACE
console.log("\n4 · DO THE THREE REVEAL MODES LOOK DIFFERENT?")
console.log("    playhead   AUTHENTIC(raw)   NATURAL(hybrid .4)   SMOOTH(=playhead)")
let maxRawGap = 0
let maxHybGap = 0
for (let i = 1; i < 40; i++) {
  const e = i / 40
  const raw = revealDistanceFraction(strokes, e, "raw", HYBRID_BLEND)
  const hy = revealDistanceFraction(strokes, e, "hybrid", HYBRID_BLEND)
  if (Math.abs(raw - e) > maxRawGap) maxRawGap = Math.abs(raw - e)
  if (Math.abs(hy - e) > maxHybGap) maxHybGap = Math.abs(hy - e)
  if (i % 6 === 0) {
    console.log(`   ${e.toFixed(3)}      ${n(raw)}            ${n(hy)}                ${n(e)}`)
  }
}
const toInk = (frac) => (frac * rec.totalLength) / inkDia
console.log(`   AUTHENTIC vs SMOOTH, peak lead/lag  ${n(maxRawGap * 100, 2)} %  =  ${n(toInk(maxRawGap), 1)} ink diameters`)
console.log(`   NATURAL   vs SMOOTH, peak lead/lag  ${n(maxHybGap * 100, 2)} %  =  ${n(toInk(maxHybGap), 1)} ink diameters`)
rows.push({
  id: "authentic-visible",
  what: "AUTHENTIC is distinguishable from SMOOTH above the repo's own 1% threshold",
  got: `${n(maxRawGap * 100, 2)} % (${n(toInk(maxRawGap), 1)} ink diameters)`,
  ok: maxRawGap >= 0.01,
})
rows.push({
  id: "natural-visible",
  what: "NATURAL is distinguishable from SMOOTH above the same threshold",
  got: `${n(maxHybGap * 100, 2)} % (${n(toInk(maxHybGap), 1)} ink diameters)`,
  ok: maxHybGap >= 0.01,
})

/* ---- 4b. What drawEase does on top --------------------------------------
 * `drawEase(t, 0.45)` = 0.45·t + 0.55·easeInOutSine(t) — a SECOND blend toward
 * constant speed, applied to the playhead before the pen map ever sees it. Two
 * blends toward the same place compose, and the panel exposes only one of them.
 */
console.log("\n4b · drawEase ON TOP OF THE PEN MAP")
let maxEase = 0
for (let i = 1; i < 40; i++) {
  const u = i / 40
  const d = Math.abs(drawEase(u, blend) - u)
  if (d > maxEase) maxEase = d
}
console.log(`   drawEase(blend=${blend}) departs from linear time by up to ${n(maxEase * 100, 2)} %`)
console.log(`   it is a SEPARATE, second easing of the same axis the pen map drives.`)

/* ---- 5. Per-stroke pacing --------------------------------------- */
// The lognormal says a stroke accelerates, peaks early and decelerates. If the
// draw-in is a constant-speed sweep this is flat.
//
// SCORED ONLY ON STROKES LONG ENOUGH TO HAVE A BELL. A lognormal sampled at
// five points has no shape to measure — the model's own `reconstructPenKinematics`
// refuses anything under three points for the same reason. Ten points on a 4 px
// grid is 40 px of travel, about two ink diameters, which is the shortest mark
// where "it accelerated and then slowed" is a statement about the render rather
// than about the sampling. The excluded strokes are counted, not hidden.
console.log("\n5 · WITHIN ONE STROKE — is there a velocity bell?")
const BELL_MIN_POINTS = 10
let worst = { i: -1, ratio: Infinity }
let bells = 0
let scored = 0
let tooShort = 0
for (let si = 0; si < strokes.length; si++) {
  const pts = strokes[si].points
  if (pts.length < BELL_MIN_POINTS) {
    tooShort++
    continue
  }
  scored++
  let peak = 0
  let sum = 0
  let cnt = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    const dt = pts[i].t - pts[i - 1].t
    if (!(dt > 0)) continue
    const v = d / dt
    if (v > peak) peak = v
    sum += v
    cnt++
  }
  if (!cnt) continue
  const ratio = peak / (sum / cnt)
  if (ratio > 1.25) bells++
  if (ratio < worst.ratio) worst = { i: si, ratio }
}
/* ⚠ LOCATED, NOT GUESSED — why the flat ones are flat.
 *
 * The strokes that come out at peak/mean EXACTLY 1.000 are the ones whose RDP
 * reduction leaves few anchors (measured: 1,2,5,6,8,11,15,17,19,21 — nine of
 * them have 3–6 raw points and reduce to a single Sigma-Lognormal component).
 * `handFeelPass` in `lib/stroke-processing.ts` carries `t` across the wobble
 * pass "by ARC-LENGTH FRACTION", and the final `resampleStroke` then
 * interpolates `t` LINEARLY inside each anchor span. With two spans there is
 * nothing left of the lognormal but its endpoints, so the reconstructed
 * velocity profile is erased and the pen crosses that stroke at one speed.
 *
 * The long strokes keep theirs (0 → 2.604, 10 → 2.514, 4 → 2.197), which is
 * what makes this a resolution limit of the carry-over rather than a failure of
 * the model: it computed the same bell for every stroke.
 *
 * NOT FIXED HERE, and deliberately. `lib/stroke-processing.ts` is a shared
 * module whose consumers include the live drawing canvas, where `t` is REAL
 * recorded input and must not be re-derived. This assertion is left FAILING so
 * it cannot be forgotten. */
console.log(`   strokes with a real velocity peak (peak/mean > 1.25): ${bells} of ${scored} scored`)
console.log(`   (${tooShort} strokes under ${BELL_MIN_POINTS} points are not scorable and are excluded)`)
console.log(`   flattest scored stroke: #${worst.i} at peak/mean ${n(worst.ratio)}`)
rows.push({
  id: "velocity-bell",
  what: "most scorable strokes carry a lognormal velocity peak rather than a flat sweep",
  got: `${bells}/${scored}`,
  ok: scored > 0 && bells >= scored * 0.6,
})

/* ---- 6. What the MODEL says this word's own duration is ------------------
 *
 * The page synthesises `t` at a flat 12 ms per point. The Sigma-Lognormal
 * reconstruction that already runs over these strokes computes a real duration
 * for each one — `stats.durationSec`, the span of that stroke's own action
 * plan — and the pipeline then THROWS IT AWAY, because
 * `PenKinematicsSettings.retime` "preserves the stroke's own first/last
 * timestamps exactly — only the distribution WITHIN a stroke changes".
 *
 * That preservation is what pins r(length, duration) at 1.0 in §1b: the model
 * is allowed to say when the pen was fast inside a stroke and forbidden to say
 * that one stroke took longer than another. This section prints the answer it
 * was not allowed to give.
 */
const { reconstructPenKinematics, drawHandState } = loadTs("lib/pen-kinematics.ts")
const hand = drawHandState()
let modelTotal = 0
let modelStrokes = 0
let modelMin = Infinity
let modelMax = 0
const modelDurs = []
const modelLens = []
for (const s of base) {
  const pts = s.points.map((p) => [p.x, p.y])
  const res = reconstructPenKinematics(pts, {
    hand,
    nibDiameter: HERO_INK_WIDTH_PX,
    coarticulation: 0.35,
    inkModulation: 0.3,
  })
  if (!res) continue
  modelStrokes++
  modelTotal += res.stats.durationSec
  if (res.stats.durationSec < modelMin) modelMin = res.stats.durationSec
  if (res.stats.durationSec > modelMax) modelMax = res.stats.durationSec
  let len = 0
  for (let i = 1; i < s.points.length; i++) {
    len += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
  }
  modelDurs.push(res.stats.durationSec)
  modelLens.push(len)
}
const rModel = pearson(modelLens, modelDurs)
console.log("\n6 · THE DURATION THE MODEL ITSELF COMPUTES, AND THE PIPELINE DISCARDS")
console.log(`   strokes the model could describe    ${modelStrokes} of ${base.length}`)
console.log(`   sum of the model's own durations    ${n(modelTotal)} s   (pen down only)`)
console.log(`   per stroke                          ${n(modelMin)} … ${n(modelMax)} s`)
console.log(`   r(stroke length, MODEL duration)    ${n(rModel, 4)}   vs ${n(rLenDur, 4)} as shipped`)
console.log(`   the page instead stamps 12 ms/point, which is ${n(rec.durationSec)} s and r = ${n(rLenDur, 4)}.`)

/* ---- verdict ---------------------------------------------------- */
console.log("\n=== ASSERTIONS ===")
for (const r of rows) {
  const tag = r.ok ? "PASS" : "FAIL"
  if (!r.ok) fail.push(r.id)
  console.log(`${tag}  ${r.what}\n      ${r.got}`)
}

if (CONTROL) {
  // On the control the pen never varied its speed, so EVERY character-derived
  // row must fail. A control that comes back clean means the instrument is
  // blind and none of the readings above are evidence.
  const mustFail = ["character-present", "clock-earns-it", "authentic-visible", "natural-visible", "velocity-bell"]
  const stillPassing = mustFail.filter((id) => rows.find((r) => r.id === id)?.ok)
  console.log(`\n=== CONTROL ===`)
  if (stillPassing.length) {
    console.log(`UNSOUND — these rows passed on a pen with NO speed variation: ${stillPassing.join(", ")}`)
    process.exit(1)
  }
  console.log(`SOUND — all ${mustFail.length} character rows correctly FAIL on a constant-speed pen.`)
  process.exit(0)
}

console.log(`\n${rows.length - fail.length}/${rows.length} pass` + (fail.length ? `  — failing: ${fail.join(", ")}` : ""))
process.exit(fail.length ? 1 : 0)
