// WAS THE "REUSE H2's TRIANGULATION WITH AN INDEX MAP" COMMENT TRUE?
//
// Explainer 19 §7 proposed, as the remaining fix for Class B: "make the bevel
// path reuse H2's triangulation with an index map — which is what that block's
// own comment already claims happens — instead of recomputing." A comment
// describing code that is not there is this repo's recurring defect, so the
// claim gets measured rather than read.
//
// The measurement intercepts `THREE.ShapeUtils.triangulateShape` — the ONE
// function both H2 and the H3 bevel path go through — and records every call's
// arguments and its returned index list, in order, for one Solid build. That
// answers three separate questions with no inference:
//
//   1. How many times is it called per build? (H2 once; H3's bevel path once
//      more only if it recomputes.)
//   2. Are H3's ARGUMENTS the same objects H2 was handed? (`===` on the outer
//      array and on each hole array — object identity, not deep equality.)
//   3. Is H3's returned index list byte-identical to H2's?
//
// Run: node scripts/verify/_probe-h2-index-reuse.mjs [--shapes=circle,square,...]
import { loadTs, ROOT } from "./_ts-load.mjs"
import { createRequire } from "node:module"
import { join } from "node:path"

// THE SAME `three` INSTANCE THE ENGINE USES, not a second copy. `_ts-load.mjs`
// reaches three through `createRequire(...)("three")`, which the package's
// exports map sends to `build/three.cjs`; an `import * as THREE from "three"`
// here would resolve to `build/three.module.js` — a DIFFERENT module object
// whose `ShapeUtils` the engine never calls. Patching that one intercepts
// nothing and reports 0 calls, which reads exactly like "H3 does not
// recompute". Measured first-hand on this probe's first run.
const THREE = createRequire(join(ROOT, "scripts", "verify", "_probe.mjs"))("three")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const SHAPE_NAMES = arg("shapes", "circle,openArc,square,crossing,tick").split(",")
const MODE = arg("capFit", "inset")

const solid = loadTs("lib/solid-mask.ts")
const { build, SHAPES } = await import("./lib/engine-node.mjs")

function quiet(fn) {
  const log = console.log
  const err = console.error
  console.log = () => {}
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.log = log
    console.error = err
  }
}

// Intercept the shared THREE instance. `_ts-load.mjs` resolves `three` from the
// repo's node_modules, which is the same module object this script imports, so
// patching here patches the call the engine makes.
const orig = THREE.ShapeUtils.triangulateShape
const calls = []
THREE.ShapeUtils.triangulateShape = function (contour, holes) {
  const out = orig.call(this, contour, holes)
  calls.push({
    contour,
    holes,
    nContour: contour.length,
    nHoles: holes.length,
    holeLens: holes.map((h) => h.length),
    idx: out.flat(),
  })
  return out
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

console.log(`capFit = ${MODE}\n`)
for (const shape of SHAPE_NAMES) {
  solid.SOLID_TUNING.capFit = MODE
  calls.length = 0
  quiet(() => build("solid", SHAPES[shape]()))

  console.log(`--- ${shape} — ${calls.length} triangulateShape call(s) in the build ---`)
  calls.forEach((c, i) => {
    console.log(
      `  [${i}] contour ${String(c.nContour).padStart(4)} pts, holes ${c.nHoles} ${JSON.stringify(c.holeLens)}, ` +
        `${c.idx.length / 3} tris`,
    )
  })

  // H2's own call is the one carrying HOLES (the `else` branch never calls it),
  // and H3's bevel recompute is the LAST call with holes. `ShapeGeometry` on the
  // outer-only `flatGeom` also lands here with 0 holes, which is why the calls
  // are identified by their arguments rather than by their position.
  const withHoles = calls.filter((c) => c.nHoles > 0)
  if (withHoles.length < 2) {
    console.log(`  -> only ${withHoles.length} hole-carrying call; nothing to compare\n`)
    continue
  }
  const h2 = withHoles[0]
  const h3 = withHoles[withHoles.length - 1]
  const argsIdentical =
    h2.contour === h3.contour &&
    h2.holes.length === h3.holes.length &&
    h2.holes.every((h, i) => h === h3.holes[i])
  const idxIdentical = same(h2.idx, h3.idx)
  let differing = 0
  for (let i = 0; i < Math.max(h2.idx.length, h3.idx.length); i++) if (h2.idx[i] !== h3.idx[i]) differing++
  const posIdentical =
    h2.contour.length === h3.contour.length &&
    h2.contour.every((p, i) => p.x === h3.contour[i].x && p.y === h3.contour[i].y)
  let maxDelta = 0
  for (let i = 0; i < Math.min(h2.contour.length, h3.contour.length); i++) {
    maxDelta = Math.max(maxDelta, Math.hypot(h2.contour[i].x - h3.contour[i].x, h2.contour[i].y - h3.contour[i].y))
  }
  console.log(
    `  -> H2 vs H3: same ARG OBJECTS ${argsIdentical} · same outer POSITIONS ${posIdentical} ` +
      `(max vertex move ${maxDelta.toFixed(5)}) · index buffers identical ${idxIdentical} ` +
      `(${differing} of ${h2.idx.length} differ)\n`,
  )
}
THREE.ShapeUtils.triangulateShape = orig
solid.SOLID_TUNING.capFit = "inset"
