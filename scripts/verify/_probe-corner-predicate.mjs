// PROBE — is `detectCorners`'s predicate inverted, and does `preserveCorners`
// change anything?
//
// WHY THIS EXISTS. `lib/stroke-processing.ts` computed
//
//     const angle = Math.acos(cosAngle)     // between (c-p) and (n-c)
//     const deviation = Math.PI - angle
//     if (deviation > threshold) { ...corner... }
//
// `(c-p)` is the vector INTO the sample and `(n-c)` is the vector OUT of it, so
// `angle` is the TURN: 0 on a straight run, PI at a hairpin. `PI - angle` is
// therefore the INTERIOR angle, and comparing it against a TURN threshold is the
// exact inversion `detectJoints3D` documents having already fixed once
// (docs/explainers/16-the-rim-and-the-bead.md §1: "acos(cosAngle) is the TURN
// angle: 0 on a straight run, PI at a hairpin. PI - acos(...) is the INTERIOR
// angle, which is the complement... Exactly backwards.").
//
// BOTH ARMS ARE RUN, always. `CORNER_TUNING.predicate = "interior"` is the
// parked prior behaviour and is the NEGATIVE CONTROL: it must FAIL every case
// the shipped arm passes. A corner gate that only ever sees its own green row
// is a green row that cannot fail.
//
// COUNT IS NOT THE TEST. The index must land ON the turn — the pre-fix code
// returns the right COUNT on a single 90-degree elbow while reporting a sample
// 21 steps away from the corner.
import { loadTs } from "./_ts-load.mjs"

const sp = loadTs("lib/stroke-processing.ts")
const { detectCorners, processStroke, CORNER_TUNING } = sp

const SPACING = 4

/** A polyline stamped the way the app stamps. */
function poly(pts) {
  let t = 0
  return pts.map((p) => {
    const q = { x: p.x, y: p.y, t, pressure: 0.6 }
    t += 10
    return q
  })
}

function line(x0, y0, x1, y1, n) {
  const out = []
  for (let i = 0; i <= n; i++) out.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n })
  return out
}

/* Every fixture is sampled at ~4 px, i.e. at the grid `resampleStroke` hands
 * `detectCorners` in production. That is the function's real contract — it is
 * called from `smoothPreservingCorners` on an already-resampled polyline — and
 * `MERGE_DISTANCE` (12 px) is above the UI slider's whole 2-8 px range for
 * exactly this reason. Feeding it a coarser polyline measures a call the app
 * never makes. */

/* A · a straight line. Zero turn everywhere. */
const straight = poly(line(100, 100, 300, 100, 50))

/* B · one exact 90-degree turn at index 25. */
const elbow = poly([...line(100, 100, 200, 100, 25), ...line(200, 100, 200, 200, 25).slice(1)])

/* C · a hairpin (180-degree reversal) at index 25. */
const hairpin = poly([...line(100, 100, 200, 100, 25), ...line(200, 100, 100, 100, 25).slice(1)])

/* D · a gentle arc: 4 px steps on a radius-200 circle = 1.15 deg per step, far
 *     under the 45 deg gate. A corner detector must stay silent. */
const arc = poly(
  Array.from({ length: 79 }, (_, i) => {
    const th = (i * 4) / 200
    return { x: 100 + 200 * Math.sin(th), y: 100 + 200 * (1 - Math.cos(th)) }
  }),
)

/* E · the `square` fixture from scripts/verify/lib/engine-node.mjs, sampled at
 *     ~3.9/3.65 px so it arrives on the production grid. Corners at 100/200/300;
 *     the fourth is the seam at 0 = 400, inside the 16 px end-arm gate. */
const square = poly(
  (() => {
    const p = []
    const c = [[250, 180], [640, 180], [640, 545], [250, 545], [250, 180]]
    for (let k = 0; k < c.length - 1; k++) {
      const [x0, y0] = c[k], [x1, y1] = c[k + 1]
      for (let i = 0; i < 100; i++) p.push({ x: x0 + ((x1 - x0) * i) / 100, y: y0 + ((y1 - y0) * i) / 100 })
    }
    p.push({ x: 250, y: 180 })
    return p
  })(),
)

const CASES = [
  { name: "straight", pts: straight, expect: 0, at: [], why: "zero turn at every sample" },
  { name: "elbow90", pts: elbow, expect: 1, at: [25], why: "one 90 deg turn, at index 25" },
  { name: "hairpin180", pts: hairpin, expect: 1, at: [25], why: "one 180 deg reversal, at index 25" },
  { name: "gentleArc", pts: arc, expect: 0, at: [], why: "1.15 deg per step, under the 45 deg gate" },
  {
    name: "square",
    pts: square,
    expect: 3,
    at: [100, 200, 300],
    why: "4 drawn corners; the 4th is the seam at 0/400, inside the end-arm gate",
  },
]

const TOL = 2

function judge(c, got) {
  const countOk = got.length === c.expect
  const near = (i) => c.at.some((a) => Math.abs(a - i) <= TOL)
  const placedOk = got.every(near) && c.at.every((a) => got.some((i) => Math.abs(a - i) <= TOL))
  return { countOk, placedOk, ok: countOk && placedOk }
}

function detectWith(predicate, pts) {
  const prev = CORNER_TUNING.predicate
  CORNER_TUNING.predicate = predicate
  try {
    return detectCorners(pts, 45, SPACING)
  } finally {
    CORNER_TUNING.predicate = prev
  }
}

let fails = 0
console.log("=== A-E · detectCorners on synthetics whose answer is known ===")
console.log("    SHIPPED = CORNER_TUNING.predicate 'turn'.  PRIOR = 'interior' (the")
console.log("    inverted predicate, parked). PRIOR must FAIL every row: a fix with no")
console.log("    failing control is not a proof.\n")
for (const c of CASES) {
  const got = detectWith("turn", c.pts)
  const prior = detectWith("interior", c.pts)
  const v = judge(c, got)
  const pv = judge(c, prior)
  let ok = v.ok
  let note = ""
  if (pv.ok) {
    ok = false
    note = " — PRIOR ARM ALSO PASSED: this row proves nothing"
  }
  if (!ok) fails++
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(11)}` +
      ` shipped=${String(got.length).padStart(2)}@[${got.slice(0, 6).join(",")}]`.padEnd(28) +
      ` prior=${String(prior.length).padStart(3)}@[${prior.slice(0, 4).join(",")}${prior.length > 4 ? ",…" : ""}]`.padEnd(24) +
      ` want ${c.expect}@[${c.at.join(",")}]` +
      `${v.countOk ? "" : "  COUNT"}${v.placedOk ? "" : "  PLACEMENT"}${note}`,
  )
  console.log(`      ${c.why}`)
}

/* ---------------- F · does the dial do anything? ---------------- */
console.log("\n=== F · preserveCorners on vs off — does the CONTROL change geometry? ===")
function sig(ps) {
  let h = 0n
  for (const p of ps) {
    h = (h * 1000003n + BigInt(Math.round(p.x * 1e6)) + BigInt(Math.round(p.y * 1e6))) & 0xffffffffffffn
  }
  return h.toString(16).padStart(12, "0")
}
function dialReport(label, predicate) {
  const prev = CORNER_TUNING.predicate
  CORNER_TUNING.predicate = predicate
  const rows = []
  try {
    for (const c of CASES) {
      const on = processStroke({ points: c.pts }, SPACING, true, true)
      const off = processStroke({ points: c.pts }, SPACING, true, false)
      const same = on.points.length === off.points.length && sig(on.points) === sig(off.points)
      let maxd = 0
      const n = Math.min(on.points.length, off.points.length)
      for (let i = 0; i < n; i++) {
        maxd = Math.max(maxd, Math.hypot(on.points[i].x - off.points[i].x, on.points[i].y - off.points[i].y))
      }
      rows.push({ name: c.name, corners: on.cornerCount, same, maxd })
    }
  } finally {
    CORNER_TUNING.predicate = prev
  }
  console.log(`  --- ${label} ---`)
  for (const r of rows) {
    console.log(
      `    ${r.name.padEnd(11)} cornerCount=${String(r.corners).padStart(2)}` +
        `  on/off ${r.same ? "IDENTICAL — the dial does nothing" : `differ, max ${r.maxd.toFixed(3)} px`}`,
    )
  }
  return rows
}
const shippedDial = dialReport("SHIPPED", "turn")
const priorDial = dialReport("PRIOR (inverted)", "interior")

/* The dial must act on the two fixtures that HAVE corners, and must be a no-op
 * on the two that do not — both directions, or "it does something now" is
 * indistinguishable from "it moves everything". */
const wantActs = new Set(["elbow90", "hairpin180", "square"])
for (const r of shippedDial) {
  const shouldAct = wantActs.has(r.name)
  const acts = !r.same
  if (acts !== shouldAct) {
    fails++
    console.log(
      `  FAIL  preserveCorners ${acts ? "moved" : "did not move"} ${r.name}` +
        ` — expected it to ${shouldAct ? "act (this shape HAS corners)" : "be a no-op (no corners)"}`,
    )
  }
}
const priorActed = priorDial.filter((r) => !r.same).map((r) => r.name)
console.log(
  `\n  PRIOR arm: the dial changed geometry on [${priorActed.join(", ") || "nothing"}]` +
    ` — and on the shapes that HAVE corners it acted for the wrong reason` +
    ` (every detected "corner" sat in a straight run, where a Taubin pass moves nothing).`,
)

/* ---------------- G · THE REAL ENTRY PATH — the hero word ---------------- */
console.log("\n=== G · the shipped hero word — the real strokes, the real settings ===")
{
  const { rawHeroStrokes, PROCESS_SETTINGS, HERO_INK_WIDTH_PX, HERO_WOBBLE_PRESET, HERO_ENDPOINT } =
    await import("./_hero-word.mjs")
  const { WOBBLE_PRESETS } = loadTs("lib/hand-feel.ts")
  const hf = {
    wobble: WOBBLE_PRESETS[HERO_WOBBLE_PRESET],
    endpoint: HERO_ENDPOINT,
    inkWidth: HERO_INK_WIDTH_PX,
  }
  const raw = rawHeroStrokes()
  for (const predicate of ["turn", "interior"]) {
    CORNER_TUNING.predicate = predicate
    let totalCorners = 0
    let identical = 0
    let worst = 0
    for (const s of raw) {
      const on = processStroke(s, PROCESS_SETTINGS.spacing, true, true, 45, hf)
      const off = processStroke(s, PROCESS_SETTINGS.spacing, true, false, 45, hf)
      totalCorners += on.cornerCount
      if (on.points.length === off.points.length && sig(on.points) === sig(off.points)) identical++
      else {
        const n = Math.min(on.points.length, off.points.length)
        for (let i = 0; i < n; i++)
          worst = Math.max(worst, Math.hypot(on.points[i].x - off.points[i].x, on.points[i].y - off.points[i].y))
      }
    }
    console.log(
      `  ${predicate === "turn" ? "SHIPPED " : "PRIOR   "} strokes=${raw.length}` +
        `  total cornerCount=${String(totalCorners).padStart(3)}` +
        `  byte-identical on/off: ${identical}/${raw.length}` +
        `  worst delta ${worst.toFixed(4)} px`,
    )
  }
  CORNER_TUNING.predicate = "turn"
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
