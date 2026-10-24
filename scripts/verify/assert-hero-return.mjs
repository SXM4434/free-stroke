// K7 — THE RETURN, AND WHAT COMES BACK CHANGED.
//
// The beat used to STOP rather than end: `docs/hero-beat-storyboard.md` §3 K7
// is *status: MISSING*, and §4's last adjacency row reads *"K6 → K7 | No — K7
// does not exist. The film stops rather than ends."* The pitch is a ROUND TRIP
// — going one way asserts a conversion, coming back asserts an IDENTITY — and
// the original flip is 3D → flat → 3D, not flat → 3D, which is *"much of why
// the original reads as a finished gesture rather than a run-out clock."*
//
// This asserts the return off the model, with no browser and no capture:
//
//   1. it is the SAME TURN, not a second mechanic — same width law, same
//      breakdown band, same authored dwell, same never-past-edge-on yaw;
//   2. it is MIRRORED where it has to be — the depth departs AFTER the edge,
//      drained to about half at the sliver on both turns (ruled 2026-10-02,
//      call 2, docs/rulings/2026-09-26.md);
//   3. it lands on K1's FRAMING, which is the whole reason K1 exists;
//   4. it comes back IDENTICAL, no junction ever breaking, which is what the
//      original flip does (`traced.tsv` f140-146 and f244-275 are the same
//      numbers) and what the model ships, `ret.mode "identical"` (ruled
//      2026-10-02, call 1). The ink returns within one dwell after the edge,
//      never on an edge frame (call 3).
//
// TWO NEGATIVE CONTROLS, BECAUSE ONE CANNOT SEPARATE THE TWO CLAIMS.
//
//   `ret.mode = "prior"`    : no return at all: the beat ends hanging on the ¾.
//                             Kills every claim.
//   `ret.mode = "changed"`  : the return runs and the drawing comes back with
//                             its crossings cut. Kills only the IDENTICAL claim.
//
// The second control used to be "identical", which became the shipped default
// on 09-25 and so graded the beat against itself. Since call 1 it is "changed",
// the wrong case again. Four more arms are the shipped series with one channel
// put back wrong, for the must-fails calls 2 and 3 ask for.
//
// Usage: node scripts/verify/assert-hero-return.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, sampleReturn, phaseOffsets, easeInOutCubic } =
  loadTs("lib/hero-motion.ts")
const { solidDepthAt } = loadTs("lib/flip-pose.ts")

// Ruled 2026-10-02, call 2 (docs/rulings/2026-09-26.md): "The turn keeps its
// depth draining, about half at the edge." The bar is the model's own edge
// number from the `solidDepthAt` the sampler calls, with a tight tolerance, and
// that number must sit inside the ruled "about half" band so the bar cannot
// follow the model back to the black stack. Same bar as assert-hero-turn.mjs.
const EDGE_DEPTH = solidDepthAt(Math.PI / 2, 0, DEFAULT_HERO_MOTION.emerge.flatDepth)
const EDGE_DEPTH_TOL = 0.005
const ABOUT_HALF = [0.4, 0.6]
const edgeDepthOk = (d) =>
  Math.abs(d - EDGE_DEPTH) <= EDGE_DEPTH_TOL && EDGE_DEPTH >= ABOUT_HALF[0] && EDGE_DEPTH <= ABOUT_HALF[1]
// Ruled 2026-10-02, call 3: "The ink returns within one dwell (2 frames) after
// edge-on, never on the edge frame."
const ONE_DWELL = 2
const DEPTH_ROW = "the depth DEPARTS after the edge, drained to about half at the sliver"
const INK_ROW = "an object goes in and a DRAWING comes out, within one dwell after the edge"
const SAME_ROW = "the drawing comes back IDENTICAL, no junction ever breaks"

/** The return turn, frame by frame at the params' own rate. */
function returnSeries(P) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats.returnTurn * fps)
  const rows = []
  for (let i = 0; i <= N; i++) rows.push({ i, ...sampleReturn(P, off.returnTurn + i / fps) })
  return { rows, N, fps }
}

/** Every sample of a phase, through the FULL sampler (so the exposure, the
 *  camera and the form are all the ones that actually render). */
function phaseSeries(P, phase) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats[phase] * fps)
  const rows = []
  for (let i = 0; i < Math.max(1, N); i++) rows.push(sampleHeroMotion(P, off[phase] + i / fps))
  return rows
}

function claims(P, mutate = null) {
  const sampled = returnSeries(P)
  const { N, fps } = sampled
  // `mutate` exists for the must-fail arms of calls 2 and 3 only (see KILL).
  const rows = mutate ? mutate(sampled.rows, P) : sampled.rows
  const e = P.emerge
  const dwellSec = e.dwellSec ?? 0
  const turnSec = P.beats.returnTurn - dwellSec
  const halfTurnFrames = (turnSec / 2) * fps

  // The original's settled word is 409-410px wide at the resolution its
  // per-frame series was measured at (docs/storyboard/measured/traced.tsv).
  const FULL = 409
  const px = (sx) => Math.round(sx * FULL)

  // B1's passing position, measured over the turn-OUT's own span, exactly as
  // assert-hero-turn.mjs measures the out-turn's.
  const outRows = rows.filter((r) => r.i <= Math.ceil(halfTurnFrames))
  let breakdown = null
  for (let k = 1; k < outRows.length; k++) {
    const a = outRows[k - 1].sx
    const b = outRows[k].sx
    if ((a - 0.5) * (b - 0.5) <= 0 && a !== b) {
      breakdown = (k - 1 + (a - 0.5) / (a - b)) / halfTurnFrames
      break
    }
  }

  const dwellRows = rows.filter((r) => r.sx <= e.edgeFloor + 1e-9)
  const atEdge = dwellRows[0] ?? null
  const frozen =
    dwellRows.length >= 2 &&
    dwellRows.every(
      (r) =>
        r.sx === dwellRows[0].sx &&
        r.yaw === dwellRows[0].yaw &&
        r.depth === dwellRows[0].depth &&
        r.flat === dwellRows[0].flat &&
        r.shade === dwellRows[0].shade &&
        r.jointBreak === dwellRows[0].jointBreak,
    )

  // The width law must be EXACTLY the original's, compared at the sampler's own
  // u so a sampling difference is never mistaken for a law difference.
  const halfTurn = turnSec / 2
  let lawDelta = 0
  for (let i = 0; i <= N; i++) {
    const local = i / fps
    let u
    if (local < halfTurn) u = local / turnSec
    else if (local < halfTurn + dwellSec) continue
    else u = (local - dwellSec) / turnSec
    u = Math.max(0, Math.min(1, u))
    const angle = easeInOutCubic(u) * Math.PI
    const want = Math.max(Math.abs(Math.cos(angle)), e.edgeFloor)
    lawDelta = Math.max(lawDelta, Math.abs(want - rows[i].sx))
  }

  const maxYawDeg = Math.max(...rows.map((r) => (r.yaw * 180) / Math.PI))

  // MIRRORED DEPTH, DRAINED. Ruled 2026-10-02, call 2 (docs/rulings/2026-09-26.md).
  // The solid keeps a body all the way in (never blank before the edge), holds
  // the model's own half depth on every edge frame, and is flat by the end.
  const beforeEdge = rows.filter((r) => r.i < (atEdge ? atEdge.i : N))
  const depthBodyIn = beforeEdge.length > 0 && beforeEdge.every((r) => r.depth > e.flatDepth + 1e-9)
  const depthHalfAtEdge = dwellRows.length > 0 && dwellRows.every((r) => edgeDepthOk(r.depth))
  const depthGoneEnd = rows[N].depth <= e.flatDepth + 1e-9

  // THE INK, ruled 2026-10-02, call 3: the solid holds every edge frame (that is
  // what took the white ghost outline out, F118) and the ink is back within one
  // dwell of the first one.
  const inkFlip = rows.findIndex((r) => r.flat >= 1)
  const lastEdge = dwellRows.length ? dwellRows[dwellRows.length - 1].i : -1
  const inkAfterEdge =
    atEdge !== null && inkFlip > lastEdge && inkFlip - atEdge.i >= 1 && inkFlip - atEdge.i <= ONE_DWELL

  // THE JUNCTIONS, ruled 2026-10-02, call 1: none ever breaks on the return.
  const newsFlip = rows.findIndex((r) => r.jointBreak > 0)

  // K7 vs K1 — the two shots the round trip claims are the same picture.
  const k1 = phaseSeries(P, "breath")
  const k7 = phaseSeries(P, "hold")
  const sameFraming =
    k7.every((s) => s.az === k1[0].az && s.el === k1[0].el && s.fill === k1[0].fill)
  const k7Flat = k7.every((s) => s.flat >= 1 && s.depth <= P.emerge.flatDepth + 1e-9)
  const k7Still =
    k7.every(
      (s) =>
        s.az === k7[0].az &&
        s.el === k7[0].el &&
        s.fill === k7[0].fill &&
        s.flat === k7[0].flat &&
        s.depth === k7[0].depth &&
        s.shadow === k7[0].shadow &&
        s.jointBreak === k7[0].jointBreak,
    )
  const k7Fused = k7.every((s) => s.jointBreak === 0)
  const k1Fused = k1.every((s) => s.jointBreak === 0)

  // A DRAWING CASTS NO CONTACT SHADOW. The shadow has to be gone by K7 or the
  // "flat" state is a lit object wearing a drawing's shading.
  const k7NoShadow = k7.every((s) => s.shadow === 0)

  // THE DESCEND — ease-out dominant, like every move in 114s of reference film
  // (mechanics §6.1), and it must actually ARRIVE at K1's framing.
  const desc = phaseSeries(P, "descend")
  const dv = []
  for (let i = 1; i < desc.length; i++) dv.push({ i, v: Math.abs(desc[i].az - desc[i - 1].az) })
  const dPeak = dv.length ? dv.reduce((a, b) => (b.v > a.v ? b : a)) : { i: 0, v: 0 }
  const dPeakFrac = dv.length ? dPeak.i / dv.length : 1
  const descendMoves = dPeak.v > 0.01
  const descendArrives = Math.abs(desc[desc.length - 1].az - 0) < P.holdAz * 0.06

  return [
    {
      name: "the return is the SAME TURN — its breakdown is a wind-up too",
      pass: breakdown !== null && breakdown >= 0.79 && breakdown <= 0.93,
      detail:
        breakdown === null
          ? "the extent never reaches half width — there is no return turn to break down"
          : `half-width passing position at ${(100 * breakdown).toFixed(1)}% of the turn-out ` +
            `(the original's return turn measures 85.6%; reference wind-up band 79-93%)`,
    },
    {
      name: "the return's moment is HELD — two frames, not one",
      pass: dwellRows.length >= 2,
      detail: `${dwellRows.length} frames at or under the edge floor (needs >= 2)`,
    },
    {
      name: "the return's dwell frames are FROZEN",
      pass: frozen,
      detail: frozen
        ? `all ${dwellRows.length} dwell frames identical in sx / yaw / depth / ink / shade / junctions`
        : "the dwell frames differ — a held beat that shimmers is a dropped frame with extra steps",
    },
    {
      name: "the return's sliver is a sliver, never a blank frame",
      pass: atEdge !== null && atEdge.sx > 0 && px(atEdge.sx) >= 2,
      detail: atEdge
        ? `edge-on width ${px(atEdge.sx)} px at the original's scale (the original's return sliver is 14 px)`
        : "no edge-on frame at all",
    },
    {
      // Ruled 2026-10-02, call 2. Was "depth > 0.99 before the edge": the black stack.
      name: DEPTH_ROW,
      pass: depthBodyIn && depthHalfAtEdge && depthGoneEnd,
      detail:
        `a body on all ${beforeEdge.length} frames before the edge (${depthBodyIn}); ` +
        `edge depth ${dwellRows.map((r) => r.depth.toFixed(4)).join(" / ") || "n/a"} on the ${dwellRows.length} edge frames ` +
        `(needs the model's own ${EDGE_DEPTH.toFixed(4)} ± ${EDGE_DEPTH_TOL}, inside the ruled ${ABOUT_HALF[0]}-${ABOUT_HALF[1]}: ${depthHalfAtEdge}); ` +
        `flat by the end (${depthGoneEnd}, ${rows[N].depth.toFixed(4)})`,
    },
    {
      name: "the return turns exactly to edge-on, and never past it",
      pass: maxYawDeg <= 90 + 1e-6 && maxYawDeg >= 89,
      detail: `max yaw ${maxYawDeg.toFixed(1)} deg (needs 89..90)`,
    },
    {
      name: "the width law is the original's, exactly — on this turn too",
      pass: lawDelta < 1e-9,
      detail: `max |delta| vs |cos(easeInOutCubic(u) * pi)| clamped: ${lawDelta.toExponential(2)} (needs ~0)`,
    },
    {
      // Ruled 2026-10-02, call 3. Was "within 1 frame of the edge", which the
      // shipped two-frame dwell can never meet.
      name: INK_ROW,
      pass: inkAfterEdge && k7Flat,
      detail:
        inkFlip < 0
          ? "the ink never returns to flat — the beat still ends on an object"
          : `ink returns at frame ${inkFlip}, edge frames ${atEdge ? atEdge.i : "n/a"}-${lastEdge}: ` +
            `${atEdge ? inkFlip - atEdge.i : "n/a"} after edge-on (needs 1-${ONE_DWELL}, and after the last edge frame); ` +
            `K7 flat on all ${k7.length} frames: ${k7Flat}`,
    },
    {
      name: "K7 is K1's FRAMING — the two shots are the same picture",
      pass: sameFraming,
      detail: `K7 az/el/fill ${k7[0].az.toFixed(1)}/${k7[0].el.toFixed(1)}/${k7[0].fill.toFixed(3)} ` +
        `vs K1 ${k1[0].az.toFixed(1)}/${k1[0].el.toFixed(1)}/${k1[0].fill.toFixed(3)} ` +
        `(without this there is nothing for K7 to be a return TO)`,
    },
    {
      name: "K7 is HELD — nothing in it moves",
      pass: k7Still && k7.length >= 8,
      detail: `${k7.length} frames, all identical in pose, ink, depth, shadow and junctions: ${k7Still}`,
    },
    {
      // Ruled 2026-10-02, call 1. Was "comes back CHANGED". k7Flat keeps the
      // "comes back" half honest: a beat that never returns has nothing to match.
      name: SAME_ROW,
      pass: k1Fused && k7Fused && newsFlip < 0 && k7Flat,
      detail:
        `K1 fused on every frame (${k1Fused}), K7 fused on every frame (${k7Fused}), ` +
        `K7 a drawing (${k7Flat}), ` +
        (newsFlip < 0 ? "and no junction breaks on the return" : `but a junction breaks at frame ${newsFlip} of the return`),
    },
    {
      name: "a drawing casts NO contact shadow",
      pass: k7NoShadow,
      detail: `shadow ${k7[0].shadow.toFixed(3)} across K7 (needs exactly 0; a lit shadow under a flat mark is the object wearing the drawing's clothes)`,
    },
    {
      name: "the camera squares up, ease-out dominant, and ARRIVES",
      pass: descendMoves && descendArrives && dPeakFrac <= 0.35,
      detail: descendMoves
        ? `velocity peak at ${(100 * dPeakFrac).toFixed(1)}% of the move (needs <= 35%), ` +
          `lands at az ${desc[desc.length - 1].az.toFixed(2)} deg (needs ~0)`
        : "the camera never squares up — K7 is not at K1's framing",
    },
  ]
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
console.log(
  `THE RETURN — descend ${P.beats.descend.toFixed(3)}s + turn ${P.beats.returnTurn.toFixed(4)}s + ` +
    `K7 ${P.beats.hold.toFixed(4)}s at ${P.fps}fps, ret.mode "${P.ret.mode}"\n`,
)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

/* ---- the control matrix ----------------------------------------------------
 * PER CLAIM, not per control. A blanket "everything must fail on every control"
 * is a lie in the other direction: `changed` is a real, shippable read of
 * this beat, and demanding that it break the width law would only prove the
 * expectation was written carelessly. So each claim declares which arm is
 * REQUIRED to kill it and which arm it is REQUIRED to survive — and a control
 * that behaves the other way is reported as the instrument being blind, in
 * whichever direction it went wrong. */
const KILL = {
  "the return is the SAME TURN — its breakdown is a wind-up too": { prior: true, changed: false },
  "the return's moment is HELD — two frames, not one": { prior: true, changed: false },
  "the return's dwell frames are FROZEN": { prior: true, changed: false },
  "the return's sliver is a sliver, never a blank frame": { prior: true, changed: false },
  // Ruled 2026-10-02, call 2: must-fails for full depth and zero depth.
  [DEPTH_ROW]: { prior: true, changed: false, fullDepth: true, zeroDepth: true },
  "the return turns exactly to edge-on, and never past it": { prior: true, changed: false },
  "the width law is the original's, exactly — on this turn too": { prior: true, changed: false },
  // Ruled 2026-10-02, call 3: must-fails for a flip on the edge frame and one
  // later than one dwell.
  [INK_ROW]: { prior: true, changed: false, inkOnEdge: true, inkLate: true },
  "K7 is K1's FRAMING — the two shots are the same picture": { prior: true, changed: false },
  // A TERMINAL HOLD CANNOT BE MADE TO MOVE BY ANY REAL ARM OF THIS MODEL, so
  // neither control kills this one and it would be exactly the vacuous green
  // row this repo keeps shipping. The DETECTOR is mutation-tested instead —
  // see below — which is the honest version of the same check.
  "K7 is HELD — nothing in it moves": { prior: false, changed: false, selfTest: true },
  // Ruled 2026-10-02, call 1: the control is "changed", and it must fail.
  [SAME_ROW]: { prior: true, changed: true },
  "a drawing casts NO contact shadow": { prior: true, changed: false },
  "the camera squares up, ease-out dominant, and ARRIVES": { prior: true, changed: false },
}

const edgeIndex = (rows, Q) => rows.find((r) => r.sx <= Q.emerge.edgeFloor + 1e-9)?.i ?? -1
const controls = [
  {
    key: "prior",
    label: `ret.mode "prior": no return at all; the beat ends hanging on the ¾`,
    params: { ...P, ret: { ...P.ret, mode: "prior" } },
  },
  {
    // Ruled 2026-10-02, call 1. Replaces "identical", the shipped default since
    // 09-25, which graded the beat against itself.
    key: "changed",
    label: `ret.mode "changed": the return runs, the drawing comes back with its crossings cut`,
    params: { ...P, ret: { ...P.ret, mode: "changed" } },
  },
  // The must-fail arms of calls 2 and 3. Neither old state is a param of the
  // model any more, so each is the shipped series with one channel put back
  // the old way, fed to the same predicates.
  {
    key: "fullDepth",
    label: `FULL depth on every solid frame of the return (the black stack)`,
    params: P,
    mutate: (rows) => rows.map((r) => (r.flat < 1 ? { ...r, depth: 1 } : r)),
  },
  {
    key: "zeroDepth",
    label: `ZERO depth on the edge frames (c391840e's 0.004: the blank blink)`,
    params: P,
    mutate: (rows, Q) =>
      rows.map((r) => (r.sx <= Q.emerge.edgeFloor + 1e-9 ? { ...r, depth: Q.emerge.flatDepth } : r)),
  },
  {
    key: "inkOnEdge",
    label: `the ink flips ON the edge frame (the white ghost outline, F118)`,
    params: P,
    mutate: (rows, Q) => {
      const a = edgeIndex(rows, Q)
      return rows.map((r) => (r.i >= a ? { ...r, flat: 1 } : r))
    },
  },
  {
    key: "inkLate",
    label: `the ink flips ${ONE_DWELL + 1} frames after edge-on, later than one dwell`,
    params: P,
    mutate: (rows, Q) => {
      const a = edgeIndex(rows, Q)
      return rows.map((r) => (r.i <= a + ONE_DWELL ? { ...r, flat: 0 } : r))
    },
  },
]

let blind = false
for (const ctl of controls) {
  const got = claims(ctl.params, ctl.mutate)
  console.log(`\nNEGATIVE CONTROL — ${ctl.label}`)
  for (const c of got) {
    const mustFail = KILL[c.name]?.[ctl.key] === true
    const wrong = mustFail ? c.pass : !c.pass
    if (wrong) blind = true
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

/* ---- the detector's own mutation test --------------------------------------
 * "K7 is held" is true by construction, so no arm of the model can falsify it.
 * That is precisely the shape of a green row that cannot fail. Feed the same
 * predicate a series with ONE perturbed frame and require it to say no. */
const stillOf = (rows) =>
  rows.every(
    (s) =>
      s.az === rows[0].az &&
      s.el === rows[0].el &&
      s.fill === rows[0].fill &&
      s.flat === rows[0].flat &&
      s.depth === rows[0].depth &&
      s.shadow === rows[0].shadow &&
      s.jointBreak === rows[0].jointBreak,
  )
const k7Real = phaseSeries(P, "hold")
const k7Bent = k7Real.map((s, i) => (i === 5 ? { ...s, az: s.az + 0.5 } : s))
const detectorWorks = stillOf(k7Real) && !stillOf(k7Bent)
if (!detectorWorks) blind = true
console.log(
  `\nDETECTOR MUTATION TEST — the stillness predicate on a series with one frame nudged 0.5 deg`,
)
console.log(
  `  real K7 still: ${stillOf(k7Real)} · nudged K7 still: ${stillOf(k7Bent)} → ` +
    `${detectorWorks ? "the detector can fail, so its green means something" : "BLIND: it cannot tell a moving hold from a still one"}`,
)

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped return.`)
if (blind) console.log(`\nINSTRUMENT IS BLIND — a control did not behave as the claim requires.`)
console.log(failed.length || blind ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind ? 1 : 0)
