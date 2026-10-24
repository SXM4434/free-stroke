// `square/extrude`, THE LAST OPEN FOLD ROW — is it the chamfer, or the join?
//
// The KNOWN_OPEN ledger in `assert-fold-census.mjs` pins it at 5 fold rays and
// blames "the ribbon's inner offset self-intersecting at a drawn corner". That
// is a claim about a mechanism, so it gets measured rather than repeated:
//
//   1. The bevelSize sweep. If the chamfer CAUSED it, switching the chamfer off
//      removes it. If the chamfer only LIFTS an existing double cover onto
//      distinct depths, the coplanar count survives with the chamfer off.
//   2. The inner column, directly. A mitred join offsets its shared vertex by
//      halfWidth / cos(turn/2). Where that exceeds the centreline advance, the
//      inner boundary travels backwards and the strip folds. This reports the
//      signed advance of the inner column per rung, in half-widths, so the
//      reversal is a number rather than an inference.
//   3. The miter-limit clamp, which already exists in the engine, against the
//      turn actually present at each corner — because a fix that clamps harder
//      is only worth proposing if the clamp is what is failing.
//
// Plain Node through the real ExtrudeEngine.
// Run: node scripts/verify/_probe-extrude-corner-fold.mjs
import { build, SHAPES, VIEW } from "./lib/engine-node.mjs"
import { foldCensusComponents } from "./lib/elbow-geom.mjs"
import { loadTs } from "./_ts-load.mjs"

const engines = loadTs("lib/geometry-engines.ts")
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

const polys = SHAPES.square()
const DEF = engines.DEFAULT_EXTRUDE_PARAMS

console.log("1 · THE CHAMFER SWEEP — does the chamfer CAUSE the fold or only reveal it?\n")
console.log("bevelEnabled  bevelSize   foldRays  maxDepths  coplanarRays  tris")
for (const [enabled, size] of [
  [true, 0.015], [true, 0.010], [true, 0.006], [true, 0.003], [true, 0.001], [false, 0.015],
]) {
  const d = quiet(() => build("extrude", polys, { extrudeParams: { ...DEF, bevelEnabled: enabled, bevelSize: size } }))
  const c = foldCensusComponents(d.pos, d.idx, { grid: 61 })
  console.log(
    `${String(enabled).padEnd(13)} ${size.toFixed(3).padEnd(11)} ${String(c.foldRays).padStart(8)} ` +
      `${String(c.maxDistinctDepths).padStart(10)} ${String(c.coplanarRays).padStart(13)} ${String(d.idx.length / 3).padStart(6)}`,
  )
}

console.log("\n2 · WHERE the flagged rays are, against the four DRAWN corners\n")
{
  const d = quiet(() => build("extrude", polys))
  const c = foldCensusComponents(d.pos, d.idx, { grid: 61 })
  const hits = (c.worst ?? c.rays ?? []).slice(0, 12)
  if (hits.length === 0) console.log("   (the census exposes no per-ray list on this build)")
  for (const h of hits) {
    const x = h.x ?? h[0], y = h.y ?? h[1]
    if (x === undefined) { console.log("  ", JSON.stringify(h).slice(0, 160)); continue }
    let best = Infinity, bi = -1
    CORNERS.forEach((cn, i) => {
      const dd = Math.hypot(cn.x - x, cn.y - y)
      if (dd < best) { best = dd; bi = i }
    })
    console.log(`   ray [${x.toFixed(4)}, ${y.toFixed(4)}]  depths ${h.depths ?? h.hits ?? "?"}  -> corner ${bi} at ${best.toFixed(4)} world`)
  }
}

console.log("\n3 · THE INNER COLUMN, per rung, near each corner — a fold is a NEGATIVE advance\n")
{
  // Rebuild the frames the way the engine does, from the processed stroke, so
  // the turn and the mitred magnitude are the engine's own numbers.
  const d = quiet(() => build("extrude", polys))
  const pts = d.strokes[0].points
  const n = pts.length
  /* `ExtrudeParams.width` IS the half-width in WORLD units — the builder's own
   * header says so at geometry-engines.ts:1674 ("`halfWidth` IS the half-width:
   * total cross-section width on a straight segment is exactly 2 x halfWidth")
   * and `buildContinuousRibbonStripGeometry` is handed `userWidth` unchanged.
   * The first version of this probe divided it by 2 AND multiplied it by the
   * canvas->world scale, giving 0.00007 and step/halfWidth ratios of 200, which
   * is how a wrong constant announces itself. */
  const halfWidth = DEF.width
  console.log(`   ${n} samples, halfWidth ${halfWidth.toFixed(5)} world (= ExtrudeParams.width), miter cos-min 0.5`)
  let worst = { adv: Infinity }
  const rows = []
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i - 1], b = pts[i], c2 = pts[i + 1]
    const inX = px2w(b.x, b.y).x - px2w(a.x, a.y).x
    const inY = px2w(b.x, b.y).y - px2w(a.x, a.y).y
    const outX = px2w(c2.x, c2.y).x - px2w(b.x, b.y).x
    const outY = px2w(c2.x, c2.y).y - px2w(b.x, b.y).y
    const Li = Math.hypot(inX, inY) || 1e-12
    const Lo = Math.hypot(outX, outY) || 1e-12
    const dot = (inX * outX + inY * outY) / (Li * Lo)
    const turn = Math.acos(Math.max(-1, Math.min(1, dot)))
    const cosHalf = Math.max(Math.cos(turn / 2), 0.5)
    const mag = halfWidth / cosHalf
    /* HOW FAR THE MITRED INNER VERTEX TRAVELS BACK ALONG EACH LEG.
     * The miter point sits at `mag` along the bisector; its foot on either leg
     * is `sqrt(mag^2 - halfWidth^2) = halfWidth * tan(turn/2)` back from the
     * corner. On the CONCAVE side that is where the two inner offset lines
     * cross, which is the correct union boundary ONLY while it stays inside
     * both segments. Past that it lands beyond the neighbouring sample and the
     * inner column reverses. So the advance is the step minus that travel. */
    const back = halfWidth * Math.tan(turn / 2)
    const adv = Math.min(Li, Lo) - back
    const w = px2w(b.x, b.y)
    let best = Infinity, bi = -1
    CORNERS.forEach((cn, k) => {
      const dd = Math.hypot(cn.x - w.x, cn.y - w.y)
      if (dd < best) { best = dd; bi = k }
    })
    rows.push({ i, turnDeg: (turn * 180) / Math.PI, mag, magOverHW: mag / halfWidth, step: Lo, adv, advOverHW: adv / halfWidth, corner: bi, dist: best })
    if (adv < worst.adv) worst = rows[rows.length - 1]
  }
  const near = rows.filter((r) => r.dist < 0.05).sort((a, b2) => a.adv - b2.adv)
  console.log("   sample  turn(deg)  miter/hw   step/hw   innerAdvance/hw   nearest corner (world dist)")
  for (const r of near.slice(0, 14)) {
    console.log(
      `   ${String(r.i).padStart(6)}  ${r.turnDeg.toFixed(2).padStart(9)}  ${r.magOverHW.toFixed(4).padStart(8)}  ` +
        `${(r.step / halfWidth).toFixed(4).padStart(8)}  ${r.advOverHW.toFixed(4).padStart(15)}   ${r.corner} (${r.dist.toFixed(4)})`,
    )
  }
  console.log(`\n   worst inner advance anywhere on the stroke: ${worst.advOverHW?.toFixed(4)} half-widths at sample ${worst.i} (turn ${worst.turnDeg?.toFixed(2)} deg)`)
  const reversing = rows.filter((r) => r.adv < 0)
  console.log(`   rungs whose inner column REVERSES (advance < 0): ${reversing.length} of ${rows.length}`)
}
