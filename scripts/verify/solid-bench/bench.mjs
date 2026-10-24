// Times SolidEngine.buildPreview and hashes every frame's geometry, for the Solid
// rebuild work (docs/research-2026-09-25/solid/PLAN.md section 8 steps 1 and 2).
//
//   node scripts/verify/solid-bench/bench.mjs [--input=hero|o|shapes] [--static]
//        [--frames=120] [--sigs=out.json] [--against=before.json]
//        [--engine=solid|extrude|inflate|rod] [--width=W]
//
// --engine=E      which engine to build (default solid). The signature carries
//                 Solid's hole tail only for solid.
// --width=W       the width arm (F118 ANIM-3C-W2): build at width multiplier W the
//                 way lib/width-keys.ts hands it to the engine. Solid, Extrude and
//                 Inflate time the rebuild with previewParamsAtWidth's params. Rod
//                 never rebuilds for width, so it builds untimed and times the
//                 widenAlongNormals pass over every tube instead. Omitted, nothing
//                 from width-keys is loaded: the shipped path.
//
// --input=hero    the hero word, scripts/capture/logo-strokes.json, fitted to 90 % of
//                 the harness canvas (default)
// --input=o       one letter "o" at the hero word's letter size, the smallest hole
// --input=shapes  every engine-node SHAPES fixture, one static build each (no frames)
// --static        no holeStabilization: the static and export path, 512 mask
//                 (default: ANIMATION_GATED with an empty active set, what Scene
//                 passes from the first frame of play)
// --against=F     compare this run's signatures with F frame by frame; prints
//                 "identical N of M" and exits 1 when any frame differs
//
// --selftest      the signature on a real frame, with one triangle's winding reversed,
//                 one normal flipped, one position attribute removed and one mesh field
//                 changed; each must differ and an untouched clone must match
//
// A signature is: vertex count, an FNV hash over every mesh's fields, every geometry
// attribute's bits, the index buffer, groups, draw range and morph attributes (see
// `sig`; before 2026-09-25 it was the position buffer alone), the head cluster's validHoleCount and every partial centroid to 5
// decimals with its pixel area. GATE_MUTATE_FILE (scripts/verify/_ts-load.mjs) swaps
// source text for the must-fail controls; make-mutant.mjs writes those files.
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const E = await import(REPO + "scripts/verify/lib/engine-node.mjs")
const { loadTs } = await import(REPO + "scripts/verify/_ts-load.mjs")
const { SOLID_DEBUG } = loadTs("lib/geometry-engines.ts")
const { heroPolys: fitHero, sig: sigOf, HS_GATED, heroProgress } = await import(REPO + "scripts/verify/solid-bench/hero-sig.mjs")
const pen = loadTs("lib/pen-reveal.ts")

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=").slice(1).join("=")
const FRAMES = Number(arg("frames", 120))
const STATIC = process.argv.includes("--static")
const INPUT = arg("input", "hero")
const ENGINE = arg("engine", "solid")
const WIDTH = arg("width", "") === "" ? undefined : Number(arg("width", ""))
const { CW, CH } = E
const heroPolys = () => fitHero(CW, CH)
const ENG = { solid: E.SolidEngine, extrude: E.ExtrudeEngine, inflate: E.InflateEngine, rod: E.RodEngine }[ENGINE]
if (!ENG) throw new Error(`unknown --engine=${ENGINE}`)
if (WIDTH !== undefined && !(WIDTH > 0)) throw new Error(`--width must be a positive number, got ${arg("width", "")}`)
const W = WIDTH === undefined ? null : loadTs("lib/width-keys.ts")
const sig = (meshes) => sigOf(meshes, ENGINE === "solid" ? SOLID_DEBUG.lastStages?.solidDiagnostics ?? {} : null)

// One "o": a closed loop 60 px wide and 64 px tall, about a lowercase letter of the
// hero word at this fit (the word is ~130 px tall here). Starts at the top so a
// partial reveal is an open arc until the last frames close it.
function oPolys() {
  const p = []
  for (let i = 0; i <= 90; i++) {
    const t = -Math.PI / 2 + (i / 90) * Math.PI * 2
    p.push({ x: CW / 2 + Math.cos(t) * 30, y: CH / 2 + Math.sin(t) * 32 })
  }
  return [p]
}

const realLog = console.log
console.log = () => {}
const opts = (hs) => ({
  canvasWidth: CW, canvasHeight: CH,
  extrudeParams: E.DEFAULT_EXTRUDE_PARAMS, solidParams: E.DEFAULT_SOLID_PARAMS, inflateParams: E.DEFAULT_INFLATE_PARAMS,
  holeStabilization: hs,
})
const HS = STATIC ? undefined : HS_GATED
/* The params a width-arm build uses, and what the engine reached. */
const atWidth = W && ENGINE !== "rod" ? W.previewParamsAtWidth(ENGINE, opts(HS), WIDTH) : null
const buildOpts = atWidth ? atWidth.params : opts(HS)
const rodOffset = W && ENGINE === "rod" ? W.rodNormalOffset(WIDTH) : null

/* --selftest: the signature on one real hero frame, broken four ways. Each broken
 * copy must differ from the untouched copy, and the untouched copy must match the
 * original, or the four differences prove nothing. Exits 1 on any miss. */
if (process.argv.includes("--selftest")) {
  const strokes = E.process(heroPolys())
  const meshes = E.SolidEngine.buildPreview(pen.filterStrokesByProgress(strokes, 0.6), opts(HS))
  const clone = () => meshes.map((m) => ({ ...m, tubeGeometry: m.tubeGeometry?.clone() }))
  const base = sig(meshes)
  const first = clone().findIndex((m) => m.tubeGeometry?.index)
  const cases = [
    ["an untouched clone", () => clone(), true],
    ["one triangle's winding reversed in the index", () => {
      const c = clone(), ix = c[first].tubeGeometry.index.array
      const t = ix[1]; ix[1] = ix[2]; ix[2] = t
      return c
    }, false],
    ["one normal flipped", () => {
      const c = clone(), a = c[first].tubeGeometry.getAttribute("normal").array
      a[0] = -a[0]; a[1] = -a[1]; a[2] = -a[2]
      return c
    }, false],
    ["the position attribute removed from one mesh", () => {
      const c = clone(); c[first].tubeGeometry.deleteAttribute("position")
      return c
    }, false],
    ["one mesh's solidStatus changed", () => {
      const c = clone(); c[first] = { ...c[first], solidStatus: `${c[first].solidStatus}-x` }
      return c
    }, false],
  ]
  console.log = realLog
  let bad = 0
  if (first < 0 || meshes[first].tubeGeometry.index.count < 3 || !meshes[first].tubeGeometry.getAttribute("normal")) {
    realLog("  FAIL  no indexed mesh with normals to test on, so the selftest cannot see its subject")
    process.exit(1)
  }
  if (meshes[first].tubeGeometry.index.array[1] === meshes[first].tubeGeometry.index.array[2]) {
    realLog("  FAIL  the first triangle is degenerate, so swapping two of its corners is not a winding change")
    process.exit(1)
  }
  realLog(`SELFTEST: bench sig on hero frame 0.6, ${meshes.length} meshes, base ${base.slice(0, 40)}`)
  for (const [name, make, same] of cases) {
    const s = sig(make())
    const pass = (s === base) === same
    if (!pass) bad++
    realLog(`  ${pass ? "PASS" : "FAIL"}  ${name} ${same ? "matches" : "differs"}: ${s.slice(0, 40)}`)
  }
  realLog(bad ? `SELFTEST FAILED, ${bad} of ${cases.length}` : `SELFTEST holds, ${cases.length} of ${cases.length}`)
  process.exit(bad ? 1 : 0)
}

const times = []
const sigs = []
let withCentroid = 0
const timeOne = (strokes) => {
  let meshes
  if (rodOffset === null) {
    const t0 = performance.now()
    meshes = ENG.buildPreview(strokes, buildOpts)
    times.push(performance.now() - t0)
  } else {
    /* Rod's width arm: the viewport keeps each tube's built positions once and
     * writes base + offset * normal into the live buffer per frame. The copy of
     * the base is the kept buffer, made untimed; the pass is what is timed. */
    meshes = ENG.buildPreview(strokes, buildOpts)
    const tubes = meshes.filter((m) => m.tubeGeometry).map((m) => {
      const pos = m.tubeGeometry.getAttribute("position").array
      return [pos.slice(), m.tubeGeometry.getAttribute("normal").array, pos]
    })
    const t0 = performance.now()
    for (const [base, normal, out] of tubes) W.widenAlongNormals(base, normal, rodOffset, out)
    times.push(performance.now() - t0)
  }
  const s = sig(meshes)
  if (!s.endsWith("cen=")) withCentroid++
  sigs.push(s)
}

if (INPUT === "shapes") {
  for (const [name, make] of Object.entries(E.SHAPES)) {
    const strokes = E.process(make())
    ENG.buildPreview(strokes, buildOpts)
    timeOne(strokes)
    sigs[sigs.length - 1] = `${name}=${sigs[sigs.length - 1]}`
  }
} else {
  const polys = INPUT === "o" ? oPolys() : INPUT === "hero" ? heroPolys() : null
  if (!polys) throw new Error(`unknown --input=${INPUT}`)
  const strokes = E.process(polys)
  for (let i = 0; i < 3; i++) ENG.buildPreview(pen.filterStrokesByProgress(strokes, 0.5), buildOpts)
  for (let f = 1; f <= FRAMES; f++) timeOne(pen.filterStrokesByProgress(strokes, heroProgress(f, FRAMES)))
}
console.log = realLog

const sorted = [...times].sort((a, b) => a - b)
const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
const out = {
  input: INPUT, static: STATIC, frames: sigs.length, framesWithCentroid: withCentroid,
  meanMs: +mean.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2),
  mutant: process.env.GATE_MUTATE_FILE ?? null,
}
if (ENGINE !== "solid") out.engine = ENGINE
if (WIDTH !== undefined) Object.assign(out, { width: WIDTH, reached: atWidth ? atWidth.reached : WIDTH, clamp: atWidth ? atWidth.clamp : null })
const sigsPath = arg("sigs", "")
if (sigsPath) writeFileSync(sigsPath, JSON.stringify(sigs))
const against = arg("against", "")
if (against) {
  if (!existsSync(against)) throw new Error(`--against file missing: ${against}`)
  const before = JSON.parse(readFileSync(against, "utf8"))
  if (before.length !== sigs.length) throw new Error(`--against has ${before.length} frames, this run ${sigs.length}`)
  let same = 0
  const firstDiff = []
  for (let i = 0; i < sigs.length; i++) {
    if (sigs[i] === before[i]) same++
    else if (firstDiff.length < 3) firstDiff.push({ frame: i + 1, before: before[i].slice(0, 90), now: sigs[i].slice(0, 90) })
  }
  out.identical = `${same} of ${sigs.length}`
  if (firstDiff.length) out.firstDiff = firstDiff
  realLog(JSON.stringify(out))
  process.exit(same === sigs.length ? 0 : 1)
}
realLog(JSON.stringify(out))
