// Motion program for the Desk Doodles logo hero beat — the CAPTURE side.
//
// ⚠️ THIS FILE IS DOWNSTREAM, AND THAT IS THE DESIGN.
//
// `lib/hero-motion.ts` is the one owner of this choreography. It is what the
// live page samples, what the timeline dock retimes, and what every assertion
// under `scripts/verify/assert-hero-*.mjs` reads. This file exists because the
// capture is plain ESM run by node with no build step and cannot import
// TypeScript — so the transfer is an explicit, mechanical paste rather than a
// pretend-automatic import: `/desk-doodles` → "Copy motion.mjs constants" →
// replace the CONSTANTS block below → re-capture.
//
// WHY IT WAS REGENERATED (hero-beat-storyboard §10.5 call 4, item 4). The
// previous version carried two rationales that 114 seconds of reference film
// disproves, and a doc's own instruction not to leave them: *"A zero-consumer
// file that states the beat's design goal is exactly how a falsified rationale
// survives another pass."* Both are corrected in place below rather than
// deleted quietly, so the next reader can see what changed and why:
//
//   ✗ `breath: 0.5, // beat of stillness before the move ("cuts land on
//     motion")`. The rule is FALSE. Of the hard cuts in the reference set, five
//     of Exquisite Corpse's eight measurable ones leave a still or near-still
//     frame, and the most important cut in the whole set — into the film's
//     payoff — leaves a shot frozen for 4.29s and arrives on FOURTEEN
//     consecutive frames at a frame-to-frame difference of exactly 0.000
//     (`docs/research/reference-film-mechanics.md` §2.2). The corrected rule
//     points the other way — **an accent is bought with a hold, not with a
//     move** — so `breath` is not a throat-clear to cut out of, it is the
//     device that buys the moment, and it is now the beat's LONGEST hold
//     instead of its shortest.
//
//   ✗ `PUSH_SCALE_END = 1.01`, commented *"the frame is 'never static, never
//     frantic' (§1)"*. That is the Ken-Burns claim and there is no Ken-Burns
//     anywhere in any of the three reference films: of the six still passages
//     the mechanics doc names, three have per-frame translation columns that
//     are EXACTLY ZERO on every frame and the other three carry one or two
//     nonzero frames out of 104, 199 and 235 — isolated spikes, never a
//     sustained series (§2.1). The dial had no consumer that rendered, on
//     either side, so it is GONE rather than parked: there is no behaviour to
//     keep reachable, only an instruction to the next person to wire a claim
//     that is not true.
//
// AND THE ORDER OF THE BEAT CHANGED UNDERNEATH IT, TWICE. `anticipation` now
// precedes `emerge` (a wind-up after the event is a hiccup), and the beat now
// makes a ROUND TRIP — `land`, `solid`, `descend`, `returnTurn` are new. The
// old `crossfade` beat is `emerge`, because "crossfade" was itself the bug: a
// crossfade is two images swapping, which is the one thing this beat must never
// read as. `CROSSFADE` is kept below as an alias so an old paste target still
// resolves.
//
// ── REGENERATED AGAIN, 2026-08-01, AND THE SECOND HALF IS THE POINT ─────────
//
// ⚠ THE SENTENCES ABOVE ARE STILL TRUE AND ARE LEFT STANDING. What was NOT
// true is the storyboard's own §11.4.5 line — *"`motion.mjs` still carries the
// falsified rationale"* — which was already closed by the regeneration recorded
// in §11.7.5. Re-read first-hand before this pass: the falsified lines are here
// as struck ✗ history, `breath` reads 1.1, and `PUSH_SCALE_END` is not
// exported. That defect was fixed; it was the CONSTANTS that had gone stale
// again, which is a different defect and the one this pass closes.
//
//   ⚠ `draw: 2.1333` — the ledger's trim, given back. The re-cut puts the
//     draw-in at **4.6667s / 140 frames** (Sebs: *"the fucking drawing is fast
//     and janky"*), which moves the whole beat from 9.833s to **12.3667s /
//     371 frames**. A capture driven off 2.1333 films a draw-in nobody has
//     shipped since.
//   ⚠ `tilt: 0.7` — now **0.4333**. The lie-down hands the camera to the rise
//     instead of arriving in front of it, so it is shorter as well as differently
//     shaped.
//   ⚠ `DRAW_LINEAR_BLEND = 0.45` — now **1**. The sine cushion was a SECOND
//     touch-down stacked on the pen's own recorded one, 5.79% against a signal
//     of 8.46%. See `drawLinearBlend` in lib/hero-motion.ts; 0.45 is the read to
//     type back if `revealMode: "smooth"` ever becomes the default, because that
//     pill bypasses the pen record entirely.
//   ⚠ FIVE CONSTANTS WERE MISSING OUTRIGHT, and each one is a law the program
//     below was silently not obeying: `RELEASE_LAW`, `RISE_OVERSHOOT`,
//     `ANTICIPATION.releaseSec`, `TILT_LAW` / `DESCEND_LAW` / `MOVE_ACCEL_FRAC`.
//     `toMotionMjsSource()` emits all of them and had done for a cycle; the
//     paste had simply not been made. **A constant that names a law the program
//     ignores is the same defect as a rationale that is false** — it states an
//     intent nothing implements — so `cameraProgram()` below was rewired to read
//     them rather than the block being pasted over an unchanged program.
//
// AND THE PROGRAM IS NOW CHECKABLE, which it was not. `cameraProgram()`'s
// per-phase poses are asserted equal to `sampleHeroMotion()`'s camera channels
// at the same phase-local u — see the PARITY note above `cameraProgram()`.

/* -------------------------------------------------------------------------- */
/*  CONSTANTS — generated by toMotionMjsSource(). Replace this whole block.     */
/* -------------------------------------------------------------------------- */

export const FPS = 30

// THE PHASE ORDER IS PART OF THE PROGRAM, not a formatting choice. It is
// `HERO_PHASES` in lib/hero-motion.ts and the sampler walks it in this
// sequence; a paste that reorders these keys is a paste that changes the beat.
export const PHASES = ["draw", "breath", "anticipation", "emerge", "land", "solid", "tilt", "standup", "orbit", "descend", "returnTurn", "hold"]

export const BEATS = {
  draw: 4.6667,
  breath: 1.1,
  anticipation: 0.3,
  emerge: 0.9167,
  land: 0.3,
  solid: 0.6,
  tilt: 0.4333,
  standup: 1.4,
  orbit: 0.9333,
  descend: 0.4333,
  returnTurn: 0.9167,
  hold: 0.3667,
}

export const LIE_EL = 65
export const STANDUP_AZ = 30
export const STANDUP_EL = 10
export const HOLD_AZ = 38
export const HOLD_EL = 10

export const FILL_LIE = 1
export const FILL_STAND = 0.86
export const FILL_HOLD = 0.8

export const BACK_C1 = 1.7016
// The rise's overshoot is the RISE'S. It used to be read off the ink's swell
// dial, which under the turn does not exist at all — see `riseOvershoot`.
export const RISE_OVERSHOOT = 0.1
export const RISE_CURVE = "riseOut"
export const RISE_GATHER_FRAC = 0.14
export const RISE_GATHER_DEPTH = 0.1
export const CAMERA_PARK = "parked"
export const DRIFT_CUT = 0.7

// THE TWO CAMERA TRANSITS. `TILT_LAW` decides whether the lie-down arrives at
// rest (prior, a 0.8 -> 84.0 deg/s hitch into the rise) or hands over at the
// gather's own speed; `DESCEND_LAW` whether the return move leaves the hold at
// full speed (prior, 0 -> 375.9 deg/s in one frame) or accelerates into it.
// `MOVE_ACCEL_FRAC` is Babbu's measured 4-of-21 (mechanics §6.2).
export const TILT_LAW = "handover"
export const DESCEND_LAW = "accelerated"
export const MOVE_ACCEL_FRAC = 0.1905

// The exposure sheet. 12 Hz inside 30fps, wherever the camera is parked.
export const CADENCE = "twos"
export const CADENCE_HZ = 12

// The contact shadow's own clock — K4's one arrival.
export const SHADOW_LAW = "lands"
export const SHADOW_LAG_SEC = 0.1333
export const SHADOW_SEC = 0.1667

// The round trip. See HeroReturn in lib/hero-motion.ts for why the change is
// an occlusion and never a shading.
export const RETURN = { mode: "changed", breakK: 0.35 }

// The wind-up. `releaseSec` is the half of it that was missing: the tense
// unwinds INSIDE the turn's silent leading frames rather than snapping back on
// the frame before it. `RELEASE_LAW = "prior"` is the snap, parked.
export const RELEASE_LAW = "overlap"
export const ANTICIPATION = {
  compressSec: 0.2,
  holdSec: 0.1,
  releaseSec: 0.2917,
  scaleY: 0.955,
  scaleX: 1.018,
}

// The turn — the beat's moment, and the return's.
export const EMERGE = {
  sec: BEATS.emerge,
  mode: "turn",
  overshoot: 0.1,
  lightLagSec: 0.08,
  lightSec: 0.7,
  flatDepth: 0.004,
  turnShade: 0.35,
  edgeFloor: 0.035,
  dwellSec: 0.0667,
}

export const DRAW_LINEAR_BLEND = 1

/* -------------------------------------------------------------------------- */
/*  End of the generated block.                                                */
/* -------------------------------------------------------------------------- */

// Old paste target. The beat is `emerge`; this alias exists so a script written
// against the previous file still resolves rather than reading `undefined.sec`.
export const CROSSFADE = { sec: BEATS.emerge }

export const secToFrames = (s) => Math.round(s * FPS)
export const totalDuration = () => PHASES.reduce((a, p) => a + BEATS[p], 0)

// ---- Curves ----------------------------------------------------------------
// These are the SAME functions as `lib/hero-motion.ts`, restated because this
// module cannot import them. They are pure and closed-form, and every one of
// them is checked on the TypeScript side by the assertions under
// scripts/verify/, so a drift here is a drift away from something that IS
// tested rather than away from another opinion.

const BACK_C2 = BACK_C1 * 1.525
export function easeInOutBack(t) {
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((BACK_C2 + 1) * 2 * t - BACK_C2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((BACK_C2 + 1) * (t * 2 - 2) + BACK_C2) + 2) / 2
}

// MATTER ARRIVING. Fast off the mark, past the target, settle back.
export function easeOutBack(t, overshoot) {
  const c1 = overshoot * 17.0158 // 0.1 -> 1.70158, the classic coefficient
  const c3 = c1 + 1
  const u = Math.max(0, Math.min(1, t)) - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

// THE RISE — ease-out dominant, with its anticipation dip intact. Every move in
// 114 seconds of reference film is ease-out dominant: a short acceleration of
// about four frames, an early velocity peak, and a decay three to four times
// the rise. Nothing in the set eases in symmetrically (§6.1). A symmetric move
// reads as TRAVELLING; an ease-out dominant one reads as ARRIVING.
export function riseEase(u, gatherFrac, gatherDepth, overshoot) {
  const g = gatherFrac <= 0 ? 0 : gatherFrac >= 1 ? 0.999 : gatherFrac
  if (u <= 0) return 0
  if (u < g) return -gatherDepth * Math.sin((Math.PI * u) / g)
  return easeOutBack((u - g) / (1 - g), overshoot)
}

// A MOVE THAT HANDS OVER INSTEAD OF STOPPING. Ported from `handoffEase` in
// lib/hero-motion.ts, whose derivation is the long comment above it: the
// VELOCITY is authored (a convex nose of `accelFrac` of the move, then a decay
// to a floor) and the position is its closed-form integral, so `f(1) = 1` and
// `f'(1) = endSlope` exactly and the join is C¹ by construction. `endSlope` is
// the whole reason this is not just an ease-out — 0 arrives at rest, and
// anything above 0 hands the NEXT move a velocity instead of stopping in front
// of it. `m = 1.5976` is a least-squares fit to Babbu's own four rise frames
// (`3, 5, 8, 21`) and is labelled as a fit rather than presented as a law.
export function handoffEase(x, accelFrac, endSlope, k = 4, m = 1.5976) {
  const t = Math.max(0, Math.min(1, x))
  const a = accelFrac <= 0 ? 1e-6 : accelFrac >= 1 ? 0.999 : accelFrac
  const Q = ((1 - a) * k) / (k + 1)
  // A floor velocity above 1/Q would make the normaliser non-positive; clamp
  // well short of it so a mis-set dial degrades rather than inverts the move.
  const s = Math.max(0, Math.min(endSlope, 0.9 / Q))
  const nose = a / (m + 1)
  const P = nose + (1 - a) / (k + 1)
  const A = P / (1 - s * Q)
  const r = s * A
  if (t < a) return (nose * Math.pow(t / a, m + 1)) / A
  const w = (1 - t) / (1 - a)
  const tail =
    (((1 - r) * (1 - a)) / (k + 1)) * (1 - Math.pow(w, k + 1)) + r * (t - a)
  return (nose + tail) / A
}

// WHERE THE TILT HANDS THE CAMERA OVER — and it is NOT `LIE_EL`. The rise
// gathers UP by `RISE_GATHER_DEPTH` of its own travel before committing, so a
// tilt that delivered the camera to `LIE_EL` would let the gather carry it PAST
// the pose: 70.35° measured against a dial that says 65. Solving
// `start + d·(start − end) = LIE_EL` puts the gather's turning point ON the
// pose instead. Ported from `riseStartEl`.
export function riseStartEl() {
  if (TILT_LAW === "prior") return LIE_EL
  const end = CAMERA_PARK === "prior" ? STANDUP_EL : HOLD_EL
  const d = Math.max(0, RISE_GATHER_DEPTH)
  return (LIE_EL + d * end) / (1 + d)
}

// The velocity the tilt must arrive at, as a multiple of its own average speed,
// so the seam into the rise's gather carries no step. Read straight off
// `riseEase`'s gather term — `−d·sin(πu/g)`, slope `−d·π/g` at u = 0 — rather
// than fitted, so retuning the gather retunes the handover with it. Ported from
// `tiltHandoverSlope`.
export function tiltHandoverSlope() {
  if (TILT_LAW === "prior") return 0
  const start = riseStartEl()
  const end = CAMERA_PARK === "prior" ? STANDUP_EL : HOLD_EL
  const g = RISE_GATHER_FRAC
  if (!(g > 0) || !(BEATS.standup > 0) || !(BEATS.tilt > 0) || !(start > 0)) return 0
  const gatherV0 = ((end - start) * ((-RISE_GATHER_DEPTH * Math.PI) / g)) / BEATS.standup
  const tiltAvgV = start / BEATS.tilt
  return tiltAvgV > 0 ? gatherV0 / tiltAvgV : 0
}

// ORBIT DRIFT — the PARKED prior. Under CAMERA_PARK "parked" the rise lands on
// the held pose directly and this is never called: §10.2 C1 measured the drift
// as a device with no basis in the reference set, so the correction is not
// "decelerate harder", it is do not travel.
export function driftEase(t, cut = DRIFT_CUT) {
  if (t <= cut) return t / 0.85
  const tail = 0.15 - Math.pow(1 - t, 2) / 0.6
  return (cut + tail) / 0.85
}

// ANTICIPATION (2D, applied to the flat face in compose): compress with a
// strong ease-out, then HOLD the tension. A squash that releases immediately
// reads as a wobble; the hold is what sells intent. It now fires BEFORE the
// turn and dead-on — it used to fire 1.33s after the mark had already gone
// solid, at el 65° where the word is a 47px-tall bar.
//
// ⚠ AND THE HOLD IS NO LONGER THE END OF IT. `RELEASE_LAW = "overlap"` gives
// the tense a third act: it unwinds across `ANTICIPATION.releaseSec` (0.2917s)
// of the TURN's own silent leading frames, so the release and the turn's onset
// are one gesture instead of a snap on the frame before. The release is
// back-loaded on `t³` — measured value-half 77.8% against 79.4% authored, where
// 42–58% is the crossfade dead band. `RELEASE_LAW = "prior"` is the snap,
// parked, and it is the negative control `assert-hero-windup.mjs` runs.
export const easeOutStrong = (t) => 1 - Math.pow(1 - t, 5)

// THE TURN'S EASING, ported verbatim from
// docs/reference-original/compose.ORIGINAL-FLIP.mjs:40 (commit f9010da). Its
// own comment says why nothing stronger works: "The card's on-screen width is
// |cos(angle)|, which is already slow at the ends and fast in the middle.
// Easing the angle on top of that compounds: quart stacked on cos left ~0.25s
// of visually dead card at each end (reads draggy) and a 1-frame blink through
// edge-on. Cubic keeps the commit/settle readable while still whipping through
// edge-on."
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// TILT: the page tips back and the completed mark is revealed LYING on it. A
// REAL CAMERA MOVE (elevation 0° → LIE_EL, captured), not a 2D squash: a 2D
// vertical scale of the flat raster can only CONDENSE the word — there is no
// near-edge-larger-than-far-edge, so nothing in the image says "receding away
// from you on a surface". The perspective projection of the actual 3D form says
// it for free, because it is true.
//
// ⚠ THIS CURVE IS NOW THE PARKED ARM. It is `TILT_LAW = "prior"`, kept
// reachable and never deleted; the shipped tilt is `handoffEase`, because a
// symmetric ease that decelerates to a stop in front of a rise that starts at
// 84 deg/s is a hitch — measured 0.8 → 84.0 deg/s in the SAME direction across
// that seam, a 105× re-acceleration with no turnaround to hide it.
export const easeInOutStrong = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// DRAW-IN retiming: handwriting is near-constant pen speed, so mostly-linear
// with a soft touch-down and lift.
//
// ⚠ CORRECTED — `DRAW_LINEAR_BLEND` IS 1 NOW, SO THIS IS THE IDENTITY. The
// sentence above was written when the trace's timestamps were synthesised at a
// flat 12 ms per point and `r(length, duration) = 0.9986` — with a machine
// recording, `penTimeDistanceFraction(t) == t` and this sine WAS the beat's only
// touch-down. The recording is real now (maxDeviation 8.46%), so the sine became
// a SECOND cushion at 68% the size of the signal it sat on — the same compounding
// trap B1 names on the turn. 0.45 stays typed here because `revealMode: "smooth"`
// bypasses the pen record entirely and would leave the draw perfectly linear.
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2
export const drawEase = (t) =>
  DRAW_LINEAR_BLEND * t + (1 - DRAW_LINEAR_BLEND) * easeInOutSine(t)

// ---- The captured camera program ------------------------------------------
//
// ⚠️ THIS USED TO BE A SECOND OPINION ABOUT THE BEAT, AND IT HAD ALREADY GONE
// WRONG. The previous version hand-wrote one loop per phase and emitted
// `anticipation` AFTER `tilt` — months after the tense was moved before the
// turn — so a capture driven from it would have filmed the beat the storyboard
// exists to replace, with the crossfade this file's own header used to defend.
// It also had no turn, no held solid and no return in it at all.
//
// It is now a WALK OVER `PHASES`, using the same constants and the same curves
// as the sampler, so a beat that is added to `BEATS` cannot be silently left
// out of the program. The order and the durations come from the pasted block;
// nothing here holds its own copy of either.
//
// ⚠️ AND IT WAS A SECOND OPINION AGAIN, IN THREE PLACES, UNTIL 2026-08-01. The
// walk was right and the poses were stale: `tilt` ran the parked symmetric ease
// and started the rise from `LIE_EL`; `standup` read its overshoot off
// `EMERGE.overshoot`, the INK's swell dial, which under `EMERGE.mode = "turn"`
// does not exist at all; `descend` ignored `DESCEND_LAW` and left the hold at
// full speed. All three now read the laws in the block above.
//
// PARITY IS MEASURED, NOT ASSUMED — and the residual turned out to be worth a
// number rather than a hand-wave. Every pose below was diffed against
// `sampleHeroMotion()`'s own az/el/fill at the matching phase-local u, all 372
// program frames, twelve phases, 2026-08-01:
//
//     az   max |Δ| 1.829e-3 deg    descend u = 0.167
//     el   max |Δ| 1.278e-3 deg    tilt    u = 0.167
//     fill max |Δ| 9.625e-6        descend u = 0.167
//
// NOT ROUNDING NOISE — IT IS THE PASTE FORMAT ITSELF. `toMotionMjsSource()`
// emits `Number(v.toFixed(4))`, so `MOVE_ACCEL_FRAC` arrives as **0.1905**
// against the model's `4/21 = 0.190476…`, and the whole residual sits inside
// `handoffEase`'s nose where that fraction is the denominator. Feed the model
// the same 4-decimal values and the three channels agree to **2.2e-13 / 8.0e-8
// / 1.1e-15**, i.e. floating point. So the film and the page can never be
// bit-identical across this transfer, and the size of that gap is now
// 0.0018° of azimuth rather than an assumption.
//
// NEGATIVE CONTROL, because a parity check that cannot fail is the lie:
// evaluated against `tiltLaw: "prior"` / `descendLaw: "prior"` the same diff
// reads **19.57°**. The check separates the shipped laws from the parked ones
// by four orders of magnitude.
//
// ⚠ AND THE PROGRAM EMITS 372 FRAMES WHERE THE TIMELINE IS 371. That is not a
// bug here and must not be "fixed" by trimming a phase: this walk rounds each
// beat to frames INDIVIDUALLY (`secToFrames` per phase) while the transport
// rounds the TOTAL once. `assert-hero-ledger.mjs` prints the same arithmetic —
// *"372 of 371 total"* — and it is the honest place to see it.
//
// A restatement that cannot be diffed against its source is exactly the class
// of drift the three ⚠ paragraphs above describe.
export function cameraProgram() {
  const frames = []
  const push = (phase, n, pose) => {
    for (let i = 0; i < n; i++) {
      const u = n <= 1 ? 1 : i / (n - 1)
      frames.push({ phase, ...pose(u) })
    }
  }
  const parked = () => ({ az: 0, el: 0, fill: FILL_LIE })
  const held = () => ({ az: HOLD_AZ, el: HOLD_EL, fill: FILL_HOLD })
  const closing = RETURN.mode === "prior" ? held : parked

  // Dead-on and parked, from the first stroke to the end of K4's hold.
  push("draw", secToFrames(BEATS.draw), parked)
  push("breath", secToFrames(BEATS.breath), parked)
  push("anticipation", secToFrames(BEATS.anticipation), parked)
  push("emerge", secToFrames(BEATS.emerge), parked)
  push("land", secToFrames(BEATS.land), parked)
  push("solid", secToFrames(BEATS.solid), parked)

  // The page tips back, then the mark stands up. The tilt is the ONE shot in
  // the beat that does not arrive: the rise begins on the very next frame and
  // continues in the same direction, so under `TILT_LAW = "handover"` it hands
  // the camera over at the rise's own starting speed rather than stopping in
  // front of it, and it stops at `riseStartEl()` so the gather's turning point
  // lands on `LIE_EL` instead of 5.35° past it.
  push("tilt", secToFrames(BEATS.tilt), (u) => ({
    az: 0,
    el:
      riseStartEl() *
      (TILT_LAW === "prior"
        ? easeInOutStrong(u)
        : handoffEase(u, MOVE_ACCEL_FRAC, tiltHandoverSlope())),
    fill: FILL_LIE,
  }))
  push("standup", secToFrames(BEATS.standup), (u) => {
    // `BACK_C1` IS THE ANTICIPATION SWITCH ON BOTH CURVES, and honouring it
    // here is what keeps `prefers-reduced-motion` reaching the counter-dip:
    // the page zeroes `backC1`, `riseOut` does not read it, and the rise kept
    // swinging 3.80° the wrong way for a reader who asked for less motion.
    const gather = BACK_C1 === 0 ? 0 : RISE_GATHER_DEPTH
    const e =
      RISE_CURVE === "prior"
        ? easeInOutBack(u)
        // `RISE_OVERSHOOT`, not `EMERGE.overshoot`: the rise's overshoot is the
        // RISE'S. Same default value, different dial — the ink's swell does not
        // exist under the turn, so the old read was one control, wrong name,
        // the other end of the beat.
        : riseEase(u, RISE_GATHER_FRAC, gather, RISE_OVERSHOOT)
    const azEnd = CAMERA_PARK === "prior" ? STANDUP_AZ : HOLD_AZ
    const elEnd = CAMERA_PARK === "prior" ? STANDUP_EL : HOLD_EL
    const fillEnd = CAMERA_PARK === "prior" ? FILL_STAND : FILL_HOLD
    // Elevation starts where the TILT left the camera, not at `LIE_EL`.
    const elStart = riseStartEl()
    return {
      az: azEnd * e,
      el: elStart + (elEnd - elStart) * e,
      fill: FILL_LIE + (fillEnd - FILL_LIE) * e,
    }
  })

  // K6 — the ¾, held. Under CAMERA_PARK "parked" every frame here is identical,
  // which is the entire point: a hold only reads as a hold if something stopped.
  push("orbit", secToFrames(BEATS.orbit), (u) => {
    const e = CAMERA_PARK === "prior" ? driftEase(u) : 1
    const azFrom = CAMERA_PARK === "prior" ? STANDUP_AZ : HOLD_AZ
    const elFrom = CAMERA_PARK === "prior" ? STANDUP_EL : HOLD_EL
    const fillFrom = CAMERA_PARK === "prior" ? FILL_STAND : FILL_HOLD
    return {
      az: azFrom + (HOLD_AZ - azFrom) * e,
      el: elFrom + (HOLD_EL - elFrom) * e,
      fill: fillFrom + (FILL_HOLD - fillFrom) * e,
    }
  })

  // The round trip closes: the camera squares back up to the framing it opened
  // in, the mark turns back through its own edge, and the drawing is held.
  // `DESCEND_LAW = "accelerated"` is what stops the return leaving a 933ms hold
  // at 375.9 deg/s on its first frame; `endSlope` is 0 because a return IS an
  // arrival — `returnTurn` is parked, so anything left over would be a camera
  // still moving under a mark that has started to turn.
  push("descend", secToFrames(BEATS.descend), (u) => {
    const e =
      RETURN.mode === "prior"
        ? 0
        : DESCEND_LAW === "prior"
          ? easeOutStrong(u)
          : handoffEase(u, MOVE_ACCEL_FRAC, 0)
    return {
      az: HOLD_AZ * (1 - e),
      el: HOLD_EL * (1 - e),
      fill: FILL_HOLD + (FILL_LIE - FILL_HOLD) * e,
    }
  })
  push("returnTurn", secToFrames(BEATS.returnTurn), closing)
  push("hold", secToFrames(BEATS.hold), closing)

  return frames
}
