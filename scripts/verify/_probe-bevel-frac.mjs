// PROBE — does `h3BevelAchievedFrac` measure the bevel, or the miter vector?
//
// WHY THIS EXISTS. `insetLoopAgainstMask` displaces each contour vertex along a
// MITER vector
//
//     dirs[i] = (n1 + n2) / (1 + n1·n2)      |dirs[i]| = 1 / cos(turn/2)
//
// which is 1 on a straight run and √2 = 1.41421 at a 90° corner (capped at
// `OFFSET_MITER_LIMIT` = 2). That length is CORRECT — travelling `√2·offset`
// along the bisector is exactly what puts the offset polygon `offset` inside
// both incident edges.
//
// The reported fraction was not. It summed `|vecs[i]|`:
//
//     meanFrac = Σ |vecs[i]| / (n · offset)
//
// so a bevel that took the FULL requested offset at every vertex of a square
// reported **1.41421** — 141% achieved. `components/viewport-3d.tsx:9780`
// paints this green at ≥ 0.8, so the error ran in the direction that hides a
// starved rim behind a corner-rich contour.
//
// THE CONTROL IS CLOSED FORM, not a fixture reading. With `isMaterial` true
// everywhere the ladder takes `frac = 1.0` at every vertex by construction, so
// the achieved fraction is exactly 1 whatever the shape — and the OLD formula's
// answer is exactly the mean miter length, which is computable per shape. Both
// arms are run; the parked `SOLID_TUNING.bevelFrac = "miter"` must reproduce the
// wrong number, or this proves nothing.
import { loadTs } from "./_ts-load.mjs"

const sm = loadTs("lib/solid-mask.ts")
const { insetLoopAgainstMask, SOLID_TUNING } = sm

let fails = 0
const line = (ok, s) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${s}`)
}

/** A material test that says YES everywhere: the ladder can never step down. */
const allMaterial = () => true

/** CCW regular polygon of `n` sides, circumradius R, centred at the origin. */
function ngon(n, R) {
  const p = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    p.push({ x: Math.cos(a) * R, y: Math.sin(a) * R })
  }
  return p
}

/** CCW square with `perSide` extra samples along each edge (turn 0 there). */
function sampledSquare(half, perSide) {
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  const p = []
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = corners[k]
    const [x1, y1] = corners[(k + 1) % 4]
    for (let i = 0; i < perSide; i++) {
      p.push({ x: x0 + ((x1 - x0) * i) / perSide, y: y0 + ((y1 - y0) * i) / perSide })
    }
  }
  return p
}

const OFFSET = 0.015 // EXTRUDE_BEVEL_PROFILES_FS.rounded.size, the shipped value
const CELL = 1e-9 // a cell far below the offset, so no rung is short-circuited

const CASES = [
  {
    name: "square-4",
    loop: sampledSquare(1, 1),
    // 4 vertices, every one a 90° corner: mean miter length = √2.
    priorExpect: Math.SQRT2,
  },
  {
    name: "square-40",
    loop: sampledSquare(1, 10),
    // 40 vertices, 4 of them corners: (36·1 + 4·√2)/40.
    priorExpect: (36 * 1 + 4 * Math.SQRT2) / 40,
  },
  {
    name: "octagon",
    loop: ngon(8, 1),
    // Every vertex turns 45°: 1/cos(22.5°).
    priorExpect: 1 / Math.cos(Math.PI / 8),
  },
  {
    name: "circle-160",
    loop: ngon(160, 1),
    // Turn 2.25° per vertex: 1/cos(1.125°) — only 1.9e-4 above 1, which is
    // exactly why a smooth fixture never exposed this and a square does.
    priorExpect: 1 / Math.cos(Math.PI / 160),
  },
]

console.log("=== achieved fraction with the material test saying YES everywhere ===")
console.log("    Every vertex takes the FULL requested offset by construction, so the")
console.log("    honest answer is exactly 1.000000 for every shape.\n")
console.log(
  `${"shape".padEnd(12)}${"n".padStart(4)}  ${"SHIPPED".padStart(10)}  ${"PRIOR miter".padStart(12)}  ${"closed form".padStart(12)}`,
)

function run(loop, mode) {
  SOLID_TUNING.bevelFrac = mode
  try {
    return insetLoopAgainstMask(loop, OFFSET, allMaterial, CELL)
  } finally {
    SOLID_TUNING.bevelFrac = "offset"
  }
}

for (const c of CASES) {
  const shipped = run(c.loop, "offset")
  const prior = run(c.loop, "miter")
  console.log(
    `${c.name.padEnd(12)}${String(c.loop.length).padStart(4)}  ` +
      `${shipped.meanFrac.toFixed(6).padStart(10)}  ${prior.meanFrac.toFixed(6).padStart(12)}  ` +
      `${c.priorExpect.toFixed(6).padStart(12)}`,
  )
  line(
    Math.abs(shipped.meanFrac - 1) < 1e-9,
    `${c.name}: shipped reads 1.000000 for a bevel that got everything it asked for` +
      (Math.abs(shipped.meanFrac - 1) < 1e-9 ? "" : ` — got ${shipped.meanFrac.toFixed(6)}`),
  )
  line(
    Math.abs(prior.meanFrac - c.priorExpect) < 1e-9,
    `${c.name}: PRIOR arm reproduces the mean MITER length ${c.priorExpect.toFixed(6)} exactly` +
      ` (the control)`,
  )
  line(
    shipped.starved === 0 && prior.starved === 0,
    `${c.name}: 0 starved vertices in both arms (the ladder never stepped down)`,
  )
}

/* ---- BOTH DIRECTIONS: a genuinely starved bevel must still read LOW ---- */
console.log("\n=== the other direction — a starved bevel must NOT read 1.0 ===")
{
  // Material only inside a stem far thinner than the offset, so no rung of the
  // ladder can pass and every vertex is starved to zero.
  const thin = () => false
  const r = run(sampledSquare(1, 10), "offset")
  const s = insetLoopAgainstMask(sampledSquare(1, 10), OFFSET, thin, CELL)
  console.log(
    `  material everywhere: frac=${r.meanFrac.toFixed(6)} starved=${r.starved}` +
      `   material nowhere: frac=${s.meanFrac.toFixed(6)} starved=${s.starved}`,
  )
  line(s.meanFrac < 0.05, `a bevel with no material to bevel into reads ~0, not 1`)
  line(s.starved === s.vecs.length, `every vertex is reported starved (${s.starved}/${s.vecs.length})`)
}

/* ---- AND THE GEOMETRY MUST NOT HAVE MOVED ---- */
console.log("\n=== the vectors themselves are unchanged — this is a REPORT fix ===")
{
  const a = run(sampledSquare(1, 10), "offset")
  const b = run(sampledSquare(1, 10), "miter")
  let worst = 0
  for (let i = 0; i < a.vecs.length; i++) {
    worst = Math.max(worst, Math.hypot(a.vecs[i].x - b.vecs[i].x, a.vecs[i].y - b.vecs[i].y))
  }
  console.log(`  max |vec| difference between the two arms: ${worst.toExponential(3)}`)
  line(worst === 0, `the displacement vectors are byte-identical between the two arms`)
  // And the miter length really is sqrt(2) at the corners — the reason for the bug.
  const mags = a.vecs.map((v) => Math.hypot(v.x, v.y) / OFFSET)
  const maxMag = Math.max(...mags)
  console.log(`  max |vec|/offset = ${maxMag.toFixed(6)}  (= 1/cos(45°) at the four corners)`)
  line(
    Math.abs(maxMag - Math.SQRT2) < 1e-9,
    `the corner displacement is √2 × the offset — correct geometry, wrong report`,
  )
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
