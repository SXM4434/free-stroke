// THE CLOSED-LOOP SEAM — Rod and Inflate, gated in BOTH directions.
//
// THE DEFECT. A stroke that returns to its own start was finished with two ENDS:
// Inflate tapered both to the tip fraction and capped each with a dome, Rod left
// an open tube and put a sphere at each end. At a seam those two ends are on top
// of each other, so the domes interpenetrate and the spheres are duplicates.
// This is the SAME defect explainer 17 §2 fixed for Extrude ("a closed loop
// built with two overlapping caps", 153 non-manifold edges -> 0). Rod and
// Inflate never received the treatment, and nothing measured it until the fold
// census (`assert-fold-census.mjs`) found it.
//
// NO BROWSER. Every question here is a question about the BUFFERS — does the
// shell pass through itself, does the corner still reach, does the taper still
// narrow — and the renderer is not in the causal chain. `lib/engine-node.mjs`
// runs the REAL engines through the REAL `processStroke` in plain Node, which
// also makes this immune to the shared dev server being fast-refreshed by a
// sibling lane mid-capture (measured 2026-07-31; see `_run-clean.mjs`). What it
// cannot answer — how the seam LOOKS under a specular — stays a browser pass.
//
// CALIBRATED IN BOTH DIRECTIONS, because a fix that flattens a genuine taper or
// rounds away a genuine corner is a worse regression than the defect:
//
//   KNOWN-BAD    the parked `capped` behaviour must FIRE on every assertion
//                that the fix is supposed to clear. A gate that only ever sees
//                the fixed build cannot fail.
//   OPEN CONTROL `openArc` ends near where it started but is NOT closed. It must
//                come out BYTE-IDENTICAL between the two settings — same
//                triangle count, same vertex positions to 1e-12 — or the
//                detector is over-eager and is rewriting open marks.
//   TAPER        an open stroke must still narrow at its ends. The fix removes
//                the taper on a LOOP (which is the look change, and is Sebs's
//                call); removing it anywhere else would be the regression.
//   UNIFORMITY   the wrapped loop must have no bulge and no pinch at the seam.
//                The first version of this fix had a +22 % one, because the
//                crossing bulge was reading the seam as a self-crossing.
//
// ---------------------------------------------------------------------------
// INSTRUMENT REPAIR, 2026-08-03. This gate was RED with two failures and BOTH
// were defects in the instrument, not in Rod. Named here so the next reader
// does not re-derive them:
//
//   D1 VACUOUS NEGATIVE CONTROL. KNOWN-BAD-2 cast fold rays through a buffer
//      built by `rodDump`, which read `m.tubeGeometry` and nothing else. The
//      interpenetrating surfaces at a `capped` seam are the two CAP SPHERES,
//      and the viewport instantiates those separately from `capPositions` /
//      `jointPositions` (`lib/engine-node.mjs:118-124` says so in as many
//      words). So the one thing the control exists to see had been excluded
//      from the buffer BY CONSTRUCTION. The old assertion could only ever have
//      passed by accident, and on 2026-08-03 it stopped doing so.
//   D2 A DETECTOR AT ITS RESOLUTION FLOOR. What the row actually measured was
//      a 1-ray grid artifact. At `grid: 121` the square's bin is 0.01276 world
//      and TUBE_RADIUS is 0.01200 — ONE RAY PER TUBE RADIUS. Swept across
//      grid 61/91/121/141/161/181/241/301 the same `square/rod` build reads
//      capped 0/0/0/1/4/3/5/12 and wrapped 0/0/1/1/3/1/3/8: non-monotone, and
//      at grid 121 it reports MORE folds for the FIXED build than for the
//      broken one. A statistic that ranks the fix below the defect is not
//      measuring the defect. The `wrapped` "fold" that failed SEAM-2 sat at
//      (1.1724, -0.5388) — an ordinary mitred corner 1.9 world units from the
//      seam at (-0.2805, 0.8267).
//   D3 AN UNGATED ARM. SEAM-1 asserted `results.circle` only, while the same
//      run's table printed `square INFLATE forced loft 22 -> 10` — ten fold
//      rays surviving in the wrapped arm with nothing reading them.
//
// WHAT REPLACED THEM. Two statistics that are EXACT and carry no grid:
//
//   capSepOverR   the distance between a stroke's two cap sphere centres, in
//                 units of the tube radius. Two spheres of radius r overlap
//                 iff their centres are closer than 2 r. This is the number
//                 `ROD_TUNING.loopEnds` documents, and it reproduces to four
//                 decimals: square/capped 0.4950, circle/capped 0.6999,
//                 openArc (open control) 37.1953.
//   selfProxOverR the closest approach of the tube CENTRELINE to itself, over
//                 pairs of stations more than 6 r apart along the arc (so a
//                 neighbour and a mitre are not self-approach), in units of r.
//                 A tube of radius r passes through itself iff this is under
//                 2. Measured: square/capped 0.0000 AT (-0.2805, 0.8267) —
//                 the documented seam corner exactly — circle/capped 0.0000,
//                 square/wrapped 4.4209, circle/wrapped 6.0910, openArc
//                 6.1212 in BOTH settings.
//
// The fold census stays, over the FULL assembly including the spheres, and is
// printed and written to JSON — but as a diagnostic, and where it is gated at
// all it is gated across a SWEEP of grids rather than at one.
// ---------------------------------------------------------------------------
//
// Run: node scripts/verify/assert-seam.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import * as THREE from "three"
import { build, SHAPES, px2w, process as processStrokes } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
import { foldCensusComponents, creaseCensusNode, sliceZ, analyseCorner, castRay } from "./lib/elbow-geom.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "seam")
const eng = loadTs("lib/geometry-engines.ts")
/* READ FROM THE ENGINE, never re-declared here. If TUBE_RADIUS moves, every
 * threshold below moves with it, because every threshold below is in units of
 * it. A gate that keeps its own copy of the constant it guards is blind to the
 * only change that matters. */
const R = eng.TUBE_RADIUS

/* THE ARM — how this file's own repair is proven, rather than asserted.
 *
 *   node scripts/verify/assert-seam.mjs                     the shipped build
 *   SEAM_ARM=capped node scripts/verify/assert-seam.mjs      the PARKED build,
 *                                                            fed in as if it
 *                                                            were the fix
 *
 * Under the arm the `wrapped` column is BUILT WITH `capped`, so every assertion
 * in section 2 is pointed at the known-bad geometry. All of them must go RED.
 * A gate that survives that is not reading its subject — which is exactly what
 * the old KNOWN-BAD-2 was doing (see D1 in the header), and the only way to
 * find that out is to run it. The arm exists because "this row can fail" is a
 * claim, and a claim in a verification file has to be executable. */
const ARM = process.env.SEAM_ARM ?? ""
const LOOP_ENDS = { capped: "capped", wrapped: ARM === "capped" ? "capped" : "wrapped" }
if (ARM) console.log(`[arm] SEAM_ARM=${ARM} — the "wrapped" column is built with loopEnds="${LOOP_ENDS.wrapped}"`)

let failures = 0
const rows = []
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  rows.push({ name, ok: !!ok, detail })
  if (!ok) failures++
}

/* ---- helpers --------------------------------------------------------- */
/* PARKED, NOT DELETED — the dump this file shipped until 2026-08-03. It reads
 * `m.tubeGeometry` and stops there, which is defect D1 above: Rod's cap and
 * joint SPHERES are not in `tubeGeometry`, so a census over this buffer cannot
 * see the pair of near-coincident surfaces that IS the closed-seam defect. Kept
 * because the tube alone is still the right subject for a question about the
 * SWEEP (does the tube fold), and because the two numbers side by side are the
 * evidence that the spheres were the missing term. */
const rodDumpTubeOnly = (meshes) => {
  const pos = []
  const idx = []
  for (const m of meshes) {
    const g = m.tubeGeometry
    const p = g.getAttribute("position")
    const base = pos.length / 3
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i))
    const ix = g.getIndex()
    for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
  }
  return { pos: Float64Array.from(pos), idx: Int32Array.from(idx) }
}

/* THE FULL RENDERED ASSEMBLY — tube PLUS the cap and joint spheres, at the
 * radius and segment counts the viewport instantiates them with
 * (`components/viewport-3d.tsx`: `const r = d.capRadius ?? TUBE_RADIUS`, and
 * `SPHERE_SEGMENTS` / `JOINT_SPHERE_SEGMENTS` from the engine). This is what a
 * browser-side `dumpMeshes` hands the probes, and it is what a person looking
 * at a Rod mark actually sees. Component counts confirm the spheres arrive:
 * square/capped 6 components (tube + 2 caps + 3 joints) against wrapped's 4. */
const pushGeom = (pos, idx, g) => {
  const p = g.getAttribute("position")
  const base = pos.length / 3
  for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i))
  const ix = g.getIndex()
  if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
  else for (let i = 0; i < p.count; i++) idx.push(base + i)
}
const rodDump = (meshes) => {
  const pos = []
  const idx = []
  for (const m of meshes) {
    pushGeom(pos, idx, m.tubeGeometry)
    const r = m.capRadius ?? R
    for (const c of m.capPositions ?? []) {
      const g = new THREE.SphereGeometry(r, eng.SPHERE_SEGMENTS, eng.SPHERE_SEGMENTS)
      g.translate(c.x, c.y, c.z)
      pushGeom(pos, idx, g)
    }
    for (const j of m.jointPositions ?? []) {
      const g = new THREE.SphereGeometry(r, eng.JOINT_SPHERE_SEGMENTS, eng.JOINT_SPHERE_SEGMENTS)
      g.translate(j.x, j.y, j.z)
      pushGeom(pos, idx, g)
    }
  }
  return { pos: Float64Array.from(pos), idx: Int32Array.from(idx) }
}

/* DUPLICATE-SURFACE SEPARATION, the exact form of the defect.
 *
 * `ROD_TUNING.loopEnds` records it in prose: at a closed seam the two cap
 * spheres are "0.50 r apart on `square` and 0.70 r apart on `circle`", and on
 * the open control "37.2 r apart". Two spheres of radius r are the same surface
 * twice when their centres are closer than 2 r. No grid, no ray, no sampling —
 * two points and a subtraction, so it reproduces to the digit. Returns the
 * WORST (smallest) separation across the meshes, or `null` when a build emits
 * no caps at all, which is itself the fixed state. */
const capSepOverR = (meshes) => {
  let worst = null
  for (const m of meshes) {
    const cp = m.capPositions
    if (!cp || cp.length < 2) continue
    const s = cp[0].distanceTo(cp[1]) / (m.capRadius ?? R)
    if (worst === null || s < worst) worst = s
  }
  return worst
}

/* CENTRELINE SELF-APPROACH, the exact form of "the shell passes through itself".
 *
 * A tube of radius r sweeps a surface that intersects itself exactly where two
 * centreline stations more than a neighbourhood apart come within 2 r. Stations
 * closer than `gapOverR` along the ARC are excluded, because a neighbour is not
 * a self-approach and neither is a mitred corner: two points s of arc either
 * side of a right angle are s·sqrt(2) apart, so at 6 r the corner floor is
 * 4.24 r — twice the overlap threshold, which is the margin this gate runs on.
 * Arc distance is measured AROUND the loop when the curve is closed, so a
 * wrapped seam is correctly a neighbourhood and not a self-approach.
 *
 * This replaces the fold-ray count as the gated quantity for Rod. It carries no
 * resolution: refine the sampling and the answer converges, it does not grow. */
const SELF_PROX_GAP_OVER_R = 6
const centrelineSelfProx = (curve, N = 1001) => {
  const pts = []
  for (let i = 0; i < N; i++) pts.push(curve.getPointAt(i / (N - 1)))
  const arc = [0]
  for (let i = 1; i < N; i++) arc.push(arc[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const total = arc[N - 1]
  const gap = SELF_PROX_GAP_OVER_R * R
  let best = Infinity
  let at = null
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let ds = arc[j] - arc[i]
      if (curve.closed) ds = Math.min(ds, total - ds)
      if (ds <= gap) continue
      const d = pts[i].distanceTo(pts[j])
      if (d < best) {
        best = d
        at = { x: Number(pts[i].x.toFixed(4)), y: Number(pts[i].y.toFixed(4)) }
      }
    }
  }
  // `Infinity` means the whole mark is shorter than the exclusion window (the
  // `tick` fixture is 7.8 r long). That is "cannot approach itself", not "does".
  return { overR: best / R, at, arcOverR: total / R }
}

/* THE ONE PLACE the arm substitutes. Every call site below still reads
 * `"wrapped"`, and under `SEAM_ARM=capped` every one of them gets the parked
 * geometry instead — so the arm cannot miss a site by being applied by hand. */
const rodBuild = (shape, arm) => {
  const loopEnds = LOOP_ENDS[arm] ?? arm
  eng.ROD_TUNING.loopEnds = loopEnds
  const meshes = eng.RodEngine.buildPreview(processStrokes(SHAPES[shape]()), {
    canvasWidth: 650,
    canvasHeight: 802,
  })
  const d = rodDump(meshes)
  const tubeOnly = rodDumpTubeOnly(meshes)
  const prox = meshes.map((m) => centrelineSelfProx(m.curve))
  return {
    ...d,
    tubeOnly,
    caps: meshes.reduce((a, m) => a + (m.capPositions?.length ?? 0), 0),
    joints: meshes.reduce((a, m) => a + (m.jointPositions?.length ?? 0), 0),
    capSepOverR: capSepOverR(meshes),
    selfProx: prox.reduce((w, p) => (p.overR < w.overR ? p : w), { overR: Infinity, at: null }),
  }
}
/* ⚠ THE NIB IS PINNED OFF HERE, AND THAT IS NOT A CONVENIENCE.
 *
 * This gate's whole method is to compare a shape against ITSELF around its own
 * circumference — the four corners of a square against each other (SEAM-3), the
 * outer radius of a loop across 72 angular bins (TAPER-2), a stroke's ends
 * against its middle (TAPER-1). Every one of those rows assumes the pen is
 * ISOTROPIC, so that a difference between two places on one mark can only have
 * come from the seam.
 *
 * `lib/geometry-engines.ts`'s broad nib (2026-08-28) makes that assumption false
 * by design: at aspect 1.8 two corners of a square are on the nib's thick
 * direction and two are on its thin one, and the gate read exactly that as a
 * seam defect — `rho_out 1.036 / 0.608 / 1.029 / 0.611`, a clean 1.7 : 1 which
 * is the nib's own ratio and not a bulge. Left alone, these three rows would be
 * red forever for a reason that has nothing to do with seams, and — worse — a
 * REAL seam bulge would then be indistinguishable from the pen.
 *
 * `nibAspect: 1` is the identity map, so the geometry these rows measure is
 * byte-for-byte the geometry they were written against. The nib's own behaviour
 * is policed by `scripts/verify/assert-nib-contrast.mjs`, which measures width
 * against direction and would go red if the nib stopped working. */
const infBuild = (shape, arm, fusion = "auto") =>
  build("inflate", SHAPES[shape](), {
    inflateParams: { loopEnds: LOOP_ENDS[arm] ?? arm, fusion, nibAspect: 1 },
  })

/* One grid is a coin flip (defect D2). Where a fold count is gated at all it is
 * gated across this whole sweep, so "clean" means clean at every resolution the
 * detector can be run at and not at the one it happened to be pinned to. */
const SWEEP = [61, 121, 181, 241]
const foldSweep = (b) => SWEEP.map((grid) => foldCensusComponents(b.pos, b.idx, { grid }).foldRays)
const folds = (b) => foldCensusComponents(b.pos, b.idx, { grid: 121 })
const identical = (a, b) => {
  if (a.idx.length !== b.idx.length || a.pos.length !== b.pos.length) return false
  for (let i = 0; i < a.pos.length; i++) if (Math.abs(a.pos[i] - b.pos[i]) > 1e-12) return false
  for (let i = 0; i < a.idx.length; i++) if (a.idx[i] !== b.idx[i]) return false
  return true
}
/** Half-width across the tube at a centreline point, by casting from outside. */
const halfWidthAt = (segs, p, tan, D) => {
  const nx = -tan.y
  const ny = tan.x
  const t1 = castRay(segs, p.x + nx * D, p.y + ny * D, -nx, -ny)
  const t2 = castRay(segs, p.x - nx * D, p.y - ny * D, nx, ny)
  return (D - t1 + (D - t2)) / 2
}
const taperRatio = (shape, loopEnds) => {
  const b = infBuild(shape, loopEnds, "loft")
  const segs = sliceZ(b.pos, b.idx, 0)
  const poly = SHAPES[shape]()[0].map((p) => px2w(p.x, p.y))
  const at = (frac) => {
    const i = Math.max(1, Math.min(poly.length - 2, Math.round(frac * (poly.length - 1))))
    const t = { x: poly[i + 1].x - poly[i - 1].x, y: poly[i + 1].y - poly[i - 1].y }
    const L = Math.hypot(t.x, t.y) || 1
    return halfWidthAt(segs, poly[i], { x: t.x / L, y: t.y / L }, 0.6)
  }
  return at(0.004) / at(0.5)
}
/** Outer radius per angular bin about a loop's centre — bulge/pinch detector. */
const loopUniformity = (loopEnds) => {
  const c = px2w(440, 360)
  const b = infBuild("circle", loopEnds, "loft")
  const N = 72
  const outer = new Array(N).fill(0)
  for (let i = 0; i < b.pos.length; i += 3) {
    const dx = b.pos[i] - c.x
    const dy = b.pos[i + 1] - c.y
    const r = Math.hypot(dx, dy)
    const a = ((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)
    const k = Math.min(N - 1, Math.floor(a * N))
    if (r > outer[k]) outer[k] = r
  }
  const med = [...outer].sort((x, y) => x - y)[Math.floor(N / 2)]
  return Math.max(...outer.map((v) => Math.abs(v / med - 1)))
}

/* ---- the square's four corners, for the reach test ------------------- */
const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
const cw = SQUARE_PX.map(([x, y]) => px2w(x, y))
const centre = { x: cw.reduce((s, p) => s + p.x, 0) / 4, y: cw.reduce((s, p) => s + p.y, 0) / 4 }
const cornerReach = (loopEnds) => {
  const b = infBuild("square", loopEnds, "auto")
  const segs = sliceZ(b.pos, b.idx, 0)
  return cw.map((c, i) => {
    const bx = centre.x - c.x
    const by = centre.y - c.y
    const L = Math.hypot(bx, by) || 1
    const nrm = (a, d) => {
      const dx = d.x - a.x
      const dy = d.y - a.y
      const M = Math.hypot(dx, dy) || 1
      return { x: dx / M, y: dy / M }
    }
    const legs = [nrm(cw[i], cw[(i + 3) % 4]), nrm(cw[i], cw[(i + 1) % 4])]
    return analyseCorner(segs, c, { x: bx / L, y: by / L }, legs, 0.05).outOverR
  })
}

/* ====================================================================== */
console.log("\nCLOSED-LOOP SEAM — the parked `capped` behaviour is the negative control\n")

/** The two fixtures whose stroke RETURNS TO ITS OWN START. Everything the seam
 *  fix is about happens on these; the other three are the controls. */
const CLOSED = ["circle", "square"]
const results = {}
for (const shape of ["circle", "square", "openArc", "tick", "crossing"]) {
  results[shape] = {}
  for (const le of ["capped", "wrapped"]) {
    const rod = rodBuild(shape, le)
    const inf = infBuild(shape, le, "auto")
    const infLoft = infBuild(shape, le, "loft")
    const rodCensus = folds(rod)
    results[shape][le] = {
      rod: {
        tris: rod.idx.length / 3,
        // DIAGNOSTIC, NOT GATED — see D2. Reported over the full assembly now
        // (tube + spheres) rather than the tube alone, so the number describes
        // what is rendered; `tubeOnlyFolds` is the old subject, kept beside it.
        folds: rodCensus.foldRays,
        components: rodCensus.components,
        tubeOnlyFolds: folds(rod.tubeOnly).foldRays,
        caps: rod.caps,
        joints: rod.joints,
        // THE GATED PAIR. Both exact, both grid-free.
        capSepOverR: rod.capSepOverR,
        selfProxOverR: rod.selfProx.overR,
        selfProxAt: rod.selfProx.at,
      },
      inflate: {
        tris: inf.idx.length / 3,
        folds: folds(inf).foldRays,
        fusionUsed: inf.debug.fusionUsed,
        loftTris: infLoft.idx.length / 3,
        loftFolds: folds(infLoft).foldRays,
        // The forced-loft arm printed a number that nothing read (D3). It is
        // gated now, and across the sweep rather than at one grid.
        loftSweep: CLOSED.includes(shape) ? foldSweep(infLoft) : null,
        crease: creaseCensusNode(inf.pos, inf.idx),
        loftCrease: creaseCensusNode(infLoft.pos, infLoft.idx),
      },
    }
  }
  const r = results[shape]
  const fmt = (v) => (v === null ? "—" : v === Infinity ? "inf" : v.toFixed(4))
  console.log(
    `  ${shape.padEnd(9)} ROD capSep/r ${fmt(r.capped.rod.capSepOverR)} -> ${fmt(r.wrapped.rod.capSepOverR)},` +
      ` selfProx/r ${fmt(r.capped.rod.selfProxOverR)} -> ${fmt(r.wrapped.rod.selfProxOverR)},` +
      ` caps ${r.capped.rod.caps} -> ${r.wrapped.rod.caps}, comps ${r.capped.rod.components} -> ${r.wrapped.rod.components}`,
  )
  console.log(
    `  ${" ".repeat(9)} INFLATE folds ${r.capped.inflate.folds} -> ${r.wrapped.inflate.folds}` +
      ` (forced loft ${r.capped.inflate.loftFolds} -> ${r.wrapped.inflate.loftFolds}` +
      (r.capped.inflate.loftSweep
        ? `; sweep grid ${SWEEP.join("/")}: ${r.capped.inflate.loftSweep.join("/")} -> ${r.wrapped.inflate.loftSweep.join("/")}`
        : "") +
      `), loft degenerate tris ${r.capped.inflate.loftCrease.degenerateTriangles} -> ${r.wrapped.inflate.loftCrease.degenerateTriangles}` +
      `  [rod folds, DIAGNOSTIC: ${r.capped.rod.folds} -> ${r.wrapped.rod.folds}]`,
  )
}
eng.ROD_TUNING.loopEnds = LOOP_ENDS.wrapped

/* ---- 1. THE KNOWN-BAD MUST FIRE -------------------------------------- */
/** Two spheres of radius r are one surface twice when their centres are inside
 *  2 r of each other; a tube of radius r passes through itself when its
 *  centreline does. Both thresholds are the geometry, not a tuned number. */
const OVERLAP_OVER_R = 2
console.log("")
check(
  "KNOWN-BAD-1 `capped` Inflate self-intersects at a closed seam (this gate can fail)",
  results.circle.capped.inflate.loftSweep.every((n) => n > 0),
  `circle/inflate capped: ${results.circle.capped.inflate.loftSweep.join("/")} fold rays at grid ${SWEEP.join("/")} — nonzero at EVERY resolution`,
)
/* WAS: `results.square.capped.rod.folds > 0` — a fold census over a tube-only
 * buffer at grid 121. Wrong twice over. (a) The surfaces that interpenetrate at
 * a `capped` seam are the two CAP SPHERES, and they were not in that buffer;
 * the control could not reach its own subject (D1). (b) The tube-only census at
 * that grid is one ray per tube radius and ranks the fixed build ABOVE the
 * broken one (D2). Replaced by the two exact statistics — both of which
 * reproduce the numbers `ROD_TUNING.loopEnds` documents, on both closed
 * fixtures, so the control now fires on two shapes instead of failing on one. */
for (const shape of CLOSED) {
  const c = results[shape].capped.rod
  check(
    `KNOWN-BAD-2 \`capped\` Rod duplicates its surface AND passes through itself at a closed ${shape} seam`,
    c.capSepOverR !== null &&
      c.capSepOverR < OVERLAP_OVER_R &&
      c.selfProxOverR < OVERLAP_OVER_R,
    `${shape}/rod capped: cap spheres ${c.capSepOverR.toFixed(4)} r apart (overlap under ${OVERLAP_OVER_R} r), ` +
      `centreline closest approach ${c.selfProxOverR.toFixed(4)} r at (${c.selfProxAt.x}, ${c.selfProxAt.y}); ` +
      `${c.components} rendered components against wrapped's ${results[shape].wrapped.rod.components}`,
  )
}
/* PARKED DIAGNOSTIC, not a check. The number the old KNOWN-BAD-2 gated on, kept
 * visible so the claim above is auditable rather than asserted. */
console.log(
  `  ....  parked: the old tube-only fold count at grid 121 reads square capped ` +
    `${results.square.capped.rod.tubeOnlyFolds} / wrapped ${results.square.wrapped.rod.tubeOnlyFolds} — ` +
    `the broken build scoring BELOW the fixed one is why it is no longer gated`,
)
const reachCapped = cornerReach("capped")
check(
  "KNOWN-BAD-3 `capped` loses the seam CORNER of a closed square (rho_out well under 1)",
  reachCapped[0] < 0.5,
  `rho_out ${reachCapped.map((v) => v.toFixed(4)).join(" ")} — corner 0 is the seam`,
)

/* ---- 2. THE FIX ------------------------------------------------------- */
check(
  "SEAM-1 Inflate: a closed loop no longer passes through itself (circle, every resolution)",
  results.circle.wrapped.inflate.folds === 0 &&
    results.circle.wrapped.inflate.loftSweep.every((n) => n === 0),
  `circle/inflate wrapped: ${results.circle.wrapped.inflate.folds} fold rays (forced loft sweep ${results.circle.wrapped.inflate.loftSweep.join("/")} at grid ${SWEEP.join("/")})`,
)
/* THE ARM THAT WAS PRINTED AND NEVER READ (D3).
 *
 * The closed SQUARE cannot be gated to zero folds the way the circle can, and
 * saying so is the point rather than an excuse: its seam sits ON a 90 degree
 * corner, and the Fusion control's own copy states that a loft "folds through
 * itself no matter how finely it is sampled" wherever the mark turns inside its
 * own radius. Opening every flagged ray confirms it — at grid 121 the wrapped
 * square's folds sit at all FOUR corners (measured (1.1476,-0.5129) corner 2,
 * (-0.2403,-0.5003) corner 3, (1.1341,0.7853) corner 1, (-0.2538,0.7853)
 * corner 0), each ~0.05 world off its corner. Corner 0 is the seam AND a mitre,
 * so on this fixture the two are not separable by a fold count.
 *
 * What IS separable, and exact: the wrap must strictly REDUCE the fold
 * population at every resolution (the seam's contribution is real even where
 * the corners' is irreducible), and it must not introduce degenerate triangles.
 * The second half is a pure topology count with no grid in it at all. */
check(
  "SEAM-1b Inflate/loft on a closed square: the wrap strictly reduces folds at EVERY resolution",
  results.square.wrapped.inflate.loftSweep.every(
    (n, i) => n < results.square.capped.inflate.loftSweep[i],
  ),
  `square/inflate loft at grid ${SWEEP.join("/")}: capped ${results.square.capped.inflate.loftSweep.join("/")} -> wrapped ${results.square.wrapped.inflate.loftSweep.join("/")} ` +
    `(the residue is the loft's documented mitre fold, at all four corners, not the seam)`,
)
check(
  "SEAM-1c Inflate/loft on a closed loop emits NO degenerate triangles (exact, no grid)",
  CLOSED.every((s) => results[s].wrapped.inflate.loftCrease.degenerateTriangles === 0),
  CLOSED.map(
    (s) =>
      `${s} ${results[s].capped.inflate.loftCrease.degenerateTriangles} -> ${results[s].wrapped.inflate.loftCrease.degenerateTriangles}`,
  ).join(", ") + " (capped -> wrapped)",
)
/* WAS: `folds === 0` on both closed shapes at grid 121. That is the statistic
 * that failed on 2026-08-02 for a mitred corner 1.9 world units from the seam
 * (D2). Replaced by the same exact pair the known-bad now fires on, so the
 * negative control and the positive assertion read the SAME instrument — which
 * is the only way one can calibrate the other. */
for (const shape of CLOSED) {
  const w = results[shape].wrapped.rod
  check(
    `SEAM-2 Rod: a closed ${shape} emits NO cap spheres and its shell does not pass through itself`,
    w.caps === 0 && w.capSepOverR === null && w.selfProxOverR >= OVERLAP_OVER_R,
    `${shape}/rod wrapped: ${w.caps} caps, centreline closest approach ${w.selfProxOverR.toFixed(4)} r ` +
      `(needs >= ${OVERLAP_OVER_R}; capped read ${results[shape].capped.rod.selfProxOverR.toFixed(4)}), ` +
      `${w.components} rendered components`,
  )
}
const reachWrapped = cornerReach("wrapped")
check(
  "SEAM-3 the seam corner SURVIVES as a corner, and matches the other three",
  reachWrapped[0] >= 0.95 &&
    reachWrapped[0] <= 1.5 &&
    Math.abs(reachWrapped[0] - reachWrapped[1]) < 0.1,
  `rho_out ${reachWrapped.map((v) => v.toFixed(4)).join(" ")} (was ${reachCapped[0].toFixed(4)} at the seam)`,
)
check(
  "SEAM-4 the OTHER three corners are untouched by the fix",
  [1, 2, 3].every((i) => Math.abs(reachWrapped[i] - reachCapped[i]) < 1e-6),
  `${[1, 2, 3].map((i) => `${reachCapped[i].toFixed(4)}->${reachWrapped[i].toFixed(4)}`).join(" ")}`,
)
check(
  "SEAM-5 the wrapped loop is closed and manifold",
  results.circle.wrapped.inflate.crease.boundaryEdges === 0 &&
    results.circle.wrapped.inflate.crease.nonManifoldEdges === 0 &&
    results.circle.wrapped.inflate.crease.degenerateTriangles === 0,
  `boundary ${results.circle.wrapped.inflate.crease.boundaryEdges}, non-manifold ${results.circle.wrapped.inflate.crease.nonManifoldEdges}, degenerate ${results.circle.wrapped.inflate.crease.degenerateTriangles}`,
)

/* ---- 3. THE OTHER DIRECTION ------------------------------------------ */
const openRodA = rodBuild("openArc", "capped")
const openRodB = rodBuild("openArc", "wrapped")
eng.ROD_TUNING.loopEnds = LOOP_ENDS.wrapped
check(
  "OPEN-1 an arc that ends NEAR its start but is not closed is byte-identical in both settings (Rod)",
  identical(openRodA, openRodB) && openRodB.caps === 2,
  `${openRodA.idx.length / 3} vs ${openRodB.idx.length / 3} triangles, caps ${openRodB.caps}`,
)
const openInfA = infBuild("openArc", "capped", "loft")
const openInfB = infBuild("openArc", "wrapped", "loft")
check(
  "OPEN-2 the same, Inflate",
  identical(openInfA, openInfB),
  `${openInfA.idx.length / 3} vs ${openInfB.idx.length / 3} triangles`,
)
for (const shape of ["tick", "crossing"]) {
  check(
    `OPEN-3 ${shape} (no closed stroke) is untouched in both engines`,
    results[shape].capped.rod.tris === results[shape].wrapped.rod.tris &&
      results[shape].capped.inflate.tris === results[shape].wrapped.inflate.tris,
    `rod ${results[shape].capped.rod.tris} = ${results[shape].wrapped.rod.tris}, inflate ${results[shape].capped.inflate.tris} = ${results[shape].wrapped.inflate.tris}`,
  )
}
const tOpenCapped = taperRatio("openArc", "capped")
const tOpenWrapped = taperRatio("openArc", "wrapped")
check(
  "TAPER-1 an OPEN stroke still narrows at its ends, by exactly as much as before",
  tOpenWrapped < 0.9 && Math.abs(tOpenWrapped - tOpenCapped) < 1e-6,
  `end/mid half-width ${tOpenCapped.toFixed(4)} -> ${tOpenWrapped.toFixed(4)} (a flattened taper would read ~1.0)`,
)
const uCapped = loopUniformity("capped")
const uWrapped = loopUniformity("wrapped")
check(
  "TAPER-2 the wrapped loop has NO seam bulge and NO seam pinch",
  uWrapped <= 0.01,
  `max |outer radius / median − 1| across 72 angular bins: ${(uWrapped * 100).toFixed(2)}% (capped ${(uCapped * 100).toFixed(2)}%). ` +
    `The first version of this fix read 22% here — the crossing bulge was scoring the seam as a self-crossing.`,
)

/* ---- 4. THE PREDICATE ITSELF ------------------------------------------ */
check(
  "PRED-1 closure is decided per stroke, and says NO to an open arc",
  results.openArc.wrapped.rod.caps === 2 && results.circle.wrapped.rod.caps === 0,
  `openArc keeps its 2 end caps; circle has 0`,
)
/* CALIBRATION IN THE OTHER DIRECTION for the two statistics KNOWN-BAD-2 and
 * SEAM-2 now share. A detector that called every pair of caps a duplicate would
 * pass both of those and be worthless. `openArc` ends near where it started and
 * is NOT closed: its caps must read as far apart, and its centreline must read
 * as not self-approaching, in BOTH settings and by a wide margin. */
const oa = results.openArc
check(
  "PRED-2 the duplicate-surface detector is NOT over-eager: an open arc reads clean in both settings",
  oa.capped.rod.capSepOverR > 10 * OVERLAP_OVER_R &&
    oa.wrapped.rod.capSepOverR === oa.capped.rod.capSepOverR &&
    oa.capped.rod.selfProxOverR >= OVERLAP_OVER_R &&
    oa.wrapped.rod.selfProxOverR === oa.capped.rod.selfProxOverR,
  `openArc cap separation ${oa.capped.rod.capSepOverR.toFixed(4)} r (closed seams read 0.4950 and 0.6999), ` +
    `centreline closest approach ${oa.capped.rod.selfProxOverR.toFixed(4)} r — identical under capped and wrapped`,
)

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, "seam.json"), JSON.stringify({ results, checks: rows }, null, 2))
console.log(`\nwrote ${join(OUT, "seam.json")}`)
console.log(failures === 0 ? "\nALL SEAM ASSERTIONS PASS" : `\n${failures} SEAM FAILURES`)
process.exit(failures === 0 ? 0 : 1)
