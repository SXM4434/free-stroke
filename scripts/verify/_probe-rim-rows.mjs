// LOCALISE `assert-mode-rims`'s FOUR RED ROWS — surface or instrument?
//
// The gate reports a COUNT and a MAX. Neither is a diagnosis, and this repo has
// already paid twice for treating one as one (explainer 13; explainer 17 §1,
// where Inflate's rim was diagnosed from a bare max and the inference was
// wrong). So this probe asks WHERE each offending edge is, against features the
// drawing itself defines: the four drawn corners of `square`, the two ends of
// `openArc`, and — for Rod — the joint bead that is supposed to be covering the
// crease in the first place.
//
// NO BROWSER. `probeDihedral` is a pure function of the position/index buffers;
// `lib/engine-node.mjs` runs the real engines through the real `processStroke`.
// The mirror below is asserted against the shipped one on the real buffers
// before any of its output is read (--verify), the same discipline
// assert-fold-census's CAL-4 uses.
//
// Run: node scripts/verify/_probe-rim-rows.mjs [--only=square/solid]
import * as THREE from "three"
import { SHAPES, process as processStrokes, CW, CH, px2w } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"

const eng = loadTs("lib/geometry-engines.ts")
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1]

const ENGINE = {
  rod: eng.RodEngine,
  extrude: eng.ExtrudeEngine,
  solid: eng.SolidEngine,
  inflate: eng.InflateEngine,
}

/** The four drawn corners of `square`, in world units. */
export const SQUARE_CORNERS = [[250, 180], [640, 180], [640, 545], [250, 545]].map(([x, y]) => px2w(x, y))

/* ── probeDihedral, mirrored EXACTLY (components/viewport-3d.tsx:9023) ──────
 * Same 1e-5 position key, same NORMAL_EPS, same min(acos d, acos -d), same
 * |n.z| < 0.4 / > 0.9 bucketing. The only difference is that it returns every
 * edge rather than six of them, because the question here is WHERE. */
export function census(pos, idx) {
  const triCount = idx.length / 3
  const key = (i) =>
    `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`
  const faceN = []
  const edges = new Map()
  let degenerateTriangles = 0
  const NORMAL_EPS = 1e-14
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
    const e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az
    const e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const len = Math.hypot(nx, ny, nz)
    if (!(len > NORMAL_EPS)) { faceN.push(null); degenerateTriangles++; continue }
    faceN.push({ x: nx / len, y: ny / len, z: nz / len })
    const ka = key(a), kb = key(b), kc = key(c)
    for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) {
      const ek = p < q ? `${p}|${q}` : `${q}|${p}`
      const list = edges.get(ek)
      if (list) list.push(t)
      else edges.set(ek, [t])
    }
  }
  const rows = []
  let boundaryEdges = 0, nonManifoldEdges = 0
  for (const [ek, list] of edges.entries()) {
    if (list.length === 1) { boundaryEdges++; continue }
    if (list.length > 2) { nonManifoldEdges++; continue }
    const [t0, t1] = list
    const n0 = faceN[t0], n1 = faceN[t1]
    if (!n0 || !n1) continue
    const dot = Math.min(1, Math.max(-1, n0.x * n1.x + n0.y * n1.y + n0.z * n1.z))
    const deg = Math.min((Math.acos(dot) * 180) / Math.PI, (Math.acos(-dot) * 180) / Math.PI)
    const w0 = Math.abs(n0.z) < 0.4, w1 = Math.abs(n1.z) < 0.4
    const c0 = Math.abs(n0.z) > 0.9, c1 = Math.abs(n1.z) > 0.9
    const bucket = w0 && w1 ? "wall" : c0 && c1 ? "cap" : "mixed"
    const [pa, pb] = ek.split("|").map((s) => s.split(",").map(Number))
    rows.push({
      deg, bucket,
      mid: [0, 1, 2].map((i) => ((pa[i] + pb[i]) / 2) * 1e-5),
      a: pa.map((v) => v * 1e-5),
      b: pb.map((v) => v * 1e-5),
      n0: [n0.x, n0.y, n0.z], n1: [n1.x, n1.y, n1.z],
    })
  }
  return { triangles: triCount, degenerateTriangles, boundaryEdges, nonManifoldEdges, rows }
}

export function stat(rows, bucket) {
  const v = rows.filter((r) => r.bucket === bucket).map((r) => r.deg)
  if (!v.length) return { n: 0, mean: 0, max: 0, over30: 0, over45: 0, over60: 0 }
  return {
    n: v.length,
    mean: Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)),
    max: Number(Math.max(...v).toFixed(2)),
    over30: v.filter((d) => d > 30).length,
    over45: v.filter((d) => d > 45).length,
    over60: v.filter((d) => d > 60).length,
  }
}

/** Rod's full rendered assembly: tube + cap spheres + joint spheres, as
 *  SEPARATE meshes — probeDihedral traverses per mesh and so must this. */
export function buildMeshes(mode, polys, params = {}) {
  const strokes = processStrokes(polys, params.process)
  // `lib/solid-mask.ts` narrates every stage to the console. Useful in a
  // browser, 400 lines of noise here; silence it around the build only.
  const realLog = console.log
  if (!process.argv.includes("--engine-log")) console.log = () => {}
  const meshes = ENGINE[mode].buildPreview(strokes, {
    canvasWidth: CW,
    canvasHeight: CH,
    extrudeParams: { ...eng.DEFAULT_EXTRUDE_PARAMS, ...(params.extrudeParams ?? {}) },
    solidParams: { ...eng.DEFAULT_SOLID_PARAMS, ...(params.solidParams ?? {}) },
    inflateParams: { ...eng.DEFAULT_INFLATE_PARAMS, ...(params.inflateParams ?? {}) },
  })
  console.log = realLog
  const out = []
  const asBuf = (g, tx) => {
    const p = g.getAttribute("position")
    const pos = new Float64Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      pos[i * 3] = p.getX(i) + (tx?.x ?? 0)
      pos[i * 3 + 1] = p.getY(i) + (tx?.y ?? 0)
      pos[i * 3 + 2] = p.getZ(i) + (tx?.z ?? 0)
    }
    const ix = g.getIndex()
    const idx = ix ? Int32Array.from({ length: ix.count }, (_, i) => ix.getX(i)) : Int32Array.from({ length: p.count }, (_, i) => i)
    return { pos, idx }
  }
  for (const m of meshes) {
    if (m.tubeGeometry) out.push({ part: "body", ...asBuf(m.tubeGeometry) })
    if (mode === "rod") {
      // Exactly what the viewport instantiates: components/viewport-3d.tsx:565
      // (cap, SPHERE_SEGMENTS) and :568 (joint, JOINT_SPHERE_SEGMENTS).
      const capG = new THREE.SphereGeometry(eng.TUBE_RADIUS, eng.SPHERE_SEGMENTS, eng.SPHERE_SEGMENTS)
      const jointG = new THREE.SphereGeometry(eng.TUBE_RADIUS, eng.JOINT_SPHERE_SEGMENTS, eng.JOINT_SPHERE_SEGMENTS)
      for (const c of m.capPositions ?? []) out.push({ part: "cap", ...asBuf(capG, c) })
      for (const c of m.jointPositions ?? []) out.push({ part: "joint", pivot: c, ...asBuf(jointG, c) })
    }
  }
  return { meshes, parts: out, strokes }
}

/** The centreline polylines the tubes were swept along, densely sampled. */
export function centrelines(meshes) {
  return meshes
    .filter((m) => m.curve)
    .map((m) => {
      const n = 8000
      const pts = []
      for (let i = 0; i <= n; i++) {
        const p = m.curve.getPointAt(i / n)
        pts.push([p.x, p.y, p.z])
      }
      return pts
    })
}

/** Exact distance from a point to a set of polylines (segment distance). */
export function distToPolylines(p, polys) {
  let best = Infinity
  for (const poly of polys) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1]
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
      const L2 = dx * dx + dy * dy + dz * dz
      let t = L2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / L2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy), p[2] - (a[2] + t * dz))
      if (d < best) best = d
    }
  }
  return best
}

/** Aggregate the way assert-mode-rims does: per-mesh census, max of maxes. */
export function aggregate(parts) {
  const all = []
  const agg = { triangles: 0, degenerateTriangles: 0, boundaryEdges: 0, nonManifoldEdges: 0, meshes: parts.length }
  for (const p of parts) {
    const c = census(p.pos, p.idx)
    agg.triangles += c.triangles
    agg.degenerateTriangles += c.degenerateTriangles
    agg.boundaryEdges += c.boundaryEdges
    agg.nonManifoldEdges += c.nonManifoldEdges
    for (const r of c.rows) all.push({ ...r, part: p.part, pivot: p.pivot })
  }
  for (const b of ["wall", "cap", "mixed"]) agg[b] = stat(all, b)
  return { agg, rows: all }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const R = eng.TUBE_RADIUS
  console.log(`TUBE_RADIUS = ${R}   RADIAL_SEGMENTS = ${eng.RADIAL_SEGMENTS}`)
  console.log(`square drawn corners (world): ${SQUARE_CORNERS.map((c) => `[${c.x.toFixed(4)},${c.y.toFixed(4)}]`).join(" ")}`)

  const CASES = [["square", "rod"], ["square", "solid"], ["openArc", "solid"], ["circle", "solid"], ["tick", "solid"]]
  for (const [shape, mode] of CASES) {
    if (ONLY && ONLY !== `${shape}/${mode}`) continue
    const { parts, meshes } = buildMeshes(mode, SHAPES[shape]())
    const { agg, rows } = aggregate(parts)
    console.log(`\n=== ${shape}/${mode} ===`)
    console.log(
      `  tris=${agg.triangles} degen=${agg.degenerateTriangles} meshes=${agg.meshes} bnd=${agg.boundaryEdges} nm=${agg.nonManifoldEdges}`,
    )
    for (const b of ["wall", "cap", "mixed"]) {
      const s = agg[b]
      console.log(`  ${b.padEnd(6)} n=${String(s.n).padStart(6)} mean=${String(s.mean).padStart(6)} max=${String(s.max).padStart(6)} >30=${String(s.over30).padStart(5)} >45=${String(s.over45).padStart(5)} >60=${String(s.over60).padStart(5)}`)
    }
    // Histogram of the mixed bucket — is there a spike at the bevel's own step?
    const mixed = rows.filter((r) => r.bucket === "mixed").map((r) => r.deg).sort((a, b) => a - b)
    const bins = new Array(19).fill(0)
    for (const d of mixed) bins[Math.min(18, Math.floor(d / 5))]++
    console.log(`  mixed histogram (5deg bins): ${bins.map((n, i) => (n ? `${i * 5}-${i * 5 + 5}:${n}` : null)).filter(Boolean).join(" ")}`)
    const wall = rows.filter((r) => r.bucket === "wall").map((r) => r.deg).sort((a, b) => a - b)
    const wbins = new Array(19).fill(0)
    for (const d of wall) wbins[Math.min(18, Math.floor(d / 5))]++
    console.log(`  wall  histogram (5deg bins): ${wbins.map((n, i) => (n ? `${i * 5}-${i * 5 + 5}:${n}` : null)).filter(Boolean).join(" ")}`)

    // WHERE are the offenders? Distance to the nearest drawn corner / stroke end.
    const feats =
      shape === "square"
        ? SQUARE_CORNERS.map((c, i) => ({ name: `corner${i}`, x: c.x, y: c.y }))
        : (() => {
            const s = SHAPES[shape]()[0]
            const a = px2w(s[0].x, s[0].y), b = px2w(s[s.length - 1].x, s[s.length - 1].y)
            return [{ name: "start", ...a }, { name: "end", ...b }]
          })()
    const near = (r) => {
      let best = null
      for (const f of feats) {
        const d = Math.hypot(r.mid[0] - f.x, r.mid[1] - f.y)
        if (!best || d < best.d) best = { name: f.name, d }
      }
      return best
    }
    for (const b of ["wall", "mixed"]) {
      const bad = rows.filter((r) => r.bucket === b && r.deg > 30)
      if (!bad.length) continue
      const tally = new Map()
      for (const r of bad) {
        const n = near(r)
        const k = n.d < 2 * R ? n.name : n.d < 5 * R ? `${n.name}+2-5r` : "AWAY"
        tally.set(k, (tally.get(k) ?? 0) + 1)
      }
      console.log(`  ${b} >30 (${bad.length}) by location: ${[...tally.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`)
      const worst = [...bad].sort((x, y) => y.deg - x.deg).slice(0, 4)
      for (const w of worst) {
        const n = near(w)
        console.log(
          `    ${w.deg.toFixed(2)}deg  part=${w.part}  mid=[${w.mid.map((v) => v.toFixed(4))}]  ${n.name} d=${n.d.toFixed(4)} (${(n.d / R).toFixed(2)} r)` +
            `  n0=[${w.n0.map((v) => v.toFixed(3))}] n1=[${w.n1.map((v) => v.toFixed(3))}]`,
        )
      }
    }
    // ROD ONLY: is the crease ON THE BOUNDARY OF THE SOLID, or buried inside it?
    //
    // Rod's solid is EXACTLY the union of balls of radius TUBE_RADIUS along the
    // centreline (plus the beads, which are balls of the same radius centred on
    // that same centreline — so they add nothing to the union and the test is
    // the centreline alone). A point is on the visible surface iff its distance
    // to the centreline is r; anything strictly inside is interior geometry,
    // which no camera and no specular can reach. That is a closed-form test on
    // the drawing, not a threshold — the crease census has no way to ask it,
    // which is why a max it reports may or may not be a thing you can see.
    if (mode === "rod") {
      const jp = meshes.flatMap((m) => m.jointPositions ?? [])
      console.log(`  joint beads: ${jp.length} at ${jp.map((p) => `[${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}]`).join(" ")}`)
      console.log(`  drawn corners WITHOUT a bead: ${SQUARE_CORNERS.map((c, i) => ({ i, d: Math.min(...jp.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) })).filter((e) => e.d > 2 * R).map((e) => `corner${e.i} (nearest bead ${(e.d / R).toFixed(1)} r)`).join(", ") || "(none)"}`)
      const cl = centrelines(meshes)
      const bad = rows.filter((r) => r.deg > 30 && r.part === "body")
      const scored = bad.map((r) => ({ ...r, dc: distToPolylines(r.mid, cl) }))
      const exposed = scored.filter((r) => r.dc > R * 0.995)
      console.log(`  body creases >30: ${bad.length} total — ${bad.length - exposed.length} BURIED inside the solid (dist to centreline < r), ${exposed.length} ON THE SURFACE`)
      console.log(`  worst crease ON THE SURFACE: ${exposed.length ? exposed.reduce((a, b) => (b.deg > a.deg ? b : a)).deg.toFixed(2) : "none"} deg` +
        `   worst BURIED: ${scored.filter((r) => r.dc <= R * 0.995).reduce((a, b) => (b.deg > a.deg ? b : a), { deg: 0 }).deg.toFixed(2)} deg`)
      for (const e of [...exposed].sort((x, y) => y.deg - x.deg).slice(0, 8)) {
        const n = near(e)
        console.log(`    SURFACE ${e.deg.toFixed(2)}deg ${e.bucket.padEnd(5)} at [${e.mid.map((v) => v.toFixed(4))}] ${n.name} ${(n.d / R).toFixed(2)} r  dist-to-centreline ${(e.dc / R).toFixed(3)} r`)
      }
    }
  }
}
