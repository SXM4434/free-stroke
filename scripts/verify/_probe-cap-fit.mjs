// DOES THE CAP TRIANGULATION FIT THE OUTLINE IT IS DRAWN AT?
//
// The Solid rim's front cap is drawn at RING 0, which is the contour INSET by
// `bevelXY` — but its triangulation is computed on the ORIGINAL contour. This
// probe asks the direct question that separates those two: do the cap triangles
// overlap EACH OTHER?
//
//   a valid triangulation of a simple polygon    0 overlapping pairs
//   a triangulation applied to a polygon it was
//   not computed for                             > 0
//
// Both arms are measured on the SAME triangle list — bevel ON draws it at the
// inset positions, bevel OFF draws it at the original ones — so the arm that
// comes back clean is the control that proves the test is not blind.
//
// Triangles are convex, so the separating-axis test is exact. A shared EDGE
// must not count as an overlap, so separation is tested with a tolerance
// relative to the mesh size and the test is strict-inequality on the axis gap.
//
// Run: node scripts/verify/_probe-cap-fit.mjs [--shapes=circle,openArc,...]
import { build, SHAPES } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const SHAPE_NAMES = arg("shapes", "circle,openArc,square,crossing,tick").split(",")

const PROFILE = loadTs("lib/dd-extrude-relief.ts").EXTRUDE_BEVEL_PROFILES_FS.rounded

function quiet(fn) {
  const log = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = log
  }
}

/** Triangles whose three vertices share the mesh's maximum z — the front cap. */
function frontCapTris(pos, idx) {
  let zMax = -Infinity
  for (let i = 0; i < pos.length / 3; i++) zMax = Math.max(zMax, pos[i * 3 + 2])
  const out = []
  for (let t = 0; t < idx.length / 3; t++) {
    const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]
    if (v.every((k) => Math.abs(pos[k * 3 + 2] - zMax) < 1e-9)) {
      out.push(v.map((k) => [pos[k * 3], pos[k * 3 + 1]]))
    }
  }
  return out
}

/** Exact for convex polygons. `eps` keeps a shared edge from reading as overlap. */
function trisOverlap(A, B, eps) {
  for (const T of [A, B]) {
    for (let i = 0; i < 3; i++) {
      const p = T[i], q = T[(i + 1) % 3]
      let nx = -(q[1] - p[1]), ny = q[0] - p[0]
      const L = Math.hypot(nx, ny)
      if (L < 1e-15) continue
      nx /= L; ny /= L
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
      for (const v of A) { const d = v[0] * nx + v[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d) }
      for (const v of B) { const d = v[0] * nx + v[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d) }
      if (a1 < b0 + eps || b1 < a0 + eps) return false
    }
  }
  return true
}

function overlapPairs(tris, eps) {
  // Bucket by bbox so 500 triangles is not 125k SAT calls.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const T of tris) for (const v of T) {
    x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0])
    y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1])
  }
  const G = 48
  const bw = (x1 - x0) / G || 1, bh = (y1 - y0) / G || 1
  const cell = new Map()
  const box = tris.map((T) => {
    const tx0 = Math.min(T[0][0], T[1][0], T[2][0]), tx1 = Math.max(T[0][0], T[1][0], T[2][0])
    const ty0 = Math.min(T[0][1], T[1][1], T[2][1]), ty1 = Math.max(T[0][1], T[1][1], T[2][1])
    return [tx0, tx1, ty0, ty1]
  })
  tris.forEach((T, t) => {
    const [tx0, tx1, ty0, ty1] = box[t]
    for (let i = Math.floor((tx0 - x0) / bw); i <= Math.floor((tx1 - x0) / bw); i++)
      for (let j = Math.floor((ty0 - y0) / bh); j <= Math.floor((ty1 - y0) / bh); j++) {
        const k = i * 100003 + j
        let l = cell.get(k)
        if (!l) cell.set(k, (l = []))
        l.push(t)
      }
  })
  const seen = new Set()
  let pairs = 0
  let worst = null
  for (const list of cell.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const s = list[a] < list[b] ? list[a] * 1e6 + list[b] : list[b] * 1e6 + list[a]
        if (seen.has(s)) continue
        seen.add(s)
        const A = tris[list[a]], B = tris[list[b]]
        if (trisOverlap(A, B, eps)) {
          pairs++
          if (!worst) worst = [list[a], list[b], A, B]
        }
      }
    }
  }
  return { pairs, worst }
}

const longest = (T) =>
  Math.max(
    Math.hypot(T[0][0] - T[1][0], T[0][1] - T[1][1]),
    Math.hypot(T[1][0] - T[2][0], T[1][1] - T[2][1]),
    Math.hypot(T[2][0] - T[0][0], T[2][1] - T[0][1]),
  )

console.log("shape       bevel   capTris   overlappingPairs   longestCapEdge")
for (const shape of SHAPE_NAMES) {
  for (const bevel of [true, false]) {
    PROFILE.enabled = bevel
    const d = quiet(() => build("solid", SHAPES[shape]()))
    const tris = frontCapTris(d.pos, d.idx)
    let span = 0
    for (const T of tris) span = Math.max(span, longest(T))
    // 1e-6 world is 4 orders below the 0.015 bevel and 5 below the band width:
    // big enough that a shared edge is not an overlap, small enough that a real
    // one cannot hide under it.
    const { pairs } = overlapPairs(tris, 1e-6)
    console.log(
      `${shape.padEnd(10)}  ${(bevel ? "on" : "off").padEnd(5)}  ${String(tris.length).padStart(7)}   ${String(pairs).padStart(16)}   ${span.toFixed(4).padStart(14)}`,
    )
  }
  PROFILE.enabled = true
}
