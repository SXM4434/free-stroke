// DOES A RE-RENDER ALLOCATE GEOMETRY THAT NOBODY DISPOSES?
//
// THE HYPOTHESIS. `components/viewport-3d.tsx:3167-3194` builds the Rod cap and
// joint spheres inside two IIFEs in the RENDER BODY:
//
//     const r = data.capRadius ?? TUBE_RADIUS
//     const capGeo = r === TUBE_RADIUS ? sphereGeometry : new THREE.SphereGeometry(r, ...)
//
// `sphereGeometry` is a module singleton, so the `r === TUBE_RADIUS` arm is free.
// The other arm allocates a fresh THREE.SphereGeometry on EVERY React render of
// <AnimatedStrokes>, hands it to <mesh geometry={...}>, and never disposes the
// one it replaced. R3F does not dispose geometry passed as a PROP (it only
// disposes objects it constructed from JSX), and three's WebGLGeometries frees a
// geometry's GL buffers only from its `dispose` event — so the buffers stay
// allocated for the life of the page.
//
// `capRadius` is not exotic. It is set on EVERY Desk Doodles rod build
// (`lib/dd-engine/adapter.ts:285`, `res.radius * k`) and on Extrude's rod
// fallback (`lib/geometry-engines.ts:2588`). TUBE_RADIUS is 0.012, so the
// equality arm is essentially never taken on those paths.
//
// THE INSTRUMENT. Count `createBuffer` / `deleteBuffer` on the WebGL context,
// patched before the page loads. A leaked geometry shows up as buffers created
// and never deleted. Nothing else in this window allocates geometry: the probe
// only writes a style uniform, and `__geomDebug.buildCount()` is read on both
// sides to prove no geometry was legitimately rebuilt.
//
// THE NEGATIVE CONTROL IS THE POINT. The same N re-renders are driven on the
// FREE STROKE engine in Rod mode, where `capRadius` is undefined and the
// singleton arm is taken. If that arm also grows, the instrument is measuring
// React/R3F churn rather than this defect and the finding is void.
//
// ── MEASURED, BEFORE AND AFTER ─────────────────────────────────────────────
// Same instrument, same fixture, same 40 renders, minutes apart:
//
//                     geomBuilds   bufCreated   bufDeleted   NET LEAKED
//   BEFORE  dd                 0          320            0          320
//   BEFORE  fs (control)       0            0            0            0
//   AFTER   dd                 0            0            0            0
//   AFTER   fs (control)       0            0            0            0
//
// The BEFORE row is what makes the AFTER row worth anything: this instrument has
// been shown to go red on the real defect, so a green from it is a result rather
// than a green row that cannot fail. The fix is `rodSphereGeos` in
// `components/viewport-3d.tsx` — a per-radius memo with a dispose cleanup.
//
// Run: node scripts/verify/_run-clean.mjs scripts/verify/_probe-cap-geo-leak.mjs
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

/* THE FIXTURE IS INLINE, DELIBERATELY. It is `SHAPES.crossing` from
 * `scripts/verify/lib/engine-node.mjs` verbatim — two strokes that cross, so the
 * mark carries caps AND joints. It is copied rather than imported because that
 * module transpiles `lib/*.ts` through `_ts-load.mjs`'s `new Function`, which
 * throws on any `import.meta` in the closure; a sibling lane's worker landing in
 * `lib/implicit-surface.ts` took the whole loader down mid-run. An instrument
 * that cannot run while a sibling edits an unrelated file is an instrument that
 * reports nothing exactly when the tree is moving. */
const crossing = () => {
  const a = [], b = []
  for (let i = 0; i <= 90; i++) {
    const t = i / 90
    a.push({ x: 140 + t * 620, y: 250 + t * 190 })
    b.push({ x: 140 + t * 620, y: 470 - t * 190 })
  }
  return [a, b]
}

const RENDERS = 40

const PATCH = `
  (() => {
    window.__glBuf = { created: 0, deleted: 0 }
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!C) continue
      const cb = C.prototype.createBuffer
      const db = C.prototype.deleteBuffer
      C.prototype.createBuffer = function () { window.__glBuf.created++; return cb.apply(this, arguments) }
      C.prototype.deleteBuffer = function () { window.__glBuf.deleted++; return db.apply(this, arguments) }
    }
  })()
`

const browser = await chromium.launch()

const rows = []

for (const engine of ["desk-doodles", "free-stroke"]) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1500 } })
  await page.addInitScript(PATCH)
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), crossing())
  await page.waitForTimeout(600)
  await page.evaluate((e) => window.__styleHarness.setEngine(e), engine)
  await page.evaluate(() => window.__styleHarness.setMode("rod"))
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(600)

  // Settle: let any first-load allocation finish before the baseline is taken.
  await page.waitForTimeout(800)
  const before = await page.evaluate(() => ({
    ...window.__glBuf,
    build: window.__geomDebug.buildCount(),
    stats: window.__geomDebug.stats(),
  }))

  // N re-renders that CANNOT change geometry: one style uniform, nothing else.
  for (let i = 0; i < RENDERS; i++) {
    await page.evaluate((k) => window.__styleHarness.setStyle({ textureScale: 1 + k * 0.001 }), i)
    await page.waitForTimeout(35)
  }
  await page.waitForTimeout(600)

  const after = await page.evaluate(() => ({
    ...window.__glBuf,
    build: window.__geomDebug.buildCount(),
    stats: window.__geomDebug.stats(),
  }))

  rows.push({
    engine,
    caps: before.stats?.capSpheres ?? 0,
    joints: before.stats?.jointSpheres ?? 0,
    buildDelta: after.build - before.build,
    created: after.created - before.created,
    deleted: after.deleted - before.deleted,
    net: after.created - before.created - (after.deleted - before.deleted),
  })
  await page.close()
}

await browser.close()

console.log(`\nGL BUFFERS over ${RENDERS} style-only re-renders, Rod mode\n`)
console.log("engine        caps joints  geomBuilds  bufCreated  bufDeleted  NET LEAKED  per-render")
for (const r of rows) {
  console.log(
    `${r.engine.padEnd(13)} ${String(r.caps).padStart(4)} ${String(r.joints).padStart(6)}` +
      `  ${String(r.buildDelta).padStart(10)}  ${String(r.created).padStart(10)}` +
      `  ${String(r.deleted).padStart(10)}  ${String(r.net).padStart(10)}  ${(r.net / RENDERS).toFixed(2)}`,
  )
}

const dd = rows.find((r) => r.engine === "desk-doodles")
const fs = rows.find((r) => r.engine === "free-stroke")
console.log("")
console.log(`  ARM      desk-doodles (capRadius set)      net leaked buffers: ${dd.net}`)
console.log(`  CONTROL  free-stroke  (capRadius absent)   net leaked buffers: ${fs.net}`)
/* THE VERDICT NAMES BOTH OUTCOMES, because after the fix this probe's job is to
 * stay green — and a probe whose only printed conclusion is "reproduced" reads
 * as broken the moment it succeeds. The BEFORE numbers in the header are what
 * license the green; see that block. */
if (dd.net > 20 && fs.net <= 4) {
  console.log(`\n  LEAK REPRODUCED — and the control is clean, so the instrument can fail.`)
} else if (dd.net <= 4 && fs.net <= 4) {
  console.log(`\n  CLEAN — neither arm leaks. This same instrument read 320 on the pre-fix file (see header),`)
  console.log(`  so this green is a result and not an instrument that cannot fail.`)
} else {
  console.log(`\n  UNEXPECTED — the CONTROL arm leaked. The instrument is measuring something else; discard.`)
}
console.log(`  geometry builds during the window: dd ${dd.buildDelta}, fs ${fs.buildDelta} (must be 0 — otherwise this is a legitimate rebuild, not a leak)\n`)
