// THE TURN, CHECKED AGAINST THE ORIGINAL IT WAS PORTED FROM.
//
// `lib/hero-motion.ts`'s emerge beat is a port of the flip in
// `docs/reference-original/compose.ORIGINAL-FLIP.mjs` (commit f9010da). A port
// is only a port if it reproduces the thing's own numbers, so this asserts them
// directly off the sampler — no browser, no capture, no rendering. Every target
// below is a measurement someone made of the original film, cited to where.
//
// WHY THIS EXISTS SEPARATELY FROM assert-hero-transition.mjs: that gate judges
// PIXELS from a real capture and needs a dev server, a GPU and ~2 minutes. This
// one judges the MOTION MODEL and runs in milliseconds, so the numbers that
// decide whether the beat is an event at all can be checked on every edit. It
// found two real defects on its first run:
//
//   - the dwell was ZERO frames. The original's two-frame dwell is a property
//     of its SAMPLING (t = easeInOutCubic(i/26), so i=13 lands exactly on 90°).
//     This beat runs on a continuous, scrubbable clock where u never lands on
//     0.5, so the narrowest frame reached sx 0.0905 — 37px where the original
//     holds 14 — and the beat's entire moment did not exist. The dwell is now
//     an authored duration.
//   - the width-law comparison was reading a sampling difference as a law
//     difference. Corrected to compare at the sampler's own u.
//
// THE NEGATIVE CONTROL IS THE POINT. Every assertion is re-run against
// `emerge.mode = "prior"` — the parked ramp, which has no turn in it — and is
// REQUIRED to fail there. A green row that cannot fail is the lie, and ten
// instruments in this repo have now been caught reporting green while measuring
// nothing.
//
// Usage: node scripts/verify/assert-hero-turn.mjs
import { loadTs } from "./_ts-load.mjs"

const { DEFAULT_HERO_MOTION, sampleEmerge, phaseOffsets, easeInOutCubic } =
  loadTs("lib/hero-motion.ts")

/** Sample the emerge beat frame by frame at the params' own frame rate. */
function turnSeries(P) {
  const fps = P.fps
  const off = phaseOffsets(P)
  const N = Math.round(P.beats.emerge * fps)
  const rows = []
  for (let i = 0; i <= N; i++) rows.push({ i, ...sampleEmerge(P, off.emerge + i / fps) })
  return { rows, N, fps }
}

/**
 * Every claim, as a predicate over the series. Returned rather than asserted so
 * the same set can be run against the control.
 */
function claims(P) {
  const { rows, N, fps } = turnSeries(P)
  const e = P.emerge
  const dwellSec = e.dwellSec ?? 0
  const turnSec = P.beats.emerge - dwellSec
  const halfTurnFrames = (turnSec / 2) * fps

  // The original's settled word is 409-410px wide at the resolution its per-frame
  // series was measured at (docs/storyboard/measured/traced.tsv).
  const FULL = 409
  const px = (sx) => Math.round(sx * FULL)

  // B1 — the half-width passing position. Measured over the TURN-OUT's own span,
  // which is what the original's 13-frame face-out half means. Dividing by the
  // whole beat would include the dwell and dilute it.
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
  const frozen =
    dwellRows.length >= 2 &&
    dwellRows.every(
      (r) =>
        r.sx === dwellRows[0].sx &&
        r.yaw === dwellRows[0].yaw &&
        r.depth === dwellRows[0].depth &&
        r.flat === dwellRows[0].flat &&
        r.shade === dwellRows[0].shade,
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
  const atEdge = dwellRows[0] ?? null
  const inkFlip = rows.findIndex((r) => r.flat === 0)
  const inkFlipsAtEdge =
    atEdge !== null && inkFlip >= 0 && Math.abs(inkFlip - dwellRows[0].i) <= 1

  return [
    {
      name: "the turn's breakdown is a WIND-UP, not a midpoint",
      pass: breakdown !== null && breakdown >= 0.79 && breakdown <= 0.93,
      detail:
        breakdown === null
          ? "the extent never reaches half width — there is no turn to break down"
          : `half-width passing position at ${(100 * breakdown).toFixed(1)}% of the turn-out ` +
            `(original: 86.9% solved / 89.7% measured; reference wind-up band 79-93%)`,
    },
    {
      name: "the moment is HELD — two frames, not one",
      pass: dwellRows.length >= 2,
      detail: `${dwellRows.length} frames at or under the edge floor (needs >= 2; one frame at ${fps}fps reads as a dropped frame)`,
    },
    {
      name: "the dwell frames are FROZEN",
      pass: frozen,
      detail: frozen
        ? `all ${dwellRows.length} dwell frames identical in sx / yaw / depth / ink / shade`
        : "the dwell frames differ — a held beat that shimmers is a dropped frame with extra steps",
    },
    {
      name: "the sliver is never a blank frame",
      pass: atEdge !== null && atEdge.sx > 0 && px(atEdge.sx) >= 2,
      detail: atEdge
        ? `edge-on width ${px(atEdge.sx)} px at the original's scale (original: 14 px; the sx >= ${e.edgeFloor} clamp)`
        : "no edge-on frame at all",
    },
    {
      name: "the sliver is REAL THICKNESS — depth arrives before the edge",
      pass: atEdge !== null && atEdge.depth > 0.99,
      detail: atEdge
        ? `depth ${atEdge.depth.toFixed(4)} at edge-on (needs > 0.99, or the sliver is a degenerate plane and the payload is empty)`
        : "no edge-on frame at all",
    },
    {
      // TWO-SIDED ON PURPOSE, and the negative control is why. As "yaw <= 90"
      // alone this passed on the parked ramp, whose yaw is 0 on every frame —
      // vacuously true, satisfied by nothing happening at all. The real claim
      // is that the turn goes exactly TO edge-on and no further: far enough to
      // present the form's thickness, never far enough to show the mark
      // reversed.
      name: "the mark turns exactly to edge-on, and never past it",
      pass: maxYawDeg <= 90 + 1e-6 && maxYawDeg >= 89,
      detail: `max yaw ${maxYawDeg.toFixed(1)} deg (needs 89..90: reaches the edge, and a real mesh yawed past it reads right-to-left)`,
    },
    {
      name: "the state change is hidden AT the edge",
      pass: inkFlipsAtEdge,
      detail:
        inkFlip < 0
          ? "the ink never changes state"
          : `ink flips at frame ${inkFlip}, edge-on at frame ${atEdge ? atEdge.i : "n/a"} (needs to coincide)`,
    },
    {
      name: "the width law is the original's, exactly",
      pass: lawDelta < 1e-9,
      detail: `max |delta| vs |cos(easeInOutCubic(u) * pi)| clamped: ${lawDelta.toExponential(2)} (needs ~0)`,
    },
  ]
}

const P = DEFAULT_HERO_MOTION
console.log(`THE TURN — ${P.beats.emerge.toFixed(4)}s at ${P.fps}fps, mode "${P.emerge.mode}"\n`)
const shipped = claims(P)
for (const c of shipped) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}\n      ${c.detail}`)

/* ---- the negative control ------------------------------------------------- */
const control = { ...P, emerge: { ...P.emerge, mode: "prior" } }
const controlled = claims(control)
const controlPasses = controlled.filter((c) => c.pass)

console.log(`\nNEGATIVE CONTROL — the same assertions against emerge.mode "prior"`)
console.log(`(the parked ramp: no turn, no dwell, silhouette pixel-identical throughout)`)
for (const c of controlled) console.log(`  ${c.pass ? "PASS <- WRONG" : "fails, correctly"}  ${c.name}`)

const failed = shipped.filter((c) => !c.pass)
const blind = controlPasses.length > 0
console.log(
  `\n${shipped.length - failed.length}/${shipped.length} claims hold on the shipped turn.` +
    `\n${controlled.length - controlPasses.length}/${controlled.length} correctly FAIL on the control.`,
)
if (blind) {
  console.log(
    `\nINSTRUMENT IS BLIND — ${controlPasses.length} assertion(s) pass on a beat with no turn in it:\n` +
      controlPasses.map((c) => `  - ${c.name}`).join("\n"),
  )
}
console.log(failed.length || blind ? "\nNOT SOUND" : "\nSOUND")
process.exit(failed.length || blind ? 1 : 0)
