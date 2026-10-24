// THE WIND-UP AND THE TURN ARE ONE GESTURE — asserted on the rendered exposure.
//
// THE DEFECT, measured on the shipped model before this lane:
//
//     t 3.500  anticipation  squashY 0.9550   yaw 0.00 deg
//     t 3.533  emerge        squashY 1.0000   yaw 0.00 deg   <- +4.71% in ONE frame
//     t 3.567  emerge        squashY 1.0000   yaw 0.00 deg
//     t 3.600  emerge        squashY 1.0000   yaw 0.35 deg   <- the turn, finally
//
// Confirmed on the capture's own pixels as h 143 -> 149, cy 424.0 -> 421.0. The
// tense snapped back out of a dead hold, and then, two frames later, the turn
// started. A wind-up has to release INTO the thing it winds up for — that is the
// entire reason K2 exists, *"the audience has to know something is about to
// happen before it happens, or the event reads as a glitch"* — and this one
// released into two frames of nothing, which reads as a twitch.
//
// EVERYTHING HERE IS MEASURED ON THE QUANTISED SAMPLE, not on the underlying
// curve. The beat runs on twos wherever the camera is parked, and the emerge is
// parked, so a probe that reads the curve reads a film nobody renders. The first
// version of the probe beside this file read `squashY` off `sampleHeroMotion`
// (quantised) and `yaw` off a second raw-time call to `sampleEmerge`
// (unquantised) — two different films in the same table — and made the release
// look four times finer than it renders.
//
// THE NEGATIVE CONTROL IS `releaseLaw: "prior"`: the whole prior wind-up law,
// verbatim. The rows that describe the change are REQUIRED to fail there. Eight
// instrument bugs have been caught in this beat already; a green row that cannot
// fail is the lie.
//
// Usage: node scripts/verify/assert-hero-windup.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets, quantiseHeroTime } =
  loadTs("lib/hero-motion.ts")

// The settled word, off the `turn3` capture the storyboard measures (§11.1.1).
// Used only to put the two channels in the SAME unit — a squash is a fraction of
// height, a turn is a fraction of width, and "which of these is the bigger event
// on this frame" is not answerable until both are pixels.
const WORD_W = 648
const WORD_H = 158

/**
 * The beat across the wind-up and the turn, one row per OUTPUT frame, tagged
 * with the exposure it resolves to. Consecutive frames that share an exposure
 * are the same picture — on twos most of them are — so every step below is
 * measured between distinct exposures rather than between frames.
 */
function exposures(P) {
  const off = phaseOffsets(P)
  const fps = P.fps
  const from = off.anticipation - 6 / fps
  const to = off.land
  const rows = []
  let lastQ = null
  for (let t = from; t < to; t += 1 / fps) {
    const q = quantiseHeroTime(P, t)
    if (lastQ !== null && Math.abs(q - lastQ) < 1e-9) continue
    lastQ = q
    const s = sampleHeroMotion(P, t)
    rows.push({
      t: q,
      phase: s.phase,
      sx: s.sx,
      squashY: s.squashY,
      squashX: s.squashX,
      yawDeg: (s.yaw * 180) / Math.PI,
      // The two channels as pixels of the settled word.
      hPx: WORD_H * s.squashY,
      wPx: WORD_W * s.sx,
    })
  }
  return rows
}

const REST = 1e-9
const tense = (r) => Math.abs(r.squashY - 1) > REST || Math.abs(r.squashX - 1) > REST
const turning = (r) => r.yawDeg > 1e-6

function claims(P) {
  const rows = exposures(P)
  const off = phaseOffsets(P)
  const inTurn = rows.filter((r) => r.t >= off.emerge - 1e-9)

  /* ---- 1 · OVERLAP. The release and the turn's onset on the same exposure. */
  const overlapping = inTurn.filter((r) => tense(r) && turning(r))

  /* ---- 2 · NO DEAD EXPOSURES BETWEEN THEM. Exposures inside the turn where
     the tense has finished and the turn has not started — the two frames of
     nothing that made the prior law read as a twitch. */
  const dead = inTurn.filter((r) => !tense(r) && !turning(r))

  /* ---- 3 · THE RELEASE ACCELERATES OUT OF THE HOLD. Its first step must be a
     small fraction of its largest; a wind-up that lets go at full speed on the
     first exposure IS the snap, however many exposures follow it.

     THE WINDOW IS FOUND FROM THE HOLD, NOT FROM THE PHASE. The first version of
     this looked for the release inside the `emerge` rows, and on the PRIOR arm
     the snap happens on the boundary itself — so the control measured ZERO
     release steps and the salience row came back green on the very law it
     exists to reject. Anchoring on the last fully-tense exposure catches both. */
  const deepestY = Math.min(...rows.map((r) => r.squashY))
  let holdEnd = -1
  for (let i = 0; i < rows.length; i++) {
    if (Math.abs(rows[i].squashY - deepestY) < 1e-9) holdEnd = i
  }
  const rel = []
  if (holdEnd >= 0) {
    for (let i = holdEnd + 1; i < rows.length; i++) {
      rel.push({
        at: i,
        dH: Math.abs(rows[i].hPx - rows[i - 1].hPx),
        dW: Math.abs(rows[i].wPx - rows[i - 1].wPx),
      })
      if (!tense(rows[i])) break
    }
  }
  const steps = rel.map((r) => r.dH)
  const maxStep = steps.length ? Math.max(...steps) : 0
  const firstStep = steps.length ? steps[0] : 0
  const firstShare = maxStep > 0 ? firstStep / maxStep : 1

  /* ---- 4 · SALIENCE, on the release's BIGGEST exposure. The residual step,
     priced against what the TURN is doing on the same exposure. This is the
     honest form of "the twitch is gone": the prior snap was the only thing
     moving on its frame, which is exactly why it read as an event of its own,
     and the new release's largest step lands where the width is falling off a
     cliff. Measured on the largest step rather than the worst RATIO — a 0.02 px
     step against a still frame is a huge ratio and an invisible event. */
  const worst = rel.length
    ? rel.reduce((a, b) => (b.dH > a.dH ? b : a))
    : { dH: 0, dW: 1 }
  const salience = worst.dH / Math.max(worst.dW, 1e-9)

  /* ---- 5 · CLEAR OF THE MOMENT. Nothing may still be unwinding at the edge. */
  const atEdge = inTurn.filter((r) => r.sx <= P.emerge.edgeFloor + 1e-9)
  const tenseAtEdge = atEdge.some(tense)

  /* ---- 6 · THE TENSE ITSELF SURVIVES. The regression guard: this lane moved
     the squash out of its own phase branch into a law spanning two phases, and
     the depth it reaches must not have changed. */
  const deepest = Math.min(...rows.map((r) => r.squashY))
  const widest = Math.max(...rows.map((r) => r.squashX))

  /* ---- 7 · SPACING, read the way §6.5 reads a transit: the instant at which
     50% of the total change has happened, as a percentage of the transit's own
     duration. Reported for both arms; a one-frame snap also measures
     back-loaded, so this is a SHAPE claim and NOT one the control is required
     to fail. Row 3 is what separates the two laws.

     THE BAR IS 70, NOT 79, AND THE 9 POINTS ARE THE EXPOSURE. The authored curve
     is `t³`, whose value-half is 79.4% — inside §6.5's wind-up band. Rendered on
     the twos grid it reads 77.8%, because the grid puts the crossing on the
     nearest held step rather than where the curve crosses. The bar is set below
     both so it measures the SHAPE rather than the sampling, and well clear of
     the 42–58% crossfade dead band, which is what it exists to catch. */
  const spacingOf = (series) => {
    if (series.length < 2) return 100
    const startH = series[0].hPx
    const total = series[series.length - 1].hPx - startH
    const span = series[series.length - 1].t - series[0].t
    if (Math.abs(total) < 1e-9 || span <= 0) return 100
    for (const r of series) {
      if ((r.hPx - startH) / total >= 0.5) return (100 * (r.t - series[0].t)) / span
    }
    return 100
  }
  const relSeries = rel.length ? [rows[rel[0].at - 1], ...rel.map((r) => rows[r.at])] : []
  const valueHalf = spacingOf(relSeries)
  // KNOWN-BAD INPUT for this row, built from the release's OWN exposures: the
  // same window, same duration, same total change, spaced LINEARLY. A row that
  // has never been shown a shape it rejects is a row nobody has calibrated.
  const linearSeries = relSeries.map((r, i) => ({
    t: r.t,
    hPx:
      relSeries[0].hPx +
      ((relSeries[relSeries.length - 1].hPx - relSeries[0].hPx) * i) / (relSeries.length - 1 || 1),
  }))
  const linearHalf = spacingOf(linearSeries)

  return {
    rows,
    linearHalf,
    claims: [
      {
        key: "overlap",
        name: "the tense is STILL LETTING GO while the mark is turning",
        pass: overlapping.length >= 2,
        detail:
          `${overlapping.length} rendered exposures carry both a live squash and a departed yaw ` +
          `(needs >= 2)` +
          (overlapping.length
            ? ` — e.g. squashY ${overlapping[0].squashY.toFixed(4)} at yaw ${overlapping[0].yawDeg.toFixed(2)} deg`
            : ""),
      },
      {
        key: "nogap",
        name: "no DEAD exposure between the wind-up and the turn",
        pass: dead.length === 0,
        detail:
          `${dead.length} exposures inside the turn where the tense is over and the yaw has not moved ` +
          `(needs 0; the prior law leaves the beat sitting still between its own wind-up and its own event)`,
      },
      {
        key: "accel",
        name: "the release ACCELERATES out of the hold — it does not leave at full speed",
        pass: steps.length >= 3 && firstShare <= 0.15,
        detail:
          `${steps.length} exposures of release, steps ` +
          steps.map((s) => s.toFixed(2)).join(" -> ") +
          ` px of height; first step is ${(100 * firstShare).toFixed(1)}% of the largest ` +
          `(needs >= 3 exposures and <= 15%)`,
      },
      {
        key: "salience",
        name: "the release's biggest step is SMALL against what the turn is doing on the same exposure",
        pass: salience <= 0.25,
        detail:
          `biggest release exposure: height moves ${worst.dH.toFixed(2)} px while width moves ` +
          `${worst.dW.toFixed(2)} px = ` +
          (worst.dW < 0.01
            ? "INFINITE — nothing else on screen moved"
            : `${(100 * salience).toFixed(1)}%`) +
          ` (needs <= 25%). A step out of stillness reads as a pop; the same step inside a bigger ` +
          `move reads as speed`,
      },
      {
        key: "clear",
        name: "nothing is still unwinding AT THE EDGE",
        pass: !tenseAtEdge,
        detail:
          `${atEdge.length} exposures at the edge floor, tense on ${atEdge.filter(tense).length} of them ` +
          `(needs 0 — the moment has to be the only thing on screen)`,
      },
      {
        key: "depth",
        name: "the tense still reaches its authored depth",
        pass:
          Math.abs(deepest - P.anticipation.scaleY) < 1e-6 &&
          Math.abs(widest - P.anticipation.scaleX) < 1e-6,
        detail:
          `deepest squashY ${deepest.toFixed(4)} against the dial's ${P.anticipation.scaleY}, ` +
          `widest squashX ${widest.toFixed(4)} against ${P.anticipation.scaleX}`,
      },
      {
        key: "spacing",
        name: "the release is BACK-LOADED, like a wind-up and not like a crossfade",
        pass: valueHalf >= 70,
        detail:
          `value-half at ${valueHalf.toFixed(1)}% of the release, authored at 79.4% (t³) and read ` +
          `1.6 points low by the twos grid. Needs >= 70%; 42-58% is §6.5's crossfade dead band, ` +
          `and a LINEAR release across the same window measures ${linearHalf.toFixed(1)}%`,
      },
    ],
  }
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
const run = claims(P)
console.log(
  `THE WIND-UP — releaseLaw "${P.releaseLaw}", release ${P.anticipation.releaseSec}s, ` +
    `exposure "${P.cadence}" at ${P.cadenceHz}Hz\n`,
)
console.log("  t       phase          squashY   height    yaw deg    width")
for (const r of run.rows) {
  console.log(
    `  ${r.t.toFixed(3)}   ${r.phase.padEnd(13)}  ${r.squashY.toFixed(4)}   ` +
      `${r.hPx.toFixed(1).padStart(6)}   ${r.yawDeg.toFixed(2).padStart(6)}   ${r.wPx.toFixed(1).padStart(6)}`,
  )
}
console.log("")
const shipped = run.claims
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

/* ---- the control ---------------------------------------------------------- */
const CONTROL = { ...P, releaseLaw: "prior" }
const got = claims(CONTROL).claims
// `spacing` is a shape claim, not a discriminator: a one-frame snap also
// measures back-loaded. Stated rather than quietly excluded.
const SHAPE = new Set(["spacing", "depth", "clear"])
console.log(`\nNEGATIVE CONTROL — releaseLaw "prior": compress, hold to the phase end, then snap`)
let blind = false
for (const c of got) {
  const discriminating = !SHAPE.has(c.key)
  if (discriminating && c.pass) blind = true
  console.log(
    `  ${c.pass ? (discriminating ? "PASS <- WRONG" : "passes (shape row)") : "fails, correctly"}  ${c.name}\n        ${c.detail}`,
  )
}

/* ---- the clamp is not decoration ------------------------------------------
 * `releaseSec` is a slider, so the dial can be dragged past the half-turn. The
 * clamp is what stops a tense still unwinding through the edge, and a clamp
 * nobody drove is a clamp nobody has. */
const OVERRUN = {
  ...P,
  anticipation: { ...P.anticipation, releaseSec: 2.0 },
}
const overrun = claims(OVERRUN).claims.find((c) => c.key === "clear")
console.log(
  `\nCLAMP MUTATION — releaseSec dragged to 2.0s, far past the half-turn` +
    `\n  ${overrun.pass ? "held, correctly" : "LEAKED"}  ${overrun.name}\n        ${overrun.detail}`,
)

// The spacing row's own known-bad input, printed so the bar is visible rather
// than asserted. A row that only ever sees the shape it was written for is a row
// that cannot fail.
const spacingBlind = run.linearHalf >= 70
console.log(
  `\nSPACING CALIBRATION — the same window, same duration, same change, spaced LINEARLY` +
    `\n  ${spacingBlind ? "PASSES <- WRONG" : "rejected, correctly"}  value-half ${run.linearHalf.toFixed(1)}% against the 70% bar`,
)

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} rows hold on the shipped wind-up.`)
console.log(
  `${got.filter((c) => !c.pass).length}/${[...got].filter((c) => !SHAPE.has(c.key)).length} discriminating rows correctly FAIL on the prior law.`,
)
if (blind) console.log(`\nINSTRUMENT IS BLIND — the prior law passed a row it cannot honestly pass.`)
if (spacingBlind) console.log(`\nINSTRUMENT IS BLIND — the spacing row accepts a linear release.`)
const bad = failed.length || blind || !overrun.pass || spacingBlind
console.log(bad ? "\nNOT SOUND" : "\nSOUND")
process.exit(bad ? 1 : 0)
