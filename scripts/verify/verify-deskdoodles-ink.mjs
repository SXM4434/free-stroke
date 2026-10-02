// DESK DOODLES INK READ — CAPTURE PASS
//
// The acceptance criterion for the Inflate work is not "the X test passes", it
// is Sebs's sentence: the word "Desk Doodles" rendered in Inflate must read as
// ink laid down by a hand, not as extruded pipe. Three named defects:
//
//   1. crossings interpenetrate and leave a seam
//   2. spherical ball joints stamped at stroke ends and bends
//   3. constant radius — no width variation along the stroke
//
// So this captures THE REAL WORD — Sebs's traced handwriting, straight out of
// scripts/capture/logo-strokes.json, the same source /desk-doodles draws — and
// frames the actual junctions close enough to judge those three by eye.
//
// WHY THE MAIN APP AND NOT /desk-doodles: that page drives its own camera every
// frame from the hero-beat state, so an external orbitView call is overwritten
// between the call and the screenshot — captured frames came back framed off
// the top of the stage while the engine was demonstrably building a correct
// 144k-triangle watertight mesh. The main app exposes the same engine, the same
// strokes, and the real Inflate config strip, with a camera that stays where it
// is put. /desk-doodles is verified separately for the wiring; the LOOK is
// judged here, where the frame is trustworthy.
//
//   node scripts/verify/verify-deskdoodles-ink.mjs [--tag=name]
//
// STANDING RULE: headed Chrome with the Metal ANGLE backend. Never headless.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
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
const TAG = arg("tag", "after")
const OUT = join(ROOT, "docs", "verification", "deskdoodles-ink", TAG)

const WORD = JSON.parse(
  readFileSync(join(ROOT, "scripts", "capture", "logo-strokes.json"), "utf8"),
).polylines

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  // deviceScaleFactor 2: the defects under judgement (a seam line, a bead at a
  // bend, a width that never changes) are a few pixels wide at 1x. Judging them
  // from a 1x frame is how you conclude "looks fine" about a visible defect.
  const page = await browser.newPage({
    viewport: { width: 1500, height: 950 },
    deviceScaleFactor: 2,
  })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${String(e).slice(0, 200)}`))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 40000 },
  )
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForFunction(() => !!window.__inflateProbe, null, { timeout: 20000 })

  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), WORD)
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(600)

  const settle = async (patch, timeoutMs = 60000) => {
    const t0 = Date.now()
    for (;;) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      const ok = await page.evaluate((p) => {
        const d = window.__inflateProbe?.debug?.()
        const s = window.__inflateProbe?.stats?.()
        if (!d || !s || s.triangles === 0) return false
        return d.fusionRequested === p.fusion && d.fusionUsed === p.fusion
      }, patch)
      if (ok) return true
      if (Date.now() - t0 > timeoutMs) return false
      await page.waitForTimeout(200)
    }
  }

  const stage = await page.locator("canvas").last()
  const report = { tag: TAG, cases: {}, consoleErrors: [] }
  let n = 0

  for (const cfg of [
    { label: "loft", patch: { fusion: "loft" } },
    { label: "implicit", patch: { fusion: "implicit", blend: 0.45, resolution: 5 } },
  ]) {
    await page.evaluate((p) => window.__styleHarness.setInflate(p), cfg.patch)
    const settled = await settle(cfg.patch)
    await page.waitForTimeout(400)

    const shot = async (name, clip) => {
      const file = join(OUT, `${String(n).padStart(3, "0")}_${cfg.label}_${name}.png`)
      if (clip) await page.screenshot({ path: file, clip })
      else await stage.screenshot({ path: file })
      n++
    }

    // ---- Whole word, several orbits ------------------------------------
    for (const [az, el] of [
      [0, 0],
      [0, 22],
      [-30, 14],
      [30, 14],
      [0, 50],
    ]) {
      await page.evaluate(([a, e]) => window.__captureHarness.orbitView(a, e, 0.9), [az, el])
      await page.waitForTimeout(300)
      await shot(`word_az${az}_el${el}`)
    }

    // ---- Macro crops of the ACTUAL junctions ---------------------------
    // The word is a WIDE, SHORT band in a tall viewport, so a naive grid puts
    // most tiles on empty paper (the first version of this script did exactly
    // that and produced six blank crops that proved nothing). Clip the middle
    // band only, and split it along the reading direction.
    const box = await stage.boundingBox()
    const tiles = []
    const COLS = 4
    for (let c = 0; c < COLS; c++) {
      tiles.push({
        x: box.x + (box.width / COLS) * c,
        y: box.y + box.height * 0.3,
        width: box.width / COLS,
        height: box.height * 0.4,
      })
    }
    for (const [az, el, label] of [
      [0, 6, "graze"],
      [0, 55, "above"],
      [35, 20, "threequarter"],
    ]) {
      await page.evaluate(([a, e]) => window.__captureHarness.orbitView(a, e, 0.5), [az, el])
      await page.waitForTimeout(300)
      for (let i = 0; i < tiles.length; i++) await shot(`macro_${label}_t${i}`, tiles[i])
    }

    const dbg = await page.evaluate(() => window.__inflateProbe.debug())
    const stats = await page.evaluate(() => window.__inflateProbe.stats())
    report.cases[cfg.label] = {
      settled,
      meshCount: stats.meshCount,
      triangles: stats.triangles,
      vertices: stats.vertices,
      msBuildTotal: dbg.msBuildTotal,
      msImplicit: dbg.msImplicitTotal,
      boundaryEdges: dbg.meshBoundaryEdges,
      nonManifoldEdges: dbg.meshNonManifoldEdges,
      primitives: dbg.fieldPrimitiveCount,
      cells: dbg.gridCellCount,
      activeCells: dbg.fieldActiveCells,
      fusionUsed: dbg.fusionUsed,
      radiusXY: dbg.inflateStrokeRadiusXY,
    }
    console.log(
      `[dd-ink] ${cfg.label.padEnd(9)} meshes=${stats.meshCount} tris=${stats.triangles} ` +
        `ms=${dbg.msBuildTotal?.toFixed(1)} bnd=${dbg.meshBoundaryEdges} nonmf=${dbg.meshNonManifoldEdges}`,
    )
  }

  report.consoleErrors = errors
  report.frames = n
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(`[dd-ink] ${n} frames -> ${OUT}  (console errors: ${errors.length})`)
  if (errors.length) console.log(errors.slice(0, 5).join("\n"))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
