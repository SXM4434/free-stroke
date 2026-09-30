// PRD FAMILY 1 — do the geometry presets do what their NAMES say?
//
// WHY THIS GATE EXISTS BEFORE THE BUTTON DOES
//
//   A geometry preset names a MODE and that mode's dials, and all of those are
//   useState in app/page.tsx — a file this lane does not own. So the family
//   ships as data plus a pure resolver, and the four lines that apply it are
//   routed separately. That is a good reason for the pills not to exist yet; it
//   is NOT a reason for the numbers to be unverified. Every patch below is
//   driven through the SAME setters app/page.tsx's own controls call
//   (`__styleHarness.setMode / setExtrude / setSolidParams / setInflate`), so
//   what is measured here is exactly what a user will get the moment the
//   routing lands.
//
// WHAT "THE NAME SAYS" IS MEASURED AS
//
//   Two framings per preset: dead front, and almost edge-on (78 deg azimuth).
//   Front-on coverage is how much MARK there is; the ratio of raking coverage
//   to front coverage is how much DEPTH there is, because a shallow form nearly
//   vanishes edge-on and a deep one presents a wall. So "Deep Ribbon" has to
//   out-rake "Ribbon Strip" and "Thick Slab" has to out-rake "Paper Cut" — a
//   claim about the label, not merely about the pixels being different.
//
// THE CONTROL IS THE SAME PRESET TWICE. Applied twice with a full rebuild in
// between it must come back at distance ~0. A distinctness matrix that has
// never seen a zero cannot tell "these two are different" from "this instrument
// reports a number".
//
// Usage: node scripts/verify/assert-geometry-presets.mjs
//        node scripts/verify/assert-geometry-presets.mjs --save
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const has = (k) => process.argv.includes(`--${k}`)
const SAVE = has("save")
const OUT = join(ROOT, "docs", "verification", "geometry-presets")

const S = loadTs("lib/style-system.ts")
const G = loadTs("lib/geometry-engines.ts")
const { PRESET_REGISTRY, applyGeometryPreset } = S

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, buf }
}
/** Fraction of the frame the form covers. */
function coverage(a) {
  let n = 0
  for (let i = 3; i < a.d.length; i += 4) if (a.d[i] >= 20) n++
  return n / (a.d.length / 4)
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    sum += (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}

function testStroke() {
  const pts = []
  for (let i = 0; i <= 110; i++) {
    const t = i / 110
    pts.push({ x: 150 + t * 560, y: 340 + Math.sin(t * Math.PI * 1.9) * 120 })
  }
  return [pts]
}

/* The starting settings, taken from the ENGINE's own exported defaults rather
 * than typed here — the numbers must be the app's, not a copy that can rot. */
const BASE = {
  mode: "rod",
  extrudeWidthSlider: G.extrudeWidthToSlider(G.DEFAULT_EXTRUDE_PARAMS.width),
  extrudeDepth: G.DEFAULT_EXTRUDE_PARAMS.depth,
  extrudeBevelEnabled: G.DEFAULT_EXTRUDE_PARAMS.bevelEnabled,
  extrudeSideWall: G.DEFAULT_EXTRUDE_PARAMS.sideWall,
  solidThickness: G.DEFAULT_SOLID_PARAMS.thickness,
  solidDepth: G.DEFAULT_SOLID_PARAMS.depth,
  inflateFusion: G.DEFAULT_INFLATE_PARAMS.fusion,
  inflateBlend: G.DEFAULT_INFLATE_PARAMS.blend,
  inflateResolution: G.DEFAULT_INFLATE_PARAMS.resolution,
  inflateLoopEnds: G.DEFAULT_INFLATE_PARAMS.loopEnds,
}

async function main() {
  if (SAVE) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: "no-preference" })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)))
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
    null,
    { timeout: 30000 },
  )
  await page.evaluate((p) => {
    window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
    window.__captureHarness.enable()
  }, testStroke())
  await page.waitForTimeout(1600)
  await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
  await page.waitForTimeout(400)

  const wait = (ms) => page.waitForTimeout(ms)
  const shot = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    const f = await decode(u)
    if (SAVE && name) writeFileSync(join(OUT, `${name}.png`), f.buf)
    return f
  }

  /* Apply a resolved settings object through the app's OWN setters — the same
   * ones every control in the config strips calls. `mapExtrudeWidthSlider` is
   * the engine's, imported, never re-typed: the slider is a normalised t and
   * only that function knows the curve. */
  const applySettings = async (g) => {
    await page.evaluate((x) => {
      window.__styleHarness.setMode(x.mode)
      window.__styleHarness.setExtrude({
        width: x.width,
        depth: x.extrudeDepth,
        bevelEnabled: x.extrudeBevelEnabled,
        sideWall: x.extrudeSideWall,
      })
      window.__styleHarness.setSolidParams({ thickness: x.solidThickness, depth: x.solidDepth })
      window.__styleHarness.setInflate({
        fusion: x.inflateFusion,
        blend: x.inflateBlend,
        resolution: x.inflateResolution,
        loopEnds: x.inflateLoopEnds,
      })
    }, { ...g, width: G.mapExtrudeWidthSlider(g.extrudeWidthSlider) })
    await wait(g.mode === "inflate" ? 2200 : 1300)
    await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
    await wait(350)
  }

  const defs = PRESET_REGISTRY.geometry
  const R = {}
  const buildsStart = await page.evaluate(() => window.__geomDebug.buildCount())

  console.log("\n=== every geometry preset, driven through the app's own setters ===")
  console.log("preset               mode      front cov   raking cov   depth ratio")
  for (const p of defs) {
    const g = applyGeometryPreset(BASE, p.id)
    await applySettings(g)
    const live = await page.evaluate(() => window.__styleHarness.get().geometryMode)
    await page.evaluate(() => window.__captureHarness.frontView(1))
    await wait(300)
    const front = await shot(SAVE ? `front_${p.id}` : null)
    await page.evaluate(() => window.__captureHarness.orbitView(78, 8, 1))
    await wait(300)
    const rake = await shot(SAVE ? `rake_${p.id}` : null)
    const cf = coverage(front)
    const cr = coverage(rake)
    R[p.id] = { mode: g.mode, live, front, rake, cf, cr, ratio: cf > 0 ? cr / cf : 0 }
    console.log(
      `${p.id.padEnd(20)} ${live.padEnd(9)} ${(cf * 100).toFixed(3).padStart(9)}% ${(cr * 100).toFixed(3).padStart(11)}% ${R[p.id].ratio.toFixed(3).padStart(13)}`,
    )
  }
  const buildsEnd = await page.evaluate(() => window.__geomDebug.buildCount())

  console.log("")
  say(
    defs.every((p) => R[p.id].live === R[p.id].mode),
    "every geometry preset actually SWITCHED the app into the mode it names",
    defs.map((p) => `${p.id}→${R[p.id].live}`).filter((s, i) => i < 3).join(", ") + ", …",
  )
  say(
    buildsEnd > buildsStart,
    "a geometry preset DOES rebuild geometry — the opposite of a style preset, and the right answer",
    `buildCount ${buildsStart} → ${buildsEnd} across ${defs.length} presets`,
  )
  say(
    defs.every((p) => R[p.id].cf > 0.0005),
    "every preset renders a form (nothing came back blank)",
    defs.map((p) => (R[p.id].cf * 100).toFixed(2)).join(" "),
  )

  /* THE CONTROL. Re-apply one preset from scratch, with a different preset
   * built in between so the rebuild is real, and require ~0 distance. */
  await applySettings(applyGeometryPreset(BASE, "thickSlab"))
  await applySettings(applyGeometryPreset(BASE, "deepRibbon"))
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await wait(300)
  const repeat = await shot(SAVE ? "front_deepRibbon_repeat" : null)
  const dRepeat = diff(R.deepRibbon.front, repeat)
  say(dRepeat < 1.0, "CONTROL · the same preset, rebuilt from scratch, returns the same render", `Δpx ${dRepeat.toFixed(3)}`)

  /* PAIRWISE DISTINCTNESS, front-on, against a floor set by that control. */
  const floor = Math.max(1.0, dRepeat * 5)
  const collapsed = []
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i].id
      const b = defs[j].id
      const d = diff(R[a].front, R[b].front)
      const dr = diff(R[a].rake, R[b].rake)
      if (d < floor && dr < floor) collapsed.push(`${a}=${b} (front ${d.toFixed(2)}, rake ${dr.toFixed(2)})`)
    }
  }
  say(
    collapsed.length === 0,
    "no two geometry presets render the same form",
    collapsed.join(" | ") || `${(defs.length * (defs.length - 1)) / 2} pairs, floor ${floor.toFixed(2)} from the control`,
  )

  /* NAMES MATCH BEHAVIOUR — the claims each label makes, one row each.
   *
   * INSTRUMENT REPAIR 2026-08-03 — A HARDCODED SUBSET OF A GROWING REGISTRY.
   *   WAS: eleven preset ids typed straight into the rows below, against a
   *   registry that holds TWELVE (`PRESET_REGISTRY.geometry`). `solidCutout`
   *   had no name assertion at all — it was applied, rendered, measured, put in
   *   the distinctness matrix, and then no row ever asked whether "Solid
   *   Cutout" describes what came back. Removal was loud only by accident
   *   (`R.x.ratio` would throw); ADDITION was completely silent, which is the
   *   direction a preset family actually moves.
   *
   *   Repaired by routing every claim through `nameClaim`, which records the
   *   ids it speaks for. The coverage row after the block compares that set
   *   against the registry in BOTH directions, so a thirteenth preset fails
   *   this gate on the day it lands, and a deleted one fails as a row instead
   *   of a stack trace. `solidCutout` gets its own claim, from its own dials. */
  console.log("\n=== does each name describe what rendered? ===")
  const claimed = new Set()
  /** One name-claim row. `ids` are the presets it speaks for; a referenced id
   *  that is no longer in the registry is a FAIL with its own row rather than a
   *  crash, and never a silent skip. */
  const nameClaim = (ids, label, fn) => {
    ids.forEach((i) => claimed.add(i))
    const absent = ids.filter((i) => !R[i])
    if (absent.length) return say(false, label, `references preset(s) absent from the registry: ${absent.join(", ")}`)
    const { ok, detail } = fn()
    say(ok, label, detail)
  }

  nameClaim(["deepRibbon", "ribbonStrip"], "'Deep Ribbon' presents more edge-on than 'Ribbon Strip' — it is deeper", () => ({
    ok: R.deepRibbon.ratio > R.ribbonStrip.ratio * 1.25,
    detail: `ratio ${R.deepRibbon.ratio.toFixed(3)} vs ${R.ribbonStrip.ratio.toFixed(3)}`,
  }))
  nameClaim(["hairlineRibbon", "pressedRibbon"], "'Hairline Ribbon' covers far less front-on than 'Pressed Ribbon' — it is thinner", () => ({
    ok: R.hairlineRibbon.cf < R.pressedRibbon.cf * 0.7,
    detail: `front ${(R.hairlineRibbon.cf * 100).toFixed(3)}% vs ${(R.pressedRibbon.cf * 100).toFixed(3)}%`,
  }))
  nameClaim(["thickSlab", "paperCut"], "'Thick Slab' is both heavier and deeper than 'Paper Cut'", () => ({
    ok: R.thickSlab.ratio > R.paperCut.ratio * 1.5 && R.thickSlab.cf > R.paperCut.cf,
    detail: `ratio ${R.thickSlab.ratio.toFixed(3)} vs ${R.paperCut.ratio.toFixed(3)} · front ${(R.thickSlab.cf * 100).toFixed(3)}% vs ${(R.paperCut.cf * 100).toFixed(3)}%`,
  }))
  /* THE PRESET THAT HAD NO ROW. Its dials sit BETWEEN the other two solids —
   * thickness 34 against paperCut's 20 and thickSlab's 60, plate depth 0.12
   * against 0.04 and 0.42 — so "filled silhouette … on a SHALLOW plate" is a
   * two-sided claim and is asserted as one. A one-sided "heavier than paperCut"
   * would be satisfied by a preset that had quietly become another thickSlab. */
  nameClaim(["solidCutout", "paperCut", "thickSlab"], "'Solid Cutout' is a fuller silhouette than 'Paper Cut' but not as heavy as 'Thick Slab'", () => ({
    ok: R.solidCutout.cf > R.paperCut.cf && R.solidCutout.cf < R.thickSlab.cf,
    detail: `front ${(R.paperCut.cf * 100).toFixed(3)}% < ${(R.solidCutout.cf * 100).toFixed(3)}% < ${(R.thickSlab.cf * 100).toFixed(3)}%`,
  }))
  nameClaim(["solidCutout", "paperCut", "thickSlab"], "'Solid Cutout' sits on a SHALLOW plate — deeper than 'Paper Cut', far shallower than 'Thick Slab'", () => ({
    ok: R.solidCutout.ratio > R.paperCut.ratio && R.solidCutout.ratio < R.thickSlab.ratio,
    detail: `depth ratio ${R.paperCut.ratio.toFixed(3)} < ${R.solidCutout.ratio.toFixed(3)} < ${R.thickSlab.ratio.toFixed(3)}`,
  }))
  nameClaim(["pillowInflate", "softBalloonStroke"], "'Pillow' is fuller than 'Soft Balloon Stroke'", () => ({
    ok: R.pillowInflate.cf > R.softBalloonStroke.cf,
    detail: `front ${(R.pillowInflate.cf * 100).toFixed(3)}% vs ${(R.softBalloonStroke.cf * 100).toFixed(3)}%`,
  }))
  nameClaim(["loftBalloon", "softBalloonStroke"], "'Loft Balloon' and 'Soft Balloon Stroke' are different SURFACES, not one at two sizes", () => ({
    ok: diff(R.loftBalloon.front, R.softBalloonStroke.front) > floor,
    detail: `Δpx ${diff(R.loftBalloon.front, R.softBalloonStroke.front).toFixed(2)} (loft strategy vs implicit field)`,
  }))
  nameClaim(["dieCutEdge", "ribbonStrip"], "'Die-Cut Edge' (bevel off) reads differently at the edge from a bevelled ribbon", () => ({
    ok: diff(R.dieCutEdge.rake, R.ribbonStrip.rake) > floor,
    detail: `Δpx raking ${diff(R.dieCutEdge.rake, R.ribbonStrip.rake).toFixed(2)}`,
  }))
  nameClaim(["pressedRibbon", "dieCutEdge"], "'Pressed Ribbon' (drafted walls) differs from straight walls where the walls show", () => ({
    ok: diff(R.pressedRibbon.rake, R.dieCutEdge.rake) > floor,
    detail: `Δpx raking ${diff(R.pressedRibbon.rake, R.dieCutEdge.rake).toFixed(2)}`,
  }))
  /* cleanRod's name claim is the REFUSED-MEMBER demonstration further down; it
   * is registered here so the coverage row below counts it. */
  claimed.add("cleanRod")

  /* THE COVERAGE ROW. Derived from the registry, in both directions.
   *
   * THE ARM, so this row is proven and not merely stated:
   *   GEOM_PRESETS_ARM=prior-claims node scripts/verify/assert-geometry-presets.mjs
   * replays the ELEVEN-id claim set this file shipped with — the known-bad
   * input, because it is literally the pre-repair state — and the row must go
   * RED naming `solidCutout`. */
  if ((process.env.GEOM_PRESETS_ARM ?? "") === "prior-claims") {
    claimed.delete("solidCutout")
    console.log("[arm] GEOM_PRESETS_ARM=prior-claims — the pre-repair 11-id claim set")
  }
  const registryIds = defs.map((p) => p.id)
  const unclaimed = registryIds.filter((i) => !claimed.has(i))
  const stale = [...claimed].filter((i) => !registryIds.includes(i))
  say(
    unclaimed.length === 0 && stale.length === 0,
    `every one of the ${registryIds.length} presets in PRESET_REGISTRY.geometry has a NAME claim, and no claim names a preset that is gone`,
    unclaimed.length || stale.length
      ? `${unclaimed.length ? `no name claim for: ${unclaimed.join(", ")}. ` : ""}${stale.length ? `claims reference absent: ${stale.join(", ")}.` : ""}`
      : `${claimed.size} claimed / ${registryIds.length} in the registry`,
  )

  /* THE REFUSED MEMBER, demonstrated rather than asserted in prose. Rod has no
   * dials, so two rod presets could only ever be the same render — which is
   * why "Bold Rod" is not in the registry. Shown by driving Rod twice with the
   * only two knobs a rod preset could conceivably carry already at their
   * defaults, and measuring 0. */
  await applySettings(applyGeometryPreset(BASE, "cleanRod"))
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await wait(300)
  const rod1 = await shot(SAVE ? "front_cleanRod_a" : null)
  await applySettings({ ...applyGeometryPreset(BASE, "cleanRod"), solidThickness: 64, extrudeDepth: 4, extrudeWidthSlider: 1 })
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await wait(300)
  const rod2 = await shot(SAVE ? "front_cleanRod_b" : null)
  say(
    diff(rod1, rod2) < 1.0,
    "'Bold Rod' is REFUSED, demonstrated: every other mode's dial at maximum changes a Rod render by nothing",
    `Δpx ${diff(rod1, rod2).toFixed(3)} — Rod's radius is the constant TUBE_RADIUS (lib/geometry-engines.ts:211)`,
  )

  say(errors.length === 0, "no console or page errors across the whole run", errors.length ? errors[0] : "0")

  await browser.close()
  console.log(
    fails === 0 ? `\nALL ${checks} GEOMETRY-PRESET ASSERTIONS PASS` : `\n${fails} of ${checks} GEOMETRY-PRESET ASSERTIONS FAILED`,
  )
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
