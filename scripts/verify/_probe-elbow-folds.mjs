// ELBOW FOLD CENSUS — the thing the crease census provably cannot see.
//
// `probeDihedral` measures `min(acos d, acos -d)`, so a FOLD — a flap of surface
// turned back through itself — reads as a SMALL crease, not a large one. That is
// recorded in explainer 17 §2 as the reason the extrude seam flap was invisible
// to every number while being obvious in a frame. The inside of a tight elbow is
// exactly where a swept loft folds: consecutive rings interpenetrate once the
// centreline's curvature radius drops below the tube radius, and the inner
// column of the strip reverses.
//
// So this asks a DIFFERENT question of the same mesh: cast a dense grid of -Z
// rays through a window around each drawn corner and count how many sheets each
// ray crosses.
//
//   one closed solid            -> every ray hits 0 or 2 sheets (enter, exit)
//   a folded / self-intersecting
//   shell                       -> rays over the fold hit 4, 6, ...
//
// That is the same principle as the FusionProbe already in viewport-3d, but
// placed WHERE I need it (that one only casts through the bbox centre, which for
// a square is empty air). Run in Node against the extracted index buffer so no
// renderer state is involved.
//
// CALIBRATION. The instrument is pointed at two known answers before it is
// believed:
//   • a lone SPHERE-like case — the `tick` fixture, a 6-point mark with no
//     corner at all — must come back all-2 in every mode. If it does not, the
//     caster is wrong and nothing below it means anything.
//   • a deliberately BROKEN mesh: the same buffers with one triangle fan
//     duplicated and displaced -Z by a hair, which inserts exactly two extra
//     sheets. The census must report 4s. A ray counter that cannot count to 4
//     reads identically to a clean mesh.
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
const LABEL = arg("label", "folds")
const OUT = join(ROOT, "docs", "verification", "elbow", LABEL)

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

const SQUARE_PX = [[250, 180], [640, 180], [640, 545], [250, 545]]
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
const tickShape = () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))]

/* ---------------- ray census, pure Node ---------------- */
// -Z rays. A triangle is binned by its XY bbox into a uniform grid so each ray
// only tests nearby triangles. Hit counting uses barycentric containment in XY
// (the ray direction is exactly -Z, so the XY problem is 2-D point-in-triangle)
// which makes it exact rather than epsilon-dependent in the ray parameter.
function rayCensus(pos, idx, cx, cy, half, n) {
  const triCount = idx.length / 3
  const bin = Math.max(half * 2 / n, 1e-6)
  const grid = new Map()
  const key = (i, j) => i * 100003 + j
  const minX = cx - half, minY = cy - half
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
    const x0 = Math.min(pos[a], pos[b], pos[c]), x1 = Math.max(pos[a], pos[b], pos[c])
    const y0 = Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), y1 = Math.max(pos[a + 1], pos[b + 1], pos[c + 1])
    if (x1 < minX || x0 > cx + half || y1 < minY || y0 > cy + half) continue
    const i0 = Math.floor((x0 - minX) / bin), i1 = Math.floor((x1 - minX) / bin)
    const j0 = Math.floor((y0 - minY) / bin), j1 = Math.floor((y1 - minY) / bin)
    for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
      for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) {
        const k = key(i, j)
        let l = grid.get(k)
        if (!l) grid.set(k, (l = []))
        l.push(t)
      }
    }
  }
  const hist = {}
  let maxHits = 0
  let rays = 0
  const worst = []
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = minX + (i + 0.5) * bin
      const y = minY + (j + 0.5) * bin
      const list = grid.get(key(i, j))
      let hits = 0
      if (list) {
        for (const t of list) {
          const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
          const ax = pos[a], ay = pos[a + 1]
          const bx = pos[b], by = pos[b + 1]
          const cxx = pos[c], cyy = pos[c + 1]
          const d = (by - cyy) * (ax - cxx) + (cxx - bx) * (ay - cyy)
          if (d === 0) continue
          const l1 = ((by - cyy) * (x - cxx) + (cxx - bx) * (y - cyy)) / d
          const l2 = ((cyy - ay) * (x - cxx) + (ax - cxx) * (y - cyy)) / d
          const l3 = 1 - l1 - l2
          if (l1 < 0 || l2 < 0 || l3 < 0) continue
          hits++
        }
      }
      rays++
      hist[hits] = (hist[hits] ?? 0) + 1
      if (hits > maxHits) maxHits = hits
      if (hits > 2 && worst.length < 8) worst.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), hits })
    }
  }
  const odd = Object.entries(hist).filter(([h]) => Number(h) % 2 === 1).reduce((s, [, c]) => s + c, 0)
  const over2 = Object.entries(hist).filter(([h]) => Number(h) > 2).reduce((s, [, c]) => s + c, 0)
  return { rays, hist, maxHits, over2, oddRays: odd, worst }
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: VIEW })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
  if (dims.w !== CW || dims.h !== CH) {
    console.log(`FAIL canvas mismatch page ${dims.w}x${dims.h} vs script ${CW}x${CH}`)
    await browser.close()
    process.exit(1)
  }

  const hasDump = await page.evaluate(() => typeof window.__geomDebug?.dumpMeshes === "function")
  if (!hasDump) {
    console.log("FAIL  __geomDebug.dumpMeshes is missing — no fold measurement is possible.")
    await browser.close()
    process.exit(1)
  }

  async function inject(shapeFn) {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), shapeFn())
    await page.waitForTimeout(800)
    await page.evaluate(() => window.__styleHarness.setMode("inflate"))
    await page.waitForTimeout(1200)
    await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(400)
  }

  // Poll: exportGroupRef is empty for a beat while a rebuild swaps meshes in.
  const dump = async () => {
    for (let t = 0; t < 30; t++) {
      const d = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      if (d && d.meshes > 0 && d.idx.length > 0) return d
      await page.waitForTimeout(300)
    }
    return null
  }

  const results = {}

  /* ── the real measurement: square, at each corner ───────────────────────── */
  await inject(squareShape)
  // The mesh must actually BE the square, or every window below is cast at
  // empty air and reports a clean 0 — which reads exactly like a clean 2.
  {
    const d0 = await dump()
    if (!d0) { console.log("FAIL  no mesh buffers"); await browser.close(); process.exit(1) }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let i = 0; i < d0.pos.length; i += 3) {
      if (d0.pos[i] < x0) x0 = d0.pos[i]
      if (d0.pos[i] > x1) x1 = d0.pos[i]
      if (d0.pos[i + 1] < y0) y0 = d0.pos[i + 1]
      if (d0.pos[i + 1] > y1) y1 = d0.pos[i + 1]
    }
    const want = SQUARE_PX.map(([px, py]) => px2w(px, py))
    const inside = want.every((w) => w.x > x0 - 0.02 && w.x < x1 + 0.02 && w.y > y0 - 0.02 && w.y < y1 + 0.02)
    console.log(`mesh bbox x[${x0.toFixed(3)},${x1.toFixed(3)}] y[${y0.toFixed(3)},${y1.toFixed(3)}] tris=${d0.idx.length / 3} — corners ${inside ? "INSIDE" : "*** OUTSIDE — wrong fixture ***"}`)
    if (!inside) { await browser.close(); process.exit(1) }
  }
  const CASES = [
    { name: "loft", patch: { fusion: "loft" } },
    { name: "implicit-b0.45-r5", patch: { fusion: "implicit", blend: 0.45, resolution: 5 } },
    { name: "implicit-b0.55-r4", patch: { fusion: "implicit", blend: 0.55, resolution: 4 } },
  ]
  for (const c of CASES) {
    await page.waitForFunction(() => !!window.__styleHarness, null, { timeout: 30000 })
    await page.evaluate((p) => window.__styleHarness.setInflate(p), c.patch)
    await page.waitForTimeout(2600)
    const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
    const dd = await dump()
    const pos = Float64Array.from(dd.pos)
    const idx = Int32Array.from(dd.idx)

    /* ── CALIBRATION, per case, on the mesh actually under test ─────────────
     * 1. A STRAIGHT RUN has no elbow, so it must come back all-2. If it does
     *    not, the caster is wrong and no corner number below means anything.
     * 2. The SAME buffers with a duplicated shell displaced in -Z carry exactly
     *    two extra sheets, so the census must report 4. A counter that cannot
     *    count past 2 reads identically to a clean mesh — which is the failure
     *    mode this repo has now been caught by five times.
     */
    const midLeg = px2w((SQUARE_PX[0][0] + SQUARE_PX[1][0]) / 2, SQUARE_PX[0][1])
    const cal1 = rayCensus(pos, idx, midLeg.x, midLeg.y, 0.03, 31)
    const pos2 = new Float64Array(pos.length * 2)
    pos2.set(pos)
    for (let i = 0; i < pos.length; i += 3) {
      pos2[pos.length + i] = pos[i]
      pos2[pos.length + i + 1] = pos[i + 1]
      pos2[pos.length + i + 2] = pos[i + 2] - 0.004
    }
    const base = pos.length / 3
    const idx2 = new Int32Array(idx.length * 2)
    idx2.set(idx)
    for (let i = 0; i < idx.length; i++) idx2[idx.length + i] = base + idx[i]
    const cal2 = rayCensus(pos2, idx2, midLeg.x, midLeg.y, 0.03, 31)
    const calOk = cal1.maxHits <= 2 && cal1.oddRays === 0 && cal2.maxHits >= 4 && cal2.over2 > 0
    console.log(
      `\nCAL[${c.name}] straight run hist=${JSON.stringify(cal1.hist)} max=${cal1.maxHits} | doubled shell hist=${JSON.stringify(cal2.hist)} max=${cal2.maxHits} -> ${calOk ? "CAN FAIL, does not invent sheets" : "*** UNCALIBRATED ***"}`,
    )
    if (!calOk) { await browser.close(); process.exit(1) }

    const per = []
    for (let ci = 0; ci < SQUARE_PX.length; ci++) {
      const w = px2w(SQUARE_PX[ci][0], SQUARE_PX[ci][1])
      per.push({ corner: ci, ...rayCensus(pos, idx, w.x, w.y, 0.09, 61) })
    }
    results[c.name] = {
      calStraightRun: cal1,
      calDoubledShell: cal2,
      fusionUsed: dbg?.fusionUsed,
      meshes: dd.meshes,
      tris: idx.length / 3,
      buildBoundaryEdges: dbg?.meshBoundaryEdges ?? null,
      buildNonManifoldEdges: dbg?.meshNonManifoldEdges ?? null,
      msImplicitTotal: dbg?.msImplicitTotal ?? null,
      corners: per,
    }
    console.log(`\n[${c.name}] fusionUsed=${dbg?.fusionUsed} meshes=${dd.meshes} tris=${idx.length / 3} auditBnd=${dbg?.meshBoundaryEdges} auditNonMf=${dbg?.meshNonManifoldEdges} ms=${dbg?.msImplicitTotal}`)
    for (const p of per) {
      console.log(`   corner${p.corner} rays=${p.rays} hist=${JSON.stringify(p.hist)} max=${p.maxHits} over2=${p.over2} odd=${p.oddRays}${p.worst.length ? `  e.g. ${JSON.stringify(p.worst.slice(0, 3))}` : ""}`)
    }
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "fold-census.json"), JSON.stringify(results, null, 2))
  console.log(`\nwrote ${join(OUT, "fold-census.json")}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
