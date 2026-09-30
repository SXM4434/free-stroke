// LANE 28 EXPLORATORY PROBE — the unaudited surface.
//
// Not a gate. This drives the REAL panel and the REAL canvas through the
// hypotheses a code read produced, and prints what it actually observed. A code
// reading is a hypothesis; this is where it either survives or dies.
//
// Every claim it prints names the number it was read from.
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
const consoleErrors = []
p.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleErrors.push(m.text())
})

await p.goto(URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)

const pts = []
for (let i = 0; i <= 110; i++) {
  const t = i / 110
  pts.push({ x: 150 + t * 460, y: 320 + Math.sin(t * Math.PI * 1.9) * 110 })
}
await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
await p.waitForTimeout(1500)

const style = () => p.evaluate(() => window.__styleHarness.get().styleState)
const setStyle = (patch) => p.evaluate((x) => window.__styleHarness.setStyle(x), patch)

/* ------------------------------------------------------------------ */
/* 1 · texturePhase — declared, defaulted, read by the renderer,       */
/*     written by NOTHING. Does any control in the panel reach it?     */
/* ------------------------------------------------------------------ */
log("\n=== 1 · texturePhase reachability ===")
const openPanel = async (label) => {
  const closeBtn = await p.$(`button[title="Close ${label}"]`)
  if (closeBtn) return
  const chip = await p.$(`button[title="Edit ${label}"]`)
  if (chip) {
    await chip.click()
  } else {
    const anyChip = await p.$('button[title^="Edit "]')
    if (anyChip) await anyChip.click()
    await p.waitForTimeout(250)
    await p.click(`nav[aria-label="Style panel sections"] button:has-text("${label}")`)
  }
  await p.waitForTimeout(350)
}

await setStyle({ textureEnabled: true, textureMode: "scanlines", textureAnimated: true, motionMode: "independent" })
await openPanel("Texture")
// Drive EVERY control the Texture panel exposes and watch the field.
const before = (await style()).texturePhase
const controls = await p.$$eval(
  '.fs-panel-enter input, .fs-panel-enter select, .fs-panel-enter button',
  (els) => els.length,
)
log(`  Texture panel exposes ${controls} interactive elements`)
// Exercise every range + select in the open panel.
await p.$$eval('.fs-panel-enter input[type=range]', (els) => {
  for (const el of els) {
    const max = Number(el.max), min = Number(el.min)
    el.value = String(min + (max - min) * 0.77)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }
})
await p.$$eval('.fs-panel-enter select', (els) => {
  for (const el of els) {
    if (el.options.length > 1) {
      el.value = el.options[el.options.length - 1].value
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }
})
await p.waitForTimeout(400)
const after = (await style()).texturePhase
log(`  texturePhase before=${before}  after driving every control=${after}`)
log(`  VERDICT: ${before === after ? "NO CONTROL REACHES IT (dead field)" : "reachable"}`)

// NEGATIVE CONTROL for the instrument: the same sweep DID move other fields.
const st = await style()
log(`  negative control — textureScale=${st.textureScale} textureDelay=${st.textureDelay} (sweep did move state)`)

/* Does the field do anything when it IS written? If not, the honest fix is to
 * delete it, not to expose it. */
const inkAt = async () =>
  p.evaluate(async () => {
    const c = document.querySelector("canvas.h-full.w-full") // 2D canvas
    void c
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(1))))
  })
void inkAt

const shot = async () => (await p.locator("canvas").last().screenshot()).toString("base64")
await setStyle({ motionMode: "off", texturePhase: 0, textureAnimated: false })
await p.waitForTimeout(500)
const a0 = await shot()
await setStyle({ texturePhase: 3.14159 })
await p.waitForTimeout(500)
const a1 = await shot()
log(`  same-frame identity check: phase 0 vs 3.14 identical bytes? ${a0 === a1}`)

/* ------------------------------------------------------------------ */
/* 2 · Fusion "asleep" row — does the fix button name the right layer? */
/* ------------------------------------------------------------------ */
log("\n=== 2 · Fusion asleep row: fix button vs warning ===")
await setStyle({
  textureEnabled: true, textureMode: "grain", textureAnimated: true,
  asciiEnabled: true, asciiAnimated: false, asciiAnimationType: "none",
  motionMode: "independent",
})
await openPanel("Fusion")
await p.click('[data-fusion-new]')
await p.waitForTimeout(400)
// Point the seed link at: source textureField (anim satisfied) -> target asciiFlow (anim OFF)
const linkId = await p.$eval("[data-fusion-link]", (el) => el.getAttribute("data-fusion-link"))
await p.selectOption(`[data-fusion-link-source="${linkId}"]`, "textureField")
await p.waitForTimeout(200)
await p.selectOption(`[data-fusion-link-target="${linkId}"]`, "asciiFlow")
await p.waitForTimeout(400)
const row = await p.$(`[data-fusion-link="${linkId}"]`)
const asleepText = await row.evaluate((el) => el.textContent)
log(`  row text: ${JSON.stringify(asleepText.replace(/\s+/g, " ").trim())}`)
const fixButtons = await row.$$eval("button", (els) => els.map((e) => e.textContent.trim()))
log(`  buttons in row: ${JSON.stringify(fixButtons)}`)

/* ------------------------------------------------------------------ */
/* 3 · Duplicate fix button / duplicate React key                      */
/* ------------------------------------------------------------------ */
log("\n=== 3 · Duplicate fix key (same layer needed at both ends) ===")
await setStyle({ ditherEnabled: false, asciiEnabled: false, textureEnabled: false })
await p.waitForTimeout(300)
await p.selectOption(`[data-fusion-link-source="${linkId}"]`, "ditherField")
await p.waitForTimeout(200)
await p.selectOption(`[data-fusion-link-target="${linkId}"]`, "ditherThreshold")
await p.waitForTimeout(400)
const row2 = await p.$(`[data-fusion-link="${linkId}"]`)
const btns2 = await row2.$$eval("button", (els) => els.map((e) => e.textContent.trim()))
log(`  buttons in row: ${JSON.stringify(btns2)}`)
const dupes = btns2.filter((t) => t === "Turn on Dither").length
log(`  "Turn on Dither" appears ${dupes}×  ${dupes > 1 ? "→ DUPLICATE" : ""}`)
log(`  React key warnings so far: ${consoleErrors.filter((t) => /same key|unique .?key/i.test(t)).length}`)
for (const t of consoleErrors.filter((t) => /key/i.test(t))) log(`    ${t.slice(0, 180)}`)

/* ------------------------------------------------------------------ */
/* 4 · drawing-canvas: pointercancel leaves the canvas stuck           */
/* ------------------------------------------------------------------ */
log("\n=== 4 · pointercancel mid-stroke ===")
const strokeCount = () =>
  p.evaluate(() => window.__styleHarness.undoInfo && document.querySelectorAll("canvas").length)
void strokeCount
const nStrokes = async () =>
  p.evaluate(() => {
    // raw stroke count is visible in the dev debug overlay
    const el = [...document.querySelectorAll("div")].find((d) => /^raw \d+ pts/.test(d.textContent.trim()))
    return el ? Number(el.textContent.trim().match(/^raw (\d+) pts/)[1]) : -1
  })
const box = await p.locator("canvas").first().boundingBox()
const cx = box.x + 120, cy = box.y + 120
const pts0 = await nStrokes()
// A normal stroke first — proves the driver works.
await p.mouse.move(cx, cy)
await p.mouse.down()
for (let i = 1; i <= 12; i++) await p.mouse.move(cx + i * 8, cy + i * 4)
await p.mouse.up()
await p.waitForTimeout(300)
const pts1 = await nStrokes()
log(`  control: normal stroke raw pts ${pts0} -> ${pts1} (driver works: ${pts1 > pts0})`)
// Now interrupt one with pointercancel.
await p.evaluate(() => {
  const c = document.querySelector("canvas")
  const mk = (type, x, y) =>
    new PointerEvent(type, { pointerId: 7, bubbles: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true, pressure: 0.5 })
  const r = c.getBoundingClientRect()
  c.dispatchEvent(mk("pointerdown", r.left + 300, r.top + 300))
  c.dispatchEvent(mk("pointermove", r.left + 320, r.top + 320))
  c.dispatchEvent(mk("pointercancel", r.left + 320, r.top + 320))
})
await p.waitForTimeout(300)
const pts2 = await nStrokes()
// Try to draw again with the mouse.
await p.mouse.move(cx + 40, cy + 200)
await p.mouse.down()
for (let i = 1; i <= 12; i++) await p.mouse.move(cx + 40 + i * 8, cy + 200 + i * 4)
await p.mouse.up()
await p.waitForTimeout(400)
const pts3 = await nStrokes()
log(`  after pointercancel: raw pts ${pts2}; after a FULL new stroke: ${pts3}`)
log(`  VERDICT: ${pts3 === pts2 ? "CANVAS IS STUCK — new strokes are ignored" : "recovered"}`)

/* ------------------------------------------------------------------ */
/* 5 · edge inputs                                                     */
/* ------------------------------------------------------------------ */
log("\n=== 5 · edge inputs ===")
const edge = async (name, polys) => {
  const errsBefore = pageErrors.length
  const r = await p.evaluate(
    (x) => {
      try {
        window.__styleHarness.injectStrokes(x, { msPerPoint: 8 })
        return "ok"
      } catch (e) {
        return "THREW: " + String(e)
      }
    },
    polys,
  )
  await p.waitForTimeout(700)
  const nErr = pageErrors.length - errsBefore
  log(`  ${name.padEnd(26)} ${r}  pageErrors:+${nErr}${nErr ? " " + pageErrors.slice(-nErr)[0].slice(0, 120) : ""}`)
}
await edge("empty", [])
await edge("single point", [[{ x: 200, y: 200 }]])
await edge("two identical points", [[{ x: 200, y: 200 }, { x: 200, y: 200 }]])
await edge("NaN coords", [[{ x: NaN, y: 200 }, { x: 260, y: 240 }, { x: 300, y: 200 }]])
const loop = []
for (let i = 0; i <= 60; i++) {
  const a = (i / 60) * Math.PI * 2
  loop.push({ x: 300 + Math.cos(a) * 90, y: 300 + Math.sin(a) * 90 })
}
await edge("closed loop", [loop])
const big = []
for (let i = 0; i < 5000; i++) {
  const t = i / 5000
  big.push({ x: 120 + t * 500 + Math.sin(t * 90) * 40, y: 300 + Math.cos(t * 70) * 120 })
}
const t0 = Date.now()
await edge("5000-point scribble", [big])
log(`  5000-point scribble wall time ${Date.now() - t0}ms`)

log("\n=== page errors (total) ===")
log(pageErrors.length ? pageErrors.slice(0, 6).join("\n") : "  none")

await b.close()
