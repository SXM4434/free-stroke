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
//      where the out-turn's arrives before it, so the sliver is full thickness
//      on both turns;
//   3. it lands on K1's FRAMING, which is the whole reason K1 exists;
//   4. it comes back CHANGED, by occlusion and never by shading, with the
//      change hidden inside the dwell.
//
// TWO NEGATIVE CONTROLS, BECAUSE ONE CANNOT SEPARATE THE TWO CLAIMS.
//
//   `ret.mode = "prior"`      — no return at all: the beat ends hanging on the
//                               ¾, which is what shipped. Kills every claim.
//   `ret.mode = "identical"`  — the return runs and the flat mark comes back
//                               UNCHANGED, which is what the original flip does
//                               (`traced.tsv` f140-146 and f244-275 are the
//                               same numbers). Kills only the CHANGE claims.
//
// The second control is the one that matters. Without it, "the drawing comes
// back carrying its pen order" would be satisfied by a beat that merely
// returns — and a green row that cannot fail is the lie.
//
// Usage: node scripts/verify/assert-hero-return.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, sampleReturn, phaseOffsets, easeInOutCubic } =
  loadTs("lib/hero-motion.ts")

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

/* THE INK SWAPS ACROSS THE SLIVER'S OWN BOUNDARY, on one side or the other.
 * The out-turn swaps on the dwell's FIRST frame (drawing 106 px at f12, solid
 * sliver 14 px at f13). Since F118 (2026-09-25, ruled: the return's dwell is the
 * solid, because a drawing at the edge is either the carve's white ghost on a
 * thick sliver or a 0.004-deep blank card) the return swaps on the frame AFTER
 * the dwell's LAST (solid sliver 14 px at f14, drawing 37 px at f15): the mirror
 * of the out-turn. This used to accept the first dwell frame plus or minus one,
 * which read the mirror as a defect and passed a swap one frame BEFORE the edge,
 * where the outgoing frame is still 106 px wide. Either side of the sliver hides
 * the swap; any other frame shows it. */
function swapAtSliver(rows, edgeFloor) {
  const dwell = rows.filter((r) => r.sx <= edgeFloor + 1e-9)
  const flip = rows.findIndex((r) => r.flat >= 1)
  if (dwell.length === 0 || flip < 0) return false
  return flip === dwell[0].i || flip === dwell[dwell.length - 1].i + 1
}

function claims(P) {
  const { rows, N, fps } = returnSeries(P)
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

  // MIRRORED DEPTH. The out-turn's depth ARRIVES before the edge; this one's
  // must DEPART after it, so the thickness is full at the sliver on both turns
  // and the change is spent where a tube seen down its own axis hides it.
  const beforeEdge = rows.filter((r) => r.i < (atEdge ? atEdge.i : N))
  const depthHeldOut = beforeEdge.length > 0 && beforeEdge.every((r) => r.depth > 0.99)
  const depthGoneEnd = rows[N].depth <= e.flatDepth + 1e-9

  // THE INK, AND THE NEWS, BOTH SWAP AT THE EDGE.
  const inkFlip = rows.findIndex((r) => r.flat >= 1)
  const newsFlip = rows.findIndex((r) => r.jointBreak > 0)
  const inkAtEdge = swapAtSliver(rows, e.edgeFloor)
  const newsAtEdge = atEdge !== null && newsFlip >= 0 && Math.abs(newsFlip - atEdge.i) <= 1

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
  const k7News = k7.every((s) => s.jointBreak >= 1)
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
      name: "the depth DEPARTS after the edge — the mirror of the out-turn",
      pass: depthHeldOut && depthGoneEnd,
      detail:
        `depth is > 0.99 on all ${beforeEdge.length} frames before the edge ` +
        `(${depthHeldOut}) and back to flat by the end (${depthGoneEnd}, ${rows[N].depth.toFixed(4)}). ` +
        `Full thickness AT the sliver on both turns; the change spent where a tube seen down its own axis hides it.`,
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
      name: "an object goes in and a DRAWING comes out, at the edge",
      pass: inkAtEdge && k7Flat,
      detail:
        inkFlip < 0
          ? "the ink never returns to flat — the beat still ends on an object"
          : `ink returns to flat at frame ${inkFlip} (${px(rows[inkFlip - 1]?.sx ?? 1)} px to ${px(rows[inkFlip].sx)} px), ` +
            `edge-on at frames ${atEdge ? `${atEdge.i}-${dwellRows[dwellRows.length - 1].i}` : "n/a"} ` +
            `(needs the first edge frame or the one after the last); K7 flat on all ${k7.length} frames: ${k7Flat}`,
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
      name: "the drawing comes back CHANGED — and only at the edge",
      pass: k7News && k1Fused && newsAtEdge,
      detail:
        `K1 fused on every frame (${k1Fused}), K7 open on every frame (${k7News}), ` +
        (newsFlip < 0
          ? "and the change never happens"
          : `change at frame ${newsFlip} of the return, edge-on at ${atEdge ? atEdge.i : "n/a"} — hidden inside the moment`),
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
 * is a lie in the other direction: `identical` is a real, shippable read of
 * this beat, and demanding that it break the width law would only prove the
 * expectation was written carelessly. So each claim declares which arm is
 * REQUIRED to kill it and which arm it is REQUIRED to survive — and a control
 * that behaves the other way is reported as the instrument being blind, in
 * whichever direction it went wrong. */
const KILL = {
  "the return is the SAME TURN — its breakdown is a wind-up too": { prior: true, identical: false },
  "the return's moment is HELD — two frames, not one": { prior: true, identical: false },
  "the return's dwell frames are FROZEN": { prior: true, identical: false },
  "the return's sliver is a sliver, never a blank frame": { prior: true, identical: false },
  "the depth DEPARTS after the edge — the mirror of the out-turn": { prior: true, identical: false },
  "the return turns exactly to edge-on, and never past it": { prior: true, identical: false },
  "the width law is the original's, exactly — on this turn too": { prior: true, identical: false },
  "an object goes in and a DRAWING comes out, at the edge": { prior: true, identical: false },
  "K7 is K1's FRAMING — the two shots are the same picture": { prior: true, identical: false },
  // A TERMINAL HOLD CANNOT BE MADE TO MOVE BY ANY REAL ARM OF THIS MODEL, so
  // neither control kills this one and it would be exactly the vacuous green
  // row this repo keeps shipping. The DETECTOR is mutation-tested instead —
  // see below — which is the honest version of the same check.
  "K7 is HELD — nothing in it moves": { prior: false, identical: false, selfTest: true },
  "the drawing comes back CHANGED — and only at the edge": { prior: true, identical: true },
  "a drawing casts NO contact shadow": { prior: true, identical: false },
  "the camera squares up, ease-out dominant, and ARRIVES": { prior: true, identical: false },
}

const controls = [
  {
    key: "prior",
    label: `ret.mode "prior" — no return at all; the beat ends hanging on the ¾ (what shipped)`,
    params: { ...P, ret: { ...P.ret, mode: "prior" } },
  },
  {
    key: "identical",
    label: `ret.mode "identical" — the return runs, the drawing comes back UNCHANGED`,
    params: { ...P, ret: { ...P.ret, mode: "identical" } },
  },
]

let blind = false
for (const ctl of controls) {
  const got = claims(ctl.params)
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

/* The swap predicate gets the same treatment: the shipped return's own rows
 * with the ink moved to every frame from 3 before the edge to 3 after it. It
 * must say yes on exactly the two frames that touch the sliver and no on the
 * rest, the frame before the edge included. */
{
  const ret = returnSeries(P).rows
  const dw = ret.filter((r) => r.sx <= P.emerge.edgeFloor + 1e-9)
  const want = new Set([dw[0].i, dw[dw.length - 1].i + 1])
  const verdicts = []
  let ok = dw.length > 0
  for (let k = dw[0].i - 3; k <= dw[dw.length - 1].i + 4; k++) {
    const moved = ret.map((r) => ({ ...r, flat: r.i >= k ? 1 : 0 }))
    const got = swapAtSliver(moved, P.emerge.edgeFloor)
    if (got !== want.has(k)) ok = false
    verdicts.push(`f${k} ${got ? "yes" : "no"}`)
  }
  if (!ok) blind = true
  console.log(`\nDETECTOR MUTATION TEST: the swap predicate with the ink moved frame by frame (edge-on f${dw[0].i}-f${dw[dw.length - 1].i})`)
  console.log(
    `  ${verdicts.join(" · ")} → ` +
      `${ok ? "yes only where the swap touches the sliver, so its green means something" : "BLIND: it passes a swap the eye can see, or fails one it cannot"}`,
  )
}

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped return.`)
if (blind) console.log(`\nINSTRUMENT IS BLIND — a control did not behave as the claim requires.`)
console.log(failed.length || blind ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind ? 1 : 0)
