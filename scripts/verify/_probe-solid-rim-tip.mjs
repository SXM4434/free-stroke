// WHERE ON THE RIM IS `openArc/solid`'s 84.73? — the second half of the
// mode-rim localisation.
//
// `_probe-rim-rows.mjs` put it 1.15 half-widths past the stroke's first
// centreline point, i.e. on the silhouette's ROUNDED END CAP — a smooth curve of
// radius = the mark's own half-width, on a fixture with no drawn corner
// anywhere. A crease census cannot say which two surfaces made it. This does:
// it reads the two offending triangles out of the buffer and prints their
// vertices, so the ring the crease sits on is read rather than inferred (the
// mistake explainer 17 §1 records: Inflate's rim was diagnosed from a bare max
// and the inference was wrong).
//
// Run: node scripts/verify/_probe-solid-rim-tip.mjs [--shape=openArc]
import { SHAPES, process as processStrokes, CW, CH, px2w } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
import { census } from "./_probe-rim-rows.mjs"

const eng = loadTs("lib/geometry-engines.ts")
const solid = loadTs("lib/solid-mask.ts")
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=").slice(1).join("=")
const SHAPE = arg("shape", "openArc")

const realLog = console.log
console.log = () => {}
const strokes = processStrokes(SHAPES[SHAPE]())
const meshes = eng.SolidEngine.buildPreview(strokes, {
  canvasWidth: CW,
  canvasHeight: CH,
  extrudeParams: eng.DEFAULT_EXTRUDE_PARAMS,
  solidParams: eng.DEFAULT_SOLID_PARAMS,
  inflateParams: eng.DEFAULT_INFLATE_PARAMS,
})
console.log = realLog

const g = meshes[0].tubeGeometry
const pa = g.getAttribute("position")
const pos = new Float64Array(pa.count * 3)
for (let i = 0; i < pa.count; i++) { pos[i * 3] = pa.getX(i); pos[i * 3 + 1] = pa.getY(i); pos[i * 3 + 2] = pa.getZ(i) }
const ix = g.getIndex()
const idx = Int32Array.from({ length: ix.count }, (_, i) => ix.getX(i))

console.log(`${SHAPE}/solid  verts=${pa.count} tris=${idx.length / 3}`)
console.log(`  diagnostics: ${JSON.stringify(meshes[0].solidDiagnostics ?? meshes[0].diagnostics ?? "(none on mesh)")}`.slice(0, 400))

// THE RING STACK. The H3 assembly emits a fixed set of z levels (the bevel
// profile's rings, front and back). Read them off the buffer rather than
// re-deriving the profile: an assumption about the builder's layout is exactly
// the kind this repo keeps getting wrong (probeDihedral's own note says so).
const zs = new Map()
for (let i = 0; i < pa.count; i++) {
  const z = Number(pos[i * 3 + 2].toFixed(5))
  zs.set(z, (zs.get(z) ?? 0) + 1)
}
console.log(`  z levels (${zs.size}): ${[...zs.entries()].sort((a, b) => b[0] - a[0]).map(([z, n]) => `${z}×${n}`).join(" ")}`)

const c = census(pos, idx)
const bad = c.rows.filter((r) => r.bucket === "mixed" && r.deg > 45).sort((a, b) => b.deg - a.deg)
console.log(`\n  mixed >45: ${bad.length}`)
// Cluster them by z-of-midpoint, which is the ring pair they sit between.
const byZ = new Map()
for (const r of bad) {
  const k = Number(r.mid[2].toFixed(4))
  byZ.set(k, (byZ.get(k) ?? 0) + 1)
}
console.log(`  by midpoint z: ${[...byZ.entries()].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z}:${n}`).join(" ")}`)

const ends = (() => {
  const s = SHAPES[SHAPE]()[0]
  return [px2w(s[0].x, s[0].y), px2w(s[s.length - 1].x, s[s.length - 1].y)]
})()
console.log(`  stroke ends (world): [${ends[0].x.toFixed(4)},${ends[0].y.toFixed(4)}] [${ends[1].x.toFixed(4)},${ends[1].y.toFixed(4)}]`)
const dEnd = (r) => Math.min(...ends.map((e) => Math.hypot(r.mid[0] - e.x, r.mid[1] - e.y)))
const nearEnd = bad.filter((r) => dEnd(r) < 0.12)
console.log(`  of those, ${nearEnd.length} lie within 0.12 world (≈3.6 half-widths) of a stroke END; ${bad.length - nearEnd.length} elsewhere`)

// The two offending faces, as positions. Six edges is what probeDihedral keeps;
// this keeps eight and prints the whole triangle, because the question is which
// RING each vertex is on and that is a z-coordinate.
for (const r of bad.slice(0, 6)) {
  console.log(`\n  ${r.deg.toFixed(2)}deg  mid=[${r.mid.map((v) => v.toFixed(4))}]  dEnd=${dEnd(r).toFixed(4)}`)
  console.log(`    edge  A=[${r.a.map((v) => v.toFixed(4))}]  B=[${r.b.map((v) => v.toFixed(4))}]`)
  console.log(`    n0=[${r.n0.map((v) => v.toFixed(3))}]  n1=[${r.n1.map((v) => v.toFixed(3))}]`)
}

// WHAT THE FIRST RING ACTUALLY DID. The bevel is an inward miter offset of the
// traced contour, so the geometry that matters is the per-vertex displacement
// between the OUTERMOST ring (the wall, at inFrac 0) and RING 0 (the cap plane,
// at inFrac 1). Recover it from the buffer by pairing vertices at the same
// contour index across the two extreme z levels — the H3 assembly emits the
// rings in a fixed vertex order, so equal index means equal contour vertex.
const zSorted = [...zs.keys()].sort((a, b) => b - a)
console.log(`\n  --- ring 0 (z=${zSorted[0]}) vs the widest ring, by contour index ---`)
const ringOf = (z) => {
  const out = []
  for (let i = 0; i < pa.count; i++) if (Number(pos[i * 3 + 2].toFixed(5)) === z) out.push(i)
  return out
}
const r0 = ringOf(zSorted[0])
// The widest ring is the one whose points are furthest from the drawing centre;
// with a symmetric profile it is the middle z.
let widest = zSorted[0], widestSpan = 0
for (const z of zSorted) {
  const ring = ringOf(z)
  let minx = Infinity, maxx = -Infinity
  for (const i of ring) { minx = Math.min(minx, pos[i * 3]); maxx = Math.max(maxx, pos[i * 3]) }
  if (maxx - minx > widestSpan) { widestSpan = maxx - minx; widest = z }
}
const rW = ringOf(widest)
console.log(`  ring0 n=${r0.length} at z=${zSorted[0]}   widest ring n=${rW.length} at z=${widest} (span ${widestSpan.toFixed(4)})`)
if (r0.length === rW.length) {
  const disp = r0.map((i, k) => {
    const j = rW[k]
    return { k, d: Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1]), x: pos[j * 3], y: pos[j * 3 + 1] }
  })
  const ds = disp.map((d) => d.d)
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length
  console.log(`  inward displacement: mean ${mean.toFixed(5)}  min ${Math.min(...ds).toFixed(5)}  max ${Math.max(...ds).toFixed(5)}  (bevel size ${solid.default?.size ?? "?"} )`)
  const top = [...disp].sort((a, b) => b.d - a.d).slice(0, 10)
  console.log(`  largest displacements: ${top.map((t) => `#${t.k}=${t.d.toFixed(4)}@[${t.x.toFixed(3)},${t.y.toFixed(3)}] dEnd=${Math.min(...ends.map((e) => Math.hypot(t.x - e.x, t.y - e.y))).toFixed(3)}`).join("  ")}`)
  const zero = disp.filter((d) => d.d < 1e-6).length
  console.log(`  vertices with ZERO inward displacement (starved to a die-cut edge): ${zero} of ${disp.length}`)

  /* WHICH RUNG OF `OFFSET_LADDER` EACH VERTEX TOOK.
   *
   * `|vecs[i]|` is `dist[i] * |dirs[i]|` and `|dirs[i]| = 1/cos(turn/2)`, so
   * dividing the measured displacement by the miter length recovered from the
   * SAME loop gives back `dist[i]` — the rung. The loop is the widest ring,
   * which is the contour before any inset (inFrac 0). This is arithmetic on the
   * shipped buffer, not a re-run of the builder, so it cannot disagree with what
   * actually got built. */
  const LADDER = [1.0, 0.66, 0.33, 0.12, 0]
  const OFFSET = 0.015 // EXTRUDE_BEVEL_PROFILES_FS.rounded.size
  const nL = rW.length
  const rung = []
  for (let k = 0; k < nL; k++) {
    const P = rW[(k - 1 + nL) % nL], C = rW[k], Q = rW[(k + 1) % nL]
    let ax = pos[C * 3] - pos[P * 3], ay = pos[C * 3 + 1] - pos[P * 3 + 1]
    let bx = pos[Q * 3] - pos[C * 3], by = pos[Q * 3 + 1] - pos[C * 3 + 1]
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    if (la < 1e-12 || lb < 1e-12) { rung.push({ k, frac: NaN }); continue }
    ax /= la; ay /= la; bx /= lb; by /= lb
    const n1x = -ay, n1y = ax, n2x = -by, n2y = bx
    const denom = 1 + (n1x * n2x + n1y * n2y)
    let ml = 1
    if (denom >= 1e-6) ml = Math.min(2, Math.hypot((n1x + n2x) / denom, (n1y + n2y) / denom))
    rung.push({ k, frac: disp[k].d / ml / OFFSET, x: disp[k].x, y: disp[k].y })
  }
  const tally = new Map()
  for (const r of rung) {
    if (Number.isNaN(r.frac)) continue
    let best = LADDER[0], bd = Infinity
    for (const L of LADDER) if (Math.abs(r.frac - L) < bd) { bd = Math.abs(r.frac - L); best = L }
    tally.set(best, (tally.get(best) ?? 0) + 1)
  }
  console.log(`  LADDER RUNG TAKEN, per contour vertex: ${[...tally.entries()].sort((a, b) => b[0] - a[0]).map(([L, n]) => `${L}=${n}`).join("  ")}   (OFFSET_LADDER = [1.0, 0.66, 0.33, 0.12])`)
  // The defect is the JUMP between neighbours, not the level. A rim tears where
  // two adjacent contour vertices land on different rungs.
  let jumps = 0, worstJump = 0
  for (let k = 0; k < nL; k++) {
    const a = rung[k].frac, b = rung[(k + 1) % nL].frac
    if (Number.isNaN(a) || Number.isNaN(b)) continue
    const j = Math.abs(a - b)
    if (j > 0.2) jumps++
    worstJump = Math.max(worstJump, j)
  }
  console.log(`  NEIGHBOUR JUMPS in achieved offset > 0.2 of the requested: ${jumps} of ${nL}   worst ${worstJump.toFixed(3)}`)
  const low = rung.filter((r) => r.frac < 0.5).sort((a, b) => a.frac - b.frac).slice(0, 12)
  console.log(`  worst-starved vertices: ${low.map((t) => `#${t.k}=${t.frac.toFixed(2)}@[${t.x.toFixed(3)},${t.y.toFixed(3)}]`).join(" ")}`)
}
