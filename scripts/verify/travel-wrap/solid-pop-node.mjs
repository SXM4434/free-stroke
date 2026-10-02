// F118 TRAVEL-6: where does the Solid in-pass pop come from? Plain Node, no browser.
//
// The hero word, laid out the way film-loop lays it out (90% of the canvas width,
// centred), timed the way injectStrokes times it (msPerPoint 12, gap 400), cut by the
// REAL seamless Travel window (`windowAt`) and the REAL clip (`filterStrokesBySchedule`),
// built by the REAL SolidEngine through scripts/verify/lib/engine-node.mjs.
//
// Per playhead it prints: the pieces the clip handed Solid, how many are tagged
// (`clipArc`), the ink clusters, how many clusters built, and the built footprint (sum of
// |z-normal| top-face triangle area, world units^2). A pop is a footprint step far above
// its neighbours'. Usage: node solid-pop-node.mjs [p0] [p1] [step] [--opening=1]
import { SolidEngine, DEFAULT_SOLID_PARAMS, CW, CH } from "../lib/engine-node.mjs"
import { readFileSync } from "node:fs"
import { loadTs } from "../_ts-load.mjs"

const S = loadTs("lib/stroke-schedule.ts")
// loadTs caches by file, so this is the same module instance engine-node built with.
const { SOLID_DEBUG } = loadTs("lib/geometry-engines.ts")
const SP = loadTs("lib/stroke-processing.ts")
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const OPENING = process.argv.includes("--opening=1")
const [p0, p1, step] = [Number(args[0] ?? 0), Number(args[1] ?? 0.03), Number(args[2] ?? 0.0005)]

const raw = JSON.parse(readFileSync(new URL("../../capture/logo-strokes.json", import.meta.url), "utf8"))
const k = (CW * 0.9) / raw.width
const ox = (CW - raw.width * k) / 2, oy = (CH - raw.height * k) / 2
let t = 0
const strokes = raw.polylines.filter((pl) => pl.length >= 2).map((pl) => {
  const points = pl.map((p) => { const pt = { x: ox + p.x * k, y: oy + p.y * k, t, pressure: 0.6 }; t += 12; return pt })
  t += 400
  return SP.processStroke({ points }, 4, true, true)
})
const sched = S.scheduleFromStrokes(strokes, null, { ...S.DRAW_IN_DEFAULTS, overlap: 1 })
const winP = { mode: "travel", length: 0.25, seamless: true }

const footprint = (meshes) => {
  let a = 0
  for (const m of meshes) {
    const g = m.tubeGeometry; if (!g) continue
    const p = g.getAttribute("position"), ix = g.getIndex()
    const n = ix ? ix.count : p.count
    for (let i = 0; i < n; i += 3) {
      const [i0, i1, i2] = ix ? [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)] : [i, i + 1, i + 2]
      const ax = p.getX(i1) - p.getX(i0), ay = p.getY(i1) - p.getY(i0), bx = p.getX(i2) - p.getX(i0), by = p.getY(i2) - p.getY(i0)
      a += Math.abs(ax * by - ay * bx) / 2
    }
  }
  return a / 2 // top and bottom caps both project; side walls project to ~0
}
let prev = null
for (let d = p0; d <= p1 + 1e-12; d += step) {
  const win = S.windowAt(winP, d, OPENING)
  const pieces = S.filterStrokesBySchedule(strokes, sched, d, win)
  const tagged = pieces.filter((s) => s.clipArc !== undefined)
  const meshes = pieces.length ? SolidEngine.buildPreview(pieces, { canvasWidth: CW, canvasHeight: CH, solidParams: DEFAULT_SOLID_PARAMS, disableHolesForAnimation: true }) : []
  const dbg = SOLID_DEBUG
  const f = footprint(meshes)
  const dF = prev === null ? 0 : f - prev
  prev = f
  const shortArcs = tagged.map((s) => s.clipArc).filter((a) => a < 40).map((a) => a.toFixed(1))
  console.log(`p ${d.toFixed(4)} pieces ${pieces.length} tagged ${tagged.length} clusters ${dbg.clusterCount} meshes ${meshes.length} foot ${f.toFixed(4)} dFoot ${dF >= 0 ? "+" : ""}${dF.toFixed(4)} shortArcs[${shortArcs.join(",")}]`)
}
