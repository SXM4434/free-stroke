// A CLOSED MARK HAS NO ENDS — and the way it says so must not kill the render.
//
// THE DEFECT (found 2026-07-31 while capturing the closed-loop seam frames).
// When Rod learned that a mark returning to its own start is a loop
// (`loopEnds: "wrapped"`), the emitter said "no caps" by returning
// `capPositions: []`. Every consumer guards with `strokeMeshData.capPositions &&`
// and then reads `[1]` — and an EMPTY ARRAY IS TRUTHY, so `[1]` is `undefined`
// and `Vector3.copy(undefined)` throws inside `AnimatedStrokes.useFrame`.
//
// This exact bug had already been found and fixed once, in the PORTED engine:
// `lib/dd-engine/adapter.ts:278` converts Desk Doodles' `[]` to `undefined` and
// its comment says why — "an empty array here silently kills the whole render
// loop." The native engine got the closed-loop change without the conversion.
//
// MEASURED BEFORE THE FIX, on the shipped default, one page load each, nothing
// touched (`scripts/verify/_probe-rod-default.mjs`):
//
//     circle/rod     479 uncaught exceptions   canvas FROZEN
//     square/rod     481 uncaught exceptions   canvas FROZEN
//     circle/inflate 108 uncaught exceptions   canvas live
//     square/inflate 109 uncaught exceptions   canvas live
//     openArc/rod      0                       canvas live
//     openArc/inflate  0                       canvas live
//
// "FROZEN" is the part that matters and it is why no existing gate caught this:
// two DIFFERENT camera positions rendered byte-identical frames. A frozen canvas
// and a still one are the same picture, so every frame captured of a closed Rod
// mark between the closed-loop fix and this one was a stale image — and the
// blank-frame guard the capture scripts carried was reading the 2-D DRAWING
// canvas, so it reported the same ink count on all of them (see lib/frame-ink.mjs).
//
// Run: node scripts/verify/assert-rod-caps.mjs
import { chromium } from "./lib/browser.mjs"
import { build, SHAPES } from "./lib/engine-node.mjs"
import { frameInk } from "./lib/frame-ink.mjs"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

let failures = 0
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  if (!ok) failures++
}

/* THE PREDICATE, and it is the whole point: not "is it missing" but "is it a
 * TRUTHY value the consumer will index into and find nothing at". */
const capsAreSafe = (caps) => caps === undefined || caps === null || caps.length >= 2

console.log("\nCALIBRATION — the predicate, against the shape that actually shipped\n")
check("CAL-1 FIRES on `capPositions: []` (truthy, indexable, empty — what shipped)", !capsAreSafe([]), "[] is truthy and [1] is undefined")
check("CAL-2 FIRES on a one-element array", !capsAreSafe([{ x: 0 }]), "[1] is undefined")
check("CAL-3 SILENT on `undefined` (the fix)", capsAreSafe(undefined), "the consumer's `caps &&` short-circuits")
check("CAL-4 SILENT on a real pair", capsAreSafe([{ x: 0 }, { x: 1 }]), "both ends present")

/* ---- Node: what the engine EMITS, on closed and open marks ---------------- */
console.log("\nTHE EMITTER — real engines in plain Node\n")
const engines = loadTs("lib/geometry-engines.ts")
const CLOSED = ["circle", "square"]
const OPEN = ["openArc", "tick"]
for (const shape of [...CLOSED, ...OPEN]) {
  const log = console.log
  console.log = () => {}
  const strokes = engines.RodEngine.buildPreview(
    build("rod", SHAPES[shape]()).strokes,
    { canvasWidth: 650, canvasHeight: 802, inflateParams: engines.DEFAULT_INFLATE_PARAMS, extrudeParams: engines.DEFAULT_EXTRUDE_PARAMS, solidParams: engines.DEFAULT_SOLID_PARAMS },
  )
  console.log = log
  const caps = strokes.map((m) => m.capPositions)
  const closed = CLOSED.includes(shape)
  check(
    `${shape}/rod / capPositions is never a truthy-but-short array`,
    caps.every(capsAreSafe),
    caps.map((c) => (c === undefined ? "undefined" : `len ${c.length}`)).join(", "),
  )
  check(
    closed ? `${shape} is CLOSED -> no caps at all` : `${shape} is OPEN -> both caps present`,
    closed ? caps.every((c) => c === undefined) : caps.every((c) => c && c.length === 2),
    caps.map((c) => (c === undefined ? "undefined" : `len ${c.length}`)).join(", "),
  )
}

/* ---- Browser: the render loop survives, and the canvas is not frozen ------- */
console.log("\nTHE RENDER LOOP — real Chrome, one fresh page per case\n")
const browser = await chromium.launch()
for (const [shape, mode, wasThrowing] of [
  ["circle", "rod", 479],
  ["square", "rod", 481],
  ["circle", "inflate", 108],
  ["square", "inflate", 109],
  ["openArc", "rod", 0],
  ["openArc", "inflate", 0],
]) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } })
  let uncaught = 0
  let first = null
  page.on("pageerror", (e) => {
    uncaught++
    if (!first) first = (e.stack || String(e)).split("\n").slice(0, 2).join(" | ").slice(0, 180)
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), SHAPES[shape]())
  await page.waitForTimeout(900)
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1800)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(700)
  const shot = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    return (await frameInk(Buffer.from(url.match(/base64,(.+)/)[1], "base64"))).ink
  }
  await page.evaluate(() => window.__captureHarness.orbitView(0, 26, 0.9))
  await page.waitForTimeout(300)
  const a = await shot()
  // THE FROZEN-CANVAS TEST'S OWN CONTROL: two grabs at the SAME camera must
  // agree, or "the frames differ" would be measuring noise rather than motion.
  const aAgain = await shot()
  await page.evaluate(() => window.__captureHarness.orbitView(90, 40, 0.9))
  await page.waitForTimeout(300)
  const b = await shot()
  const key = `${shape}/${mode}`
  check(
    `${key} / the render loop does not throw (was ${wasThrowing})`,
    uncaught === 0,
    `${uncaught} uncaught${first ? ` — ${first}` : ""}`,
  )
  check(
    `${key} / the canvas is not frozen (a camera move changes the frame)`,
    a !== b && a === aAgain,
    `ink az0 ${a}, az0 again ${aAgain} (must match — that is this test's control), az90 ${b}`,
  )
  await page.close()
}
await browser.close()

console.log(failures === 0 ? "\nALL ROD-CAP ASSERTIONS PASS" : `\n${failures} ROD-CAP FAILURES`)
process.exit(failures === 0 ? 0 : 1)
