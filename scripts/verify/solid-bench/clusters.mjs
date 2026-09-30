import { fileURLToPath } from "node:url"
const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const E = await import(REPO + "scripts/verify/lib/engine-node.mjs")
const { loadTs } = await import(REPO + "scripts/verify/_ts-load.mjs")
const eng = loadTs("lib/geometry-engines.ts"); const sm = loadTs("lib/solid-mask.ts")
import { readFileSync } from "node:fs"
const raw = JSON.parse(readFileSync(REPO + "scripts/capture/logo-strokes.json", "utf8"))
const k = (E.CW * 0.9) / raw.width, ox = (E.CW - raw.width * k) / 2, oy = (E.CH - raw.height * k) / 2
const polys = raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))
const L = console.log; console.log = () => {}
const strokes = E.process(polys)
const opts = { canvasWidth: E.CW, canvasHeight: E.CH, solidParams: E.DEFAULT_SOLID_PARAMS }
// count buildMaskSolid calls by wrapping via cluster count reported in SOLID_DEBUG
const meshes = E.SolidEngine.buildPreview(strokes, opts)
const d = eng.SOLID_DEBUG
console.log = L
const st = d.lastStages?.solidDiagnostics
console.log("keys with cluster:", Object.keys(d).filter((x) => /cluster/i.test(x)).map((x) => `${x}=${JSON.stringify(d[x])}`))
console.log("static head-cluster stableHolesWorld:", st?.stableHolesWorld?.length, " stats.holeCount(merged):", meshes[0]?.solidStats?.holeCount ?? "(n/a)")
console.log("mesh keys:", Object.keys(meshes[0] ?? {}).join(","))
console.log("exported cluster fn:", typeof eng.clusterStrokesByInkOverlap)
console.log = () => {}
const xs = strokes.map((s) => s.points.reduce((a, p) => a + p.x, 0) / s.points.length)
const res = []
for (const [name, sel] of [["left5", (i) => xs[i] < E.CW * 0.42], ["right", (i) => xs[i] >= E.CW * 0.42]]) {
  const sub = strokes.filter((_, i) => sel(i))
  E.SolidEngine.buildPreview(sub, opts)
  res.push(`${name}: strokes=${sub.length} clusters=${eng.SOLID_DEBUG.clusterCount} headHoles=${eng.SOLID_DEBUG.lastStages?.solidDiagnostics?.stableHolesWorld?.length}`)
}
console.log = L
console.log(res.join("\n"), "\nxs:", xs.map((x) => x.toFixed(0)).join(" "))
