// F91 / F61: WHICH EDGES GO NON-MANIFOLD UNDER THE NIB, AND WHY.
//
// `assert-elbow` ROUTE-8 reads `nonManifold 14` on square/inflate at the shipped
// aspect 1.8, and 0 at 1.0. That number comes from `__geomDebug.probeDihedral`,
// which WELDS vertices by position quantised to 1e-5 before it counts edge use.
// The polygoniser's own audit (`meshNonManifoldEdges`, `auditManifold` in
// lib/implicit-surface.ts) counts by INDEX and never welds. The two are
// different instruments, so this probe reads both on the same buffers and then
// takes every welded non-manifold edge apart: which vertex indices collapsed into
// each key, how far apart they really were, and whether the same collapse exists
// in FIELD space (positions mapped back through A^-1) or only after the nib.
//
// Arms: aspect 1.0 / 1.8 / 2.0 / 2.4 on the square, `fusion: "auto"`, which is
// what ROUTE-8 grades.
//
// POSITIVE CONTROL: a planted fold. The 1.0 mesh gets one triangle duplicated
// with a displaced third vertex, which puts one edge in three triangles. The
// welded census must read >= 1 on it, or its 0 is blind.
//
// Usage: FS_PORT=3105 FS_HEADED=1 node scripts/verify/_probe-nib-manifold.mjs [--aspects=1,1.8]
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ASPECTS = arg("aspects", "1,1.8,2,2.4").split(",").map(Number)
const VIEW = { width: 1300, height: 850 }
const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
const squareShape = () => {
  const p = []
  const c = [...SQUARE_PX, SQUARE_PX[0]]
  for (let k = 0; k < c.length - 1; k++) {
    const [x0, y0] = c[k]
    const [x1, y1] = c[k + 1]
    for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
  }
  p.push({ x: 250, y: 180 })
  return [p]
}
// A CONTROL SHAPE with no nib in it: the same square turned 20 degrees, so its
// walls cut the marching-cubes grid obliquely at aspect 1.0 the way the nib's
// shear makes them cut it at 1.8. If the collisions follow the OBLIQUITY and
// not the nib, this reads non-zero at 1.0.
const rotatedSquare = () => {
  const [p] = squareShape()
  const cx = 445, cy = 362, a = (20 * Math.PI) / 180
  return [p.map(({ x, y }) => ({
    x: cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    y: cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  }))]
}
const SHAPE = arg("shape", "square")
const FUSION = arg("fusion", "auto")
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })
const CORNERS = SQUARE_PX.map(([x, y]) => px2w(x, y))

/** Edge-use census. `keyOf(i)` names a vertex; identity = by index. */
function census(pos, idx, keyOf) {
  const edges = new Map()
  let degenerateWelded = 0
  for (let t = 0; t < idx.length / 3; t++) {
    const k = [keyOf(idx[t * 3]), keyOf(idx[t * 3 + 1]), keyOf(idx[t * 3 + 2])]
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) degenerateWelded++
    for (const [p, q] of [[k[0], k[1]], [k[1], k[2]], [k[2], k[0]]]) {
      if (p === q) continue
      const ek = p < q ? `${p}|${q}` : `${q}|${p}`
      const l = edges.get(ek)
      if (l) l.push(t)
      else edges.set(ek, [t])
    }
  }
  let boundary = 0
  const nm = []
  for (const [ek, l] of edges) {
    if (l.length === 1) boundary++
    else if (l.length > 2) nm.push({ ek, tris: l })
  }
  return { boundary, nonManifold: nm.length, nm, degenerateWelded }
}
const q5 = (v) => Math.round(v * 1e5)
const weldKey = (pos) => (i) => `${q5(pos[i * 3])},${q5(pos[i * 3 + 1])},${q5(pos[i * 3 + 2])}`

/** Undo the nib: world -> field, the same A^-1 as `inflateNibToField`. */
function toField(pos, a, b, angleDeg) {
  const al = (-angleDeg * Math.PI) / 180
  const ca = Math.cos(al)
  const sa = Math.sin(al)
  const out = new Float64Array(pos.length)
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]
    const y = pos[i + 1]
    const u = (x * ca + y * sa) / a
    const v = (-x * sa + y * ca) / b
    out[i] = u * ca - v * sa
    out[i + 1] = u * sa + v * ca
    out[i + 2] = pos[i + 2]
  }
  return out
}

function explain(pos, idx, res, rNom) {
  const key = weldKey(pos)
  const groups = new Map()
  for (let i = 0; i < pos.length / 3; i++) {
    const k = key(i)
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  }
  const rows = []
  for (const { ek, tris } of res.nm) {
    const [ka, kb] = ek.split("|")
    const ga = groups.get(ka) ?? []
    const gb = groups.get(kb) ?? []
    const spread = (g) => {
      let m = 0
      for (let i = 0; i < g.length; i++)
        for (let j = i + 1; j < g.length; j++)
          m = Math.max(m, Math.hypot(pos[g[i] * 3] - pos[g[j] * 3], pos[g[i] * 3 + 1] - pos[g[j] * 3 + 1], pos[g[i] * 3 + 2] - pos[g[j] * 3 + 2]))
      return m
    }
    const mx = pos[ga[0] * 3]
    const my = pos[ga[0] * 3 + 1]
    const mz = pos[ga[0] * 3 + 2]
    const dCorner = Math.min(...CORNERS.map((c) => Math.hypot(mx - c.x, my - c.y)))
    rows.push({
      tris: tris.length,
      verticesA: ga.length,
      verticesB: gb.length,
      spreadA: spread(ga),
      spreadB: spread(gb),
      at: [mx, my, mz].map((v) => Number(v.toFixed(4))),
      cornerR: Number((dCorner / rNom).toFixed(2)),
    })
  }
  return rows
}

const browser = await chromium.launch({ headed: true, label: "nib-manifold" })
const page = await browser.newPage({ viewport: VIEW })
let exitCode = 0
try {
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })
  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(200)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), SHAPE === "rotated" ? rotatedSquare() : squareShape())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1400)
  await page.evaluate((f) => window.__styleHarness.setInflate({ fusion: f }), FUSION)
  await page.evaluate(() => window.__revealHarness.setProgress(1))

  let control = null
  for (const aspect of ASPECTS) {
    await page.evaluate((v) => window.__styleHarness.setInflate({ nibAspect: v }), aspect)
    await page.waitForTimeout(2600)
    const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
    let dd = null
    for (let t = 0; t < 30 && !(dd && dd.idx.length); t++) {
      dd = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      if (!(dd && dd.idx.length)) await page.waitForTimeout(300)
    }
    const probe = await page.evaluate(() => window.__geomDebug.probeDihedral())
    const pos = Float64Array.from(dd.pos)
    const idx = Int32Array.from(dd.idx)
    const byIndex = census(pos, idx, (i) => i)
    const welded = census(pos, idx, weldKey(pos))
    const fpos = toField(pos, dbg.nibSemiMajor, dbg.nibSemiMinor, dbg.nibAngleDeg)
    const weldedField = census(fpos, idx, weldKey(fpos))
    const rNom = Number(dbg.fieldCellSize) * Number(dbg.fieldResolution ?? 5) || 0.05
    console.log(
      `\n[aspect ${aspect}] used=${dbg.fusionUsed} tris=${idx.length / 3} verts=${pos.length / 3} ` +
        `nibContrastBuilt=${Number(dbg.nibContrastBuilt).toFixed(4)} cell=${Number(dbg.fieldCellSize).toFixed(5)}`,
    )
    console.log(
      `  engine audit (index)   nonManifold ${dbg.meshNonManifoldEdges}  boundary ${dbg.meshBoundaryEdges}\n` +
        `  probe census (page)    nonManifold ${probe.reduce((a, r) => a + r.nonManifoldEdges, 0)}  ` +
        `boundary ${probe.reduce((a, r) => a + r.boundaryEdges, 0)}  degenerate ${probe.reduce((a, r) => a + r.degenerateTriangles, 0)}\n` +
        `  this probe, by index   nonManifold ${byIndex.nonManifold}  boundary ${byIndex.boundary}\n` +
        `  this probe, welded 1e-5 WORLD  nonManifold ${welded.nonManifold}  boundary ${welded.boundary}  weld-degenerate tris ${welded.degenerateWelded}\n` +
        `  this probe, welded 1e-5 FIELD  nonManifold ${weldedField.nonManifold}  boundary ${weldedField.boundary}  weld-degenerate tris ${weldedField.degenerateWelded}`,
    )
    // Smallest distinct-vertex spacing: how close does marching cubes put two
    // vertices that are NOT the same index?
    const rows = explain(pos, idx, welded, rNom)
    for (const r of rows.slice(0, 30)) console.log("   nm", JSON.stringify(r))
    if (aspect === 1) control = { pos, idx }
  }

  // POSITIVE CONTROL: plant one fold on the round-pen mesh.
  if (control) {
    const { pos, idx } = control
    const t = 100
    const a = idx[t * 3]
    const b = idx[t * 3 + 1]
    const c = idx[t * 3 + 2]
    const p2 = new Float64Array(pos.length + 3)
    p2.set(pos)
    const n = pos.length / 3
    p2[n * 3] = pos[c * 3] + 0.003
    p2[n * 3 + 1] = pos[c * 3 + 1] + 0.003
    p2[n * 3 + 2] = pos[c * 3 + 2] + 0.003
    const i2 = new Int32Array(idx.length + 3)
    i2.set(idx)
    i2[idx.length] = a
    i2[idx.length + 1] = b
    i2[idx.length + 2] = n
    const clean = census(pos, idx, weldKey(pos)).nonManifold
    const planted = census(p2, i2, weldKey(p2)).nonManifold
    console.log(`\nPOSITIVE CONTROL  welded census on aspect 1.0: clean ${clean}, with one planted fold ${planted}`)
    if (!(planted > clean)) {
      console.log("  FAIL the census cannot see a planted fold; its 0 means nothing")
      exitCode = 1
    } else console.log("  PASS the census sees a planted fold")
  }
} finally {
  await browser.close()
}
process.exit(exitCode)
