// ELBOW PROBE — square/inflate's four drawn corners, loft vs implicit.
//
// The open defect: `square/inflate` reads `mixed max 89.6` at its four 90-degree
// corners under the DEFAULT (`fusion: "loft"`). This probe asks the question the
// bare max cannot answer: WHERE on the elbow those creases live, and what the
// SAME fixture reads under `fusion: "implicit"`, which is the path that can
// re-topologise.
//
// Classification. The square's four corners are known in canvas px, so their
// world positions are computable (canvasWidth = innerWidth/2, canvasHeight =
// innerHeight - 48, coordScale = 3/max(w,h)). For a crease near corner c with
// interior bisector direction `bis` (pointing INTO the square from c), an edge
// midpoint m is:
//   OUTSIDE the elbow   (m - c)·bis < 0    — the spherical wedge that bridges
//                                            the two tubes; smooth in the exact
//                                            surface, so a crease here is a
//                                            TESSELLATION artefact.
//   INSIDE  the elbow   (m - c)·bis > 0    — the armpit where the two tubes
//                                            interpenetrate; a crease here is a
//                                            REAL feature of the swept-sphere
//                                            volume (a round nib turning a hard
//                                            corner leaves a sharp inner corner).
// That distinction is the whole diagnosis, and no number reported so far has
// made it.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
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
const LABEL = arg("label", "elbow")
const OUT = join(ROOT, "docs", "verification", "elbow", LABEL)

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

const SQUARE_PX = [
  [250, 180],
  [640, 180],
  [640, 545],
  [250, 545],
]
const squareShape = () => {
  const p = []
  const c = [...SQUARE_PX, SQUARE_PX[0]]
  for (let k = 0; k < c.length - 1; k++) {
    const [x0, y0] = c[k]
    const [x1, y1] = c[k + 1]
    for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
  }
  p.push({ x: 250, y: 180 })
  return [p]
}
// Interior bisector at each corner: toward the square's centre.
const CORNERS = SQUARE_PX.map(([px, py]) => {
  const w = px2w(px, py)
  const centrePx = [
    SQUARE_PX.reduce((s, c) => s + c[0], 0) / 4,
    SQUARE_PX.reduce((s, c) => s + c[1], 0) / 4,
  ]
  const cw = px2w(centrePx[0], centrePx[1])
  const dx = cw.x - w.x
  const dy = cw.y - w.y
  const L = Math.hypot(dx, dy) || 1
  return { x: w.x, y: w.y, bx: dx / L, by: dy / L }
})

function classify(mid) {
  // mid is [x, y, z] world. Nearest corner, then inside/outside by the bisector.
  let best = null
  for (let i = 0; i < CORNERS.length; i++) {
    const c = CORNERS[i]
    const d = Math.hypot(mid[0] - c.x, mid[1] - c.y)
    if (!best || d < best.dist) {
      best = { corner: i, dist: Number(d.toFixed(4)), side: null }
    }
  }
  const c = CORNERS[best.corner]
  const proj = (mid[0] - c.x) * c.bx + (mid[1] - c.y) * c.by
  best.side = proj > 0 ? "inside" : "outside"
  best.proj = Number(proj.toFixed(4))
  return best
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: VIEW })
  page.on("console", (m) => {
    if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  // The page's own idea of the canvas must match the one used to place the
  // corners, or every classification below is measured against the wrong point.
  const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
  console.log(`canvas: page ${dims.w}x${dims.h}  script ${CW}x${CH}  ${dims.w === CW && dims.h === CH ? "MATCH" : "*** MISMATCH ***"}`)
  if (dims.w !== CW || dims.h !== CH) {
    await browser.close()
    process.exit(1)
  }

  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(200)
  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), squareShape())
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(400)
  const mat = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
  if (mat !== "glossyPlastic") throw new Error(`material did not take: ${mat}`)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(400)

  const CASES = [
    { name: "loft", patch: { fusion: "loft" } },
    { name: "implicit-hero-b0.45-r5", patch: { fusion: "implicit", blend: 0.45, resolution: 5 } },
    { name: "implicit-default-b0.55-r4", patch: { fusion: "implicit", blend: 0.55, resolution: 4 } },
    { name: "implicit-hardunion-b0-r5", patch: { fusion: "implicit", blend: 0, resolution: 5 } },
    { name: "implicit-b0.45-r8", patch: { fusion: "implicit", blend: 0.45, resolution: 8 } },
    { name: "implicit-b1.2-r5", patch: { fusion: "implicit", blend: 1.2, resolution: 5 } },
  ]

  const results = {}
  for (const c of CASES) {
    await page.evaluate((p) => window.__styleHarness.setInflate(p), c.patch)
    await page.waitForTimeout(2500)
    const got = await page.evaluate(() => window.__styleHarness.get().inflateParams)
    const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
    let probe = []
    for (let t = 0; t < 40; t++) {
      probe = await page.evaluate(() => window.__geomDebug.probeDihedral())
      if (Array.isArray(probe) && probe.length && probe.some((p) => p.triangles > 0)) break
      await page.waitForTimeout(300)
    }
    const agg = { meshes: probe.length, triangles: 0, degenerate: 0, boundaryEdges: 0, nonManifoldEdges: 0 }
    for (const b of ["wall", "cap", "mixed"]) {
      let n = 0, sum = 0, max = 0, over30 = 0, over60 = 0
      for (const p of probe) {
        const s = p[b]
        if (!s || !s.n) continue
        n += s.n
        sum += s.mean * s.n
        max = Math.max(max, s.max)
        over30 += s.over30
      }
      agg[b] = { n, mean: n ? Number((sum / n).toFixed(2)) : 0, max: Number(max.toFixed(2)), over30 }
    }
    for (const p of probe) {
      agg.triangles += p.triangles
      agg.degenerate += p.degenerateTriangles ?? 0
      agg.boundaryEdges += p.boundaryEdges
      agg.nonManifoldEdges += p.nonManifoldEdges
    }
    // Worst edges, classified. Both buckets: the elbow crease can land in
    // `mixed` or `wall` depending on which way the two faces happen to tilt.
    const worst = { mixed: [], wall: [] }
    for (const b of ["mixed", "wall"]) {
      const all = []
      for (const p of probe) for (const w of p.worst?.[b] ?? []) all.push(w)
      all.sort((x, y) => y.deg - x.deg)
      worst[b] = all.slice(0, 6).map((w) => ({ deg: w.deg, mid: w.mid, n0: w.n0, n1: w.n1, where: classify(w.mid) }))
    }
    results[c.name] = { params: got, fusionUsed: dbg?.fusionUsed ?? null, implicitFailure: dbg?.failureReason ?? null, msTotal: dbg?.fieldSampleCount ?? null, agg, worst }
    console.log(
      `\n[${c.name}] fusionUsed=${dbg?.fusionUsed} meshes=${agg.meshes} tris=${agg.triangles} degen=${agg.degenerate} bnd=${agg.boundaryEdges} nonmf=${agg.nonManifoldEdges}`,
    )
    console.log(
      `   wall(n=${agg.wall.n} mean=${agg.wall.mean} max=${agg.wall.max} >30=${agg.wall.over30})  cap(n=${agg.cap.n} mean=${agg.cap.mean} max=${agg.cap.max})  mixed(n=${agg.mixed.n} mean=${agg.mixed.mean} max=${agg.mixed.max} >30=${agg.mixed.over30})`,
    )
    for (const b of ["mixed", "wall"]) {
      for (const w of worst[b]) {
        console.log(
          `   worst.${b} ${String(w.deg).padStart(6)}  at [${w.mid}]  corner${w.where.corner} d=${w.where.dist} ${w.where.side.toUpperCase()} (proj ${w.where.proj})  n0=[${w.n0}] n1=[${w.n1}]`,
        )
      }
    }
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "elbow-probe.json"), JSON.stringify(results, null, 2))
  console.log(`\nwrote ${join(OUT, "elbow-probe.json")}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
