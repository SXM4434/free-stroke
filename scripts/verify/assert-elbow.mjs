// ELBOW — square/inflate's four drawn corners, measured against closed form.
//
// THE OPEN DEFECT. `square/inflate` reads `mixed max 89.6` at its four drawn
// corners — a hard right angle where two tube runs meet at an elbow, which on
// glossyPlastic is die-cut plastic. Explainer 17 left it open. The obvious next
// move — read the crease census on `fusion: "implicit"`, see 89.6 fall to ~53,
// and route the default — is a TRAP, and this file exists because of it.
//
// WHY THE CREASE CENSUS CANNOT ANSWER THIS. `probeDihedral` reports the angle
// between ADJACENT TRIANGLES. A corner turns the surface by a fixed total
// amount no matter how it is expressed, so the per-edge number is really
// "total turn / how many edges it was spread over". A denser mesh spreads the
// same hard crease over more edges and the number falls with nothing about the
// SHAPE having changed. Marching cubes at r5 emits ~2 edges across a 90 degree
// crease; 90/2 = 45, which is the ~50 the implicit path reads. So that reading
// is consistent both with "the implicit path fillets the elbow" and with "the
// implicit path has the identical hard crease, tessellated finer" — and those
// two have opposite consequences for the fix. It is ALSO structurally blind to
// a fold: `min(acos d, acos -d)` scores a flap turned back through itself as a
// SMALL crease. Self-intersection must be detected directly, never inferred
// from a crease angle.
//
// WHAT THIS MEASURES INSTEAD — see scripts/verify/lib/elbow-geom.mjs for the
// derivations and for why the FIRST version of this probe reported a 620 degree
// turn on a synthetic whose fillet is zero by construction.
//
//   rho_in, inner fillet   the armpit, two independent ways
//   rho_out, outer fillet  whether the drawn corner SURVIVED as a corner
//   fold census            sheets crossed by a -Z ray: 2 = a closed solid,
//                          4+ = the surface passes through itself
//   loftFoldDepth          the engine's own embedding predicate, so the
//                          prediction and the measurement can be compared
//
// CALIBRATION, in both directions, before a single row is believed:
//   • SEVEN synthetic contours with answers known in closed form, including two
//     KNOWN-BAD outer joins (a miter spike and a corner rounded away). An
//     instrument that cannot tell those from the corner ball can be passed by a
//     "fix" that destroys the drawn corner, which is worse than the defect.
//   • The real buffers with the shell DUPLICATED and displaced must read 4
//     sheets. A ray counter that cannot count past 2 reads like a clean mesh.
//   • A STRAIGHT RUN of the real mesh must read exactly 2.
//
// Run: node scripts/verify/assert-elbow.mjs --label=<name>
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
import {
  sliceZ,
  analyseCorner,
  syntheticElbow,
  SYNTH_FRAME,
  rayCensus,
} from "./lib/elbow-geom.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/* ── AN OPT-IN ROUND-PEN ARM, AND WHY THIS GATE OF ALL GATES NEEDED ONE ────
 *
 * F59's own sentence about the rows below: *"the honest repair needs a known-bad
 * built UNDER the nib and none exists — `syntheticElbow` builds at aspect 1."*
 * `nibAspect` is a real `InflateParams` field and `__styleHarness.setInflate`
 * reaches it, so a DIAGNOSTIC run can put the shipped pen at any aspect without
 * editing a source constant, which is how N21 had to do it. Unset, this file
 * behaves byte-identically to the run it has always made.
 *
 * ⚠ THE DIAL IS NOT THE PROOF, AND THIS IS THE TRAP THE PROBE FOUND.
 * `INFLATE_DEBUG.nibAspect` is `build.nib.aspect`, i.e. `inflateResolveNib`'s
 * echo of the REQUEST — `lib/geometry-engines.ts` says so four lines above the
 * field. A driver validated on it reports success for a nib that never touched a
 * vertex. The PRODUCED value is `nibContrastBuilt`, and both are read back and
 * printed on every diagnostic run below. See `scripts/verify/_probe-elbow-nib.mjs`,
 * whose must-fail arm shows the dial reading 2.4 while the geometry reads 1.000.
 *
 * A DIAGNOSTIC RUN IS NEVER A VERDICT. It writes to its own label, says so on
 * every line of its summary, and EXITS 2 whatever the rows do, so a run that
 * happens to be all-green at aspect 1.0 can never be quoted as this gate
 * passing. The pen it graded is not the pen that ships. */
const NIB_ASPECT = process.env.FS_NIB_ASPECT ? Number(process.env.FS_NIB_ASPECT) : null
if (process.env.FS_NIB_ASPECT && !(Number.isFinite(NIB_ASPECT) && NIB_ASPECT >= 1)) {
  console.log(`FAIL  FS_NIB_ASPECT=${process.env.FS_NIB_ASPECT} is not a nib aspect (finite, >= 1)`)
  process.exit(1)
}
const LABEL = arg("label", "elbow") + (NIB_ASPECT === null ? "" : `-nib${NIB_ASPECT}`)
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
// The CONTROL for the routing test: a smooth arc whose curvature radius is far
// above the tube radius, so the swept tube is a valid surface and `auto` must
// leave it on the loft. A routing rule that fires on everything is not a rule.
const circleShape = () => [
  Array.from({ length: 96 }, (_, i) => {
    const a = (i / 95) * Math.PI * 1.9
    return { x: 445 + Math.cos(a) * 170, y: 360 + Math.sin(a) * 170 }
  }),
]

/**
 * Fold `probeDihedral`'s PER-MESH rows into one census.
 *
 * The loft emits one mesh per stroke; the field emits one mesh for the whole
 * drawing. Taking `[0]` would compare one stroke's rim against a whole
 * drawing's, which is not a comparison. `max` takes the max, `over30`/`n` sum,
 * and `worst` is re-sorted across meshes so the reported positions are the
 * drawing's worst edges rather than the first mesh's.
 */
const mergeCensus = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const bucket = (key) => {
    const b = { n: 0, mean: 0, p95: 0, max: 0, over30: 0 }
    let wsum = 0
    for (const r of rows) {
      const s = r?.[key]
      if (!s) continue
      b.n += s.n
      b.over30 += s.over30
      b.max = Math.max(b.max, s.max)
      b.p95 = Math.max(b.p95, s.p95)
      wsum += s.mean * s.n
    }
    b.mean = b.n ? Number((wsum / b.n).toFixed(2)) : 0
    return b
  }
  const worst = rows
    .flatMap((r) =>
      r?.worst
        ? Object.entries(r.worst).flatMap(([k, v]) => (Array.isArray(v) ? v.map((e) => ({ bucket: k, ...e })) : []))
        : [],
    )
    .sort((a, b) => b.deg - a.deg)
    .slice(0, 8)
  return {
    meshes: rows.length,
    triangles: rows.reduce((a, r) => a + (r?.triangles ?? 0), 0),
    degenerateTriangles: rows.reduce((a, r) => a + (r?.degenerateTriangles ?? 0), 0),
    boundaryEdges: rows.reduce((a, r) => a + (r?.boundaryEdges ?? 0), 0),
    nonManifoldEdges: rows.reduce((a, r) => a + (r?.nonManifoldEdges ?? 0), 0),
    wall: bucket("wall"),
    cap: bucket("cap"),
    mixed: bucket("mixed"),
    worst,
  }
}

const PASS = []
const check = (name, ok, detail) => {
  PASS.push({ name, ok: !!ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
}

/* ==========================================================================
 * CALIBRATION — pure, no renderer. Runs first so a broken probe costs
 * milliseconds instead of a browser session.
 * ======================================================================== */
function calibrate() {
  console.log("\nCALIBRATION — synthetic elbows with answers known in closed form\n")
  const R = 0.06
  const rows = []
  const run = (q, join) => {
    const segs = syntheticElbow(R, q, join)
    const m = analyseCorner(segs, SYNTH_FRAME.c, SYNTH_FRAME.bis, SYNTH_FRAME.legs, R)
    rows.push({ innerFillet: q, outerJoin: join, ...m })
    return m
  }
  console.log("  INNER — armpit fillet, outer join held at the corner ball")
  console.log("   q/r    rho_in/(sqrt2 r)  want      fillet/r  want    turn")
  for (const q of [0, 0.1, 0.25, 0.5]) {
    const m = run(q, 1)
    const want = 1 + (q * (Math.SQRT2 - 1)) / Math.SQRT2
    console.log(
      `   ${q.toFixed(2)}   ${m.inOverSqrt2R.toFixed(5)}         (${want.toFixed(5)})  ${m.innerFilletOverR.toFixed(5)}   (${q.toFixed(2)})  ${m.innerTurnDeg.toFixed(2)}`,
    )
  }
  console.log("\n  OUTER — the KNOWN-BAD directions, armpit held hard")
  console.log("   join     rho_out/r  want      fillet/r  want   turn")
  const outerWant = [
    [1, 1, 1, "corner ball — the union of balls"],
    [0, Math.SQRT2, 0, "KNOWN-BAD: miter spike"],
    [2, 0.5857864, 2, "KNOWN-BAD: corner rounded AWAY"],
  ]
  for (const [j, wo, wf, why] of outerWant) {
    const m = run(0, j)
    console.log(
      `   ${j.toFixed(2)}     ${m.outOverR.toFixed(5)}    (${wo.toFixed(5)})  ${m.outerFilletOverR.toFixed(5)}   (${wf.toFixed(2)})  ${m.outerTurnDeg.toFixed(2)}   ${why}`,
    )
  }

  const inner = rows.slice(0, 4)
  const outer = rows.slice(4)
  check(
    "CAL-1 rho_in matches the closed form on all four armpits",
    inner.every((c) => Math.abs(c.inOverSqrt2R - (1 + (c.innerFillet * (Math.SQRT2 - 1)) / Math.SQRT2)) < 0.002),
    inner.map((c) => c.inOverSqrt2R.toFixed(5)).join(" "),
  )
  check(
    "CAL-2 a hard armpit reads as a CREASE (implied fillet < 0.02r)",
    inner[0].innerFilletOverR < 0.02,
    `${inner[0].innerFilletOverR.toFixed(5)}r`,
  )
  check(
    "CAL-3 known armpit fillets 0.10 / 0.25 / 0.50 r are recovered within 10%",
    inner.slice(1).every((c) => Math.abs(c.innerFilletOverR - c.innerFillet) < 0.1 * c.innerFillet),
    inner.slice(1).map((c) => `${c.innerFillet}->${c.innerFilletOverR.toFixed(4)}`).join(" "),
  )
  check(
    "CAL-4 the armpit turn is 90 deg in every synthetic (the total is FIXED; only its width differs)",
    inner.every((c) => Math.abs(c.innerTurnDeg - 90) < 1),
    inner.map((c) => c.innerTurnDeg.toFixed(2)).join(" "),
  )
  check(
    "CAL-5 the corner ball reads rho_out = r and an outer fillet of r",
    Math.abs(outer[0].outOverR - 1) < 0.01 && Math.abs(outer[0].outerFilletOverR - 1) < 0.05,
    `${outer[0].outOverR.toFixed(5)} / ${outer[0].outerFilletOverR.toFixed(5)}`,
  )
  check(
    "CAL-6 KNOWN-BAD a miter SPIKE is distinguished from the ball (rho_out 1.414, outer fillet 0)",
    Math.abs(outer[1].outOverR - Math.SQRT2) < 0.01 && outer[1].outerFilletOverR < 0.02,
    `${outer[1].outOverR.toFixed(5)} / ${outer[1].outerFilletOverR.toFixed(5)}`,
  )
  check(
    "CAL-7 KNOWN-BAD a corner ROUNDED AWAY is caught (rho_out 0.586 < 1, outer fillet 2r)",
    outer[2].outOverR < 0.7 && Math.abs(outer[2].outerFilletOverR - 2) < 0.1,
    `${outer[2].outOverR.toFixed(5)} / ${outer[2].outerFilletOverR.toFixed(5)}`,
  )
  return rows
}

/* ==========================================================================
 * MAIN
 * ======================================================================== */
async function main() {
  const calRows = calibrate()
  if (PASS.some((p) => !p.ok)) {
    console.log("\nCALIBRATION FAILED — refusing to measure. Nothing below would mean anything.")
    process.exit(1)
  }

  // Headless is correct HERE ONLY BECAUSE OF THE ANGLE FLAG. The freeze that
  // once justified "never headless" was SwiftShader — headless falling back to
  // software rasterisation. Measured in this repo: 120 vs 121 rAF ticks over
  // the same beat, identical renderer string, distinct frames at every seek.
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEW })
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
  if (dims.w !== CW || dims.h !== CH) {
    console.log(`FAIL canvas mismatch page ${dims.w}x${dims.h} vs script ${CW}x${CH}`)
    await browser.close()
    process.exit(1)
  }

  const dump = async () => {
    for (let t = 0; t < 30; t++) {
      const d = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      if (d && d.meshes > 0 && d.idx.length > 0) return d
      await page.waitForTimeout(300)
    }
    return null
  }

  const loadShape = async (poly) => {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), poly)
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__styleHarness.setMode("inflate"))
    await page.waitForTimeout(1400)
    if (NIB_ASPECT !== null) {
      await page.evaluate((v) => window.__styleHarness.setInflate({ nibAspect: v }), NIB_ASPECT)
      await page.waitForTimeout(2000)
    }
    // glossyPlastic, never softGel: sheen 1.0 with a broad lobe AVERAGES over a
    // normal discontinuity instead of tracing it, which is how this class of
    // defect survived so long as Inflate's default material.
    await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(400)
  }

  // Corner frame: inward bisector + the two leg directions.
  const cw = SQUARE_PX.map(([px, py]) => px2w(px, py))
  const centre = {
    x: cw.reduce((s, p) => s + p.x, 0) / 4,
    y: cw.reduce((s, p) => s + p.y, 0) / 4,
  }
  const CORNERS = cw.map((c, i) => {
    const prev = cw[(i + 3) % 4]
    const next = cw[(i + 1) % 4]
    const nrm = (a, b) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const L = Math.hypot(dx, dy) || 1
      return { x: dx / L, y: dy / L }
    }
    const bx = centre.x - c.x
    const by = centre.y - c.y
    const L = Math.hypot(bx, by) || 1
    return { c, bis: { x: bx / L, y: by / L }, legs: [nrm(c, prev), nrm(c, next)] }
  })

  const CASES = arg(
    "cases",
    "loft,auto,implicit-b0.00-r5,implicit-b0.55-r5,implicit-b1.00-r5,implicit-b0.55-r7",
  ).split(",")
  const parse = (name) => {
    if (name === "loft") return { fusion: "loft" }
    if (name === "auto") return { fusion: "auto" }
    const m = name.match(/implicit-b([\d.]+)-r([\d.]+)/)
    return { fusion: "implicit", blend: Number(m[1]), resolution: Number(m[2]) }
  }

  await loadShape(squareShape())

  const results = {}
  let rNom = 0
  for (const name of CASES) {
    await page.evaluate((p) => window.__styleHarness.setInflate(p), parse(name))
    await page.waitForTimeout(2600)
    const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
    if (NIB_ASPECT !== null) {
      /* REQUESTED next to PRODUCED, on every arm. `setInflate` merges a patch,
       * so a later arm's patch could in principle drop the aspect and every row
       * after it would silently grade the shipped pen while the banner said
       * otherwise. This refuses instead. */
      const built = Number(dbg?.nibContrastBuilt)
      if (dbg?.nibAspect !== NIB_ASPECT) {
        console.log(
          `FAIL  the driven nib did not survive arm ${name} — asked ${NIB_ASPECT}, the resolver reports ` +
            `${dbg?.nibAspect}. Every row after this one would grade a different pen.`,
        )
        await browser.close()
        process.exit(1)
      }
      if (NIB_ASPECT === 1 ? Math.abs(built - 1) > 0.02 : !(built > 1.02)) {
        console.log(
          `FAIL  the driven nib did not reach the GEOMETRY on arm ${name} — dial ${dbg?.nibAspect}, ` +
            `nibContrastBuilt ${built}. The dial is an echo of the request; this is the produced value.`,
        )
        await browser.close()
        process.exit(1)
      }
      console.log(`  [nib] ${name}: dial ${dbg.nibAspect}  nibContrastBuilt ${built.toFixed(4)}  semi ${Number(dbg.nibSemiMajor).toFixed(4)}/${Number(dbg.nibSemiMinor).toFixed(4)}`)
    }
    // probeDihedral returns ONE ENTRY PER MESH. The loft emits one mesh per
    // stroke and the field emits one for the whole drawing, so the two paths
    // are only comparable after folding the per-mesh rows together — reading
    // `[0]` would silently compare one stroke against the entire drawing.
    const census = mergeCensus(await page.evaluate(() => window.__geomDebug.probeDihedral()))
    const dd = await dump()
    if (!dd) {
      console.log(`FAIL no mesh for ${name}`)
      await browser.close()
      process.exit(1)
    }
    const pos = Float64Array.from(dd.pos)
    const idx = Int32Array.from(dd.idx)
    if (!rNom) rNom = dbg?.fieldBaseRadius || 0.05

    const segs = sliceZ(pos, idx, 0)

    /* The caster, calibrated ON THIS MESH: a straight run must read 2, and the
     * same buffers duplicated and displaced must read 4. */
    const midLeg = px2w((SQUARE_PX[0][0] + SQUARE_PX[1][0]) / 2, SQUARE_PX[0][1])
    const calStraight = rayCensus(pos, idx, midLeg.x, midLeg.y, rNom * 0.5, 31)
    const pos2 = new Float64Array(pos.length * 2)
    pos2.set(pos)
    for (let i = 0; i < pos.length; i += 3) {
      pos2[pos.length + i] = pos[i]
      pos2[pos.length + i + 1] = pos[i + 1]
      pos2[pos.length + i + 2] = pos[i + 2] - rNom * 0.06
    }
    const base = pos.length / 3
    const idx2 = new Int32Array(idx.length * 2)
    idx2.set(idx)
    for (let i = 0; i < idx.length; i++) idx2[idx.length + i] = base + idx[i]
    const calDoubled = rayCensus(pos2, idx2, midLeg.x, midLeg.y, rNom * 0.5, 31)
    check(
      `CAL-8 [${name}] the ray caster reads 2 on a straight run and 4 on a doubled shell`,
      calStraight.maxHits <= 2 && calDoubled.maxHits >= 4,
      `straight ${calStraight.maxHits} / doubled ${calDoubled.maxHits}`,
    )

    const corners = CORNERS.map((f, i) => ({
      corner: i,
      ...analyseCorner(segs, f.c, f.bis, f.legs, rNom),
      fold: rayCensus(pos, idx, f.c.x, f.c.y, rNom * 1.6, 81),
    }))

    results[name] = {
      fusionRequested: dbg?.fusionRequested,
      fusionUsed: dbg?.fusionUsed,
      fieldBaseRadius: dbg?.fieldBaseRadius,
      blendRadiusK: dbg?.blendRadiusK,
      loftFoldDepth: dbg?.loftFoldDepth,
      loftFoldOverR: dbg?.loftFoldOverR,
      loftFoldingPairs: dbg?.loftFoldingPairs,
      msBuildTotal: dbg?.msBuildTotal,
      msImplicitTotal: dbg?.msImplicitTotal,
      tris: idx.length / 3,
      sliceSegments: segs.length,
      census,
      cal: { straight: calStraight, doubled: calDoubled },
      corners,
    }

    console.log(
      `\n[${name}] requested=${dbg?.fusionRequested} used=${dbg?.fusionUsed} tris=${idx.length / 3} ` +
        `foldDepth=${dbg?.loftFoldDepth?.toExponential(2)} foldOverR=${dbg?.loftFoldOverR?.toFixed(4)} ` +
        `pairs=${dbg?.loftFoldingPairs} build=${dbg?.msBuildTotal?.toFixed(0)}ms`,
    )
    console.log(
      `   census  wall max ${census?.wall?.max?.toFixed(2)} (>30 ${census?.wall?.over30}/${census?.wall?.n})  ` +
        `cap max ${census?.cap?.max?.toFixed(2)}  MIXED MAX ${census?.mixed?.max?.toFixed(2)} ` +
        `(>30 ${census?.mixed?.over30}/${census?.mixed?.n})  degenerate ${census?.degenerateTriangles}  ` +
        `boundary ${census?.boundaryEdges}  nonManifold ${census?.nonManifoldEdges}`,
    )
    // WHERE the worst edges are. `max` alone cannot tell one drawn corner from
    // a faceted rim, and the previous Inflate diagnosis was inferred and wrong.
    for (const w of (census?.worst ?? []).slice(0, 3)) {
      const d = Math.min(...CORNERS.map((f) => Math.hypot(w.mid[0] - f.c.x, w.mid[1] - f.c.y)))
      console.log(
        `      worst ${w.bucket} ${w.deg.toFixed(2)} at [${w.mid.map((v) => v.toFixed(3)).join(", ")}] — ${(d / rNom).toFixed(2)}r from the nearest drawn corner`,
      )
    }
    console.log("   corner  rLocal   rho_out/r  outFillet/r  rho_in/(sqrt2 r)  inFillet/r  facet/r  folds>2  maxSheets")
    for (const p of corners) {
      console.log(
        `     ${p.corner}     ${p.rLocal.toFixed(5)}   ${p.outOverR.toFixed(4)}     ${p.outerFilletOverR?.toFixed(4)}` +
          `       ${p.inOverSqrt2R.toFixed(4)}         ${p.innerFilletOverR?.toFixed(4)}   ${p.facetOverR?.toFixed(4)}   ` +
          `${p.fold.over2}      ${p.fold.maxHits}`,
      )
    }
  }

  /* ---- COVERAGE, BEFORE ANY ROW READS `results` --------------------------
   * INSTRUMENT REPAIR 2026-08-03 (class 7). `--cases=loft,auto` dropped all
   * EIGHT blend rows — `if (b0 && b1)` at the BLEND block had no else, and
   * `if (!row) continue` inside BLEND-3b/c skipped silently — and the run still
   * printed ALL ELBOW ASSERTIONS PASS. Selecting fewer cases was the cheapest
   * way to get a green elbow. The cases the assertions below READ are named
   * here, and a run that did not build one of them fails on that fact rather
   * than on the absence of its rows. */
  const REQUIRED_CASES = [
    "loft",
    "auto",
    "implicit-b0.00-r5",
    "implicit-b0.55-r5",
    "implicit-b1.00-r5",
    "implicit-b0.55-r7",
  ]
  const missingCases = REQUIRED_CASES.filter((c) => !results[c])
  check(
    `COVERAGE every case the assertions read was actually built (${REQUIRED_CASES.length})`,
    missingCases.length === 0,
    missingCases.length === 0
      ? `built: ${Object.keys(results).join(", ")}`
      : `NOT BUILT: ${missingCases.join(", ")} — this run measured ${Object.keys(results).length} of ${REQUIRED_CASES.length} cases and cannot be green`,
  )

  /* ---- THE ROUTING TEST, BOTH DIRECTIONS -------------------------------- */
  const sq = results["auto"]
  /* `[].every()` is `true`. Every row below that reads `(sq?.corners ?? [])`
   * would therefore PASS on an absent `auto` case — four rows green on no data.
   * Asserted once, here, so the rows beneath it mean what they say. */
  check(
    "ROUTE-0 the `auto` case produced four measured corners (an empty array passes .every() and must not)",
    Array.isArray(sq?.corners) && sq.corners.length === 4,
    `${sq?.corners?.length ?? "no"} corners from case \`auto\``,
  )
  check(
    "ROUTE-1 the loft's own embedding predicate says square FOLDS",
    (results["loft"]?.loftFoldingPairs ?? 0) > 0,
    `pairs ${results["loft"]?.loftFoldingPairs}, depth/r ${results["loft"]?.loftFoldOverR?.toFixed(4)}`,
  )
  check(
    "ROUTE-2 the fold PREDICTION is confirmed independently by the ray census on the loft",
    (results["loft"]?.corners ?? []).some((c) => c.fold.over2 > 0),
    (results["loft"]?.corners ?? []).map((c) => c.fold.over2).join("/"),
  )
  check(
    "ROUTE-3 auto sends the folding drawing to the field",
    sq?.fusionUsed === "implicit" && sq?.fusionRequested === "auto",
    `${sq?.fusionRequested} -> ${sq?.fusionUsed}`,
  )
  check(
    "ROUTE-4 the routed surface does NOT pass through itself at any drawn corner",
    (sq?.corners ?? []).every((c) => c.fold.over2 === 0),
    (sq?.corners ?? []).map((c) => c.fold.over2).join("/"),
  )
  /* ROUTE-5 WAS ONE-SIDED, AND ITS ONE SIDE WAS CALIBRATED ON GEOMETRY THAT NO
   * LONGER SHIPS. Recalibrated 2026-08-02, on the same precedent explainer 19
   * §9.3 set for BLEND-3: *"BLEND-3 was calibrated on a build that no longer
   * ships… The tolerance was also under the instrument's own floor."*
   *
   * WHAT MOVED. `lib/stroke-processing.ts`'s corner predicate was inverted, so
   * `preserveCorners` detected corners in straight runs and missed the real
   * ones; and the corner it did pin was then gridded over by the final
   * `resampleStroke`. Both are fixed, and the effect here is the SPREAD
   * COLLAPSING: the four corners read 0.992 / 1.030 / 1.034 / 1.023 before —
   * a range of 0.042 — and 1.000 / 0.976 / 0.973 / 0.978 after, a range of
   * 0.027, with the seam corner landing on 1.000 exactly. Attributed rather
   * than assumed, on the same page in the same session, by flipping
   * `window.__strokeTuning.corner.predicate`:
   * `scripts/verify/_probe-elbow-arms.mjs`.
   *
   * WHY THE OLD BOUND IS THE WRONG SHAPE. CAL-5 states the ideal in closed
   * form: at a corner the outer envelope is the corner BALL, so ρ_out/r is
   * exactly 1. A one-sided `>= 0.98` therefore treats an over-reach as free —
   * it would pass CAL-6's own known-bad miter SPIKE at 1.414 — while failing a
   * reading 0.007 UNDER the ideal. The test is two-sided about the ball, and
   * always was in intent.
   *
   * WHERE 0.06 COMES FROM, and it is not a fitted number. The polygoniser's
   * cell is 0.2 r (`BLEND-4`), so the isosurface's position is quantised to
   * ±0.1 r and no reading here can be trusted finer than that. 0.06 is
   * TIGHTER than the instrument's own quantisation, so it is a real bar, and
   * it rejects both parked known-bads by nearly 7×: CAL-7's rounded-away
   * corner (0.586) and CAL-6's miter spike (1.414) are each 0.414 from the
   * ball. Those two rows are this row's negative controls and they still fire
   * — they are asserted above, on the same predicate.
   *
   * THE FRAMES ARE THE ACTUAL VERDICT, and they were looked at:
   * `docs/verification/corner-split/lane27/{turn,interior}_c1_{high,raking}.png`
   * — same corner, same camera, same material, one build per arm. The shipped
   * arm is one continuous rolled knee; the parked arm has a kink in the
   * silhouette on the approach and a blemish on the leg below it. */
  const BALL_TOL = 0.06
  /* INSTRUMENT REPAIR 2026-08-03 — THE EXCLUSION THAT SURVIVED ITS REASON.
   *   WAS: `(sq?.corners ?? []).slice(1)` in ROUTE-5 and ROUTE-6 — dropping
   *   CORNER 0, which is the SEAM, the exact corner `assert-seam.mjs` exists
   *   for and the one this file's own recalibration note singles out ("with the
   *   seam corner landing on 1.000 exactly"). The gate excluded the corner it
   *   cites as its evidence. `assert-mode-rims.mjs:357-364` already states the
   *   policy in prose — "An exclusion kept past its reason is a widened gate, so
   *   it is gone rather than reworded" — and it is applied here. All four
   *   corners, no slice. */
  const ballOk = (c) => Math.abs(c.outOverR - 1) <= BALL_TOL
  check(
    `ROUTE-5 ALL FOUR drawn corners SURVIVED as the corner BALL — |rho_out/r - 1| <= ${BALL_TOL}, neither rounded away nor spiked`,
    (sq?.corners ?? []).length === 4 && sq.corners.every(ballOk),
    (sq?.corners ?? []).map((c, i) => `${i === 0 ? "seam " : ""}${c.outOverR.toFixed(3)}`).join(" "),
  )
  /* INSTRUMENT REPAIR 2026-08-03 — A CONTROL WITH NO INPUT (class 1).
   *   WAS: `Math.abs(0.586 - 1) > BALL_TOL && Math.abs(1.414 - 1) > BALL_TOL`.
   *   Two literals against a literal — `0.414 > 0.06`, evaluated with no build
   *   input of any kind. Nothing in this repository could make it false except
   *   editing BALL_TOL to 0.414 or more. It asserted arithmetic, not a
   *   detector.
   *
   *   The two known-bads are REAL and already MEASURED in this same run:
   *   `calibrate()` builds them with `syntheticElbow` and CAL-6 / CAL-7 read
   *   them. So the control now applies ROUTE-5's and ROUTE-6's OWN predicates
   *   to those measured geometries. If `analyseCorner` ever stopped separating
   *   a spike or a rounded-off join from the ball, this row fails — which is
   *   the failure mode ROUTE-5 needs covered and the literal version could not
   *   see. */
  const spike = calRows[5]
  const rounded = calRows[6]
  check(
    "ROUTE-5b NEGATIVE CONTROL: ROUTE-5's band, applied to the MEASURED known-bad elbows this run built, rejects both",
    !!spike && !!rounded && !ballOk(spike) && !ballOk(rounded),
    `miter spike rho_out/r ${spike?.outOverR?.toFixed(4)} and rounded-away ${rounded?.outOverR?.toFixed(4)} ` +
      `against the ball at 1 +/- ${BALL_TOL} — measured by \`syntheticElbow\`, not asserted as literals`,
  )
  const joinOk = (c) => c.outerFilletOverR > 0.7 && c.outerFilletOverR < 1.6
  check(
    "ROUTE-6 the outer join is the corner BALL at ALL FOUR corners, not a spike and not a rounded-off blob (0.7 < fillet/r < 1.6)",
    (sq?.corners ?? []).length === 4 && sq.corners.every(joinOk),
    (sq?.corners ?? []).map((c, i) => `${i === 0 ? "seam " : ""}${c.outerFilletOverR?.toFixed(3)}`).join(" "),
  )
  check(
    "ROUTE-6b NEGATIVE CONTROL: ROUTE-6's band, applied to the same two measured known-bads, rejects both",
    !!spike && !!rounded && !joinOk(spike) && !joinOk(rounded),
    `miter spike outer fillet/r ${spike?.outerFilletOverR?.toFixed(4)} (a spike has none) and rounded-away ${rounded?.outerFilletOverR?.toFixed(4)} (2r, the join eating the corner)`,
  )

  check(
    "ROUTE-8 the mesh the routing produces is closed and manifold, with no degenerates",
    sq?.census?.boundaryEdges === 0 && sq?.census?.nonManifoldEdges === 0 && sq?.census?.degenerateTriangles === 0,
    `boundary ${sq?.census?.boundaryEdges}, nonManifold ${sq?.census?.nonManifoldEdges}, degenerate ${sq?.census?.degenerateTriangles}`,
  )

  /* WHAT `blend` ACTUALLY DOES — established empirically, not from its name.
   * §2b of lib/implicit-surface.ts hard-mins a stroke's OWN consecutive
   * capsules. Two legs meeting at a drawn corner are consecutive samples of one
   * stroke, so k cannot reach them. The square carries its own control: corner
   * 0 is the SEAM, where the stroke's end meets its own start, orders far apart
   * — two runs — so k reaches that one and only that one. */
  const b0 = results["implicit-b0.00-r5"]
  const b1 = results["implicit-b1.00-r5"]
  /* THE MISSING `else` (class 7). Without it `--cases=loft,auto` skipped the
   * eight rows below and the run still ended ALL ELBOW ASSERTIONS PASS. A block
   * that cannot run is a block that must FAIL, with the reason printed. */
  if (!b0 || !b1) {
    check(
      "BLEND-0 the two blend endpoints (b=0.00 and b=1.00 at r5) were built — without them the eight BLEND rows below cannot run",
      false,
      `b0 ${b0 ? "built" : "MISSING"}, b1 ${b1 ? "built" : "MISSING"} — the BLEND block is SKIPPED and this run is not a blend verification`,
    )
  }
  if (b0 && b1) {
    const drawn = [1, 2, 3].map((i) => Math.abs(b1.corners[i].inOverSqrt2R - b0.corners[i].inOverSqrt2R))
    const seam = Math.abs(b1.corners[0].inOverSqrt2R - b0.corners[0].inOverSqrt2R)
    check(
      "BLEND-1 blend does NOTHING at a DRAWN corner (one run, hard min): b=0 vs b=1 agree",
      drawn.every((d) => d < 0.01),
      drawn.map((d) => d.toFixed(5)).join(" "),
    )
    check(
      "BLEND-2 blend DOES move the SEAM corner (two runs) — the control that proves the dial is alive",
      seam > 0.03,
      `${seam.toFixed(5)}`,
    )
    /* THE SEAM ARMPIT against the closed form rho = sqrt(2)(r + k/6), i.e.
     * inOverSqrt2R = 1 + k/(6r) — READ AGAINST THE FIELD'S OWN FLOOR, which
     * this build measures rather than assumes.
     *
     * WHY THIS WAS REWRITTEN (2026-07-31). The row was a single `|measured −
     * predicted| < 0.015` at b=0.55 and b=1.00, and on the shipped tree it
     * FAILED at b=0.55: 1.0958 against a predicted 1.0770. The geometry is not
     * what moved — the ASSERTION was calibrated on a build that no longer
     * ships. Measured both ways in plain Node (`_probe-blend-floor.mjs`, and
     * the capped/wrapped pair):
     *
     *     loopEnds   b=0      b=0.55   b=1.00      (corner 0, r5)
     *     capped     1.0464   1.0779   1.1322      <- explainer 19 §6's table
     *     wrapped    1.0748   1.0958   1.1466      <- what ships
     *
     * `capped` reproduces explainer 19 §6 to four decimals, so §6's table and
     * this tolerance were both taken on the PARKED seam. §4b of the same
     * explainer then replaced it: on `wrapped` the seam is a full-width corner
     * instead of a 0.159 r tip, so its armpit is a different — and correct —
     * piece of geometry. The three DRAWN corners are unchanged to four decimals
     * across the same pair, which is the control that says only the seam moved.
     *
     * AND THE OLD TOLERANCE WAS UNDER THE INSTRUMENT'S NOISE FLOOR. BLEND-1
     * proves k cannot reach a drawn corner, so the continuum value of
     * inOverSqrt2R at corners 1-3 is exactly 1 at EVERY blend. They read
     * 1.0732 / 1.0786 / 1.0907. That excess is the marching-cubes floor, in the
     * same units as the thing under test, and it is four to six times the
     * 0.015 that was being demanded of the seam. Sweeping r4-r8 it does not
     * decay monotonically (0.0596 / 0.0748 / 0.0348 / 0.0517 / 0.0397 at k=0) —
     * it is the ambiguous-cell phase, exactly as explainer 19 §7 records for the
     * non-manifold sweep. So the floor is measured per build, not modelled.
     *
     * The rows below are therefore: never BELOW the closed form (an under-acting
     * dial fails), never above it by more than the measured floor (an
     * over-acting dial fails), and — at b=1.00, where the prediction stands
     * clear of the floor — the original tight 0.015. */
    const floor = Math.max(...[1, 2, 3].map((i) => b0.corners[i].inOverSqrt2R - 1))
    const predOf = (row) => 1 + row.blendRadiusK / (6 * row.fieldBaseRadius)
    // ONE predicate, used by the rows AND by the negative control below, so the
    // control cannot drift away from the thing it is calibrating.
    const armpitOk = (measured, predicted, fl) =>
      measured >= predicted - 0.005 && measured - predicted <= fl

    check(
      "BLEND-3a the discretisation FLOOR is real and bounded, measured on corners where k provably does nothing",
      floor > 0.005 && floor < 0.15,
      `floor ${floor.toFixed(4)} from drawn corners ${[1, 2, 3].map((i) => b0.corners[i].inOverSqrt2R.toFixed(4)).join(" ")} (continuum value there is exactly 1)`,
    )
    for (const [nm, row] of [
      ["b=0.00", b0],
      ["b=0.55", results["implicit-b0.55-r5"]],
      ["b=1.00", b1],
    ]) {
      /* WAS `if (!row) continue` — a silent skip that let a partial `--cases=`
       * run drop BLEND-3b/3c for a whole blend value with no trace in the
       * output. A missing row is now its own FAIL. */
      if (!row) {
        check(`BLEND-3b ${nm} the case was BUILT`, false, `case for ${nm} is missing from this run — its armpit rows could not be evaluated`)
        continue
      }
      const predicted = predOf(row)
      const measured = row.corners[0].inOverSqrt2R
      check(
        `BLEND-3b ${nm} the seam armpit is NEVER BELOW the closed form sqrt(2)(r + k/6)`,
        measured >= predicted - 0.005,
        `measured ${measured.toFixed(4)} vs predicted ${predicted.toFixed(4)} (k/r=${(row.blendRadiusK / row.fieldBaseRadius).toFixed(4)})`,
      )
      check(
        `BLEND-3c ${nm} and never above it by more than the measured floor`,
        measured - predicted <= floor,
        `excess ${(measured - predicted).toFixed(4)} vs floor ${floor.toFixed(4)}`,
      )
    }
    {
      // The one row where the prediction stands CLEAR of the floor: 1.1399 at
      // b=1.00 against a k=0 reading of 1.0748, so the reading is the geometry
      // rather than the cell. There the original tight tolerance still holds and
      // is kept unchanged.
      const predicted = predOf(b1)
      const measured = b1.corners[0].inOverSqrt2R
      check(
        "BLEND-3d b=1.00 — where the prediction clears the floor — still matches the closed form to 0.015",
        predicted - b0.corners[0].inOverSqrt2R > floor * 0.5 && Math.abs(measured - predicted) < 0.015,
        `measured ${measured.toFixed(4)} vs predicted ${predicted.toFixed(4)}; prediction clears the k=0 reading ${b0.corners[0].inOverSqrt2R.toFixed(4)} by ${(predicted - b0.corners[0].inOverSqrt2R).toFixed(4)}`,
      )
    }
    /* NEGATIVE CONTROL, on the SAME predicate the rows use. A band read against
     * a measured floor is wider than a fixed 0.015, so it has to be shown to
     * still fail on the three ways this dial can be wrong. The readings are
     * synthesised the way the field actually behaves — `max(true, floor)`,
     * because at k=0 the armpit is a crease by construction and marching cubes
     * still reports the cell (BLEND-4) — so a dial acting at HALF strength does
     * not read half way, it reads the floor. */
    {
      /* INSTRUMENT REPAIR 2026-08-03 — A CONTROL ARM THAT COLLAPSED ONTO
       * ANOTHER ONE.
       *   WAS: `const half = Math.max(1 + (predicted - 1) / 2, k0)`. With the
       *   shipped readings predicted = 1.1399 and k0 = 1.0748, the continuum
       *   half-strength value is 1.0700, which is BELOW k0 — so `Math.max`
       *   returned k0 and `half === dead` EXACTLY. The row then reported
       *   "rejects a dead, a half and a doubled dial" while exercising two
       *   distinct readings. `fired.length === 3` counted the same number
       *   twice. Not wrong in its verdict; wrong in its claim, which is the
       *   thing a control is for.
       *
       *   The floor is real and is not the defect: at 50 % strength the
       *   continuum reading genuinely falls under the marching-cubes floor, so
       *   the floor model returning the dead reading is CORRECT behaviour of
       *   the model. The repair is to take the under-acting arm at a strength
       *   where it clears the floor and is therefore its own reading — and to
       *   assert that the three arms are pairwise DISTINCT, so this can never
       *   silently collapse again. `weakFrac` is derived from the floor rather
       *   than chosen: the weakest arm that still sits above k0. */
      const predicted = predOf(b1)
      const k0 = b0.corners[0].inOverSqrt2R
      const dead = k0
      const contin = (f) => 1 + (predicted - 1) * f
      // The smallest strength whose CONTINUUM reading clears the dead reading
      // by a tenth of the gap, rounded up to a hundredth — so the arm is its own
      // number rather than the floor's.
      let weakFrac = 1
      for (let f = 0.05; f <= 1; f += 0.05) {
        if (contin(f) > k0 + (predicted - k0) * 0.1) { weakFrac = Number(f.toFixed(2)); break }
      }
      const weak = Math.max(contin(weakFrac), k0)
      const doubled = 1 + (predicted - 1) * 2
      const arms = [
        ["dead dial", dead],
        [`under-acting dial at ${(weakFrac * 100).toFixed(0)}%`, weak],
        ["double strength", doubled],
      ]
      const fired = arms.filter(([, m]) => !armpitOk(m, predicted, floor))
      const distinct = new Set(arms.map(([, m]) => m.toFixed(6))).size === arms.length
      check(
        "BLEND-3e NEGATIVE CONTROL: the floor-aware band rejects a dead, an under-acting and a doubled dial — and the three are DISTINCT readings",
        fired.length === 3 && distinct,
        `rejected ${fired.map(([n]) => n).join(", ")} — synthetic readings ${arms.map(([, m]) => m.toFixed(4)).join(" / ")} ` +
          `against predicted ${predicted.toFixed(4)} +floor ${floor.toFixed(4)}; distinct=${distinct}` +
          (distinct ? "" : " — TWO ARMS COINCIDE, so this control exercises fewer readings than it claims"),
      )
      /* PARKED DIAGNOSTIC: the 50 % arm the old row used, and why it is not the
       * one gated on. Printed rather than deleted, because the collapse is a
       * true fact about the instrument's resolution and worth keeping visible. */
      console.log(
        `  ....  parked: a 50% dial reads ${contin(0.5).toFixed(4)} in the continuum, BELOW the k=0 reading ` +
          `${k0.toFixed(4)}, so the floor model returns the dead value and that arm carries no information`,
      )
    }
    // THE TRAP, stated as a number: with k = 0 the armpit is a hard crease BY
    // CONSTRUCTION (the union of two cylinders), and the field STILL reports an
    // apparent fillet — at the marching-cubes CELL size, not at the facet size.
    // This is the reading that would have been mistaken for "implicit fillets
    // the elbow", and it is why the crease census could not settle this.
    const cell = b0.fieldBaseRadius / 5
    const apparent = [1, 2, 3].map((i) => b0.corners[i].innerFilletOverR * b0.fieldBaseRadius)
    /* THE LOWER BOUND WAS 0.4 CELLS, AND IT WAS THE WRONG SIDE TO GATE ON.
     * Recalibrated 2026-08-02 alongside ROUTE-5, same cause, same evidence.
     *
     * This row's whole claim is the UPPER one: at k = 0 the armpit is a hard
     * crease BY CONSTRUCTION (the union of two cylinders), so anything the
     * field reports there must be the RESOLUTION FLOOR and not a shape — under
     * about one cell. A LOWER bound of 0.4 cells asserts the opposite: that the
     * apparent fillet must be at least that big. Nothing wants that. A reading
     * closer to zero is the field agreeing more exactly with the closed form,
     * which is the direction this whole pass moved: with the corner now pinned
     * through the resample the three drawn corners read 0.27 / 0.35 / 0.22
     * cells, against 0.62 / 0.76 / 0.91 recorded in explainer 19 §6.
     *
     * `> 0` is kept so the row still fails if the probe stops resolving the
     * armpit at all — a flat zero would mean the measurement died, not that the
     * crease got sharper. The upper bound, which is the assertion, is unchanged
     * at 1.4 cells. */
    check(
      "BLEND-4 at k=0 the armpit's APPARENT fillet is the marching-cubes CELL, not a shape (under 1.4 cells)",
      apparent.every((a) => a > 0 && a < 1.4 * cell),
      `${apparent.map((a) => (a / cell).toFixed(2)).join(" ")} cells (cell = ${cell.toFixed(5)} = 0.2r)`,
    )
  }

  /* ---- THE CASE THAT WAS BUILT AND NEVER READ ---------------------------
   * INSTRUMENT REPAIR 2026-08-03. `implicit-b0.55-r7` is in the default
   * `--cases` list: it is applied to the page, waited on, dumped, ray-cast,
   * corner-analysed, printed and written to JSON — and until now NO CHECK READ
   * IT. A case that costs a 2.6 s rebuild and answers no question is a case
   * that will be deleted by someone tidying, taking whatever it would have
   * caught with it.
   *
   * Two things only it can say, and neither is a restatement of an r5 row:
   *   RES-1  the RESOLUTION dial reaches the mesh at all. r7 against r5 at the
   *          same blend is one variable.
   *   RES-2  and the corner ball — this file's headline claim, ROUTE-5 — is a
   *          statement about the GEOMETRY, so it must survive at a different
   *          polygonisation. A ball that only reads 1.0 at r5 would be a
   *          reading of the cell, which is exactly the confusion BLEND-4
   *          exists to name. Same predicate, different grid. */
  {
    const r5 = results["implicit-b0.55-r5"]
    const r7 = results["implicit-b0.55-r7"]
    check(
      "RES-1 the RESOLUTION dial reaches the mesh: r7 is a different polygonisation from r5 at the same blend",
      !!r5 && !!r7 && r7.tris !== r5.tris && r7.tris > 0,
      `b0.55 r5 ${r5?.tris} triangles vs r7 ${r7?.tris}` + (!r5 || !r7 ? " — one of the two cases was not built" : ""),
    )
    check(
      `RES-2 and ALL FOUR corners still read as the corner BALL at r7 — |rho_out/r - 1| <= ${BALL_TOL}, the same predicate as ROUTE-5`,
      (r7?.corners ?? []).length === 4 && r7.corners.every(ballOk),
      (r7?.corners ?? []).map((c, i) => `${i === 0 ? "seam " : ""}${c.outOverR.toFixed(3)}`).join(" ") +
        ` (r5 read ${(r5?.corners ?? []).map((c) => c.outOverR.toFixed(3)).join(" ")})`,
    )
  }

  /* ---- THE CONTROL: a drawing the loft CAN represent must stay on it ----- */
  await loadShape(circleShape())
  await page.evaluate(() => window.__styleHarness.setInflate({ fusion: "auto" }))
  await page.waitForTimeout(2600)
  const ctlDbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
  const ctlCensus = mergeCensus(await page.evaluate(() => window.__geomDebug.probeDihedral()))
  results.__control_circle = {
    fusionRequested: ctlDbg?.fusionRequested,
    fusionUsed: ctlDbg?.fusionUsed,
    loftFoldDepth: ctlDbg?.loftFoldDepth,
    loftFoldOverR: ctlDbg?.loftFoldOverR,
    loftFoldingPairs: ctlDbg?.loftFoldingPairs,
    msBuildTotal: ctlDbg?.msBuildTotal,
    census: { wall: ctlCensus?.wall, cap: ctlCensus?.cap, mixed: ctlCensus?.mixed },
  }
  console.log(
    `\n[CONTROL circle] requested=${ctlDbg?.fusionRequested} used=${ctlDbg?.fusionUsed} ` +
      `pairs=${ctlDbg?.loftFoldingPairs} depth/r=${ctlDbg?.loftFoldOverR?.toFixed(4)} ` +
      `build=${ctlDbg?.msBuildTotal?.toFixed(0)}ms  wall max ${ctlCensus?.wall?.max?.toFixed(2)} ` +
      `mixed max ${ctlCensus?.mixed?.max?.toFixed(2)} (>30 ${ctlCensus?.mixed?.over30}/${ctlCensus?.mixed?.n})`,
  )
  check(
    "ROUTE-7 CONTROL a smooth arc does NOT fold and auto LEAVES IT ON THE LOFT",
    ctlDbg?.fusionUsed === "loft" && (ctlDbg?.loftFoldingPairs ?? 1) === 0,
    `${ctlDbg?.fusionUsed}, pairs ${ctlDbg?.loftFoldingPairs}`,
  )

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "elbow.json"), JSON.stringify({ calibration: calRows, cases: results }, null, 2))

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight, because nothing had run this gate since 08-07.
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * `elbow.json` IS this gate's own output, and it is the only artefact this
   * capture leaves on disk — there is no renderer file to compare against
   * instead. So an age check alone would certify the gate's own write, the
   * trap `assert-drawin-pentip.mjs` recorded. That is why the row asks WHEN
   * the write happened relative to this process rather than how old it is.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.json$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
      const detailP = !landed
    ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-elbow.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-elbow.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    check(
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      landed && treeHeld,
      detailP,
    )
  }

  console.log(`\nwrote ${join(OUT, "elbow.json")}`)
  console.log(`console errors: ${consoleErrors.length}`)
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join("\n"))
  await browser.close()

  const failed = PASS.filter((p) => !p.ok)
  if (NIB_ASPECT !== null) {
    console.log(
      `\nDIAGNOSTIC RUN AT nibAspect ${NIB_ASPECT} — NOT A VERDICT ON THE SHIPPED PEN.\n` +
        `${failed.length} row(s) failed of ${PASS.length}. The shipped build is ` +
        `INFLATE_NIB_ASPECT_DEFAULT and this run overrode it, so these rows say what the ` +
        `PREDICATES do at aspect ${NIB_ASPECT} and nothing about what ships. Exiting 2 for that reason.`,
    )
    for (const f of failed) console.log(`  FAIL ${f.name}  [${f.detail}]`)
    process.exit(2)
  }
  console.log(`\n${failed.length === 0 ? "ALL ELBOW ASSERTIONS PASS" : `${failed.length} ELBOW FAILURES`}`)
  for (const f of failed) console.log(`  FAIL ${f.name}  [${f.detail}]`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
