// WHERE ARE `square/rod`'s FOLD RAYS? — localise `assert-fold-census`'s one
// remaining sweep failure.
//
// The row reads `0/1/1/3 rays at grid 61/121/181/241`. A count is not a
// diagnosis and this particular count already has a documented history:
// `assert-seam.mjs`'s defect D2 measured the SAME build at eight grids and
// found the statistic non-monotone, with the FIXED arm scoring worse than the
// broken one at grid 121 — one ray per tube radius. So the question is not
// "how many" but WHERE: at the seam (which would mean the loop fix did not
// take) or at a drawn 90-degree corner (which is `r*kappa >= 1`, explainer 19's
// other half of the embedding theorem, and the same mechanism `square/extrude`
// is already pinned as KNOWN-OPEN for).
//
// Run: node scripts/verify/_probe-square-rod-folds.mjs
import * as THREE from "three"
import { build, SHAPES, process as processStrokes } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
import { foldCensusComponents } from "./lib/elbow-geom.mjs"

const eng = loadTs("lib/geometry-engines.ts")
const R = eng.TUBE_RADIUS
const SEAM = { x: -0.2805, y: 0.8267 }

/** Rod's full rendered assembly: tube + cap spheres + joint spheres. */
function rodDump(meshes) {
  const pos = []
  const idx = []
  const push = (g, m) => {
    const p = g.getAttribute("position")
    const base = pos.length / 3
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      if (m) v.applyMatrix4(m)
      pos.push(v.x, v.y, v.z)
    }
    const ix = g.getIndex()
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i))
    else for (let i = 0; i < p.count; i++) idx.push(base + i)
  }
  for (const m of meshes) {
    push(m.tubeGeometry, null)
    const sphere = new THREE.SphereGeometry(R, 16, 12)
    for (const list of [m.capPositions ?? [], m.jointPositions ?? []]) {
      for (const c of list) push(sphere, new THREE.Matrix4().makeTranslation(c.x, c.y, c.z))
    }
  }
  return { pos: Float64Array.from(pos), idx: Int32Array.from(idx) }
}

for (const loopEnds of ["capped", "wrapped"]) {
  eng.ROD_TUNING.loopEnds = loopEnds
  const meshes = eng.RodEngine.buildPreview(processStrokes(SHAPES.square()), {
    canvasWidth: 650,
    canvasHeight: 802,
  })
  const d = rodDump(meshes)
  console.log(`\n=== square / rod / loopEnds=${loopEnds} ===`)
  console.log(
    `  meshes ${meshes.length}  caps ${meshes.reduce((a, m) => a + (m.capPositions?.length ?? 0), 0)}` +
      `  joints ${meshes.reduce((a, m) => a + (m.jointPositions?.length ?? 0), 0)}`,
  )
  const corners = [
    [250, 180],
    [640, 180],
    [640, 545],
    [250, 545],
  ]
  for (const grid of [61, 121, 181, 241, 301]) {
    const c = foldCensusComponents(d.pos, d.idx, { grid })
    const worst = c.rows.flatMap((r) => r.worst)
    console.log(
      `  grid ${String(grid).padStart(3)}  foldRays ${c.foldRays}  maxSheets ${c.maxFoldSheets}` +
        `  coplanar ${c.coplanarRays}  sliver ${c.sliverRays}  comps ${c.components}`,
    )
    for (const w of worst.slice(0, 8)) {
      const dSeam = Math.hypot(w.x - SEAM.x, w.y - SEAM.y) / R
      console.log(`      over-2 ray at (${w.x}, ${w.y}) hits ${w.hits} — ${dSeam.toFixed(1)} r from the seam`)
    }
  }
}
