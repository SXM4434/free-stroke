// IS BLEND-3's RESIDUAL THE GEOMETRY, OR THE MARCHING-CUBES FLOOR?
//
// `assert-elbow.mjs` BLEND-3 asserts the seam armpit sits at the closed form
//   rho_in / (sqrt2 r) = 1 + k/(6r)
// with a fixed absolute tolerance of 0.015. On the current tree the b=0.55/r5
// row reads 1.0958 against a predicted 1.0770 and FAILS by 0.0038.
//
// The same script's BLEND-4 already measures the reason to be suspicious: at
// k = 0 the armpit is a hard crease BY CONSTRUCTION (the union of two round
// cones) and the field still reports an apparent fillet of 0.62-0.91 marching
// -cubes cells. So the k=0 reading is NOT 1.0 — it is 1.0 + a discretisation
// floor. The prediction is a continuum statement; the measurement carries that
// floor on top of it, and the two are the same order of magnitude at r5.
//
// A residual that is the FLOOR shrinks when the cells shrink. A residual that
// is the GEOMETRY does not. That is a decidable question and this probe asks
// it: sweep resolution at fixed blend and read the excess over the prediction.
//
// Plain Node through `lib/engine-node.mjs` — the real InflateEngine, no
// browser, so a sibling lane's save cannot move it mid-sweep.
//
// Run: node scripts/verify/_probe-blend-floor.mjs [--blends=0,0.55,1] [--res=4,5,6,7,8]
import { build, SHAPES, VIEW } from "./lib/engine-node.mjs"
import { sliceZ, analyseCorner } from "./lib/elbow-geom.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const BLENDS = arg("blends", "0,0.55,1").split(",").map(Number)
const RES = arg("res", "4,5,6,7,8").split(",").map(Number)

const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

// The same four corners assert-elbow builds, in the same order: corner 0 is
// the SEAM (the stroke's start meets its own end), 1-3 are drawn corners.
const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
const cw = SQUARE_PX.map(([px, py]) => px2w(px, py))
const centre = { x: cw.reduce((s, p) => s + p.x, 0) / 4, y: cw.reduce((s, p) => s + p.y, 0) / 4 }
const nrm = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return { x: dx / L, y: dy / L }
}
const CORNERS = cw.map((c, i) => {
  const bx = centre.x - c.x, by = centre.y - c.y
  const L = Math.hypot(bx, by) || 1
  return { c, bis: { x: bx / L, y: by / L }, legs: [nrm(c, cw[(i + 3) % 4]), nrm(c, cw[(i + 1) % 4])] }
})

function quiet(fn) {
  const log = console.log, err = console.error
  console.log = () => {}
  console.error = () => {}
  try { return fn() } finally { console.log = log; console.error = err }
}

const polys = SHAPES.square()

console.log("blend  res    cell/r   k/r      predicted   measured c0   excess     c1      c2      c3")
const rows = []
for (const blend of BLENDS) {
  for (const res of RES) {
    const d = quiet(() =>
      build("solid" === "x" ? "solid" : "inflate", polys, {
        inflateParams: { fusion: "implicit", blend, resolution: res },
      }),
    )
    const r = d.debug.fieldBaseRadius
    const k = d.debug.blendRadiusK
    const segs = sliceZ(d.pos, d.idx, 0)
    const m = CORNERS.map((f) => analyseCorner(segs, f.c, f.bis, f.legs, r))
    const predicted = 1 + k / (6 * r)
    const measured = m[0].inOverSqrt2R
    const cellOverR = d.debug.implicitCellSize ? d.debug.implicitCellSize / r : 1 / res
    rows.push({ blend, res, r, k, predicted, measured, excess: measured - predicted })
    console.log(
      `${String(blend).padEnd(6)} ${String(res).padEnd(5)}  ${cellOverR.toFixed(4)}  ${(k / r).toFixed(4)}   ` +
        `${predicted.toFixed(4)}      ${measured.toFixed(4)}     ${(measured - predicted).toFixed(4)}   ` +
        `${m[1].inOverSqrt2R.toFixed(4)}  ${m[2].inOverSqrt2R.toFixed(4)}  ${m[3].inOverSqrt2R.toFixed(4)}`,
    )
  }
  console.log("")
}

console.log("\nEXCESS OVER THE CLOSED FORM, per blend, as the cells shrink:")
for (const blend of BLENDS) {
  const r = rows.filter((x) => x.blend === blend)
  console.log(
    `  blend ${String(blend).padEnd(5)} ` +
      r.map((x) => `r${x.res}:${x.excess.toFixed(4)}`).join("  ") +
      `   ${r[0].excess > r[r.length - 1].excess ? "SHRINKS with resolution -> discretisation" : "does NOT shrink -> geometry"}`,
  )
}
