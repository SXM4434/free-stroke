// THE RISE'S SPACING, against the reference set's own three properties.
//
// `reference-film-mechanics.md` §6.1, measured across 114 seconds of film:
//
//   "Every move in the reference set is EASE-OUT DOMINANT: a short acceleration
//    (~4 frames), an early velocity peak, and a long decay (3-4x the rise).
//    Nothing eases in symmetrically."
//
// The beat's rise shipped as `easeInOutBack`, which is spaced 50:50 — the same
// defect as the emerge's 42% breakdown, one level up. A symmetric move reads as
// TRAVELLING; an ease-out dominant move reads as ARRIVING. This asserts the
// three properties directly off the curve.
//
// THE PRIOR CURVE IS THE NEGATIVE CONTROL. Every claim is re-run against
// `riseCurve: "prior"` and required to FAIL there. Without that this file would
// be three thresholds nobody had shown could fire — and a green row that cannot
// fail is the lie.
//
// Usage: node scripts/verify/assert-hero-rise.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets } = loadTs("lib/hero-motion.ts")

/**
 * The rise sampled at its own frame rate, as the ELEVATION the camera actually
 * flies — not the raw curve. What the eye reads is the pose, so a curve that
 * looks ease-out dominant but is applied to something non-linear would still
 * fail here, correctly.
 */
function riseSeries(P) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats.standup * fps)
  const rows = []
  for (let i = 0; i <= N; i++) {
    const t = off.standup + (i / fps)
    const s = sampleHeroMotion(P, t)
    rows.push({ i, el: s.el, az: s.az })
  }
  return { rows, N, fps }
}

function claims(P) {
  const { rows, N, fps } = riseSeries(P)

  // Travel is measured on elevation, which is the rise's dominant axis
  // (lieEl -> standupEl). Normalised so the numbers are shape, not degrees.
  const e0 = rows[0].el
  const e1 = P.standupEl
  const span = e1 - e0
  const prog = rows.map((r) => (r.el - e0) / span)

  // Per-frame velocity, and where it peaks.
  const vel = []
  for (let i = 1; i < prog.length; i++) vel.push({ i, v: prog[i] - prog[i - 1] })
  const peak = vel.reduce((a, b) => (Math.abs(b.v) > Math.abs(a.v) ? b : a))
  const peakFrac = peak.i / N

  // The gather: how far the move goes BACKWARDS before committing.
  const minProg = Math.min(...prog)
  const gatherFrames = prog.findIndex((p) => p > 0 && prog.indexOf(minProg) < prog.indexOf(p))

  // Rise vs decay. The rise is up to the velocity peak; the decay is the rest.
  const riseFrames = peak.i
  const decayFrames = N - peak.i
  const decayRatio = riseFrames > 0 ? decayFrames / riseFrames : Infinity

  // The overshoot must SURVIVE. B4: "do not touch it."
  const maxProg = Math.max(...prog)
  const overshootPct = 100 * (maxProg - 1)

  // Does it arrive? A rise that never settles is a different defect.
  const endProg = prog[prog.length - 1]

  return [
    {
      name: "the velocity peak is EARLY, not at the midpoint",
      pass: peakFrac <= 0.35,
      detail: `peak at ${(100 * peakFrac).toFixed(1)}% of the rise, frame ${peak.i} of ${N} (needs <= 35%; symmetric curves peak at 50%)`,
    },
    {
      name: "the decay is 3-4x the acceleration",
      pass: decayRatio >= 3,
      detail: `rise ${riseFrames} fr, decay ${decayFrames} fr, ratio ${decayRatio.toFixed(2)}x (needs >= 3x)`,
    },
    {
      name: "the acceleration is SHORT",
      pass: riseFrames <= Math.round(0.25 * N),
      detail: `${riseFrames} frames to the velocity peak at ${fps}fps (needs <= ${Math.round(0.25 * N)}, i.e. a quarter of the rise)`,
    },
    {
      name: "the gather survives — it still winds up before it commits",
      pass: minProg < -0.02,
      detail: `dips to ${(100 * minProg).toFixed(1)}% before committing (needs < -2%; this is the camera-side anticipation)`,
    },
    {
      name: "the overshoot survives — B4 says do not touch it",
      pass: overshootPct >= 5 && overshootPct <= 20,
      detail: `overshoots to +${overshootPct.toFixed(1)}% (needs 5-20%; the classic back curve gives about 10%)`,
    },
    {
      name: "and it ARRIVES",
      pass: Math.abs(endProg - 1) < 0.005,
      detail: `settles at ${(100 * endProg).toFixed(2)}% of the travel (needs 100% +/- 0.5)`,
    },
  ]
}

const P = DEFAULT_HERO_MOTION
console.log(`THE RISE — ${P.beats.standup}s at ${P.fps}fps, curve "${P.riseCurve}"\n`)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

const control = { ...P, riseCurve: "prior" }
const controlled = claims(control)
const wrongly = controlled.filter((c) => c.pass)

console.log(`\nNEGATIVE CONTROL — the same claims against riseCurve "prior" (symmetric easeInOutBack)`)
for (const c of controlled) console.log(`  ${c.pass ? "passes" : "fails, correctly"}  ${c.name}`)

// The control is NOT required to fail every claim: the prior curve keeps its
// gather, its overshoot and its arrival by construction, and those three are
// exactly what this change must NOT break. What it must fail is the SPACING —
// that is the whole defect, and if the control passed those the instrument
// would be measuring nothing.
const SPACING = new Set([
  "the velocity peak is EARLY, not at the midpoint",
  "the decay is 3-4x the acceleration",
  "the acceleration is SHORT",
])
const blindSpacing = controlled.filter((c) => SPACING.has(c.name) && c.pass)
const brokeKeepers = controlled.filter((c) => !SPACING.has(c.name) && !c.pass)

const failed = shipped.filter((c) => !c.pass)
console.log(
  `\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped rise.` +
    `\n${blindSpacing.length === 0 ? "all 3" : `${3 - blindSpacing.length} of 3`} SPACING claims correctly FAIL on the symmetric control.`,
)
if (blindSpacing.length) {
  console.log(
    `\nINSTRUMENT IS BLIND — the symmetric curve passes a spacing claim:\n` +
      blindSpacing.map((c) => `  - ${c.name}`).join("\n"),
  )
}
if (brokeKeepers.length) {
  console.log(
    `\nNOTE — the control also fails a non-spacing claim, which means that claim is\n` +
      `not describing something the prior curve had:\n` +
      brokeKeepers.map((c) => `  - ${c.name}`).join("\n"),
  )
}
console.log(failed.length || blindSpacing.length ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blindSpacing.length ? 1 : 0)
