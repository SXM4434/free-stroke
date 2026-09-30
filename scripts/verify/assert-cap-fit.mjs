// THE SOLID CAP IS TRIANGULATED ON THE LOOPS IT IS DRAWN AT — both directions.
//
// THE DEFECT (fold census 2026-07-31, class B). Solid's front and back caps are
// drawn at RING 0 of the rim stack, which is the contour INSET by the bevel's
// XY offset. Their triangulation was computed on the ORIGINAL contour. Earcut is
// entitled to emit a long chord as long as it stays inside the outline, and the
// inward offset narrows the outline underneath it — so on a thin form the cap
// crossed itself. Measured on `circle`, whose band is 0.087 wide: the longest
// cap edge is 0.6597 world units, subtending ~49 degrees on a mean radius of
// 0.785, sagitta 0.785(1 − cos 24.7°) = 0.072 — legal on the original band and
// 0.015 too deep for the 0.057 band that is left after insetting BOTH sides.
//
// WHAT THIS GATE HAS TO PROVE, and why one direction is not enough. Rounding the
// form, shrinking the bevel or dropping the cap would all drive the fold count
// to zero and every one of them would be a worse regression than the defect. So
// the gate is two-sided:
//
//   the fold goes away          fold rays / coplanar rays / overlapping cap
//                               triangle pairs all 0, on every fixture
//   and NOTHING ELSE MOVES      vertex positions byte-identical, triangle count
//                               identical, XY bbox identical, the whole crease
//                               census identical (so the bevel's own signature —
//                               the cap band's ~15 degree steps — is untouched),
//                               and the welded Euler characteristic identical
//                               (so the holes are still holes)
//
// AND THE INSTRUMENT IS CALIBRATED BEFORE ANY ROW IS BELIEVED. The parked prior
// behaviour, `SOLID_TUNING.capFit = "source"`, is the negative control and is
// REQUIRED to fire at its exact recorded counts; the overlap test itself is run
// against a hand-built overlapping pair and a hand-built valid fan; and `tick` —
// the fixture with no chord long enough to spill — must read 0 on BOTH arms, so
// a test that simply fired on everything would fail here.
//
// No browser: `lib/engine-node.mjs` runs the real engines in plain Node, so a
// sibling lane's save cannot fast-refresh the measurement out from under it.
//
// Run: node scripts/verify/assert-cap-fit.mjs
import { build, SHAPES } from "./lib/engine-node.mjs"
import { foldCensusComponents, creaseCensusNode } from "./lib/elbow-geom.mjs"
import { loadTs } from "./_ts-load.mjs"

const SOLID_TUNING = loadTs("lib/solid-mask.ts").SOLID_TUNING

let failures = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  if (!ok) failures++
}

function quiet(fn) {
  const log = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = log
  }
}

/* ---- the overlap test, and its own calibration ---------------------------- */

/** Exact for convex polygons. `eps` keeps a SHARED EDGE from reading as overlap. */
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

const EPS = 1e-6 // 4 orders below the 0.015 bevel; a shared edge is not overlap

/** Triangles whose three vertices sit on the mesh's maximum z — the front cap. */
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

function overlapPairs(tris) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const T of tris) for (const v of T) {
    x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0])
    y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1])
  }
  const G = 48
  const bw = (x1 - x0) / G || 1, bh = (y1 - y0) / G || 1
  const cell = new Map()
  tris.forEach((T, t) => {
    const tx0 = Math.min(T[0][0], T[1][0], T[2][0]), tx1 = Math.max(T[0][0], T[1][0], T[2][0])
    const ty0 = Math.min(T[0][1], T[1][1], T[2][1]), ty1 = Math.max(T[0][1], T[1][1], T[2][1])
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
  for (const list of cell.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const s = list[a] < list[b] ? list[a] * 1e6 + list[b] : list[b] * 1e6 + list[a]
        if (seen.has(s)) continue
        seen.add(s)
        if (trisOverlap(tris[list[a]], tris[list[b]], EPS)) pairs++
      }
    }
  }
  return pairs
}

/** V − E + F on the mesh WELDED by position: 2 for a sphere, 0 for a torus. */
function eulerWelded(pos, idx) {
  const key = (i) =>
    `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`
  const verts = new Set()
  const edges = new Set()
  const F = idx.length / 3
  for (let t = 0; t < F; t++) {
    const k = [key(idx[t * 3]), key(idx[t * 3 + 1]), key(idx[t * 3 + 2])]
    for (const v of k) verts.add(v)
    for (const [p, q] of [[k[0], k[1]], [k[1], k[2]], [k[2], k[0]]]) {
      edges.add(p < q ? `${p}|${q}` : `${q}|${p}`)
    }
  }
  return verts.size - edges.size + F
}

function bbox(pos) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let i = 0; i < pos.length / 3; i++) {
    x0 = Math.min(x0, pos[i * 3]); x1 = Math.max(x1, pos[i * 3])
    y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1])
    z0 = Math.min(z0, pos[i * 3 + 2]); z1 = Math.max(z1, pos[i * 3 + 2])
  }
  return [x0, x1, y0, y1, z0, z1].map((v) => Number(v.toFixed(9))).join(" ")
}

function measure(shape) {
  const polys = SHAPES[shape]()
  const out = {}
  for (const arm of ["inset", "source"]) {
    SOLID_TUNING.capFit = arm
    const d = quiet(() => build("solid", polys))
    const capTris = frontCapTris(d.pos, d.idx)
    out[arm] = {
      pos: d.pos,
      idx: d.idx,
      tris: d.idx.length / 3,
      capTris: capTris.length,
      overlapPairs: overlapPairs(capTris),
      fold: foldCensusComponents(d.pos, d.idx, { grid: 121 }),
      crease: creaseCensusNode(d.pos, d.idx),
      euler: eulerWelded(d.pos, d.idx),
      bbox: bbox(d.pos),
    }
  }
  SOLID_TUNING.capFit = "inset"
  return out
}

/* ==========================================================================
 * CALIBRATION — runs first, so a broken instrument costs milliseconds.
 * ======================================================================== */
console.log("\nCALIBRATION — the overlap test, against a known-bad and a known-good\n")
{
  // Two triangles sharing an edge: a valid fan. Must NOT read as overlap.
  const fanA = [[0, 0], [1, 0], [0, 1]]
  const fanB = [[1, 0], [1, 1], [0, 1]]
  // The same pair with one vertex pushed across the shared edge: an overlap.
  const badA = [[0, 0], [1, 0], [0, 1]]
  const badB = [[1, 0], [1, 1], [0.2, 0.2]]
  check("CAL-1 the overlap test FIRES on two triangles that genuinely overlap", trisOverlap(badA, badB, EPS), "vertex pushed 0.2 across the shared edge")
  check("CAL-2 the overlap test is SILENT on a valid fan sharing that same edge", !trisOverlap(fanA, fanB, EPS), "shared edge is not an overlap")
}

/* ==========================================================================
 * THE FIXTURES. `capFit: "source"` is the parked prior behaviour and the
 * negative control; every recorded count below was measured on it.
 *
 * ⚠ TWO ROWS WERE RE-RECORDED 2026-08-02, AND NOT ON AN ASSUMPTION.
 *
 * `lib/stroke-processing.ts`'s corner predicate was inverted: it compared the
 * INTERIOR angle against a threshold expressed as a TURN, so it fired on
 * straight runs and discarded real corners. Fixing it changes the PROCESSED
 * POLYLINE of any mark that has a corner — and of `openArc` too, whose single
 * spurious "corner" at index ~4 was pinning a point inside the curved lead-in.
 * The mask contour these cap tests are computed from therefore moves, and the
 * parked defect's count moves with it.
 *
 * That is a legitimate reason for a pin to move and an ILLEGITIMATE reason to
 * edit one without proof, so it was measured rather than assumed:
 *
 *     node --import ./scripts/verify/_arm-prior-corners.mjs \
 *          scripts/verify/assert-cap-fit.mjs
 *
 * re-runs THIS GATE with the parked inverted predicate selected, and comes back
 * ALL PASS on the OLD numbers — 228/59/69 and 14/4/15 exactly. So the delta is
 * the corner fix and nothing else; if anything else had moved, the old numbers
 * would not have returned and re-recording would have buried it.
 *
 *   openArc  228 / 59 / 69   ->  226 / 59 / 69
 *   square    14 /  4 / 15   ->   54 / 17 / 41
 *
 * ⚠ TWO ROWS RE-RECORDED AGAIN 2026-08-04, SAME DISCIPLINE, DIFFERENT CAUSE.
 *
 * The Solid rim repair of that date changed `insetLoopAgainstMask` in three
 * ways — the offset guard's blind radius, the edge-flip repair's scale, and the
 * bevel's per-vertex Z profile — and all three move the INSET LOOPS. Those loops
 * are precisely what the parked `capFit:"source"` arm measures the cap against,
 * so its counts had to move.
 *
 * Measured rather than assumed, by the same method as above:
 *
 *     node --import ./scripts/verify/_arm-prior-rim.mjs  *          scripts/verify/assert-cap-fit.mjs
 *
 * re-runs THIS GATE with all three parked priors selected and comes back
 * ALL CAP-FIT ASSERTIONS PASS on the OLD numbers — 226/59/69 and 54/17/41
 * exactly, and every other fixture unchanged. So the delta is this lane's rim
 * repair and nothing else.
 *
 *   openArc  226 / 59 / 69   ->  194 / 49 / 48
 *   square    54 / 17 / 41   ->   54 / 15 / 41
 *
 * BOTH MOVED DOWNWARD, which is the direction that matters: the parked defect
 * got SMALLER because the inset it is computed from is now continuous where it
 * used to tear. It still FIRES on every fixture that carried it, which is what
 * these rows exist to prove, and the SHIPPED `capFit:"inset"` arm still reads 0
 * on every fixture.
 *
 * `square` moved TWICE in the same lane and both moves are the same cause. The
 * first was the predicate; the second was the second half of the same defect —
 * `preserveCorners` pinned a corner through the smoother and the FINAL
 * `resampleStroke` then gridded straight over it, so whether the apex survived
 * was decided by where the 4 px grid happened to land. `resampleStroke` now
 * takes the corners as vertices that must survive. Deterministic across three
 * consecutive runs at 54 / 17 / 41.
 *
 * The control still FIRES in both cases — harder on `square`, which now has
 * three real corners in its contour where it used to have one spurious one —
 * which is what these rows exist to prove. The SHIPPED `capFit: "inset"` arm
 * reads 0 on every fixture, unchanged.
 * ======================================================================== */
const KNOWN_BAD = {
  circle: { overlapPairs: 198, foldRays: 53, coplanarRays: 56 },
  openArc: { overlapPairs: 194, foldRays: 49, coplanarRays: 48 },
  square: { overlapPairs: 54, foldRays: 15, coplanarRays: 41 },
  crossing: { overlapPairs: 37, foldRays: 1, coplanarRays: 2 },
  // `tick` is the fixture whose cap carries no chord long enough to spill out of
  // the inset outline. It reads 0 on BOTH arms, and that is the row that stops
  // this gate from being one that fires on everything.
  tick: { overlapPairs: 0, foldRays: 0, coplanarRays: 0 },
}

/* INSTRUMENT REPAIR 2026-08-03 — A SWEEP DRIVEN BY ITS OWN LEDGER (class 4,
 * latent). Every loop below iterated `Object.keys(KNOWN_BAD)`, a literal
 * five-name list that happens to equal `SHAPES` TODAY. The moment a sixth
 * fixture lands in `lib/engine-node.mjs` this gate stops covering it — silently,
 * because the list it iterates is the list it checks against, so the two can
 * never disagree. The sweep is driven by SHAPES now, and the ledger's coverage
 * of SHAPES is asserted in both directions before anything is measured. */
const FIXTURES = Object.keys(SHAPES)
const unledgered = FIXTURES.filter((s) => !KNOWN_BAD[s])
const orphanLedger = Object.keys(KNOWN_BAD).filter((s) => !SHAPES[s])
check(
  `LEDGER every fixture in lib/engine-node.mjs SHAPES has a recorded known-bad, and none is recorded for a fixture that is gone (${FIXTURES.length})`,
  unledgered.length === 0 && orphanLedger.length === 0,
  unledgered.length || orphanLedger.length
    ? `${unledgered.length ? `no KNOWN_BAD entry for: ${unledgered.join(", ")}. ` : ""}${orphanLedger.length ? `KNOWN_BAD names an absent fixture: ${orphanLedger.join(", ")}.` : ""}`
    : `${FIXTURES.join(", ")}`,
)

console.log("\nSWEEP — every Solid fixture, both arms\n")
console.log("shape       arm      tris   capTris   overlapPairs   foldRays   coplanar   euler")
const all = {}
for (const shape of FIXTURES) {
  const m = measure(shape)
  all[shape] = m
  for (const arm of ["source", "inset"]) {
    const a = m[arm]
    console.log(
      `${shape.padEnd(10)}  ${arm.padEnd(6)}  ${String(a.tris).padStart(5)}   ${String(a.capTris).padStart(7)}   ${String(a.overlapPairs).padStart(12)}   ${String(a.fold.foldRays).padStart(8)}   ${String(a.fold.coplanarRays).padStart(8)}   ${String(a.euler).padStart(5)}`,
    )
  }
}

console.log("\nTHE NEGATIVE CONTROL — the parked behaviour must still FIRE\n")
for (const shape of FIXTURES) {
  const want = KNOWN_BAD[shape] ?? { overlapPairs: null, foldRays: null, coplanarRays: null }
  const s = all[shape].source
  check(
    `${shape} / capFit:"source" reproduces the recorded defect exactly`,
    s.overlapPairs === want.overlapPairs && s.fold.foldRays === want.foldRays && s.fold.coplanarRays === want.coplanarRays,
    `${s.overlapPairs} overlapping cap pairs / ${s.fold.foldRays} fold rays / ${s.fold.coplanarRays} coplanar` +
      ` vs recorded ${want.overlapPairs} / ${want.foldRays} / ${want.coplanarRays}`,
  )
}

console.log("\nTHE FIX — the cap no longer crosses itself, on every fixture\n")
for (const shape of FIXTURES) {
  const a = all[shape].inset
  check(
    `${shape} / cap triangles do not overlap each other`,
    a.overlapPairs === 0,
    `${a.overlapPairs} overlapping pairs among ${a.capTris} cap triangles`,
  )
  check(
    `${shape} / no shell passes through ITSELF`,
    a.fold.foldRays === 0 && a.fold.coplanarRays === 0,
    `${a.fold.foldRays} fold rays (max ${a.fold.maxFoldSheets} depths), ${a.fold.coplanarRays} coplanar rays`,
  )
}

console.log("\nTHE OTHER DIRECTION — the form did not move\n")
for (const shape of FIXTURES) {
  const { inset: a, source: b } = all[shape]
  let posDiff = 0
  if (a.pos.length !== b.pos.length) posDiff = -1
  else for (let i = 0; i < a.pos.length; i++) if (a.pos[i] !== b.pos[i]) posDiff++
  check(
    `${shape} / every vertex POSITION is byte-identical (only the cap's indices moved)`,
    posDiff === 0,
    posDiff === -1 ? "vertex count changed" : `${posDiff} of ${a.pos.length} floats differ`,
  )
  check(
    `${shape} / triangle and cap-triangle counts unchanged`,
    a.tris === b.tris && a.capTris === b.capTris,
    `${a.tris} tris (${a.capTris} cap) vs ${b.tris} (${b.capTris})`,
  )
  check(`${shape} / silhouette unchanged (XY/Z bounds)`, a.bbox === b.bbox, a.bbox)
  check(
    `${shape} / hole topology unchanged (welded Euler characteristic)`,
    a.euler === b.euler,
    `chi ${a.euler} vs ${b.euler} — 2 = no hole, 0 = one through-hole`,
  )
  const same = (x, y) => x.n === y.n && x.mean === y.mean && x.max === y.max && x.over30 === y.over30
  check(
    `${shape} / the bevel's own signature is untouched (cap/wall/mixed crease buckets identical)`,
    same(a.crease.cap, b.crease.cap) && same(a.crease.wall, b.crease.wall) && same(a.crease.mixed, b.crease.mixed),
    `cap mean ${a.crease.cap.mean} max ${a.crease.cap.max} n ${a.crease.cap.n} · wall mean ${a.crease.wall.mean} max ${a.crease.wall.max} · mixed mean ${a.crease.mixed.mean} max ${a.crease.mixed.max}`,
  )
  check(
    `${shape} / shell still closed and manifold, and no worse than before`,
    a.crease.boundaryEdges === b.crease.boundaryEdges &&
      a.crease.nonManifoldEdges === b.crease.nonManifoldEdges &&
      a.crease.degenerateTriangles <= b.crease.degenerateTriangles,
    `boundary ${a.crease.boundaryEdges}/${b.crease.boundaryEdges}, non-manifold ${a.crease.nonManifoldEdges}/${b.crease.nonManifoldEdges}, degenerate ${a.crease.degenerateTriangles}/${b.crease.degenerateTriangles}`,
  )
}

console.log(failures === 0 ? "\nALL CAP-FIT ASSERTIONS PASS" : `\n${failures} CAP-FIT FAILURES`)
process.exit(failures === 0 ? 0 : 1)
