// DOES THE CUT DISCONNECT THE MARK? — the question a sum cannot ask, answered
// in the geometry rather than by a margin.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// `findHeroJunctions` (app/desk-doodles/page.tsx) used to drop a junction unless
// it sat further than `JOINT_BREAK_REACH_K · inkDiameter` from either end of the
// UNDER stroke. That margin is BACKWARDS for the failure it was written against:
// the further from the end a junction is, the BIGGER the piece a break leaves
// floating. Measured — `_probe-break-carve.mjs --prior --perBreak` at carve 1.00,
// where the law's own three drop rules already reduce the 22 candidate contacts
// to nine breaks:
//
//     0->1   142 px  assembled        18->20   49 px  621 px ADRIFT
//     3->4    76 px  assembled        18->21   60 px  638 px ADRIFT
//     4->6   114 px  assembled
//     6->7    78 px  assembled        7->8    156 px  (the model's known edge —
//     8->9    74 px  assembled                 it reads 7 components where the
//    16->17  130 px  assembled                 live gate reads 6)
//
// The margin admits 18->20 and 18->21 — `toEnd` 2.44 R and 1.77 R, both under
// its 1.25 ink diameters… no: both are UNDER the margin and so were correctly
// dropped, while 0->1 at 2.13 R was dropped too and is one of the good ones.
// It separates nothing: on this word the margin's decision and the damage
// disagree in both directions. So the margin is not the question.
//
// ── WHAT THE QUESTION IS ───────────────────────────────────────────────────
// `buildJointBreaks` says what a break IS: a slab of the UNDER stroke's
// centreline, removed where that centreline sits in the paper band around the
// OVER stroke. The law already reads the three regions that slab lives in —
// `behind` (inside the front stroke's ink), `cut` (in the band), and everything
// past `outer` — but it reads them as TOTALS. A total cannot say which SIDE of
// the junction it came from, and a letter comes apart on one side.
//
// Read per direction instead, the same three regions answer it exactly. Walking
// the under stroke away from the junction, it either
//
//   COVERED   ends while still inside the front stroke's ink  -> that tail is
//             hidden, and attached to the stroke that hides it;
//   CONSUMED  ends inside the paper band                      -> that tail is
//             removed outright, so there is nothing to strand;
//   SURVIVES  leaves the band with stroke still to run        -> a piece of ink
//             survives past the cut, and it has to reach the rest of the mark.
//
// The break is admissible when the two surviving pieces are still in one piece —
// i.e. when the cut does not raise the mark's connected-component count. That is
// the same property `assert-hero-k7-intact.mjs` counts on the render, computed on
// the contact graph the junction search already builds, and it is not a
// threshold: nothing in it is fitted to this word.
//
// ── AND IT IS CALIBRATED, NOT TRUSTED ──────────────────────────────────────
// `--calibrate` counts the components of the CARVED contact graph and requires
// them to equal the six the raster reads (`_probe-break-carve.mjs`, carve 1.00
// UNBROKEN: 6) and the six the live gate reads at K1. A graph that disagrees
// with the picture is a model of a different mark.
//
// Usage:
//   node scripts/verify/_probe-junction-crossing.mjs [--prior] [--carve=1] [--calibrate]
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "break-carve")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)
const CACHE = join(OUT, has("prior") ? "live-junctions-prior.json" : "live-junctions.json")

const flat = loadTs("lib/flat-ink.ts")
const { carvedHalfWidth, JOINT_BREAK_KEEP_K, PEN_NIB_DEFAULT } = flat

const strokes = processedHeroStrokes().map((s) => s.points)
const live = JSON.parse(readFileSync(CACHE, "utf8"))
const ink = live.inkWidth
const R = ink / 2
const carve = Number(arg("carve", "1"))
const breakK = Number(arg("breakK", String(live.breakK)))
const gap = Math.max(0, breakK) * ink
const tubeKeep = (JOINT_BREAK_KEEP_K * ink) / 2

/** The law's own radius: the tube's at carve 0, the nib's at 1. */
const sized = (pts, i) =>
  tubeKeep + (carvedHalfWidth(pts, i, R, PEN_NIB_DEFAULT) - tubeKeep) * carve

function nearestIdx(pts, x, y) {
  let bi = 0
  let bd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2
    if (d < bd) {
      bd = d
      bi = i
    }
  }
  return bi
}
function segDist(qx, qy, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
}
function polylineDist(pts, qx, qy) {
  if (pts.length === 1) return Math.hypot(pts[0].x - qx, pts[0].y - qy)
  let best = Infinity
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = segDist(qx, qy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (d < best) best = d
  }
  return best
}
function arcs(pts) {
  const a = [0]
  for (let i = 1; i < pts.length; i++)
    a.push(a[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return a
}

/**
 * Which of the three regions the under stroke is in when it runs out, walking
 * away from the junction in one direction. Half a stroke unit per step —
 * finer than the 4-unit resampling, so a short exit cannot fall between points.
 */
function sideOutcome(A, ai, B, keepOver, outer, sign) {
  let acc = 0
  let k = ai
  let left = null
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= A.length) {
      if (left !== null) return { kind: "SURVIVES", arc: left, run: acc - left }
      const d = polylineDist(B, A[k].x, A[k].y)
      return { kind: d <= keepOver ? "COVERED" : "CONSUMED", arc: acc, run: 0 }
    }
    const seg = Math.hypot(A[n].x - A[k].x, A[n].y - A[k].y)
    const steps = Math.max(1, Math.ceil(seg / 0.5))
    for (let s = 1; s <= steps; s++) {
      const f = s / steps
      const qx = A[k].x + (A[n].x - A[k].x) * f
      const qy = A[k].y + (A[n].y - A[k].y) * f
      if (left === null && polylineDist(B, qx, qy) > outer) left = acc + seg * f
    }
    acc += seg
    k = n
  }
}

/* ---------------------------------------------------------------------- */
/*  The contact graph of the CARVED mark                                   */
/* ---------------------------------------------------------------------- */

/**
 * Every pair of strokes whose INK actually overlaps once the mark is carved,
 * with WHERE along each of them.
 *
 * ⚠ IT IS NOT THE CLOSEST APPROACH, AND THAT DISTINCTION IS LOAD-BEARING.
 * `buildPenField` bakes `min_j (|q − p_j| − w_j)`, a union of stamps whose radius
 * varies with travel direction — so two strokes overlap iff SOME pair of stamps
 * overlaps, `min_ij (|p_i − p_j| − w_i − w_j) <= 0`, not iff the nearest pair
 * does. Minimising the raw distance instead misses a fatter stamp a little
 * further along, which is the same one-sample mistake the field's own comment
 * warns about. Measured: on the closest-approach test this graph reads SEVEN
 * components against the raster's six — it splits 13 off 14/15 — because 13->14's
 * nearest pair is 19.20 units apart against half-widths of 10.08 + 8.03, while
 * the stamp that actually bridges them is 0.92 R rather than 0.71 R.
 *
 * The tube still fuses far more than this: this is the carved mark's graph, which
 * is the one the return is looked at on.
 */
function contacts() {
  const W = strokes.map((pts) => pts.map((_, i) => sized(pts, i)))
  const out = []
  for (let a = 0; a < strokes.length; a++) {
    for (let b = a + 1; b < strokes.length; b++) {
      const A = strokes[a]
      const B = strokes[b]
      let best = Infinity
      let ai = 0
      let bi = 0
      for (let i = 0; i < A.length; i++) {
        for (let k = 0; k < B.length; k++) {
          const d = Math.hypot(A[i].x - B[k].x, A[i].y - B[k].y) - W[a][i] - W[b][k]
          if (d < best) {
            best = d
            ai = i
            bi = k
          }
        }
      }
      if (best <= 0) out.push({ a, b, ai, bi, sep: best })
    }
  }
  return out
}

function componentsOf(nodes, edges) {
  const parent = new Map(nodes.map((n) => [n, n]))
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  const union = (x, y) => {
    const rx = find(x)
    const ry = find(y)
    if (rx !== ry) parent.set(rx, ry)
  }
  for (const [x, y] of edges) if (parent.has(x) && parent.has(y)) union(x, y)
  return { find, count: new Set(nodes.map(find)).size }
}

const G = contacts()

if (has("calibrate")) {
  const nodes = strokes.map((_, i) => `s${i}`)
  const { find, count } = componentsOf(
    nodes,
    G.map((c) => [`s${c.a}`, `s${c.b}`]),
  )
  const tally = new Map()
  nodes.forEach((n) => {
    const r = find(n)
    tally.set(r, [...(tally.get(r) ?? []), n])
  })
  console.log(`carved contact graph: ${G.length} contacts, ${count} components`)
  for (const [, v] of tally) console.log(`   {${v.map((s) => s.slice(1)).join(" ")}}`)
  console.log(
    `\nthe raster reads 6 (\`_probe-break-carve.mjs\`, carve 1.00 UNBROKEN) and the live gate ` +
      `reads 6 at K1.\n${count === 6 ? "CALIBRATED ✓" : "✗ THE GRAPH DESCRIBES A DIFFERENT MARK"}`,
  )
  process.exit(count === 6 ? 0 : 1)
}

console.log(
  `${has("prior") ? "PRIOR" : "SHIPPED"} set · ${live.list.length} junctions · ink ${ink.toFixed(2)} ` +
    `(R ${R.toFixed(2)}) · carve ${carve.toFixed(2)} · breakK ${breakK} (band ${gap.toFixed(1)}u)\n`,
)
console.log("  u->o   keepO   side(+)          side(-)         VERDICT")
const admitted = []
const rejected = []
for (const jn of live.list) {
  const A = strokes[jn.under]
  const B = strokes[jn.over]
  if (!A || !B || A.length < 2 || B.length < 2) {
    console.log(`  ${jn.under}->${jn.over}   degenerate stroke — no break is expressible`)
    continue
  }
  const ai = nearestIdx(A, jn.x, jn.y)
  const bi = nearestIdx(B, jn.x, jn.y)
  const keepOver = sized(B, bi)
  const outer = keepOver + gap
  const bArc = arcs(B)
  const bEnd = Math.min(bArc[bi], bArc[bArc.length - 1] - bArc[bi])
  const overIsCap = !(bEnd > keepOver)
  const sp = sideOutcome(A, ai, B, keepOver, outer, 1)
  const sm = sideOutcome(A, ai, B, keepOver, outer, -1)

  /* THE FAR SIDE HAS TO BE A STROKE, NOT A CRUMB. The only intrinsic length in
   * the problem is the mark's own width, so that is the bar: a piece shorter
   * than the stroke is wide is a blob. Measured, that is the `D`: 0->1 crosses
   * its own bar at 81.5° and leaves 13 units of stem above it against a diameter
   * of 22.6, which at 5x reads as a floating triangle over a severed stem
   * (`break-0-1.png`). */
  const keepUnder = sized(A, ai)
  const need = 2 * keepUnder
  const outFar = sp.kind === "SURVIVES" && sp.run >= need
  const outNear = sm.kind === "SURVIVES" && sm.run >= need
  const ok = !overIsCap && outFar && outNear
  ;(ok ? admitted : rejected).push(`${jn.under}-${jn.over}`)
  const f = (s) =>
    `${s.kind}${s.kind === "SURVIVES" ? `+${s.run.toFixed(0)}u` : ""}@${s.arc.toFixed(1)}`.padEnd(16)
  console.log(
    `  ${String(jn.under).padStart(2)}->${String(jn.over).padEnd(2)} ${keepOver.toFixed(1).padStart(6)}   ` +
      `${f(sp)} ${f(sm)} ${ok ? "ADMIT" : "reject"}` +
      `${overIsCap ? " · the stroke in front is a terminal CAP" : ""}` +
      `${!outFar || !outNear ? ` · no far side (needs ${need.toFixed(0)}u of stroke past the cut)` : ""}`,
  )
}
console.log(`\nadmitted ${admitted.length}: [${admitted.join(" ")}]`)
console.log(`rejected ${rejected.length}: [${rejected.join(" ")}]`)
