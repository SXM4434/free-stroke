// WHAT K7's RETURN HAS TO SAY — measured on the real word, not asserted.
//
// §10.5 call 1 names K7's news as *"the crossings resolve into over/under"* and
// attaches a hard constraint: the change must be an OCCLUSION and never a
// shading, because a value difference inside the ink breaks gate 1 (flat ink
// SD < 1) while a gap leaves every surviving ink pixel at one value.
//
// The constraint holds. The PLACE does not, on this mark, and this is the
// measurement that says so — run it before believing either half:
//
//   1. TRUE CROSSINGS. Segment-vs-segment intersection over the traced
//      polylines as authored. One. In 22 strokes and 1078 points.
//   2. JUNCTIONS. Every pair of strokes whose centrelines come within one ink
//      diameter of each other, measured on the PROCESSED strokes — the same
//      arrays `app/desk-doodles/page.tsx` builds the geometry from, through the
//      same `processStroke` call with the same settings.
//
// The second number is the payload. `online-reference-mechanics.md` §9.1 found
// the same absence from the other side — *"Not one instance anywhere of a mark
// occluding itself at a crossing"* across eleven clips — so the mechanism
// survives and the specific form has to change.
//
// Usage: node scripts/verify/_probe-hero-junctions.mjs
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadTs, ROOT } from "./_ts-load.mjs"

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")

// Matches app/desk-doodles/page.tsx exactly: PROCESS_SETTINGS, the timing
// cadence, the hand-feel defaults and the derived ink width.
const MS_PER_POINT = 12
const MS_GAP_BETWEEN_STROKES = 60
const INK = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

const polylines = JSON.parse(
  readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"),
).polylines

let clock = 0
const raw = polylines.map((pl) => {
  const points = pl.map((p) => {
    const pt = { x: p.x, y: p.y, t: clock }
    clock += MS_PER_POINT
    return pt
  })
  clock += MS_GAP_BETWEEN_STROKES
  return { points }
})
const processed = raw.map((s) =>
  processStroke(s, 4, true, true, 45, { wobble: 0.4, endpoint: "protrude", inkWidth: INK }),
)

/* ---- 1. true crossings, on the authored polylines -------------------------- */
function intersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (Math.abs(d) < 1e-12) return null
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
}
const crossings = []
for (let a = 0; a < polylines.length; a++) {
  for (let b = a; b < polylines.length; b++) {
    const A = polylines[a]
    const B = polylines[b]
    for (let i = 0; i + 1 < A.length; i++) {
      for (let k = a === b ? i + 2 : 0; k + 1 < B.length; k++) {
        if (a === b && Math.abs(i - k) < 3) continue
        const p = intersect(A[i], A[i + 1], B[k], B[k + 1])
        if (p) crossings.push({ a, b, ...p })
      }
    }
  }
}

/* ---- 2. junctions, on the processed strokes -------------------------------- */
function pointToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - px, ay + t * vy - py)
}
const junctions = []
for (let a = 0; a < processed.length; a++) {
  for (let b = a + 1; b < processed.length; b++) {
    const A = processed[a].points
    const B = processed[b].points
    let best = Infinity
    let bx = 0
    let by = 0
    for (let i = 0; i < A.length; i++) {
      if (B.length === 1) {
        const d = Math.hypot(A[i].x - B[0].x, A[i].y - B[0].y)
        if (d < best) {
          best = d
          bx = A[i].x
          by = A[i].y
        }
        continue
      }
      for (let k = 0; k + 1 < B.length; k++) {
        const d = pointToSegment(A[i].x, A[i].y, B[k].x, B[k].y, B[k + 1].x, B[k + 1].y)
        if (d < best) {
          best = d
          bx = A[i].x
          by = A[i].y
        }
      }
    }
    if (best < INK) junctions.push({ under: a, over: b, x: bx, y: by, gap: best })
  }
}

console.log(`THE HERO WORD — ${polylines.length} strokes, ${polylines.reduce((a, p) => a + p.length, 0)} authored points`)
console.log(`ink diameter ${INK.toFixed(2)} stroke-coordinate px (computeSolidEffectiveThicknessPx)\n`)

console.log(`TRUE CROSSINGS (centreline X-junctions, authored polylines): ${crossings.length}`)
for (const c of crossings) {
  const w = (i) => {
    const xs = polylines[i].map((p) => p.x)
    return `${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)}`
  }
  console.log(
    `  s${c.a} x s${c.b} at ${c.x.toFixed(0)},${c.y.toFixed(0)} — s${c.a} spans x ${w(c.a)}, s${c.b} spans x ${w(c.b)} (${polylines[c.b].length} pts)`,
  )
}
console.log(
  `  → the board's "the crossings resolve into over/under" has ${crossings.length} place to happen on this mark, and it is a tick.\n`,
)

console.log(`JUNCTIONS (pairs within one ink diameter, processed strokes): ${junctions.length}`)
for (const j of junctions) {
  console.log(
    `  s${j.under} under s${j.over} at ${j.x.toFixed(0)},${j.y.toFixed(0)} — centreline gap ${j.gap.toFixed(1)}`,
  )
}
console.log(
  `\n  → K7's payload: ${junctions.length} places where the pen laid one stroke across another and the` +
    `\n    implicit surface fuses them into one mass. The later stroke is the one in front.`,
)

// Sensitivity, so the number is not a threshold artefact.
const at = (D) => {
  let n = 0
  for (let a = 0; a < processed.length; a++)
    for (let b = a + 1; b < processed.length; b++) {
      const A = processed[a].points
      const B = processed[b].points
      let best = Infinity
      for (let i = 0; i < A.length; i++) {
        if (B.length === 1) best = Math.min(best, Math.hypot(A[i].x - B[0].x, A[i].y - B[0].y))
        else
          for (let k = 0; k + 1 < B.length; k++)
            best = Math.min(
              best,
              pointToSegment(A[i].x, A[i].y, B[k].x, B[k].y, B[k + 1].x, B[k + 1].y),
            )
      }
      if (best < D) n++
    }
  return n
}
console.log(
  `\nSENSITIVITY — junctions at 0.5x / 1x / 1.5x the ink diameter: ${at(INK / 2)} / ${at(INK)} / ${at(INK * 1.5)}`,
)
