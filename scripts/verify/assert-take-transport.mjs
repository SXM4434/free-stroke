// assert-take-transport.mjs · DOES THE PAGE'S TRANSPORT STORE HOLD THE FRAME LOOP'S OWN NUMBERS?
//
//   FS_PORT=3138 node scripts/verify/assert-take-transport.mjs
//
// Layout rethink phase L2 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md`
// §2 "Lift", §5 row L2). The transport state moved out of
// `components/viewport-3d.tsx` into `lib/take-transport.ts`, a page-level store,
// so phase L3 can render the transport, the strip and the key lanes in panels
// outside the viewport. Those panels read the store. This gate asks whether
// what they would read IS what the frame loop draws, frame by frame, and
// whether the viewport obeys what they would write.
//
// THE ORDER INSIDE ONE FRAME, measured on the first run of this gate: the
// strokes draw first (AnimatedStrokes writes what it drew to `TAKE_LIVE`) and
// `PlaybackController` advances the playhead after them. So the playhead a
// frame draws is the one the frame before left in the store, and a sampler
// that runs once per frame, between the loop's frames, sees
// `drawn[k] === store[k - 1]`. That order is the app's, the same on the
// snapshot this branch starts from; this gate holds the store to it exactly.
//
// Rows:
//   P0  paused: the store's playhead equals the drawn playhead exactly.
//   P1  every moving frame of a 3 s play: the playhead the frame loop drew
//       (`__fsTake.get().live.playhead`) equals the store's playhead one
//       sample earlier. Exact equality, no tolerance.
//   P2  the play moved: at least 60 frames sampled, at least 60 of them with
//       a new drawn playhead, and a span of at least 0.1. Without it P1 is
//       vacuous.
//   M1  must-fail, a reader one frame later than the store (what a `useState`
//       copy in a panel is at best): the same comparison against the store's
//       value two samples earlier must go red on at least one moving frame.
//   M2  must-fail, the throttled readout (`progress`, about 15 per second):
//       the same comparison must go red on at least one moving frame.
//   S1  Play pressed in the viewport sets the store's `playing`; the store's
//       `playing` set false pauses the viewport (its button reads "Play").
//   S2  the store's `speed` set to 2 presses the viewport's 2x button, and the
//       button 1x pressed in the viewport writes 1 to the store.
//   D1  the store's derived `totalDuration` equals the viewport's own
//       (`__fsTake.get().totalDuration`), and a pace is published.
//   G1  no page error over the run.
//
// Writes nothing to disk.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } })
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(9000)
  await page.waitForFunction(() => !!window.__revealHarness && !!window.__fsTransport && !!window.__fsTake, null, {
    timeout: 60000,
  })

  // Five strokes, the same hand `assert-take-timeline` draws.
  const box = await page.locator("canvas[aria-label*='Drawing canvas']").boundingBox()
  const drawStroke = async (x0, y0, steps, dx, dy) => {
    await page.mouse.move(box.x + x0, box.y + y0)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(box.x + x0 + i * dx, box.y + y0 + i * dy + Math.sin(i / 3) * 18)
      await page.waitForTimeout(8)
    }
    await page.mouse.up()
    await page.waitForTimeout(150)
  }
  await drawStroke(90, 150, 18, 15, 1)
  await drawStroke(90, 300, 10, 16, 2)
  await drawStroke(120, 250, 14, 4, 12)
  await drawStroke(70, 300, 14, 12, 0)
  await drawStroke(110, 470, 22, 13, -1)
  await page.waitForTimeout(1500)

  const dock = page.locator("[data-animation-transport]")
  const playBtn = dock.getByRole("button", { name: "Play", exact: true })
  const pauseBtn = dock.getByRole("button", { name: "Pause", exact: true })

  // From the top, so the 3 s has somewhere to go.
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.waitForTimeout(300)
  const still = await page.evaluate(() => ({ store: window.__fsTransport.playhead(), drawn: window.__fsTake.get().live.playhead }))
  row(still.store === still.drawn, "P0   paused, the store's playhead is the drawn one", `store ${still.store}, drawn ${still.drawn}`)

  /* §P · the playhead. Sampling starts before the click and runs 3 s in the
   * page's own rAF, so every sample is one frame. */
  const samplesP = page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = []
        const t0 = performance.now()
        const tick = () => {
          out.push({
            store: window.__fsTransport.playhead(),
            drawn: window.__fsTake.get().live.playhead,
            progress: window.__fsTransport.progress(),
          })
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick)
          else resolve(out)
        }
        requestAnimationFrame(tick)
      }),
  )
  await page.waitForTimeout(50)
  await playBtn.click()
  const playingAfterClick = await page.evaluate(() => window.__fsTransport.get("playing"))
  const s = await samplesP

  // Moving frames: the drawn playhead changed since the last sample. Index 0
  // and 1 have no earlier samples to compare against.
  const moving = s.map((f, i) => ({ ...f, i })).filter((f) => f.i >= 2 && f.drawn !== s[f.i - 1].drawn)
  const off = moving.filter((f) => s[f.i - 1].store !== f.drawn)
  const span = Math.max(...s.map((f) => f.drawn)) - Math.min(...s.map((f) => f.drawn))
  row(
    moving.length > 0 && off.length === 0,
    "P1   every moving frame drew the playhead the store held",
    `${moving.length - off.length} of ${moving.length} moving frames equal` +
      (off.length ? `; first off at sample ${off[0].i}: store before ${s[off[0].i - 1].store}, drawn ${off[0].drawn}` : ""),
  )
  row(
    s.length >= 60 && moving.length >= 60 && span >= 0.1,
    "P2   the play moved, so P1 measured something",
    `${s.length} frames, ${moving.length} with a new drawn playhead, span ${span.toFixed(3)}`,
  )
  const lateOff = moving.filter((f) => s[f.i - 2].store !== f.drawn).length
  row(lateOff > 0, "M1   must-fail: a reader one frame later than the store goes red", `${lateOff} of ${moving.length} moving frames off`)
  const progOff = moving.filter((f) => s[f.i - 1].progress !== f.drawn).length
  row(progOff > 0, "M2   must-fail: the throttled readout goes red", `${progOff} of ${moving.length} moving frames off`)

  /* §S · the slots, both directions. From the top again (CL-GATES-1): on this tree the take ends inside
   * §P's 3 s, and at progress 1 the store's playing=true is dropped within 200 ms (store false, progress 1),
   * so without the rewind S1 measured the end of the take, not the slot. */
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.waitForTimeout(300)
  const playingBack = await page.evaluate(() => {
    window.__fsTransport.set("playing", true)
    return window.__fsTransport.get("playing")
  })
  await page.waitForTimeout(200)
  const pauseShown = await pauseBtn.count()
  // What the store and the button hold at that moment, so a red S1 says which side let go (CL-GATES-1).
  const atS1 = await page.evaluate(() => ({ playing: window.__fsTransport.get("playing"), progress: window.__fsTransport.progress(), buttons: [...document.querySelectorAll("[data-animation-transport]")].map((t) => [...t.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).slice(0, 3).join("/")) }))
  await page.evaluate(() => window.__fsTransport.set("playing", false))
  await page.waitForTimeout(200)
  const playShown = await playBtn.count()
  const h0 = await page.evaluate(() => window.__fsTransport.playhead())
  await page.waitForTimeout(300)
  const h1 = await page.evaluate(() => window.__fsTransport.playhead())
  row(
    playingAfterClick === true && playingBack === true && pauseShown === 1 && playShown === 1 && h0 === h1,
    "S1   Play in the viewport sets the store; the store pauses the viewport",
    `after click ${playingAfterClick}, store set true shows Pause ${pauseShown} (store then playing ${atS1.playing}, progress ${atS1.progress}, ${atS1.buttons.length} transports: ${atS1.buttons.join(" | ")}), set false shows Play ${playShown}, playhead held ${h0 === h1}`,
  )

  await page.evaluate(() => window.__fsTransport.set("speed", 2))
  await page.waitForTimeout(200)
  const twoPressed = await dock.getByRole("button", { name: "2x", exact: true }).getAttribute("aria-pressed")
  await dock.getByRole("button", { name: "1x", exact: true }).click()
  await page.waitForTimeout(100)
  const speedBack = await page.evaluate(() => window.__fsTransport.get("speed"))
  row(
    twoPressed === "true" && speedBack === 1,
    "S2   the store's speed presses 2x; 1x pressed writes the store",
    `2x aria-pressed ${twoPressed}, store after 1x click ${speedBack}`,
  )

  /* §D · derived. */
  const d = await page.evaluate(() => {
    const der = window.__fsTransport.derived()
    return {
      der: der ? { totalDuration: der.totalDuration, revealMode: der.revealMode, revealEase: der.revealEase } : null,
      viewTotal: window.__fsTake.get().totalDuration,
    }
  })
  row(
    d.der !== null && d.der.totalDuration === d.viewTotal && typeof d.der.revealMode === "string",
    "D1   the store's derived length is the viewport's",
    d.der ? `store ${d.der.totalDuration} ms, viewport ${d.viewTotal} ms, mode ${d.der.revealMode}, ease ${d.der.revealEase}` : "nothing published",
  )

  row(pageErrors.length === 0, "G1   the page threw nothing", `${pageErrors.length} pageerror events` + (pageErrors[0] ? `: ${pageErrors[0]}` : ""))
} catch (e) {
  row(false, "RUN  the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
} finally {
  await browser.close()
}

console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exitCode = fail ? 1 : 0
