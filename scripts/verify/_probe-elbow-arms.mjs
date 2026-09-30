// PROBE — attribute `assert-elbow`'s moved numbers to a cause, on the real page.
//
// WHY THIS EXISTS. The corner-predicate fix changes the processed polyline of
// any mark that has a corner, and `assert-elbow` measures the `square` fixture,
// which has four. Three of its rows moved. "It was probably my change" is not a
// measurement, and re-recording a pin on that basis is exactly how a real
// regression gets buried under a plausible story.
//
// So this drives the SAME page, injects the SAME square, and reads the SAME
// per-corner metrics through `analyseCorner` — once with the shipped predicate
// and once with the parked inverted one, selected at runtime through
// `window.__strokeTuning.corner.predicate`. Nothing else differs between the two
// passes: same browser, same session, same material, same fusion mode.
//
// It reports numbers and does not judge. `assert-elbow` is the gate; this is the
// instrument that says WHICH ARM a number belongs to.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./_ts-load.mjs"
import { sliceZ, analyseCorner, creaseCensusNode, rayCensus } from "./lib/elbow-geom.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)
const px2w = (px, py) => ({ x: (px - CW / 2) * SCALE, y: -(py - CH / 2) * SCALE })

/* The square fixture, identical to assert-elbow's and engine-node's. */
const SQUARE_PX = [
  [250, 180],
  [640, 180],
  [640, 545],
  [250, 545],
]
function squarePoly() {
  const p = []
  const c = [...SQUARE_PX, SQUARE_PX[0]]
  for (let k = 0; k < c.length - 1; k++) {
    const [x0, y0] = c[k]
    const [x1, y1] = c[k + 1]
    for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
  }
  p.push({ x: SQUARE_PX[0][0], y: SQUARE_PX[0][1] })
  return [p]
}

const cw = SQUARE_PX.map(([px, py]) => px2w(px, py))
const centre = { x: cw.reduce((s, p) => s + p.x, 0) / 4, y: cw.reduce((s, p) => s + p.y, 0) / 4 }
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

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: VIEW })
const consoleErrors = []
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200))
})
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

const hasTuning = await page.evaluate(() => !!window.__strokeTuning?.corner)
if (!hasTuning) {
  console.log("FAIL  window.__strokeTuning is not published — the arms cannot be selected")
  await browser.close()
  process.exit(1)
}

const results = {}
for (const arm of ["turn", "interior"]) {
  await page.evaluate((a) => {
    window.__strokeTuning.corner.predicate = a
  }, arm)
  await page.evaluate(() => window.__styleHarness.clearStrokes())
  await page.waitForTimeout(200)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), squarePoly())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__styleHarness.setMode("inflate"))
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.__styleHarness.setMaterial("glossyPlastic"))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(400)

  let d = null
  for (let t = 0; t < 30 && !d; t++) {
    const x = await page.evaluate(() => window.__geomDebug.dumpMeshes())
    if (x && x.meshes > 0 && x.idx.length > 0) d = x
    else await page.waitForTimeout(300)
  }
  /* Same source assert-elbow uses (`assert-elbow.mjs:317`, `:331`): the
   * inflate probe's own `fieldBaseRadius`, not an invented nominal. */
  const dbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
  const pos = Float64Array.from(d.pos)
  const idx = Int32Array.from(d.idx)
  const segs = sliceZ(pos, idx, 0)
  const rNom = dbg?.fieldBaseRadius || 0.05
  const corners = CORNERS.map((f, i) => ({
    corner: i,
    ...analyseCorner(segs, f.c, f.bis, f.legs, rNom),
    fold: rayCensus(pos, idx, f.c.x, f.c.y, rNom * 1.6, 81),
  }))
  const census = creaseCensusNode(pos, idx)
  results[arm] = { corners, census, tris: idx.length / 3, fusionUsed: dbg?.fusionUsed, rNom }
  console.log(
    `\n[${arm}] fusionUsed=${dbg?.fusionUsed} tris=${idx.length / 3} rNom=${rNom?.toFixed(5)}` +
      `  wall max ${census?.wall?.max?.toFixed(2)}  mixed max ${census?.mixed?.max?.toFixed(2)}`,
  )
  console.log("   corner   rho_out/r   outFillet/r   rho_in/(sqrt2 r)   folds>2")
  for (const p of corners) {
    console.log(
      `     ${p.corner}       ${p.outOverR.toFixed(4)}      ${p.outerFilletOverR?.toFixed(4)}` +
        `          ${p.inOverSqrt2R.toFixed(4)}           ${p.fold.over2}`,
    )
  }
}

console.log("\n=== the delta, per corner (SHIPPED 'turn' minus PARKED 'interior') ===")
console.log("   corner   rho_out/r  shipped   prior     delta")
for (let i = 0; i < 4; i++) {
  const a = results.turn.corners[i]
  const b = results.interior.corners[i]
  const d = a.outOverR - b.outOverR
  console.log(
    `     ${i}                  ${a.outOverR.toFixed(4)}   ${b.outOverR.toFixed(4)}   ` +
      `${d >= 0 ? "+" : ""}${d.toFixed(4)}${Math.abs(d) > 0.02 ? "   <- moved" : ""}`,
  )
}

// Leave the page on what ships.
await page.evaluate(() => {
  window.__strokeTuning.corner.predicate = "turn"
})
console.log(`\nconsole errors: ${consoleErrors.length}`)
const dir = join(ROOT, "docs", "verification", "elbow", "arms")
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, "arms.json"), JSON.stringify(results, null, 2))
console.log(`wrote ${join(dir, "arms.json")}`)
await browser.close()
