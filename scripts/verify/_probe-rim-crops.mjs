// THE RIM, AT 6-10x, AT THE PLACES THE CENSUS POINTS AT.
//
// Every number in this lane says the same thing and none of them is the verdict.
// `assert-mode-rims` reports a MAX and a COUNT; a max cannot tell a drawn corner
// from a tear, and this repo has already paid for reading one as the other
// twice (explainer 13; explainer 17 §1, where Inflate's rim was diagnosed from a
// bare max and the diagnosis was wrong). So: put the camera on each named
// feature and look.
//
// A/B IN ONE RUN, THROUGH THE REAL APP. `SOLID_TUNING` is a module object with
// no window binding, so the parked-prior arm is selected by rewriting the
// defaults in `lib/solid-mask.ts` and letting the dev server's fast refresh
// rebuild — the same file the app imports, the same entry path, the same
// camera. The file is restored before the process exits, including on throw.
// Nothing else in the repo is touched, and no other lane is live.
//
// Real Chrome, --use-angle=metal (docs/DISPATCH.md §3: without it Chrome falls
// back to SwiftShader, which silently pauses the rAF loop, and a frozen frame is
// indistinguishable from a still one). The window is 3000x1600 so the 3-D
// canvas — half the window, in this split layout — clears 1440.
//
// Run: node scripts/verify/_probe-rim-crops.mjs --label=rims
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { SHAPES, CW as CW_H, CH as CH_H, SCALE as SCALE_H } from "./lib/engine-node.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "rims")
const PORT = process.env.FS_PORT ?? "3000"
const OUT = join(ROOT, "docs", "verification", "gloss-rim", LABEL)
const SOLID_MASK = join(ROOT, "lib", "solid-mask.ts")

const SHIPPED = `{
  capFit: "inset",
  bevelFrac: "offset",
  probeBlind: "raster",
  flipRepair: "exact",
  rimProfile: "scaled",
}`
const PRIOR = `{
  capFit: "inset",
  bevelFrac: "offset",
  probeBlind: "onecell",
  flipRepair: "halve",
  rimProfile: "flat",
}`

/* THE FEATURES, AS CANVAS COORDINATES — mapped to world INSIDE the page.
 *
 * `px2w` in `lib/engine-node.mjs` bakes the 1300x850 harness viewport into its
 * constants, and the engine's canvas->world transform is `3 / max(w, h)` about
 * the canvas centre — so the SAME polyline lands at DIFFERENT world coordinates
 * in a different window. This has to be shot at 3000x1600, because the app is a
 * split layout and the 3-D canvas is half the window (HANDOFF §4 records a gate
 * that passed on a third-scale subject for its entire life). Measured on the
 * first run: `bounds().center` came back [-0.599, 0.804] where the 1300x850
 * arithmetic predicts [0.430, 0.153], and every crop taken on the stale mapping
 * was aimed at empty space and came back white — which reads exactly like a
 * clean rim. So the mapping is READ FROM THE PAGE and the targets travel with
 * it. */
const arcPts = SHAPES.openArc()[0]
const CANVAS_FEATURES = {
  squareCorners: [[250, 180], [640, 180], [640, 545], [250, 545]],
  arcEnds: [
    [arcPts[0].x, arcPts[0].y],
    [arcPts[arcPts.length - 1].x, arcPts[arcPts.length - 1].y],
  ],
  /* Two points inside the stretch of `openArc`'s INNER boundary where 22 of 497
   * contour vertices were starved to an eighth of the bevel — the tear the
   * census called 84.73. Measured in the harness's own world frame as
   * [0.101, 0.816] and [-0.254, 0.433]; converted back to canvas here so they
   * move with the viewport like every other target. */
  arcStarved: [
    [0.101 / SCALE_H + CW_H / 2, CH_H / 2 - 0.816 / SCALE_H],
    [-0.254 / SCALE_H + CW_H / 2, CH_H / 2 - 0.433 / SCALE_H],
  ],
}

/* WHAT TO SHOOT. `dist` is an absolute camera distance in world units against a
 * measured bounding radius of 0.800, so 0.30 puts about a fifth of the form
 * across the frame and 0.45 about a third — the 6-10x the brief asks for,
 * calibrated by shooting a ladder at 2.0 / 1.2 / 0.8 / 0.5 / 0.35 / 0.25 and
 * looking rather than by arithmetic. Two elevations per feature: a crease that
 * hides under one specular direction shows under another, which is the whole
 * reason these are shot on gloss. */
function buildCases(toWorld) {
  const sq = CANVAS_FEATURES.squareCorners.map(toWorld)
  const arc = CANVAS_FEATURES.arcEnds.map(toWorld)
  const starved = CANVAS_FEATURES.arcStarved.map(toWorld)
  return [
    ...sq.map((c, i) => ({ shape: "square", mode: "solid", name: `sq_solid_c${i}`, at: c, dist: 0.3 })),
    ...sq.map((c, i) => ({ shape: "square", mode: "rod", name: `sq_rod_c${i}`, at: c, dist: 0.16 })),
    ...arc.map((c, i) => ({ shape: "openArc", mode: "solid", name: `arc_solid_e${i}`, at: c, dist: 0.3 })),
    ...starved.map((c, i) => ({ shape: "openArc", mode: "solid", name: `arc_solid_starved${i}`, at: c, dist: 0.45 })),
  ]
}
const VIEWS = [
  { tag: "high", az: 34, el: 46 },
  { tag: "raking", az: 22, el: 12 },
]

async function shoot(page, arm, CASES) {
  const dir = join(OUT, arm)
  mkdirSync(dir, { recursive: true })
  let lastShape = null
  let lastMode = null
  for (const c of CASES) {
    if (c.shape !== lastShape) {
      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(200)
      await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 6 }), SHAPES[c.shape]())
      await page.waitForTimeout(800)
      lastShape = c.shape
      lastMode = null
    }
    if (c.mode !== lastMode) {
      await page.evaluate((m) => window.__styleHarness.setMode(m), c.mode)
      await page.waitForTimeout(1600)
      // Material AFTER mode — setMode stamps MODE_MATERIAL_DEFAULTS otherwise,
      // and Solid's default is matteClay, the register that hides this defect.
      await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
      await page.waitForTimeout(300)
      const got = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
      if (got !== "glossyPlastic") throw new Error(`material did not take: ${got}`)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(400)
      lastMode = c.mode
    }
    for (const v of VIEWS) {
      await page.evaluate(
        ({ at, dist, az, el }) => window.__captureHarness.focusView({ x: at.x, y: at.y, z: 0 }, dist, az, el),
        { at: c.at, dist: c.dist, az: v.az, el: v.el },
      )
      await page.waitForTimeout(220)
      const url = await page.evaluate(() => window.__captureHarness.grab())
      if (!url || !url.startsWith("data:image/png;base64,")) throw new Error(`grab failed for ${c.name}`)
      const buf = Buffer.from(url.split(",")[1], "base64")
      writeFileSync(join(dir, `${c.name}_${v.tag}.png`), buf)
    }
    console.log(`[crop] ${arm}/${c.name}`)
  }
}

async function main() {
  const original = readFileSync(SOLID_MASK, "utf8")
  if (!original.includes(SHIPPED)) throw new Error("solid-mask.ts default block not found — refusing to patch blind")
  const browser = await chromium.launch()
  try {
    /* THE CANVAS IS HALF THE WINDOW — the app is a split layout, so a 1600-wide
     * window yields an 800-wide 3-D canvas and every "1600px capture" is a
     * third-scale subject. HANDOFF §4 records a gate that passed on one for its
     * entire life. 3000 wide gives a 1500x1552 canvas. */
    const page = await browser.newPage({ viewport: { width: 3000, height: 1600 } })
    await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
    const renderer = await page.evaluate(() => {
      const c = document.createElement("canvas")
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      const d = gl && gl.getExtension("WEBGL_debug_renderer_info")
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?"
    })
    console.log(`[crop] renderer: ${renderer}`)
    if (/SwiftShader|llvmpipe/i.test(renderer)) throw new Error("SwiftShader — the rAF loop is paused and every frame is a lie")

    /* THE MAPPING, READ FROM THE PAGE — see CANVAS_FEATURES. The canvas width is
     * asserted and the targets are asserted finite, because a NaN target renders
     * a blank frame and a blank frame reads as a clean rim. */
    const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
    const sc = 3 / Math.max(dims.w, dims.h)
    const toWorld = ([px, py]) => ({ x: (px - dims.w / 2) * sc, y: -(py - dims.h / 2) * sc })
    const CASES = buildCases(toWorld)
    console.log(`[crop] canvas ${dims.w}x${dims.h}  scale ${sc.toFixed(6)}`)
    if (dims.w < 1440) throw new Error(`canvas ${dims.w}px wide — captures must be >=1440 (HANDOFF §4)`)
    for (const c of CASES) if (!Number.isFinite(c.at.x) || !Number.isFinite(c.at.y)) throw new Error(`NaN target for ${c.name}`)

    await shoot(page, "after", CASES)

    writeFileSync(SOLID_MASK, original.replace(SHIPPED, PRIOR))
    console.log("[crop] patched to the parked priors; waiting for fast refresh")
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
    await page.waitForTimeout(2000)
    await shoot(page, "before", CASES)
  } finally {
    writeFileSync(SOLID_MASK, original)
    await browser.close()
    console.log(`[crop] restored lib/solid-mask.ts; frames in ${OUT}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
