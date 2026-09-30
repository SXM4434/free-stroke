// INFLATE FUSION — CAPTURE PASS
//
// Captures the evidence for the implicit-surface work. Judgement lives in
// assert-inflate-fusion.mjs; this script only observes.
//
// The signature under test is NOT "did pixels change". It is:
//
//   Draw an X. With implicit fusion ON, the crossing must be a SINGLE fused
//   surface with a fillet, and there must be NO interpenetration.
//
// So alongside the frames we take a real cross-section: window.__inflateProbe
// (a component inside the live <Canvas>, so it reads the rendered scene graph,
// not a re-run of the engine) fires a grid of -Z rays through the crossing and
// records every surface each ray passes through.
//
//   one fused solid              -> every ray hits 0 or 2 sheets
//   two interpenetrating tubes   -> rays over the overlap hit 4
//
// Plus the engine's own report (INFLATE_DEBUG): watertightness (boundary and
// non-manifold edge counts from the marching-cubes output), grid size, SDF
// evaluation count, and measured build time.
//
//   node scripts/verify/verify-inflate-fusion.mjs
//   node scripts/verify/assert-inflate-fusion.mjs
//
// STANDING RULE: headed Chrome with the Metal ANGLE backend. Headless silently
// breaks WebGL/rAF in this project — never add { headless: true }.
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
const OUT = join(ROOT, "docs", "verification", "inflate-fusion")

/* ---- Test shapes (canvas pixel space) ---------------------------------- */

/** Two crossing strokes. THE signature case. */
const shapeX = () => {
  const a = []
  const b = []
  for (let i = 0; i <= 60; i++) {
    const t = i / 60
    a.push({ x: 180 + t * 460, y: 160 + t * 460 })
    b.push({ x: 640 - t * 460, y: 160 + t * 460 })
  }
  return [a, b]
}

/** ONE stroke that crosses ITSELF — tests the run-splitting rule. */
const shapeSelfCross = () => {
  const p = []
  for (let i = 0; i <= 140; i++) {
    const t = (i / 140) * Math.PI * 2
    // Lemniscate: a single closed path with exactly one self-crossing.
    const d = 1 + Math.sin(t) * Math.sin(t)
    p.push({ x: 410 + (250 * Math.cos(t)) / d, y: 380 + (250 * Math.sin(t) * Math.cos(t)) / d })
  }
  return [p]
}

/** Dense self-intersecting scribble — the perf case. */
const shapeScribble = () => {
  const p = []
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 6
    p.push({ x: 420 + Math.cos(t) * (60 + t * 18), y: 380 + Math.sin(t * 1.3) * 120 })
  }
  return [p]
}

const SHAPES = { x: shapeX, selfCross: shapeSelfCross, scribble: shapeScribble }

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(join(OUT, "frames"), { recursive: true })

  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) consoleErrors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${String(e).slice(0, 200)}`))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 30000 },
  )
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForFunction(() => !!window.__inflateProbe, null, { timeout: 20000 })

  const report = { cases: {}, perf: {}, consoleErrors: [] }
  let frameNo = 0

  const grab = async (tag) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,(.+)/)
    if (!m) return null
    const name = `${String(frameNo).padStart(4, "0")}_${tag}.png`
    writeFileSync(join(OUT, "frames", name), Buffer.from(m[1], "base64"))
    frameNo++
    return name
  }

  const loadShape = async (name) => {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), SHAPES[name]())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__styleHarness.setMode("inflate"))
    await page.waitForTimeout(500)
  }

  /**
   * Apply a fusion patch and WAIT FOR THE BUILD TO LAND.
   *
   * A fixed sleep is not good enough: the implicit rebuild is synchronous
   * inside the React render and takes anywhere from 25 ms to ~2 s depending on
   * the resolution dial and the stroke count. An earlier version of this script
   * slept 900 ms and silently captured a blank viewport for the two slowest
   * configurations — the frames looked like a bug in the engine when they were
   * a bug in the harness. So: poll the engine's own report until the dials it
   * echoes back match what we asked for AND the scene actually has a mesh.
   */
  const settle = async (patch, timeoutMs = 45000) => {
    const t0 = Date.now()
    for (;;) {
      // Re-poke the reveal playhead to the END on every poll. The draw-in
      // reveal filters the stroke list by playhead time, and a rebuild can land
      // while the playhead is still at 0 — which feeds the engine ZERO strokes,
      // so it early-returns with an empty INFLATE_DEBUG and an empty scene. An
      // earlier version of this loop only checked, never re-poked, and recorded
      // one perf row (scribble @ res 6) as "0 triangles, 0 ms" that looked like
      // the polygoniser had failed when the model simply had not been asked to
      // exist yet. Poking here makes the loop self-healing instead.
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      const ok = await page.evaluate((p) => {
        const d = window.__inflateProbe?.debug?.()
        const s = window.__inflateProbe?.stats?.()
        if (!d || !s) return false
        if (s.meshCount === 0 || s.triangles === 0) return false
        if (d.fusionRequested !== p.fusion) return false
        if (p.blend !== undefined && Math.abs(d.blendFraction - p.blend) > 1e-6) return false
        if (p.resolution !== undefined && Math.abs(d.resolutionDial - p.resolution) > 1e-6)
          return false
        return true
      }, patch)
      if (ok) return true
      if (Date.now() - t0 > timeoutMs) {
        console.warn(`[fusion] WARNING: build did not settle for ${JSON.stringify(patch)}`)
        return false
      }
      await page.waitForTimeout(150)
    }
  }

  const setFusion = async (patch) => {
    await page.evaluate((p) => window.__styleHarness.setInflate(p), patch)
    const settled = await settle(patch)
    // One more beat so the material/environment map finishes its own settle
    // before a frame is grabbed.
    await page.waitForTimeout(250)
    return settled
  }

  /** Orbit sweep — many angles, because a seam hides at some of them. */
  const orbitSweep = async (tag, count, fillK = 0.85) => {
    const names = []
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1)
      const az = -70 + t * 140
      const el = 10 + Math.sin(t * Math.PI) * 45
      await page.evaluate(
        ([a, e, k]) => window.__captureHarness.orbitView(a, e, k),
        [az, el, fillK],
      )
      await page.waitForTimeout(140)
      const n = await grab(`${tag}_az${Math.round(az)}_el${Math.round(el)}`)
      if (n) names.push(n)
    }
    return names
  }

  /**
   * Read the probe, retrying until the reading is non-degenerate.
   *
   * After a heavy rebuild (the ~1-2 s configurations) the viewport is
   * occasionally observed one frame BEFORE the reveal tick has restored the
   * playhead, so the mesh is momentarily empty. That is a transient of the
   * partial-reveal machinery, not the state under test, and measuring it
   * produced phantom "the implicit path made nothing" rows. Re-poking the
   * reveal to 1 and re-reading is the correct thing to measure: the settled
   * model, which is what a user looks at.
   */
  const probe = async (attempts = 8) => {
    for (let i = 0; i < attempts; i++) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(200)
      const stats = await page.evaluate(() => window.__inflateProbe.stats())
      if (stats.meshCount > 0 && stats.triangles > 0) {
        const cross = await page.evaluate(() => window.__inflateProbe.crossSection(0.16, 41))
        const dbg = await page.evaluate(() => window.__inflateProbe.debug())
        return { cross, dbg, stats }
      }
    }
    console.warn("[fusion] WARNING: probe never saw a non-empty model")
    const cross = await page.evaluate(() => window.__inflateProbe.crossSection(0.16, 41))
    const dbg = await page.evaluate(() => window.__inflateProbe.debug())
    const stats = await page.evaluate(() => window.__inflateProbe.stats())
    return { cross, dbg, stats }
  }

  /**
   * The FILLET measurement — an in-plane radial profile through the crossing.
   *
   * See the long note on `__inflateProbe.radialProfile`: the top-down
   * cross-section proves fusion but is structurally blind to the fillet, which
   * lives in the four armpits at z = 0. rho(theta) there has a closed form, so
   * this is the number the assertion checks the cubic smooth-min's k/6
   * displacement against.
   */
  const radial = async (nAngles = 1440) =>
    page.evaluate((n) => window.__inflateProbe.radialProfile(n), nAngles)

  /* ---- 1. THE SIGNATURE CASE: an X, loft vs implicit ------------------- */
  await loadShape("x")

  for (const cfg of [
    { label: "x_loft", patch: { fusion: "loft" } },
    { label: "x_implicit", patch: { fusion: "implicit", blend: 0.55, resolution: 4 } },
  ]) {
    await setFusion(cfg.patch)
    const p = await probe()
    p.radial = await radial()
    // Straight-down view first: this is the view the cross-section describes.
    await page.evaluate(() => window.__captureHarness.frontView(0.75))
    await page.waitForTimeout(200)
    const front = await grab(`${cfg.label}_front`)
    // Grazing angle: interpenetration seams read strongest near-edge-on.
    await page.evaluate(() => window.__captureHarness.orbitView(0, 8, 0.5))
    await page.waitForTimeout(200)
    const graze = await grab(`${cfg.label}_graze_closeup`)
    // Hard zoom onto the junction itself. orbitView targets the bounding-box
    // centre, which for an X is exactly the crossing, so a small fillK frames
    // the junction and nothing else — this is where a fillet or a seam is
    // actually legible rather than a few pixels wide.
    const macro = []
    for (const [az, el] of [
      [0, 0],
      [0, 30],
      [0, 55],
      [45, 25],
      [-45, 25],
      [0, 75],
    ]) {
      await page.evaluate(
        ([a, e]) => window.__captureHarness.orbitView(a, e, 0.16),
        [az, el],
      )
      await page.waitForTimeout(180)
      const n = await grab(`${cfg.label}_macro_az${az}_el${el}`)
      if (n) macro.push(n)
    }
    const frames = await orbitSweep(cfg.label, 22, 0.8)
    report.cases[cfg.label] = { ...cfg.patch, ...p, frames: [front, graze, ...macro, ...frames] }
    console.log(
      `[fusion] ${cfg.label.padEnd(14)} meshes=${p.stats.meshCount} tris=${p.stats.triangles} ` +
        `maxHits=${p.cross?.maxHits} hist=${JSON.stringify(p.cross?.histogram)} ` +
        `bnd=${p.dbg.meshBoundaryEdges} nonmf=${p.dbg.meshNonManifoldEdges} ms=${p.dbg.msBuildTotal?.toFixed(1)}`,
    )
  }

  /* ---- 2. BLEND SWEEP — is the fillet actually the blend radius? ------- */
  //
  // blend = 0 is a HARD union: still one fused surface, but CREASED. This sweep
  // is the control that separates "fused" from "fused WITH A FILLET", and it is
  // checked against a closed form rather than a vibe:
  //
  //   armpit radius       rho = sqrt(2) * (r + k/6)     [the smin's depth]
  //   fillet half-width   |d phi| < k / (2r)            [its compact support]
  //
  // Resolution 6 (not 5) because the whole sweep is a sub-cell measurement:
  // the difference between blend 0 and blend 0.55 is 0.13 r, and at res 5 the
  // cell is 0.20 r. Finer cells buy precision exactly where it is being spent.
  for (const blend of [0, 0.25, 0.55, 1.0, 1.4]) {
    await setFusion({ fusion: "implicit", blend, resolution: 6 })
    const p = await probe()
    p.radial = await radial()
    const tag = `x_blend${String(blend).replace(".", "p")}`
    await page.evaluate(() => window.__captureHarness.orbitView(0, 35, 0.55))
    await page.waitForTimeout(200)
    const closeup = await grab(`${tag}_closeup`)
    // The blend dial is judged at the junction, so macro-frame it there too.
    for (const [az, el] of [
      [0, 0],
      [0, 40],
      [30, 25],
    ]) {
      await page.evaluate(
        ([a, e]) => window.__captureHarness.orbitView(a, e, 0.16),
        [az, el],
      )
      await page.waitForTimeout(180)
      await grab(`${tag}_macro_az${az}_el${el}`)
    }
    const frames = await orbitSweep(tag, 5, 0.7)
    report.cases[`x_blend_${blend}`] = {
      fusion: "implicit",
      blend,
      resolution: 6,
      ...p,
      frames: [closeup, ...frames],
    }
    const rmin = p.radial ? Math.min(...p.radial.radii.filter((v) => Number.isFinite(v))) : NaN
    console.log(
      `[fusion] blend=${String(blend).padEnd(5)} maxHits=${p.cross?.maxHits} ` +
        `armpit=${(rmin / (p.dbg.inflateStrokeRadiusXY || 1)).toFixed(4)}r ` +
        `predicted=${(Math.SQRT2 * ((p.dbg.fieldBaseRadius + p.dbg.blendRadiusK / 6) / (p.dbg.inflateStrokeRadiusXY || 1))).toFixed(4)}r ` +
        `tris=${p.stats.triangles} bnd=${p.dbg.meshBoundaryEdges} ms=${p.dbg.msBuildTotal?.toFixed(1)}`,
    )
  }

  /* ---- 2b. GRID CONVERGENCE — fillet vs crease ------------------------- */
  //
  // The same crossing, measured at five cell sizes, at the hard union (k = 0)
  // and at the default blend. A FILLET is a real feature of the field, so
  // refining the grid must not move it. A CREASE is not representable by
  // marching cubes at all — the polygoniser rounds it off over about one cell —
  // so its measured position wanders with where the grid happens to fall. That
  // contrast is why the assertion gives k = 0 a looser tolerance, and it should
  // be measured rather than asserted from the armchair.
  report.lawConvergence = {}
  for (const resolution of [3, 4, 5, 6, 8]) {
    for (const blend of [0, 0.55]) {
      const settled = await setFusion({ fusion: "implicit", blend, resolution })
      const p = await probe()
      const rad = await radial()
      const unitR = p.dbg.inflateStrokeRadiusXY || 1
      // Opposite-armpit average — the same centre-offset correction the
      // assertion uses; see the note there.
      let a = null
      if (rad) {
        const n = rad.n
        const R = rad.radii
        let i0 = -1
        let best = Infinity
        for (let i = 0; i < n; i++)
          if (Number.isFinite(R[i]) && R[i] < best) {
            best = R[i]
            i0 = i
          }
        const win = Math.round((n * 30) / 360)
        const lm = (c) => {
          let bv = Infinity
          for (let d = -win; d <= win; d++) {
            const i = (((Math.round(c) + d) % n) + n) % n
            if (Number.isFinite(R[i]) && R[i] < bv) bv = R[i]
          }
          return bv
        }
        const q = n / 4
        const v = [i0, i0 + q, i0 + 2 * q, i0 + 3 * q].map(lm)
        a = ((v[0] + v[2]) / 2 + (v[1] + v[3]) / 2) / 2
      }
      report.lawConvergence[`res${resolution}_blend${blend}`] = {
        resolution,
        blend,
        settled,
        armpitOverR: a === null ? NaN : a / unitR,
        predictedOverR:
          (Math.SQRT2 * (p.dbg.fieldBaseRadius + p.dbg.blendRadiusK / 6)) / unitR,
        cellSize: p.dbg.fieldCellSize,
        triangles: p.stats.triangles,
        ms: p.dbg.msBuildTotal,
      }
      console.log(
        `[conv] res=${resolution} blend=${blend}  armpit=${(a === null ? NaN : a / unitR).toFixed(4)}r ` +
          `predicted=${((Math.SQRT2 * (p.dbg.fieldBaseRadius + p.dbg.blendRadiusK / 6)) / unitR).toFixed(4)}r`,
      )
    }
  }

  /* ---- 3. SELF-CROSSING: one stroke crossing itself -------------------- */
  await loadShape("selfCross")
  for (const cfg of [
    { label: "selfCross_loft", patch: { fusion: "loft" } },
    { label: "selfCross_implicit", patch: { fusion: "implicit", blend: 0.55, resolution: 4 } },
  ]) {
    await setFusion(cfg.patch)
    const p = await probe()
    await page.evaluate(() => window.__captureHarness.frontView(0.8))
    await page.waitForTimeout(200)
    const front = await grab(`${cfg.label}_front`)
    const frames = await orbitSweep(cfg.label, 10, 0.8)
    report.cases[cfg.label] = { ...cfg.patch, ...p, frames: [front, ...frames] }
    console.log(
      `[fusion] ${cfg.label.padEnd(20)} meshes=${p.stats.meshCount} maxHits=${p.cross?.maxHits} ` +
        `hist=${JSON.stringify(p.cross?.histogram)} bnd=${p.dbg.meshBoundaryEdges} ms=${p.dbg.msBuildTotal?.toFixed(1)}`,
    )
  }

  /* ---- 4. PERF: resolution sweep on the worst realistic input ---------- */
  for (const shape of ["x", "scribble"]) {
    await loadShape(shape)
    await setFusion({ fusion: "loft" })
    const loft = await probe()
    report.perf[`${shape}_loft`] = {
      ms: loft.dbg.msBuildTotal,
      triangles: loft.stats.triangles,
      meshes: loft.stats.meshCount,
    }
    console.log(`[perf] ${shape}/loft  ms=${loft.dbg.msBuildTotal?.toFixed(1)} tris=${loft.stats.triangles}`)

    for (const resolution of [2, 3, 4, 5, 6, 8]) {
      let settled = await setFusion({ fusion: "implicit", blend: 0.55, resolution })
      let p = await probe()
      // Belt and braces: if a configuration still comes back empty, bounce the
      // dial and take the reading again rather than recording a zero row. A
      // zero row is indistinguishable in the report from "the polygoniser
      // failed", and that ambiguity is what made the previous run's one bad
      // cell unreadable.
      if (!settled || p.stats.triangles === 0) {
        await setFusion({ fusion: "loft" })
        settled = await setFusion({ fusion: "implicit", blend: 0.55, resolution })
        p = await probe()
      }
      report.perf[`${shape}_implicit_res${resolution}`] = {
        settled,
        ms: p.dbg.msBuildTotal,
        msField: p.dbg.msFieldGrid,
        msMarch: p.dbg.msMarchingCubes,
        msNormals: p.dbg.msNormals,
        msImplicit: p.dbg.msImplicitTotal,
        triangles: p.stats.triangles,
        vertices: p.stats.vertices,
        cells: p.dbg.gridCellCount,
        activeCells: p.dbg.fieldActiveCells,
        fieldSamples: p.dbg.fieldSampleCount,
        sdfEvals: p.dbg.fieldSdfEvals,
        meanCandidates: p.dbg.fieldMeanCandidates,
        meanRuns: p.dbg.fieldMeanRuns,
        grid: [p.dbg.fieldGridX, p.dbg.fieldGridY, p.dbg.fieldGridZ],
        boundaryEdges: p.dbg.meshBoundaryEdges,
        nonManifoldEdges: p.dbg.meshNonManifoldEdges,
        coarsened: p.dbg.fieldCoarsened,
        fusionUsed: p.dbg.fusionUsed,
        failureReason: p.dbg.failureReason,
      }
      console.log(
        `[perf] ${shape}/implicit res=${resolution}  ms=${p.dbg.msBuildTotal?.toFixed(1)} ` +
          `(grid ${p.dbg.msFieldGrid?.toFixed(1)} / mc ${p.dbg.msMarchingCubes?.toFixed(1)} / n ${p.dbg.msNormals?.toFixed(1)}) ` +
          `tris=${p.stats.triangles} cells=${p.dbg.gridCellCount} active=${p.dbg.fieldActiveCells} ` +
          `sdf=${p.dbg.fieldSdfEvals} cand=${p.dbg.fieldMeanCandidates?.toFixed(1)} runs=${p.dbg.fieldMeanRuns?.toFixed(2)}`,
      )
    }
    // A couple of frames of the scribble so the perf case is also looked at.
    await setFusion({ fusion: "implicit", blend: 0.55, resolution: 4 })
    await page.evaluate(() => window.__captureHarness.frontView(0.85))
    await page.waitForTimeout(200)
    await grab(`${shape}_implicit_perfview`)
    await setFusion({ fusion: "loft" })
    await page.evaluate(() => window.__captureHarness.frontView(0.85))
    await page.waitForTimeout(200)
    await grab(`${shape}_loft_perfview`)
  }

  report.consoleErrors = consoleErrors
  report.frameCount = frameNo
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`\n[fusion] ${frameNo} frames -> ${join(OUT, "frames")}`)
  console.log(`[fusion] report -> ${join(OUT, "report.json")}  (console errors: ${consoleErrors.length})`)
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
