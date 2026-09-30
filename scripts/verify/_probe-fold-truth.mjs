// IS THE FOLD CENSUS TELLING THE TRUTH? — the second half of calibrating it.
//
// `assert-fold-census.mjs` fires on six fixture/mode rows beyond the elbow it
// was built for. A new instrument that immediately finds six new defects is
// exactly the shape of an instrument with a false-positive mode, and this repo
// has shipped ten of those. So every flagged ray is opened up here and the hits
// are classified by MECHANISM before a single one is called a defect.
//
// THE ONE FALSE-POSITIVE MODE A −Z SHEET COUNT HAS. A triangle whose plane
// contains the ray direction projects to a SLIVER in XY. It is the silhouette,
// not a crossing: the ray lies in its plane, so whether the barycentric test
// says "inside" is decided by float noise. A swept tube and an extruded prism
// are full of them — every side wall is vertical, i.e. exactly parallel to −Z.
// `foldCensusComponents` already drops the exactly-degenerate ones (|2A| <
// areaEps); what it cannot drop is a wall that is vertical to within a few
// ulps but not exactly, or a bevel ring at a grazing angle.
//
// So each hit is reported with:
//   z            where along the ray it sits — a real solid is entered and left
//                in PAIRS, and a duplicated/folded sheet shows as a third pair
//   |n.z|        how parallel the triangle is to the ray. |n.z| ~ 0 is a
//                silhouette sliver (suspect); |n.z| ~ 1 is a face the ray
//                genuinely passes through (real)
//   projected area relative to the ray's own cell
//
// VERDICT RULE, stated before the numbers are read:
//   • all extra hits have |n.z| < 0.02 and sliver-sized projections  -> ARTEFACT
//   • extra hits are full faces at distinct z, forming extra enter/exit pairs
//                                                              -> REAL FOLD
//
// Run: node scripts/verify/_probe-fold-truth.mjs [--cases=square/extrude,...]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { meshComponents } from "./lib/elbow-geom.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const CASES = arg("cases", "crossing/solid,circle/solid,circle/inflate,square/rod,square/extrude,square/solid,square/inflate").split(",")
const OUT = join(ROOT, "docs", "verification", "fold-census", arg("label", "truth"))

const VIEW = { width: 1300, height: 850 }
const SHAPES = {
  crossing: () => {
    const a = [], b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  square: () => {
    const p = []
    const c = [[250, 180], [640, 180], [640, 545], [250, 545], [250, 180]]
    for (let k = 0; k < c.length - 1; k++) {
      const [x0, y0] = c[k], [x1, y1] = c[k + 1]
      for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  tick: () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))],
}

/** Every hit along a −Z ray, with the evidence needed to classify it. */
function rayHits(pos, idx, tris, x, y) {
  const hits = []
  for (const t of tris) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2]
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2]
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2]
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (d === 0) continue
    const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d
    const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d
    const l3 = 1 - l1 - l2
    if (l1 < 0 || l2 < 0 || l3 < 0) continue
    const e1 = [bx - ax, by - ay, bz - az]
    const e2 = [cx - ax, cy - ay, cz - az]
    const n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ]
    const L = Math.hypot(n[0], n[1], n[2]) || 1
    hits.push({
      tri: t,
      z: l1 * az + l2 * bz + l3 * cz,
      absNz: Math.abs(n[2] / L),
      projArea: Math.abs(d) / 2,
    })
  }
  hits.sort((p, q) => q.z - p.z)
  return hits
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEW })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  const report = {}
  for (const cs of CASES) {
    const [shape, mode] = cs.split("/")
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), SHAPES[shape]())
    await page.waitForTimeout(800)
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(1700)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(500)
    let d = null
    for (let t = 0; t < 30; t++) {
      d = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      if (d && d.meshes > 0 && d.idx.length) break
      await page.waitForTimeout(300)
    }
    const pos = Float64Array.from(d.pos)
    const idx = Int32Array.from(d.idx)
    const { count, triComp } = meshComponents(idx, pos.length / 3)
    const triCount = idx.length / 3

    // Re-run the same grid, but keep the actual hit lists for flagged rays.
    const flagged = []
    for (let comp = 0; comp < count; comp++) {
      const tris = []
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (let t = 0; t < triCount; t++) {
        if (triComp[t] !== comp) continue
        tris.push(t)
        for (let k = 0; k < 3; k++) {
          const v = idx[t * 3 + k]
          x0 = Math.min(x0, pos[v * 3]); x1 = Math.max(x1, pos[v * 3])
          y0 = Math.min(y0, pos[v * 3 + 1]); y1 = Math.max(y1, pos[v * 3 + 1])
        }
      }
      const grid = 121
      const padX = (x1 - x0) * 0.02 + 1e-6
      const padY = (y1 - y0) * 0.02 + 1e-6
      const minX = x0 - padX, minY = y0 - padY
      const binX = (x1 - x0 + 2 * padX) / grid
      const binY = (y1 - y0 + 2 * padY) / grid
      const JX = 0.2360679775, JY = 0.3819660113
      for (let j = 0; j < grid; j++) {
        for (let i = 0; i < grid; i++) {
          const x = minX + (i + JX) * binX
          const y = minY + (j + JY) * binY
          const hits = rayHits(pos, idx, tris, x, y)
          if (hits.length > 2) flagged.push({ comp, x, y, cellArea: binX * binY, hits })
        }
      }
    }
    // Classify, with the SAME rule foldCensusComponents gates on, so the two
    // cannot disagree about what they are looking at.
    let zLo = Infinity, zHi = -Infinity
    for (let i = 0; i < pos.length / 3; i++) {
      const z = pos[i * 3 + 2]
      if (z < zLo) zLo = z
      if (z > zHi) zHi = z
    }
    const zEps = Math.max((zHi - zLo) * 1e-4, 1e-12)
    let sliverOnly = 0
    let realPairs = 0
    let coplanar = 0
    for (const f of flagged) {
      const extras = f.hits.length - 2
      const slivers = f.hits.filter((h) => h.absNz < 0.02 || h.projArea < f.cellArea * 1e-3).length
      const zs = f.hits.map((h) => h.z).sort((a, b) => a - b)
      let distinct = 1
      for (let k = 1; k < zs.length; k++) if (zs[k] - zs[k - 1] > zEps) distinct++
      f.distinctDepths = distinct
      if (distinct > 2) realPairs++
      else if (slivers >= extras) sliverOnly++
      else coplanar++
    }
    flagged.sort((a, b) => b.distinctDepths - a.distinctDepths)
    report[cs] = {
      components: count,
      zEps,
      flaggedRays: flagged.length,
      classifiedFold: realPairs,
      classifiedCoplanar: coplanar,
      classifiedSliverArtefact: sliverOnly,
      samples: flagged.slice(0, 5).map((f) => ({
        comp: f.comp,
        x: Number(f.x.toFixed(5)),
        y: Number(f.y.toFixed(5)),
        distinctDepths: f.distinctDepths,
        hits: f.hits.map((h) => ({ z: Number(h.z.toFixed(8)), absNz: Number(h.absNz.toFixed(5)), areaOverCell: Number((h.projArea / f.cellArea).toExponential(2)) })),
      })),
    }
    console.log(
      `\n${cs}: ${flagged.length} flagged — ${realPairs} FOLD (distinct depths), ${coplanar} coplanar, ${sliverOnly} sliver   [zEps ${zEps.toExponential(2)}]`,
    )
    for (const s of report[cs].samples) {
      console.log(
        `   [${s.x}, ${s.y}] comp ${s.comp} depths=${s.distinctDepths}: ` +
          s.hits.map((h) => `z=${h.z} |nz|=${h.absNz}`).join("  |  "),
      )
    }
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "fold-truth.json"), JSON.stringify(report, null, 2))
  console.log(`\nwrote ${join(OUT, "fold-truth.json")}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
