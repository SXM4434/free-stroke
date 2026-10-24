// WHAT KIND OF CONTACT IS EACH "JUNCTION"? — the measurement the eye demanded.
//
// WHY. Watching the shipped beat back at full res, K7's returned mark is not a
// drawing carrying its own pen order. It is a drawing with a DECAPITATED `l`
// (the ascender's tip left floating, detached from its own stem), a severed `s`,
// and a cluster of four white bars across the `sk` that reads as shattered.
// `assert-hero-k7-news.mjs` is 8/8 green over the same frames, and it is right
// about every single thing it measures — 1544 px ink→paper, 0 px paper→ink,
// interior sd 0.000, break area within 5 % of the model. None of those can see
// a letter coming apart.
//
// THE SUSPECT is the definition. `findHeroJunctions` (app/desk-doodles/page.tsx)
// takes every PAIR of strokes whose centrelines come within one ink diameter and
// calls that a junction — and its own docstring records that a true
// centreline-crossing test finds **one** intersection in 22 strokes. So the set
// is not crossings. The question this answers is what it IS: a hand lifts and
// re-places the pen constantly, so two strokes that CONTINUE each other end to
// end are also within one ink diameter, and breaking there does not reveal an
// over/under — there is nothing over anything. It cuts the letter in half.
//
// So: classify each of the 22 by the two properties that separate "laid across"
// from "carried on".
//
//   INTERIOR-ness — where the contact sits along each stroke, as a fraction of
//   that stroke's own arc length. A crossing happens in the middle of both. A
//   continuation happens at the END of at least one.
//
//   CROSSING ANGLE — the angle between the two tangents at the contact. A
//   crossing is near-perpendicular. A continuation is near-parallel (the pen
//   carries on in the same direction); so is a stroke that runs alongside
//   another for a while, which is the other thing this word is full of.
//
// Usage: node scripts/verify/_probe-junction-kind.mjs

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadTs, ROOT } from "./_ts-load.mjs"

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")

// Matches app/desk-doodles/page.tsx exactly — same settings, same derived ink.
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
const strokes = raw.map((s) =>
  processStroke(s, 4, true, true, 45, { wobble: 0.4, endpoint: "protrude", inkWidth: INK }),
)

const arc = (pts) => {
  const a = [0]
  for (let i = 1; i < pts.length; i++)
    a.push(a[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return a
}
const tangentAt = (pts, i) => {
  const a = pts[Math.max(0, i - 2)]
  const b = pts[Math.min(pts.length - 1, i + 2)]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return { x: dx / L, y: dy / L }
}
function pointToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0
  return { d: Math.hypot(ax + t * vx - px, ay + t * vy - py), t }
}

const rows = []
for (let a = 0; a < strokes.length; a++) {
  for (let b = a + 1; b < strokes.length; b++) {
    const A = strokes[a].points
    const B = strokes[b].points
    let best = Infinity
    let ai = 0
    let bi = 0
    let bt = 0
    for (let i = 0; i < A.length; i++) {
      for (let k = 0; k + 1 < B.length || (B.length === 1 && k === 0); k++) {
        const r =
          B.length === 1
            ? { d: Math.hypot(A[i].x - B[0].x, A[i].y - B[0].y), t: 0 }
            : pointToSegment(A[i].x, A[i].y, B[k].x, B[k].y, B[k + 1].x, B[k + 1].y)
        if (r.d < best) {
          best = r.d
          ai = i
          bi = k
          bt = r.t
        }
        if (B.length === 1) break
      }
    }
    if (best >= INK) continue

    const aa = arc(A)
    const ba = arc(B)
    const aLen = aa[aa.length - 1] || 1
    const bLen = ba[ba.length - 1] || 1
    const aPos = aa[ai] / aLen
    const bPos = B.length > 1 ? (ba[bi] + bt * (ba[bi + 1] - ba[bi])) / bLen : 0
    const ta = tangentAt(A, ai)
    const tb = B.length > 1 ? tangentAt(B, Math.min(B.length - 1, bi)) : { x: 1, y: 0 }
    const dot = Math.abs(ta.x * tb.x + ta.y * tb.y)
    const angle = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI

    // How far the contact sits from the NEARER end of each stroke, both as a
    // fraction and in ink diameters — a break one ink diameter from a tip takes
    // the tip off.
    const aEndFrac = Math.min(aPos, 1 - aPos)
    const bEndFrac = Math.min(bPos, 1 - bPos)
    const aEndPx = aEndFrac * aLen
    const bEndPx = bEndFrac * bLen
    rows.push({
      under: a, over: b, gap: best,
      aPos, bPos, aEndFrac, bEndFrac, aEndPx, bEndPx,
      aLen, bLen, angle,
    })
  }
}

console.log(`ink diameter ${INK.toFixed(2)} px · ${strokes.length} strokes · ${rows.length} junctions as shipped\n`)
console.log(
  "  under over   gap   angle    pos on under   pos on over   nearest end (under/over), in ink diameters   verdict",
)
let across = 0
for (const r of rows) {
  // "LAID ACROSS" = the contact is INSIDE both strokes and the two tangents
  // genuinely cross. Everything else is the pen carrying on, or two strokes
  // running alongside each other.
  const interior = r.aEndPx > INK && r.bEndPx > INK
  const crosses = r.angle > 25
  const verdict = interior && crosses ? "ACROSS" : !interior ? "END — a continuation" : "PARALLEL — alongside"
  if (interior && crosses) across++
  console.log(
    `  ${String(r.under).padStart(5)} ${String(r.over).padStart(5)} ${r.gap.toFixed(2).padStart(6)} ${r.angle.toFixed(0).padStart(6)}°` +
      `   ${r.aPos.toFixed(2).padStart(12)}  ${r.bPos.toFixed(2).padStart(12)}` +
      `   ${(r.aEndPx / INK).toFixed(2).padStart(6)} / ${(r.bEndPx / INK).toFixed(2).padStart(6)}` +
      `                    ${verdict}`,
  )
}
console.log(
  `\n${rows.length} junctions as shipped · ${across} of them are one stroke LAID ACROSS another` +
    `\n${rows.filter((r) => !(r.aEndPx > INK && r.bEndPx > INK)).length} are a contact at a stroke END — the pen lifting and carrying on` +
    `\n${rows.filter((r) => r.aEndPx > INK && r.bEndPx > INK && r.angle <= 25).length} are two strokes running ALONGSIDE each other`,
)
