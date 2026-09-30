// CLASS B — the Solid/Extrude rim assembly overlapping itself. Open the rays.
//
// The prior lane localised this to "the cap RE-TRIANGULATION the bevel path
// switches on" and named the fix as "reuse H2's triangulation with an index map
// — which is what that block's own comment already claims happens". This probe
// exists to check the claim before acting on it, and to say WHICH triangles are
// crossed rather than only how many rays are.
//
// It runs the real engines through `lib/engine-node.mjs`, so the numbers are the
// shipped code path with no browser and no shared dev server in the way.
//
// Run: node scripts/verify/_probe-cap-overlap.mjs [--shapes=circle,openArc,...]
import { build, SHAPES } from "./lib/engine-node.mjs"
import { foldCensusComponents, meshComponents } from "./lib/elbow-geom.mjs"
import { loadTs } from "./_ts-load.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const SHAPE_NAMES = arg("shapes", "circle,openArc,square,crossing,tick").split(",")
const MODES = arg("modes", "solid,extrude").split(",")

const relief = loadTs("lib/dd-extrude-relief.ts")
const PROFILE = relief.EXTRUDE_BEVEL_PROFILES_FS.rounded

// The engine logs a page of diagnostics per build; they are useful in the app
// and noise here. Silenced around the build only, never around a measurement.
function quiet(fn) {
  const log = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = log
  }
}

/** Every hit along a -Z ray at (x,y), with what it takes to classify it. */
function rayHits(pos, idx, tris, x, y, areaEps) {
  const hits = []
  for (const t of tris) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2]
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2]
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2]
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (Math.abs(d) < areaEps) continue
    const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d
    const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d
    const l3 = 1 - l1 - l2
    if (l1 < 0 || l2 < 0 || l3 < 0) continue
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const L = Math.hypot(nx, ny, nz) || 1
    hits.push({
      t,
      z: l1 * az + l2 * bz + l3 * cz,
      nz: Math.abs(nz / L),
      zs: [az, bz, cz],
      pts: [[ax, ay, az], [bx, by, bz], [cx, cy, cz]],
    })
  }
  hits.sort((p, q) => q.z - p.z)
  return hits
}

function analyse(shape, mode) {
  const polys = SHAPES[shape]()
  const rows = {}
  for (const bevel of [true, false]) {
    PROFILE.enabled = bevel
    const d = quiet(() => build(mode, polys))
    const f = foldCensusComponents(d.pos, d.idx, { grid: 121 })
    rows[bevel ? "on" : "off"] = { d, f }
  }
  PROFILE.enabled = true
  return rows
}

for (const mode of MODES) {
  console.log(`\n================ ${mode.toUpperCase()} ================`)
  console.log("shape       bevel   tris    foldRays  maxSheets  coplanar")
  const keep = {}
  for (const shape of SHAPE_NAMES) {
    const r = analyse(shape, mode)
    keep[shape] = r
    for (const k of ["on", "off"]) {
      const { d, f } = r[k]
      console.log(
        `${shape.padEnd(10)}  ${k.padEnd(5)}  ${String(d.idx.length / 3).padStart(6)}  ${String(f.foldRays).padStart(8)}  ${String(f.maxFoldSheets).padStart(9)}  ${String(f.coplanarRays).padStart(8)}`,
      )
    }
  }

  // Open the worst rays on whichever shape fires hardest.
  for (const shape of SHAPE_NAMES) {
    const { d, f } = keep[shape].on
    if (f.foldRays === 0) continue
    const pos = d.pos, idx = d.idx
    const vertCount = pos.length / 3
    const { triComp } = meshComponents(idx, vertCount)
    const triCount = idx.length / 3
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let i = 0; i < vertCount; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    const areaEps = 1e-9 * ((x1 - x0) ** 2 + (y1 - y0) ** 2)
    const tris = []
    for (let t = 0; t < triCount; t++) if (triComp[t] === triComp[0]) tris.push(t)

    console.log(`\n--- ${shape}/${mode}: opening flagged rays ---`)
    // Re-scan the SAME grid the census uses, so a ray opened here is a ray it
    // counted. Only rays it classifies as a FOLD (more than two DISTINCT
    // depths) are opened: a cap plane covered twice is `coplanarRays`, which is
    // reported and not gated, and mixing the two describes the wrong defect.
    const grid = 121
    const padX = (x1 - x0) * 0.02 + 1e-6
    const padY = (y1 - y0) * 0.02 + 1e-6
    const minX = x0 - padX, minY = y0 - padY
    const binX = (x1 - x0 + 2 * padX) / grid
    const binY = (y1 - y0 + 2 * padY) / grid
    const JX = 0.2360679775, JY = 0.3819660113
    const foldPts = []
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const x = minX + (i + JX) * binX
        const y = minY + (j + JY) * binY
        const hits = rayHits(pos, idx, tris, x, y, areaEps)
        if (hits.length <= 2) continue
        const zs = hits.map((h) => h.z).sort((p, q) => p - q)
        let distinct = 1
        for (let k = 1; k < zs.length; k++) if (zs[k] - zs[k - 1] > 1e-5) distinct++
        if (distinct > 2) foldPts.push({ x, y, hits, distinct })
      }
    }
    console.log(`  fold rays re-found by this probe: ${foldPts.length} (census said ${f.foldRays})`)
    let shown = 0
    {
      for (const w of foldPts) {
        if (shown >= 4) break
        const hits = w.hits
        shown++
        const R = Math.hypot(w.x, w.y)
        console.log(`  ray (${w.x.toFixed(4)}, ${w.y.toFixed(4)})  |xy|=${R.toFixed(4)}  hits=${hits.length}  distinctDepths=${w.distinct}`)
        for (const h of hits) {
          const p = h.pts
          const radii = p.map((q) => Math.hypot(q[0], q[1]).toFixed(4)).join("/")
          const ang = p.map((q) => (Math.atan2(q[1], q[0]) * 180) / Math.PI)
          let span = 0
          for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
              let dd = Math.abs(ang[i] - ang[j])
              if (dd > 180) dd = 360 - dd
              span = Math.max(span, dd)
            }
          }
          console.log(
            `    tri ${String(h.t).padStart(5)}  z=${h.z.toFixed(5)}  |n.z|=${h.nz.toFixed(5)}  vertZ=[${h.zs.map((v) => v.toFixed(5)).join(", ")}]  r=[${radii}]  arcSpan=${span.toFixed(1)}deg`,
          )
        }
      }
    }
  }
}
