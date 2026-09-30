// WHERE ARE THE FOUR ZERO-AREA TRIANGLES? — localise `assert-seam`'s SEAM-1c.
//
// The gate reports `square 0 -> 4 (capped -> wrapped)`: the wrapped square loft
// emits four triangles with no normal, and the capped one emits none. A count is
// not a diagnosis, so this prints WHICH triangles, WHICH ring band and segment
// they belong to, and what the two rings involved actually are — the numbers
// that decide whether the cause is a duplicate ring, a zero-radius ring, or the
// index wrap joining a ring to itself.
//
// Run: node scripts/verify/_probe-loft-degenerate.mjs
import { build, SHAPES } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"

const eng = loadTs("lib/geometry-engines.ts")
const R = eng.TUBE_RADIUS
const NORMAL_EPS = 1e-14

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const SHAPE = arg("shape", "square")

for (const loopEnds of ["capped", "wrapped"]) {
  const b = build("inflate", SHAPES[SHAPE](), { inflateParams: { loopEnds, fusion: "loft" } })
  const { pos, idx } = b
  const tri = idx.length / 3
  const bad = []
  for (let t = 0; t < tri; t++) {
    const a = idx[t * 3], b2 = idx[t * 3 + 1], c = idx[t * 3 + 2]
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
    const e1x = pos[b2 * 3] - ax, e1y = pos[b2 * 3 + 1] - ay, e1z = pos[b2 * 3 + 2] - az
    const e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    if (!(Math.hypot(nx, ny, nz) > NORMAL_EPS)) bad.push({ t, a, b: b2, c })
  }
  console.log(`\n=== ${SHAPE} / loopEnds=${loopEnds} — ${tri} triangles, ${bad.length} degenerate ===`)
  if (!bad.length) continue

  /* Reconstruct the ring layout. A tube built by `inflateBuildEllipticalTube`
   * lays vertices out as ring-major: vertex v belongs to ring floor(v/ringSegs),
   * segment v % ringSegs. ringSegs is `ringSampleCount` = 28 in the shipped
   * build; recovered from the geometry rather than assumed, by finding the
   * stride that makes every triangle's three vertices land in two adjacent
   * (or wrapped) rings. */
  const RING_SEGS = 28
  for (const t of bad) {
    const ring = (v) => Math.floor(v / RING_SEGS)
    const seg = (v) => v % RING_SEGS
    const P = (v) => [pos[v * 3].toFixed(4), pos[v * 3 + 1].toFixed(4), pos[v * 3 + 2].toFixed(4)].join(", ")
    console.log(
      `  tri ${t.t}: v${t.a}(ring ${ring(t.a)} seg ${seg(t.a)})  v${t.b}(ring ${ring(t.b)} seg ${seg(t.b)})  v${t.c}(ring ${ring(t.c)} seg ${seg(t.c)})`,
    )
    console.log(`      a (${P(t.a)})`)
    console.log(`      b (${P(t.b)})`)
    console.log(`      c (${P(t.c)})`)
    const d = (u, v) =>
      Math.hypot(pos[u * 3] - pos[v * 3], pos[u * 3 + 1] - pos[v * 3 + 1], pos[u * 3 + 2] - pos[v * 3 + 2])
    console.log(
      `      |ab| ${(d(t.a, t.b) / R).toExponential(3)} r   |bc| ${(d(t.b, t.c) / R).toExponential(3)} r   |ca| ${(d(t.c, t.a) / R).toExponential(3)} r`,
    )
  }

  /* Which rings are involved, and are any two of them coincident? */
  const rings = new Set()
  for (const t of bad) for (const v of [t.a, t.b, t.c]) rings.add(Math.floor(v / RING_SEGS))
  const list = [...rings].sort((x, y) => x - y)
  console.log(`  rings involved: ${list.join(", ")}`)
  const ringCentroid = (i) => {
    let x = 0, y = 0, z = 0
    for (let j = 0; j < RING_SEGS; j++) {
      const v = i * RING_SEGS + j
      x += pos[v * 3]; y += pos[v * 3 + 1]; z += pos[v * 3 + 2]
    }
    return [x / RING_SEGS, y / RING_SEGS, z / RING_SEGS]
  }
  const ringRadius = (i) => {
    const [cx, cy, cz] = ringCentroid(i)
    let m = 0
    for (let j = 0; j < RING_SEGS; j++) {
      const v = i * RING_SEGS + j
      m = Math.max(m, Math.hypot(pos[v * 3] - cx, pos[v * 3 + 1] - cy, pos[v * 3 + 2] - cz))
    }
    return m
  }
  for (const i of list) {
    const c = ringCentroid(i)
    console.log(
      `    ring ${String(i).padStart(4)}  centroid (${c.map((v) => v.toFixed(4)).join(", ")})  maxRadius ${(ringRadius(i) / R).toFixed(5)} r`,
    )
  }
  /* Neighbour separation around the involved rings, so a duplicated ring is
   * visible as a 0 in this column. */
  const totalRings = Math.floor(pos.length / 3 / RING_SEGS)
  console.log(`  total rings in the buffer (incl. 2 tip verts): ~${totalRings}`)
  for (const i of list) {
    for (const j of [i - 1, i, i + 1]) {
      if (j < 0 || j + 1 >= totalRings) continue
      const a = ringCentroid(j)
      const b2 = ringCentroid(j + 1)
      console.log(
        `    |ring ${j} -> ${j + 1}| = ${(Math.hypot(a[0] - b2[0], a[1] - b2[1], a[2] - b2[2]) / R).toExponential(3)} r` +
          `   radii ${(ringRadius(j) / R).toFixed(5)} -> ${(ringRadius(j + 1) / R).toFixed(5)} r`,
      )
    }
  }
}
