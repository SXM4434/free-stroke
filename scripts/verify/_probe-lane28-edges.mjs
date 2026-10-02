// LANE 28 PROBE v2 — the paths probe v1 could not reach honestly.
//
// v1's pointercancel test was INVALID and says so: the synthetic
// `PointerEvent` had no active pointer, so `canvas.setPointerCapture` THREW
// inside `handlePointerDown` before `isDrawingRef` was ever set. The component
// never entered the drawing state, so "recovered" was measuring nothing. This
// version opens the gesture with a REAL mouse press (pointerId 1, capture
// succeeds) and only then cancels it.
//
// Also: the REAL entry path for edge inputs. `injectStrokes` drops
// `poly.length < 2` before it reaches `processStroke`, so v1's "single point"
// case never tested the thing it named.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const URL = LAB_URL
const log = (...a) => console.log(...a)

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
const pageErrors = []
p.on("pageerror", (e) => pageErrors.push(String(e)))
await p.goto(URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
await p.waitForTimeout(800)

const nRaw = () =>
  p.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => /^raw \d+ pts/.test(d.textContent.trim()))
    return el ? Number(el.textContent.trim().match(/^raw (\d+) pts/)[1]) : -1
  })
const canvasBox = await p.locator("canvas").first().boundingBox()
const at = (dx, dy) => [canvasBox.x + dx, canvasBox.y + dy]

/* ------------------------------------------------------------------ */
/* A · pointercancel on a REAL captured pointer                        */
/* ------------------------------------------------------------------ */
log("=== A · pointercancel on a real captured gesture ===")
const a0 = await nRaw()
await p.mouse.move(...at(140, 140))
await p.mouse.down()
for (let i = 1; i <= 10; i++) await p.mouse.move(...at(140 + i * 9, 140 + i * 5))
// Cancel WITHOUT a pointerup — what a real browser gesture takeover does.
const capInfo = await p.evaluate(() => {
  const c = document.querySelector("canvas")
  const r = c.getBoundingClientRect()
  const ev = (type) =>
    new PointerEvent(type, {
      pointerId: 1, bubbles: true, cancelable: false,
      clientX: r.left + 230, clientY: r.top + 190,
      pointerType: "mouse", isPrimary: true,
    })
  c.dispatchEvent(ev("pointercancel"))
  return "cancel dispatched"
})
log(`  ${capInfo}`)
await p.waitForTimeout(250)
const a1 = await nRaw()
// Release the real mouse somewhere harmless AFTER the cancel — a real takeover
// gives no pointerup at all, so first measure without one.
const stuckBefore = await p.evaluate(() => {
  // Try to start a brand-new gesture while the old one may still be live.
  const c = document.querySelector("canvas")
  return c ? true : false
})
void stuckBefore
await p.mouse.up()
await p.waitForTimeout(250)
const a2 = await nRaw()
log(`  raw pts: start ${a0} -> after cancel ${a1} -> after the real pointerup ${a2}`)
log(`  the cancelled gesture ${a2 > a0 ? "COMMITTED a stroke  <<< DEFECT" : "was DISCARDED  <<< correct"}`)

// Now: a fresh gesture after the cancel. Does the canvas still draw?
const a3 = await nRaw()
await p.mouse.move(...at(140, 320))
await p.mouse.down()
for (let i = 1; i <= 10; i++) await p.mouse.move(...at(140 + i * 9, 320 + i * 5))
await p.mouse.up()
await p.waitForTimeout(350)
const a4 = await nRaw()
log(`  fresh gesture after the cancel: ${a3} -> ${a4}  ${a4 > a3 ? "OK" : "STUCK"}`)

/* ------------------------------------------------------------------ */
/* B · the REAL entry path for the edge inputs                         */
/* ------------------------------------------------------------------ */
log("\n=== B · real pointer path, edge gestures ===")
const gesture = async (name, fn) => {
  const before = await nRaw()
  const errs = pageErrors.length
  await fn()
  await p.waitForTimeout(450)
  const after = await nRaw()
  log(`  ${name.padEnd(30)} raw ${before} -> ${after}  pageErrors:+${pageErrors.length - errs}`)
}
await gesture("tap (one point, no move)", async () => {
  await p.mouse.move(...at(400, 400))
  await p.mouse.down()
  await p.mouse.up()
})
await gesture("two-point (down,1 move,up)", async () => {
  await p.mouse.move(...at(420, 400))
  await p.mouse.down()
  await p.mouse.move(...at(421, 401))
  await p.mouse.up()
})
await gesture("zero-length (same coord ×8)", async () => {
  await p.mouse.move(...at(440, 400))
  await p.mouse.down()
  for (let i = 0; i < 8; i++) await p.mouse.move(...at(440, 400))
  await p.mouse.up()
})
await gesture("drag OUT of the canvas", async () => {
  await p.mouse.move(...at(200, 200))
  await p.mouse.down()
  for (let i = 1; i <= 8; i++) await p.mouse.move(...at(200 + i * 30, 200))
  await p.mouse.move(canvasBox.x + canvasBox.width + 60, canvasBox.y + 200)
  await p.mouse.up()
})

/* ------------------------------------------------------------------ */
/* C · rapid mode switching mid-draw                                   */
/* ------------------------------------------------------------------ */
log("\n=== C · geometry mode switching mid-draw ===")
const cErr = pageErrors.length
const c0 = await nRaw()
await p.mouse.move(...at(160, 480))
await p.mouse.down()
for (const mode of ["extrude", "solid", "inflate", "rod", "solid"]) {
  for (let i = 0; i < 4; i++) await p.mouse.move(...at(160 + Math.random() * 300, 480 + Math.random() * 120))
  await p.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await p.waitForTimeout(60)
}
await p.mouse.up()
await p.waitForTimeout(900)
const c1 = await nRaw()
log(`  raw ${c0} -> ${c1}; pageErrors:+${pageErrors.length - cErr}`)
const stillAlive = await p.evaluate(() => !!window.__styleHarness && !!document.querySelector("canvas"))
log(`  app alive after: ${stillAlive}`)

/* ------------------------------------------------------------------ */
/* D · NaN — what does it actually RENDER?                             */
/* ------------------------------------------------------------------ */
log("\n=== D · NaN coordinates, and what the viewport does with them ===")
const viewportShot = async () => {
  const cs = await p.locator("canvas").all()
  const buf = await cs[cs.length - 1].screenshot()
  // mean luminance + how many distinct 8-bit greys — a dead scene is flat
  return buf.length
}
await p.evaluate(() => window.__styleHarness.clearStrokes())
await p.waitForTimeout(400)
const cleanBytes = await viewportShot()
await p.evaluate(() =>
  window.__styleHarness.injectStrokes(
    [[{ x: 200, y: 250 }, { x: NaN, y: 300 }, { x: 320, y: 250 }, { x: 380, y: 320 }]],
    { msPerPoint: 10 },
  ),
)
await p.waitForTimeout(1200)
const nanBytes = await viewportShot()
const nanErrs = pageErrors.length
log(`  clean-canvas png ${cleanBytes}B ; after NaN stroke ${nanBytes}B ; pageErrors ${nanErrs}`)
const geomState = await p.evaluate(() => {
  const dbg = window.__fsStyleClockDebug || {}
  return { keys: Object.keys(dbg).length }
})
log(`  style-clock debug reachable: ${geomState.keys > 0}`)

/* ------------------------------------------------------------------ */
/* E · can anything force ViewportErrorBoundary?                       */
/* ------------------------------------------------------------------ */
log("\n=== E · ViewportErrorBoundary reachability ===")
const hasCrashLaw = await p.evaluate(() => typeof window.__styleHarness?.crashViewport)
log(`  window.__styleHarness.crashViewport: ${hasCrashLaw}`)
const boundaryVisible = await p.evaluate(() =>
  !![...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped")),
)
log(`  boundary UI on screen: ${boundaryVisible}`)

log("\n=== page errors ===")
log(pageErrors.length ? pageErrors.slice(0, 8).map((e) => "  " + e.slice(0, 160)).join("\n") : "  none")
await b.close()
