/** N6 — preview===export parity for the nib. The repo's stated invariant is that
 *  buildExport walks the SAME builder as buildPreview; this checks the nib
 *  survives the export path, where `defer` is absent and the sync branch runs. */
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"
const GE = loadTs("lib/geometry-engines.ts")
const strokes = processedHeroStrokes()
const eng = GE.getEngine("inflate")
const P = { canvasWidth: 1100, canvasHeight: 242, solidParams: GE.DEFAULT_SOLID_PARAMS,
            inflateParams: { ...GE.DEFAULT_INFLATE_PARAMS, fusion: "implicit", blend: 0.45, resolution: 5 } }
const prev = eng.buildPreview(strokes, P)
const pd = { a: GE.INFLATE_DEBUG.nibSemiMajor, b: GE.INFLATE_DEBUG.nibSemiMinor, c: GE.INFLATE_DEBUG.nibContrastBuilt }
const exp = eng.buildExport(strokes, P)
const ed = { a: GE.INFLATE_DEBUG.nibSemiMajor, b: GE.INFLATE_DEBUG.nibSemiMinor, c: GE.INFLATE_DEBUG.nibContrastBuilt }
const bbox = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return [b.max.x-b.min.x, b.max.y-b.min.y].map(v=>v.toFixed(5)).join(" x ") }
const pg = prev.map(m=>m.tubeGeometry).filter(Boolean)
let eg = []
exp.group?.traverse?.((o)=>{ if (o.geometry) eg.push(o.geometry) })
console.log("preview nib", pd, "bbox", pg.map(bbox).join(" | "))
console.log("export  nib", ed, "bbox", eg.map(bbox).join(" | "))
const stamp = (g) => g.userData.__fsNibApplied ?? "(none)"
console.log("preview stamp", pg.map(stamp).join(","), " export stamp", eg.map(stamp).join(","))
