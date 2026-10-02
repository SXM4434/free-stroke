// K4 — SOLID, DEAD-ON, HELD. And the one thing that arrives in it.
//
// `docs/hero-beat-storyboard.md` §3 K4 is *status: exists, never held*: the
// shot lasts 0.33s, *"the tilt starts ten frames later — the camera never stops
// again for the rest of the film"*, and the one piece of real news in it is
// *"spent in a single frame nobody is given time to look at."* K1 and K4 are
// the SAME framing and the audience A/Bs K4 against its memory of K1; that
// comparison is the product's whole claim and it needs a held frame to happen
// in. The board gives it 18 frames.
//
// AND IT NOW CARRIES ONE ARRIVAL INSTEAD OF TWO. §3 K4 gave the shot both *"the
// crossings resolve into over/under"* and *"the contact shadow lands"*. §10.5
// call 1 takes the first away, on the most consistent finding in the reference
// set — one thing moves at a time, 100:1 band separation through Exquisite
// Corpse's shuffle, simultaneity of exactly 1 across Babbu's eleven-event
// cascade. So the junctions move to K7 and the shadow gets this shot to itself,
// on its own curve, four frames behind the face — the 50-100ms secondary-action
// offset §7 asks for.
//
// §1.4 is why that is not cosmetic. The shadow is real and ported, but it is
// *"tied to the same scalar as the light, so it fades up instead of landing"* —
// `viewport-3d.tsx:3243`, `opacityScale={1 - flatten.ink}`. Under the turn that
// gets WORSE, not better: `flat` hard-flips at the edge, so the prior law pops
// the shadow on in the same frame the ink changes state, and two things arrive
// together in a beat whose whole reference set never does that.
//
// THREE NEGATIVE CONTROLS, each aimed at a different claim:
//   `shadowLaw: "prior"`        — the shadow rides the light. What renders today.
//   `land = solid = 0`          — no landing beat, no held solid. What shipped.
//   `shadowSec` stretched       — the landing runs past its own beat.
//
// Usage: node scripts/verify/assert-hero-hold.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets } = loadTs("lib/hero-motion.ts")

function phaseSeries(P, phase) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats[phase] * fps)
  const rows = []
  for (let i = 0; i < N; i++) rows.push(sampleHeroMotion(P, off[phase] + i / fps))
  return rows
}

const still = (rows, keys) =>
  rows.length > 0 && rows.every((s) => keys.every((k) => s[k] === rows[0][k]))

function claims(P) {
  const fps = P.fps
  const off = phaseOffsets(P)

  const k1 = phaseSeries(P, "breath")
  const land = phaseSeries(P, "land")
  const k4 = phaseSeries(P, "solid")

  // The face arrives at the end of the emerge; `off.land` IS that instant.
  const faceAt = off.land
  // Sample the landing at frame resolution from the face's arrival onward.
  const window = []
  for (let i = 0; i <= Math.round((P.beats.land + P.beats.solid) * fps); i++) {
    const t = faceAt + i / fps
    window.push({ i, t, ...sampleHeroMotion(P, t) })
  }

  const firstMove = window.findIndex((r) => r.shadow > 0)
  const lagFrames = firstMove < 0 ? Infinity : firstMove
  const landedAt = window.findIndex((r) => r.shadow >= 0.999)
  const landsInsideItsBeat =
    landedAt >= 0 && landedAt <= Math.round(P.beats.land * fps) && firstMove > 0

  /* ---- the landing's SPACING, measured on the law and not on the exposure ---
   * THE FIRST VERSION OF THIS MEASURED THE WRONG THING AND FAILED, CORRECTLY.
   * It read the shadow off the rendered `land` beat, which is camera-parked and
   * therefore on TWOS — so a 5-frame landing has two distinct states and its
   * "value-half" is 50% by arithmetic, whatever curve is underneath. That is
   * not the curve being wrong, it is a curve being asked a question the
   * exposure cannot answer.
   *
   * And the reference set agrees with the exposure, not with the ramp: on twos
   * a fast secondary action is not an easing, it is a STAGGER. Every element in
   * Babbu appears in a single frame at final size and is then pixel-frozen
   * (mechanics §2.3), and the structure worth stealing is *"each item is two
   * beats — the object, then its name, ~450ms later. Never both at once"* (§5.1).
   *
   * So the two things are asserted separately and both have to hold: the LAW
   * is ease-out dominant, sampled on its own clock over its own duration; and
   * on the EXPOSURE the shadow lands on a different step from the face. */
  const ones = { ...P, cadence: "ones" }
  const rampN = Math.max(2, Math.round(P.shadowSec * fps))
  const start = faceAt + P.shadowLagSec
  const ramp = []
  for (let i = 0; i <= rampN; i++) {
    ramp.push(sampleHeroMotion(ones, start + (i / rampN) * P.shadowSec).shadow)
  }
  const distinct = new Set(ramp.map((v) => v.toFixed(6))).size
  const span = ramp[ramp.length - 1] - ramp[0]
  let valueHalf = null
  if (span > 0) {
    for (let i = 1; i < ramp.length; i++) {
      if (ramp[i] - ramp[0] >= span / 2) {
        valueHalf = (i - 1) / (ramp.length - 1)
        break
      }
    }
  }

  // THE STAGGER, on the exposure that renders. Which held step does the face
  // arrive on, and which does the shadow? They must not be the same one.
  const stepOf = (t) => Math.floor((t - faceAt) * P.cadenceHz + 1e-9)
  const faceStep = stepOf(faceAt)
  const shadowStep = firstMove >= 0 ? stepOf(faceAt + firstMove / fps) : null
  const staggered = shadowStep !== null && shadowStep > faceStep

  // ONE PIECE OF NEWS. Across the landing beat the camera, the ink, the depth
  // and the junctions must all be constant; only the shadow moves.
  const landOnlyShadow =
    still(land, ["az", "el", "fill", "flat", "depth", "yaw", "jointBreak"]) &&
    land.length > 1 &&
    land[land.length - 1].shadow > land[0].shadow

  const k4Held = k4.length >= 15
  const k4Framing =
    k4.length > 0 &&
    k4.every((s) => s.az === k1[0].az && s.el === k1[0].el && s.fill === k1[0].fill)
  const k4Still = still(k4, ["az", "el", "fill", "flat", "depth", "yaw", "shadow", "jointBreak"])
  const k4Solid = k4.length > 0 && k4.every((s) => s.flat === 0 && s.depth >= 0.999)

  // CALL 1's SPLIT, as one testable statement: the junctions resolve in K7 and
  // nowhere near K4.
  const k7 = phaseSeries(P, "hold")
  const splitHeld =
    land.every((s) => s.jointBreak === 0) &&
    k4.every((s) => s.jointBreak === 0) &&
    k7.length > 0 &&
    k7.every((s) => s.jointBreak >= 1)

  return [
    {
      name: "the shadow LANDS LATE — it is not on the frame the face arrives on",
      pass: lagFrames >= 2 && lagFrames <= 8,
      detail:
        lagFrames === Infinity
          ? "the shadow never arrives at all"
          : `first shadow at frame ${lagFrames} after the face (needs 2-8; the 50-100ms secondary-action band at ${fps}fps)`,
    },
    {
      name: "the landing FITS ITS OWN BEAT — the beat is named for it",
      pass: landsInsideItsBeat,
      detail:
        landedAt < 0
          ? "the shadow never reaches full"
          : `full at frame ${landedAt} of ${Math.round(P.beats.land * fps)} in the land beat ` +
            `(lag ${P.shadowLagSec.toFixed(4)}s + landing ${P.shadowSec.toFixed(4)}s = ${(P.shadowLagSec + P.shadowSec).toFixed(4)}s, beat ${P.beats.land.toFixed(4)}s)`,
    },
    {
      name: "the landing's CURVE is ease-out dominant, like every move in the reference set",
      pass: distinct >= 3 && valueHalf !== null && valueHalf <= 0.35,
      detail:
        distinct < 3
          ? `only ${distinct} distinct value(s) across the landing's own duration — that is a step, not a landing`
          : `half the change is done by ${(100 * valueHalf).toFixed(1)}% of the landing (needs <= 35%; measured on the law, at ${fps}fps on ones)`,
    },
    {
      name: "on TWOS the shadow lands on its OWN step — a stagger, not a curve",
      pass: staggered,
      detail:
        shadowStep === null
          ? "the shadow never arrives"
          : `face on exposure step ${faceStep}, shadow on step ${shadowStep} at ${P.cadenceHz} Hz ` +
            `(never both at once — the reference set's stagger, not an easing the exposure cannot render)`,
    },
    {
      name: "ONE piece of news — nothing else moves while the shadow lands",
      pass: landOnlyShadow,
      detail: landOnlyShadow
        ? `camera, ink, depth and junctions all constant across ${land.length} frames; shadow ${land[0].shadow.toFixed(3)} → ${land[land.length - 1].shadow.toFixed(3)}`
        : "something other than the shadow is moving in this shot, or the shadow is not",
    },
    {
      name: "K4 EXISTS AND IS HELD — 18 frames of solid, dead-on, stopped",
      pass: k4Held && k4Still && k4Solid,
      detail: `${k4.length} frames (needs >= 15), still: ${k4Still}, solid: ${k4Solid}`,
    },
    {
      name: "K4 is K1's FRAMING — the A/B the product's claim depends on",
      pass: k4Framing && k4.length > 0,
      detail:
        k4.length === 0
          ? "there is no K4 to compare"
          : `K4 az/el/fill ${k4[0].az.toFixed(1)}/${k4[0].el.toFixed(1)}/${k4[0].fill.toFixed(3)} ` +
            `vs K1 ${k1[0].az.toFixed(1)}/${k1[0].el.toFixed(1)}/${k1[0].fill.toFixed(3)}`,
    },
    {
      name: "the junctions resolve in K7, NOT here — call 1's split",
      pass: splitHeld,
      detail: splitHeld
        ? "junctions fused through the landing and through K4, open through K7 — one arrival each"
        : "the crossing resolution and the shadow are in the same shot, or the junctions never resolve at all",
    },
  ]
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
console.log(
  `K4 — land ${P.beats.land.toFixed(4)}s + hold ${P.beats.solid.toFixed(4)}s at ${P.fps}fps, ` +
    `shadowLaw "${P.shadowLaw}"\n`,
)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

const KILL = {
  // `noK4` removes the landing beat entirely, so every claim that reads it
  // legitimately dies with it — including the lag, which has no window left to
  // be measured in.
  "the shadow LANDS LATE — it is not on the frame the face arrives on": {
    rides: true, noK4: true, stretched: false,
  },
  "the landing FITS ITS OWN BEAT — the beat is named for it": {
    rides: true, noK4: true, stretched: true,
  },
  "the landing's CURVE is ease-out dominant, like every move in the reference set": {
    rides: true, noK4: false, stretched: false,
  },
  "on TWOS the shadow lands on its OWN step — a stagger, not a curve": {
    rides: true, noK4: true, stretched: false,
  },
  "ONE piece of news — nothing else moves while the shadow lands": {
    rides: true, noK4: true, stretched: false,
  },
  // `stretched` is the honest control for the stillness half: a landing that
  // runs past its own beat is still moving inside the held frame, so K4 stops
  // being a hold. Without it this claim could not fail.
  "K4 EXISTS AND IS HELD — 18 frames of solid, dead-on, stopped": {
    rides: false, noK4: true, stretched: true,
  },
  "K4 is K1's FRAMING — the A/B the product's claim depends on": {
    rides: false, noK4: true, stretched: false,
  },
  "the junctions resolve in K7, NOT here — call 1's split": {
    rides: false, noK4: false, stretched: false, ret: true,
  },
}

const controls = [
  {
    key: "rides",
    label: `shadowLaw "prior" — the shadow rides the light, which is what viewport-3d.tsx:3243 does today`,
    params: { ...P, shadowLaw: "prior" },
  },
  {
    key: "noK4",
    label: `land = solid = 0 — no landing beat and no held solid; the tilt starts straight out of the turn (what shipped)`,
    params: { ...P, beats: { ...P.beats, land: 0, solid: 0 } },
  },
  {
    key: "stretched",
    label: `shadowSec 0.9 — the landing runs past its own beat and into the held frame`,
    params: { ...P, shadowSec: 0.9 },
  },
  {
    key: "ret",
    label: `ret.mode "prior" — the beat never returns, so nothing ever resolves the junctions`,
    params: { ...P, ret: { ...P.ret, mode: "prior" } },
  },
]

let blind = false
for (const ctl of controls) {
  const got = claims(ctl.params)
  console.log(`\nNEGATIVE CONTROL — ${ctl.label}`)
  for (const c of got) {
    const mustFail = KILL[c.name]?.[ctl.key] === true
    if (mustFail ? c.pass : !c.pass) blind = true
    console.log(
      `  ${
        c.pass
          ? mustFail
            ? "PASS <- WRONG, this control should have killed it"
            : "passes, correctly"
          : mustFail
            ? "fails, correctly"
            : "FAILS <- WRONG, this control should not have touched it"
      }  ${c.name}`,
    )
  }
  console.log(`  ${got.filter((c) => !c.pass).length}/${got.length} claims fail on this control.`)
}

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped K4.`)
if (blind) console.log(`\nINSTRUMENT IS BLIND — a control did not behave as the claim requires.`)
console.log(failed.length || blind ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind ? 1 : 0)
