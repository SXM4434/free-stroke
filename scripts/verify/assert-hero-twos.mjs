// THE EXPOSURE SHEET — twos wherever the camera is parked, and the moment
// surviving it.
//
// `docs/hero-beat-storyboard.md` §10.2 C6: mechanics §4.3 measured EVERY
// authored graphic passage in Exquisite Corpse on twos — parity ratios 9.9× to
// 19.4× — with only the live-action video on ones, and *"that is a deliberate
// hand-animation cadence and it is a large part of why the film reads as drawn
// rather than rendered. It costs nothing to reproduce: sample the animation
// clock at 12 Hz."* §7 of the board puts only the turn on twos; C6 corrects it
// — *"K1, K2, the four turns, the land, K4, K6 and K7 are all camera-parked and
// all eligible."*
//
// And the exclusion is from the same source: *"it is dangerous to animate on
// double frames during a table move or camera track"* (Whitaker/Halas/Sito).
// So the tilt, the rise and the descend stay on ones.
//
// THE THING THIS FILE EXISTS TO CATCH. A 12 Hz grid anchored at the phase start
// lands on local 0.4167 and 0.5000 of a 0.9167s emerge and steps clean OVER the
// dwell window [0.4250, 0.4917) — the moment silently ceases to exist, which is
// the exact failure this beat already had once, when the dwell was inherited
// from frame quantisation instead of being authored. So the grid is anchored to
// the CENTRE OF THE DWELL, and that alternative is run here as a live negative
// control rather than described.
//
// Usage: node scripts/verify/assert-hero-twos.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, sampleEmerge, sampleReturn, phaseOffsets, HERO_PHASES, PARKED_PHASES } =
  loadTs("lib/hero-motion.ts")

const KEYS = ["az", "el", "fill", "flat", "depth", "yaw", "shade", "shadow", "jointBreak", "reveal", "squashX", "squashY"]
const sig = (s) => KEYS.map((k) => s[k]).join("|")

function phaseFrames(P, phase) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats[phase] * fps)
  const rows = []
  for (let i = 0; i < N; i++) rows.push(sampleHeroMotion(P, off[phase] + i / fps))
  return rows
}

/** Distinct rendered states in a phase, and how many a 12 Hz exposure allows. */
function exposure(P, phase) {
  const rows = phaseFrames(P, phase)
  const distinct = new Set(rows.map(sig)).size
  const allowed = Math.ceil(P.beats[phase] * P.cadenceHz) + 1
  return { rows, distinct, allowed, frames: rows.length }
}

/* ---- the two alternative grids, simulated -------------------------------- */
/** Anchored at the phase start — the version that steps over the dwell. */
function phaseStartGrid(P, phase, t) {
  const start = phaseOffsets(P)[phase]
  return start + Math.floor((t - start) * P.cadenceHz) / P.cadenceHz
}
/** One grid for the whole beat — the version that leaks across boundaries. */
function globalGrid(P, t) {
  return Math.floor(t * P.cadenceHz) / P.cadenceHz
}

function claims(P) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const e = P.emerge

  // 1 — the parked portion.
  const parked = PARKED_PHASES.map((ph) => ({ ph, ...exposure(P, ph) }))
  const parkedOnTwos = parked.every((x) => x.frames <= 1 || x.distinct <= x.allowed)
  const parkedWorst = parked.reduce(
    (a, b) => (b.distinct - b.allowed > a.distinct - a.allowed ? b : a),
    parked[0],
  )

  // 2 — the camera moves. A move is on ones if it has as many distinct states
  // as it has frames.
  const moves = HERO_PHASES.filter((ph) => !PARKED_PHASES.includes(ph) && ph !== "draw")
  const moveRows = moves.map((ph) => ({ ph, ...exposure(P, ph) }))
  const movesOnOnes = moveRows.every((x) => x.distinct >= x.frames - 1)

  // 3/4/5 — the moment, under the exposure that renders.
  const turnEdge = (phase, sampler) => {
    const N = Math.round(P.beats[phase] * fps)
    const shipped = []
    const alt = []
    for (let i = 0; i <= N; i++) {
      const t = off[phase] + i / fps
      shipped.push(sampleHeroMotion(P, t))
      alt.push(sampler(P, phase, Math.max(off[phase], phaseStartGrid(P, phase, t))))
    }
    return { shipped, alt }
  }
  const emergeEdge = turnEdge("emerge", (p, ph, q) => sampleEmerge(p, q))
  const returnEdge = turnEdge("returnTurn", (p, ph, q) => sampleReturn(p, q))

  const atFloor = (rows) => rows.filter((r) => r.sx <= e.edgeFloor + 1e-9)
  const outHeld = atFloor(emergeEdge.shipped)
  const backHeld = atFloor(returnEdge.shipped)
  const momentSurvives = outHeld.length >= 2 && backHeld.length >= 2

  const identical = (rows) =>
    rows.length >= 2 && rows.every((r) => sig(r) === sig(rows[0]))
  const dwellIdentical = identical(outHeld) && identical(backHeld)

  /* ---- SYMMETRY, read off the HELD STATES and not off the frames -----------
   * B1: *"the cushion sits on the OUTSIDE of the turn on both sides… Only the
   * edge itself is whipped."*
   *
   * THE FIRST VERSION COMPARED FRAME k BEFORE THE EDGE WITH FRAME k AFTER IT
   * AND FAILED, on a beat whose exposure is 409/402/357/193/14/193/357/402/409.
   * It was measuring the 30fps READ of the exposure, and 0.9167s is 27.5 frames
   * — an odd sampling lattice against an even exposure, so the leading run holds
   * seven frames and the trailing run five. That is a property of where the
   * frame grid falls, not of the turn.
   *
   * An exposure sheet is a list of HELD STATES, so that is what is compared:
   * run-length compress the widths and mirror the run VALUES about the edge. */
  const inside = emergeEdge.shipped.filter((_, i) => off.emerge + i / fps < off.land)
  const runs = []
  for (const r of inside) {
    const v = Number(r.sx.toFixed(9))
    if (runs.length && Math.abs(runs[runs.length - 1].v - v) < 1e-6) runs[runs.length - 1].n++
    else runs.push({ v, n: 1 })
  }
  const edgeRun = runs.findIndex((r) => r.v <= e.edgeFloor + 1e-9)
  let symmetric = edgeRun > 0 && edgeRun < runs.length - 1
  let mirrorPairs = 0
  if (symmetric) {
    for (let k = 1; edgeRun - k >= 0 && edgeRun + k < runs.length; k++) {
      mirrorPairs++
      if (Math.abs(runs[edgeRun - k].v - runs[edgeRun + k].v) > 1e-6) symmetric = false
    }
    if (mirrorPairs < 2) symmetric = false
  }
  const runSeq = runs.map((r) => Math.round(r.v * 409)).join("/")

  // 6 — the grid never leaks across a phase boundary. The first frame of every
  // parked phase must be that phase's own first state.
  let leaks = 0
  for (const ph of PARKED_PHASES) {
    const t = off[ph]
    const q = globalGrid(P, t)
    if (q < off[ph] - 1e-12) leaks++
  }
  const firstFrameOwn = PARKED_PHASES.every((ph) => {
    const s = sampleHeroMotion(P, off[ph])
    const raw = sampleHeroMotion({ ...P, cadence: "ones" }, off[ph])
    return sig(s) === sig(raw)
  })

  return [
    {
      name: "the PARKED portion runs on twos",
      pass: parkedOnTwos,
      detail: parked
        .map((x) => `${x.ph} ${x.distinct}/${x.frames}fr`)
        .join(" · ") +
        ` — worst is ${parkedWorst.ph} at ${parkedWorst.distinct} distinct states against ${parkedWorst.allowed} allowed by a ${P.cadenceHz} Hz exposure`,
    },
    {
      name: "the CAMERA MOVES stay on ones — never twos through a track",
      pass: movesOnOnes,
      detail: moveRows.map((x) => `${x.ph} ${x.distinct}/${x.frames}fr`).join(" · "),
    },
    {
      name: "the MOMENT SURVIVES the exposure — on both turns",
      pass: momentSurvives,
      detail: `${outHeld.length} frames at the edge on the way out, ${backHeld.length} on the way back (needs >= 2 each)`,
    },
    {
      name: "the dwell frames are byte-identical BY CONSTRUCTION",
      pass: dwellIdentical,
      detail: dwellIdentical
        ? "every frame inside each dwell step carries the same state, because it IS the same held step — not because two renders happened to agree"
        : "the dwell frames differ",
    },
    {
      name: "the exposure is SYMMETRIC about the edge",
      pass: symmetric,
      detail:
        `held states ${runSeq} px at the original's scale` +
        (symmetric
          ? ` — ${mirrorPairs} mirrored pairs; the cushion sits on the outside of the turn on both sides, only the edge is whipped`
          : ` — these do not mirror about the sliver`),
    },
    {
      name: "the grid never crosses a phase boundary",
      pass: firstFrameOwn,
      detail: firstFrameOwn
        ? `every parked phase's first frame is its own first state (a single global grid would leak on ${leaks} of ${PARKED_PHASES.length})`
        : "a phase's first frame is showing the previous phase's state",
    },
  ]
}

/* ---- run ------------------------------------------------------------------ */
const P = DEFAULT_HERO_MOTION
console.log(`THE EXPOSURE — cadence "${P.cadence}" at ${P.cadenceHz} Hz inside ${P.fps}fps\n`)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

const KILL = {
  "the PARKED portion runs on twos": { ones: true },
  "the CAMERA MOVES stay on ones — never twos through a track": {},
  "the MOMENT SURVIVES the exposure — on both turns": {},
  "the dwell frames are byte-identical BY CONSTRUCTION": {},
  // TWOS IS WHAT MAKES THIS TRUE, and that was not the expectation written
  // here first — it had to be corrected by the run. On ONES the exposure is
  // NOT symmetric about the edge: the turning portion is 27.5 frames at 30fps,
  // so the frame lattice does not centre on the dwell and the state before the
  // edge and the state after it sit at different distances from it. The twos
  // grid, anchored at the dwell, puts them back on B1's own symmetry. So the
  // continuous clock is a real negative control for this claim rather than an
  // arm that happens not to touch it.
  "the exposure is SYMMETRIC about the edge": { ones: true },
  "the grid never crosses a phase boundary": {},
}

const controls = [
  {
    key: "ones",
    label: `cadence "ones" — a new state every frame; the continuous clock this beat shipped with`,
    params: { ...P, cadence: "ones" },
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
}

/* ---- THE ANCHOR CONTROL, and it is the point of this file -----------------
 * The alternative is not a parameter, it is a design choice, so it is
 * SIMULATED here rather than described: quantise the same turn with the grid
 * anchored at the phase start instead of at the dwell, and count the frames
 * that land on the edge. If the shipped anchor is doing nothing, both numbers
 * will be the same and this whole file is decoration. */
const e = P.emerge
const off = phaseOffsets(P)
const countEdge = (phase, sampler, grid) => {
  const N = Math.round(P.beats[phase] * P.fps)
  let n = 0
  const widths = []
  for (let i = 0; i <= N; i++) {
    const t = off[phase] + i / P.fps
    const s = sampler(P, Math.max(off[phase], grid(t)))
    widths.push(Math.round(s.sx * 409))
    if (s.sx <= e.edgeFloor + 1e-9) n++
  }
  return { n, widths }
}
const shippedExposed = (() => {
  const N = Math.round(P.beats.emerge * P.fps)
  const widths = []
  let n = 0
  for (let i = 0; i <= N; i++) {
    const s = sampleHeroMotion(P, off.emerge + i / P.fps)
    widths.push(Math.round(s.sx * 409))
    if (s.sx <= e.edgeFloor + 1e-9) n++
  }
  return { n, widths }
})()
const altOut = countEdge("emerge", sampleEmerge, (t) => phaseStartGrid(P, "emerge", t))

const anchorMatters = shippedExposed.n >= 2 && altOut.n === 0
if (!anchorMatters) blind = true
console.log(`\nANCHOR CONTROL — the same turn, quantised two ways`)
console.log(`  anchored at the DWELL (shipped): ${shippedExposed.n} frames on the edge`)
console.log(`    exposure ${[...new Set(shippedExposed.widths)].join(" / ")} px at the original's scale`)
console.log(`  anchored at the PHASE START:     ${altOut.n} frames on the edge`)
console.log(`    exposure ${[...new Set(altOut.widths)].join(" / ")} px`)
console.log(
  `  → ${anchorMatters ? "the anchor is load-bearing: the phase-start grid steps clean over the moment" : "BLIND: both anchors give the same answer, so this claim proves nothing"}`,
)

const failed = shipped.filter((c) => !c.pass)
console.log(`\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped exposure.`)
if (blind) console.log(`\nINSTRUMENT IS BLIND — a control did not behave as the claim requires.`)
console.log(failed.length || blind ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind ? 1 : 0)
