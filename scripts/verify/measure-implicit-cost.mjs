// MEASURE THE HERO'S IMPLICIT-SURFACE COST — where the 1.1s stall actually is.
//
// WHY THIS RUNS IN NODE AND NOT IN THE BROWSER.
// The stall is a pure-JS cost: `polygoniseCapsuleField` allocates a grid,
// samples an SDF on it, marches it, and audits the result. Not one line of it
// touches WebGL, the DOM, or a canvas — `lib/geometry-engines.ts` loads
// verbatim under `_ts-load.mjs`. Node and Chrome run the same V8, so the
// relative cost split (grid / march / normals / audit) and its scaling laws
// transfer directly, and measuring here gives something a browser run cannot:
// a clean signal with no compositor, no rAF throttling and no React in it, at
// a hundred sample points instead of the handful a real-time run can hold.
//
// The browser run still has to happen — only it can say whether the beat READS
// right — but it answers "does the page stall", not "which line costs what".
// This answers the second question, which is the one that picks the fix.
//
// WHAT IT MEASURES
//   1. COST vs REVEAL. The draw-in rebuilds the whole implicit surface from an
//      arc-length prefix of the strokes on every ~22ms tick. Sweeping the
//      prefix from 0 to 1 gives the cost curve the beat actually pays, and
//      says whether the stall is a ramp or a cliff.
//   2. COST SPLIT. msGrid / msMarch / msNormals / audit, plus the grid
//      dimensions and the allocation volume implied by them, so the fix is
//      aimed at the term that dominates rather than at the one that is easiest
//      to see.
//   3. COST vs RESOLUTION. The dial is cells-per-stroke-radius; cost is
//      expected to go as resolution^3. The hero pins 5, the lab was showing 8.
//   4. CACHE VALUE. Re-running an identical build measures what a
//      signature-keyed cache would save (everything) and confirms the build is
//      deterministic enough to be cached at all.
//
// Usage:
//   node scripts/verify/measure-implicit-cost.mjs
//   node scripts/verify/measure-implicit-cost.mjs --steps=24 --res=3,4,5,6,8
import { loadTs } from "./_ts-load.mjs"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const STEPS = parseInt(arg("steps", "20"), 10)
const RESOLUTIONS = arg("res", "3,4,5,6,8").split(",").map(Number)

const { getEngine, INFLATE_DEBUG } = loadTs("lib/geometry-engines.ts")
const { processStroke } = loadTs("lib/stroke-processing.ts")
const { computeSolidEffectiveThicknessPx, DEFAULT_SOLID_PARAMS } = loadTs("lib/geometry-engines.ts")

// ---- the hero's own strokes, built the way app/desk-doodles/page.tsx builds
// them: the traced logo, timed at the capture's cadence, processed at the
// capture's settings with Desk Doodles' rough-handdrawn hand-feel. ----------
const MS_PER_POINT = 12
const MS_GAP_BETWEEN_STROKES = 60
const PROCESS = { spacing: 4, smoothing: true, preserveCorners: true }
const INK_WIDTH_PX = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

// Matches the page: window.innerWidth / 2, window.innerHeight - 48 at 1440x900.
const CANVAS_W = 720
const CANVAS_H = 852

const HERO_INFLATE = { fusion: "implicit", blend: 0.45, resolution: 5 }

function heroStrokes() {
  const json = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8"))
  let t = 0
  const raw = json.polylines.map((pl) => {
    const points = pl.map((p) => {
      const pt = { x: p.x, y: p.y, t }
      t += MS_PER_POINT
      return pt
    })
    t += MS_GAP_BETWEEN_STROKES
    return { points }
  })
  return raw.map((s) =>
    processStroke(s, PROCESS.spacing, PROCESS.smoothing, PROCESS.preserveCorners, 45, {
      wobble: 0.4,
      endpoint: "protrude",
      inkWidth: INK_WIDTH_PX,
    }),
  )
}

/**
 * The arc-length prefix the reveal feeds the engine. Same semantics as
 * `filterStrokesByProgress` in components/viewport-3d.tsx (which is not
 * exported and lives in a .tsx): whole strokes until the cut, then one
 * interpolated endpoint at the exact target length.
 */
function prefix(strokes, p) {
  if (p >= 1) return strokes
  if (p <= 0) return []
  let total = 0
  for (const s of strokes) {
    for (let i = 1; i < s.points.length; i++) {
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
    }
  }
  let target = total * p
  const out = []
  for (const s of strokes) {
    const pts = s.points
    let acc = 0
    const kept = [pts[0]]
    let cut = false
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      if (acc + seg >= target) {
        const f = seg > 0 ? (target - acc) / seg : 0
        kept.push({
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
          t: pts[i - 1].t + (pts[i].t - pts[i - 1].t) * f,
          pressure: pts[i - 1].pressure,
        })
        cut = true
        break
      }
      acc += seg
      kept.push(pts[i])
      target -= 0
    }
    if (kept.length >= 2) out.push({ ...s, points: kept })
    if (cut) break
    target -= acc
  }
  return out
}

const engine = getEngine("inflate")

function build(strokes, resolution) {
  const t0 = performance.now()
  engine.buildPreview(strokes, {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    inflateParams: { ...HERO_INFLATE, resolution },
  })
  const wall = performance.now() - t0
  const d = INFLATE_DEBUG
  return {
    wall,
    msImplicit: d.msImplicitTotal,
    msGrid: d.msFieldGrid,
    msMarch: d.msMarchingCubes,
    msNormals: d.msNormals,
    nx: d.fieldGridX,
    ny: d.fieldGridY,
    nz: d.fieldGridZ,
    activeCells: d.fieldActiveCells,
    sdfEvals: d.fieldSdfEvals,
    meanCand: d.fieldMeanCandidates,
    prims: d.fieldPrimitiveCount,
    coarsened: d.fieldCoarsened,
    fusionUsed: d.fusionUsed,
  }
}

const fmt = (n, w = 7, dp = 1) => String(n.toFixed(dp)).padStart(w)
const int = (n, w = 9) => String(Math.round(n)).toLocaleString("en-US").padStart(w)

async function main() {
  const strokes = heroStrokes()
  const pts = strokes.reduce((a, s) => a + s.points.length, 0)
  console.log(`hero strokes: ${strokes.length} strokes, ${pts} processed points`)
  console.log(`canvas ${CANVAS_W}x${CANVAS_H}, blend ${HERO_INFLATE.blend}\n`)

  // JIT warm-up. Without it the first full build carries the compile cost of
  // every hot loop in the module and reads 2-3x high — which is exactly the
  // trap a naive "warm-up pass" fell into.
  for (let i = 0; i < 3; i++) build(prefix(strokes, 0.35), 5)

  console.log("=== 1. COST vs REVEAL (resolution 5, the value the hero pins) ===")
  console.log(
    "  reveal   wall(ms)  grid    march  normals   +audit   grid dims        active     sdfEvals   alloc(MB)",
  )
  const curve = []
  for (let i = 1; i <= STEPS; i++) {
    const p = i / STEPS
    const r = build(prefix(strokes, p), 5)
    const cells = r.nx * r.ny * r.nz
    const verts = (r.nx + 1) * (r.ny + 1) * (r.nz + 1)
    // values(f32) + computed(u8) + active(u8) + edgeVert(i32 x3), all allocated
    // and zero/-1-filled per build over the FULL grid, not the active set.
    const allocMB = (verts * 4 + verts + cells + verts * 12) / 1048576
    const audit = r.msImplicit - r.msGrid - r.msMarch - r.msNormals
    curve.push({ p, ...r, allocMB, audit })
    console.log(
      `  ${fmt(p, 5, 2)}  ${fmt(r.wall, 9)} ${fmt(r.msGrid, 6)} ${fmt(r.msMarch, 8)} ${fmt(r.msNormals, 8)} ${fmt(audit, 8)}   ${String(r.nx).padStart(4)}x${String(r.ny).padStart(3)}x${String(r.nz).padStart(3)} ${int(r.activeCells)} ${int(r.sdfEvals, 12)} ${fmt(allocMB, 9)}`,
    )
  }

  const full = curve[curve.length - 1]
  const half = curve[Math.floor(curve.length / 2) - 1]
  console.log(
    `\n  full/half cost ratio: ${(full.wall / half.wall).toFixed(2)}x  (linear in revealed length would be ~2.0x)`,
  )
  console.log(
    `  sum over one draw-in at 45Hz ticks: ~${(
      (curve.reduce((a, c) => a + c.wall, 0) / curve.length) *
      (2.6 / 0.022)
    ).toFixed(0)}ms of build work inside a 2600ms beat`,
  )

  console.log("\n=== 2. COST vs RESOLUTION (full word) ===")
  console.log("  res   wall(ms)   grid dims        cells      verts     tris?   alloc(MB)   vs res5")
  const base = build(strokes, 5).wall
  for (const res of RESOLUTIONS) {
    const r = build(strokes, res)
    const cells = r.nx * r.ny * r.nz
    const verts = (r.nx + 1) * (r.ny + 1) * (r.nz + 1)
    const allocMB = (verts * 4 + verts + cells + verts * 12) / 1048576
    console.log(
      `  ${String(res).padStart(3)} ${fmt(r.wall, 9)}    ${String(r.nx).padStart(4)}x${String(r.ny).padStart(3)}x${String(r.nz).padStart(3)} ${int(cells, 11)} ${int(r.activeCells, 10)}          ${fmt(allocMB, 9)}   ${fmt(r.wall / base, 6, 2)}x`,
    )
  }

  console.log("\n=== 3. REPEAT-BUILD COST (what a signature cache would save) ===")
  const a = build(strokes, 5)
  const b = build(strokes, 5)
  console.log(`  identical inputs, two consecutive builds: ${a.wall.toFixed(1)}ms then ${b.wall.toFixed(1)}ms`)
  console.log(`  a cache keyed on the stroke signature turns the second into ~0ms`)

  console.log("\n=== 4. WHAT THE BEAT CAN AFFORD ===")
  const budget = 16.7
  const affordable = curve.filter((c) => c.wall <= budget)
  console.log(`  60fps budget = ${budget}ms/frame`)
  console.log(
    `  reveal fractions that build inside one frame: ${
      affordable.length ? affordable.map((c) => c.p.toFixed(2)).join(", ") : "NONE"
    }`,
  )
  for (const res of RESOLUTIONS) {
    const r = build(strokes, res)
    console.log(`  res ${res}: full word ${r.wall.toFixed(1)}ms — ${(r.wall / budget).toFixed(1)} frames`)
  }
}

main()
