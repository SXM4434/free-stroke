// DOES THE EXTRUDE RIBBON COVER A PLAN REGION TWICE — with the chamfer OFF?
//
// The KNOWN_OPEN ledger blames `square/extrude`'s 5 fold rays on "the ribbon's
// inner offset self-intersecting at a drawn corner", and says the chamfer only
// lifts an existing double cover onto distinct depths. That is testable without
// any ray casting: take the ribbon's TOP face — the +Z plane — and ask whether
// its triangles overlap EACH OTHER, the same separating-axis question
// `_probe-cap-fit.mjs` asks of Solid's cap.
//
//   a strip whose inner boundary never reverses   0 overlapping pairs
//   a strip that folds back over a corner         > 0, at the corner
//
// Run with the chamfer OFF so the answer is about the JOIN and nothing else.
//
// Run: node scripts/verify/_probe-extrude-topface.mjs
import { build, SHAPES, VIEW } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"

const engines = loadTs("lib/geometry-engines.ts")
const DEF = engines.DEFAULT_EXTRUDE_PARAMS
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })
const CORNERS = [[250, 180], [640, 180], [640, 545], [250, 545]].map(([x, y]) => px2w(x, y))

function quiet(fn) {
  const log = console.log, err = console.error
  console.log = () => {}
  console.error = () => {}
  try { return fn() } finally { console.log = log; console.error = err }
}

function faceAtExtremeZ(pos, idx, sign) {
  let zE = sign > 0 ? -Infinity : Infinity
  for (let i = 0; i < pos.length / 3; i++) {
    const z = pos[i * 3 + 2]
    if (sign > 0 ? z > zE : z < zE) zE = z
  }
  const out = []
  for (let t = 0; t < idx.length / 3; t++) {
    const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]
    if (v.every((k) => Math.abs(pos[k * 3 + 2] - zE) < 1e-9)) out.push(v.map((k) => [pos[k * 3], pos[k * 3 + 1]]))
  }
  return { tris: out, z: zE }
}

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

function overlaps(tris, eps) {
  let pairs = 0
  const centroids = []
  for (let a = 0; a < tris.length; a++) {
    for (let b = a + 1; b < tris.length; b++) {
      // Adjacent triangles of a strip share an edge; the eps-strict SAT below
      // already rejects a shared edge, but skipping the immediate neighbour
      // keeps the report about genuine crossings.
      if (trisOverlap(tris[a], tris[b], eps)) {
        pairs++
        const c = [
          (tris[a][0][0] + tris[a][1][0] + tris[a][2][0] + tris[b][0][0] + tris[b][1][0] + tris[b][2][0]) / 6,
          (tris[a][0][1] + tris[a][1][1] + tris[a][2][1] + tris[b][0][1] + tris[b][1][1] + tris[b][2][1]) / 6,
        ]
        centroids.push(c)
      }
    }
  }
  return { pairs, centroids }
}

const polys = SHAPES.square()

console.log("shape/mode          chamfer  topTris  overlappingPairs   where (nearest drawn corner)")
for (const [name, shape] of Object.entries({ square: SHAPES.square, crossing: SHAPES.crossing, circle: SHAPES.circle, tick: SHAPES.tick })) {
  for (const bevelEnabled of [false, true]) {
    const d = quiet(() => build("extrude", shape(), { extrudeParams: { ...DEF, bevelEnabled } }))
    const { tris } = faceAtExtremeZ(d.pos, d.idx, +1)
    const { pairs, centroids } = overlaps(tris, 1e-7)
    let where = ""
    if (centroids.length && name === "square") {
      // A HISTOGRAM, not the first few. The first version of this line printed
      // the first six distinct entries of a Set and therefore reported whichever
      // corner the triangle order happened to start at — corner 0 every time,
      // which flatly contradicted the ray census's corners 2 and 3 and was a
      // reporting bug, not a finding.
      const hist = [0, 0, 0, 0]
      const far = []
      for (const c of centroids) {
        let best = Infinity, bi = -1
        CORNERS.forEach((cn, i) => { const dd = Math.hypot(cn.x - c[0], cn.y - c[1]); if (dd < best) { best = dd; bi = i } })
        hist[bi]++
        if (best > 0.05) far.push(best)
      }
      where = `per corner ${hist.join("/")}, ${far.length} further than 0.05 world from any corner`
    } else if (centroids.length) {
      where = centroids.slice(0, 3).map((c) => `[${c[0].toFixed(3)},${c[1].toFixed(3)}]`).join(" ")
    }
    console.log(
      `${(name + "/extrude").padEnd(19)} ${(bevelEnabled ? "on" : "off").padEnd(8)} ${String(tris.length).padStart(7)} ${String(pairs).padStart(16)}   ${where}`,
    )
  }
}

console.log("\nThe same question of the BOTTOM face, so a one-sided artefact cannot pass:\n")
for (const bevelEnabled of [false, true]) {
  const d = quiet(() => build("extrude", polys, { extrudeParams: { ...DEF, bevelEnabled } }))
  const { tris } = faceAtExtremeZ(d.pos, d.idx, -1)
  const { pairs } = overlaps(tris, 1e-7)
  console.log(`  square/extrude chamfer ${bevelEnabled ? "on " : "off"}  bottomTris ${tris.length}  overlappingPairs ${pairs}`)
}
