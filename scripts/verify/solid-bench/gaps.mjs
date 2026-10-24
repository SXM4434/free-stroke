// ANIM-1C2: does Solid keep every stroke of a list whose middle entry is missing,
// empty, a single point or a zero-length piece? Reads the SolidEngine.buildPreview
// output back as a footprint (every triangle's XY projection rasterized on a grid
// over the world square) and asks, per stroke that is in the list, what fraction
// of its points land on ink. Extrude is run on the same lists as the control:
// ANIM-1C measured Extrude drawing these spans right.
//
//   node scripts/verify/solid-bench/gaps.mjs [--hole=6] [--alone=7] [--mode=anim|static|nohole]
//
// A case PASSES when every stroke it hands in reads coverage >= 0.9. Exits 1 on a
// Solid miss; the Extrude rows are the control and must pass for the run to mean
// anything (exit 2 when they do not).
//
// ANIM-1C3 adds two rows that put ink OUTSIDE the canvas Solid is handed:
//   MUST-FAIL ARM: stroke HOLE moved wholly past x = CW. A canvas-only raster
//     (43bf2856c) builds nothing for it, so this row FAILS there; it must pass
//     once Solid rasterizes union(canvas, ink bounds).
//   HERO AT 720: the raw logo-strokes.json polylines (x 6 to 1089) at the page's
//     own canvas, 720 x 852, as the browser gate injects them. Every stroke must
//     read covered in the whole build AND build more than 0 verts on its own.
// Corpus: the hero's 12 strokes at two canvases, on SolidEngine.buildPreview in
// Node. Not covered: the browser raster (node-canvas stands in), other words.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const E = await import(REPO + "scripts/verify/lib/engine-node.mjs")
const { loadTs } = await import(REPO + "scripts/verify/_ts-load.mjs")
const sched = loadTs("lib/stroke-schedule.ts")

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=").slice(1).join("=")
const HOLE = Number(arg("hole", 6))
const ALONE = Number(arg("alone", 7))
const MODE = arg("mode", "anim")
const { CW, CH } = E

const raw = JSON.parse(readFileSync(REPO + "scripts/capture/logo-strokes.json", "utf8"))
const k = (CW * 0.9) / raw.width, ox = (CW - raw.width * k) / 2, oy = (CH - raw.height * k) / 2
const polys = raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))

const L = console.log
console.log = () => {}
const strokes = E.process(polys)
const N = strokes.length

const opts = {
  canvasWidth: CW, canvasHeight: CH,
  extrudeParams: E.DEFAULT_EXTRUDE_PARAMS, solidParams: E.DEFAULT_SOLID_PARAMS, inflateParams: E.DEFAULT_INFLATE_PARAMS,
  holeStabilization: MODE === "static" ? undefined : { mode: "ANIMATION_GATED", activeFinalHolesWorld: [] },
  disableHolesForAnimation: MODE === "nohole",
}

// World window [-R, R] at 200 cells per world unit. R = 3 (was 1.5, G 600) so
// ink past the canvas edge still lands on the grid; the cell size and the cell
// alignment are unchanged, so the older rows grade exactly as before.
const R = 3, G = 1200
function footprint(meshes) {
  const grid = new Uint8Array(G * G)
  const toG = (w) => ((w + R) / (2 * R)) * G
  for (const m of meshes) {
    const g = m.tubeGeometry
    const pos = g?.getAttribute("position")
    if (!pos) continue
    const idx = g.index ? g.index.array : null
    const tri = idx ? idx.length / 3 : pos.count / 3
    for (let t = 0; t < tri; t++) {
      const v = [0, 1, 2].map((j) => (idx ? idx[t * 3 + j] : t * 3 + j))
      const P = v.map((i) => [toG(pos.getX(i)), toG(pos.getY(i))])
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])))
      const x1 = Math.min(G - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])))
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])))
      const y1 = Math.min(G - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])))
      const e = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
      const area = e(P[0], P[1], P[2][0], P[2][1])
      if (area === 0) continue
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5, cy = y + 0.5
        const w0 = e(P[1], P[2], cx, cy), w1 = e(P[2], P[0], cx, cy), w2 = e(P[0], P[1], cx, cy)
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) grid[y * G + x] = 1
      }
    }
  }
  return grid
}
// A point is on ink when any cell within 1 of it is filled (the grid is coarse).
function coverage(grid, s, px2w = E.px2w) {
  if (s.points.length === 0) return null
  let hit = 0
  for (const p of s.points) {
    const w = px2w(p.x, p.y)
    const gx = Math.floor(((w.x + R) / (2 * R)) * G), gy = Math.floor(((w.y + R) / (2 * R)) * G)
    let on = false
    for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx, y = gy + dy
      if (x >= 0 && y >= 0 && x < G && y < G && grid[y * G + x]) { on = true; break }
    }
    if (on) hit++
  }
  return hit / s.points.length
}

const at = (i, f) => strokes.map((s, j) => (j === i ? f(s) : s))
const spansHolding = (held) => {
  // One part, every stroke whole except the held ones at [0,0]: what takeSpansIn
  // hands filterStrokesBySpans for a stroke that has not started.
  const sp = new Float64Array(N * 2)
  for (let s = 0; s < N; s++) { sp[s * 2] = 0; sp[s * 2 + 1] = held.includes(s) ? 0 : 1 }
  return [sp]
}
const cases = [
  ["whole list", strokes, [...Array(N).keys()]],
  [`stroke ${HOLE} dropped (filterStrokesBySpans, held back)`, (sched.filterStrokesBySpans ? sched.filterStrokesBySpans(strokes, spansHolding([HOLE])) : strokes.filter((_, i) => i !== HOLE)), [...Array(N).keys()].filter((i) => i !== HOLE)],
  [`stroke ${HOLE} empty, points: []`, at(HOLE, (s) => ({ ...s, points: [] })), [...Array(N).keys()].filter((i) => i !== HOLE)],
  [`stroke ${HOLE} one point`, at(HOLE, (s) => ({ ...s, points: [s.points[0]] })), [...Array(N).keys()]],
  [`stroke ${HOLE} zero-length piece`, at(HOLE, (s) => ({ ...s, points: [s.points[0], { ...s.points[0] }], clipArc: 0 })), [...Array(N).keys()].filter((i) => i !== HOLE)],
  [`stroke ${ALONE} alone and whole (filterStrokesBySpans)`, (sched.filterStrokesBySpans ? sched.filterStrokesBySpans(strokes, spansHolding([...Array(N).keys()].filter((i) => i !== ALONE))) : strokes.filter((_, i) => i === ALONE)), [ALONE]],
  [`stroke ${HOLE} alone and whole`, [strokes[HOLE]], [HOLE]],
]

// MUST-FAIL ARM: stroke HOLE translated so its leftmost ink sits 40 px past x = CW.
const pastXs = strokes[HOLE].points.reduce((m, p) => Math.min(m, p.x), Infinity)
const pastDx = CW + 40 - pastXs
const pastStroke = { ...strokes[HOLE], points: strokes[HOLE].points.map((p) => ({ ...p, x: p.x + pastDx })) }
const pastList = strokes.map((s, j) => (j === HOLE ? pastStroke : s))
const grade = strokes.map((s, j) => (j === HOLE ? pastStroke : s))

// HERO AT 720: the page's canvas, innerWidth 1440 / 2 by 900 - 48.
const PW = 720, PH = 852, PS = 3.0 / Math.max(PW, PH)
const px2wPage = (px, py) => ({ x: (px - PW / 2) * PS, y: -(py - PH / 2) * PS })
const pageOy = (PH - raw.height) / 2
const pageStrokes = E.process(raw.polylines.map((pl) => pl.map((p) => ({ x: p.x, y: pageOy + p.y }))))
const pageOpts = { ...opts, canvasWidth: PW, canvasHeight: PH }

const rows = []
let solidMiss = 0, ctrlMiss = 0
const all = [
  ...cases.map((c) => [...c, opts, strokes, E.px2w]),
  [`MUST-FAIL ARM: stroke ${HOLE} moved past x = CW (${CW}), from x ${(pastXs + pastDx).toFixed(0)}`, pastList, [...Array(N).keys()], opts, grade, E.px2w],
  [`hero at the page canvas ${PW}x${PH}, raw polylines, x 6 to 1089`, pageStrokes, [...Array(pageStrokes.length).keys()], pageOpts, pageStrokes, px2wPage],
]
for (const [name, list, expect, o, ref, p2w] of all) {
  for (const [eng, engine] of [["solid", E.SolidEngine], ["extrude", E.ExtrudeEngine]]) {
    const meshes = engine.buildPreview(list, o)
    const grid = footprint(meshes)
    const cov = expect.map((i) => [i, coverage(grid, ref[i], p2w)])
    const low = cov.filter(([, c]) => c !== null && c < 0.9)
    // A single point is not a stroke Extrude or Solid can be asked to draw: it is
    // graded on the others only.
    const graded = name.includes("one point") ? low.filter(([i]) => i !== HOLE) : low
    const pass = graded.length === 0
    if (!pass) eng === "solid" ? solidMiss++ : ctrlMiss++
    const vcount = (ms) => ms.reduce((s, m) => s + (m.tubeGeometry?.getAttribute("position")?.count ?? 0), 0)
    const verts = vcount(meshes)
    // Per-stroke verts, each stroke built on its own, for the rows that put ink
    // past the canvas: a stroke that builds 0 verts alone is a drop even when a
    // neighbour's mesh happens to cover its points.
    let alone = ""
    if (o === pageOpts || list === pastList) {
      const per = expect.map((i) => vcount(engine.buildPreview([list[i]], o)))
      const zero = per.map((v, i) => [expect[i], v]).filter(([, v]) => !(v > 0))
      if (zero.length) { if (pass) eng === "solid" ? solidMiss++ : ctrlMiss++ }
      alone = `, verts alone per stroke [${per.join(" ")}]` + (zero.length ? `, 0 verts: ${zero.map(([i]) => i).join(" ")}` : "")
      if (zero.length && pass) { rows.push(`FAIL  ${eng.padEnd(7)} ${name}: list ${list.length}, meshes ${meshes.length}, verts ${verts}${alone}`); continue }
    }
    rows.push(`${pass ? "PASS" : "FAIL"}  ${eng.padEnd(7)} ${name}: list ${list.length}, meshes ${meshes.length}, verts ${verts}${alone}` +
      (graded.length ? `, strokes off the frame: ${graded.map(([i, c]) => `${i}(${c.toFixed(2)})`).join(" ")}` : ""))
  }
}
console.log = L
L(`gaps.mjs mode=${MODE} hero N=${N} strokes, footprint grid ${G}x${G}`)
for (const r of rows) L("  " + r)
L(`solid misses ${solidMiss}, extrude control misses ${ctrlMiss}`)
process.exit(ctrlMiss ? 2 : solidMiss ? 1 : 0)
