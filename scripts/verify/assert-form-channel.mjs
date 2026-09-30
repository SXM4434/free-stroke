/**
 * ASSERT: THE FORM CHANNEL IS REACHABLE, IT MOVES THE PICTURE, AND IT PERSISTS.
 *
 * WHAT IS AT RISK. `flatten` is the channel the hero beat animates, and until
 * 2026-09-04 `app/page.tsx` did not mention it once against 13 mentions of
 * `drawIn`. The viewport has always TAKEN it as a prop and always defaulted it
 * to `SOLID_STATE`, so the product route could only ever draw the last frame of
 * a five-frame idea. The engine was there the whole time; nothing handed it a
 * value.
 *
 * ⚠ THE BAR IS PIXELS, NOT STATE. A gate that read the document back would pass
 * while the mark never changed, which is exactly the defect F81 records: six pen
 * tip shapes, a picker, a live setter with subscribers, and every one of them
 * drawing the identical picture. So every row here is a screenshot difference
 * with a noise floor under it.
 *
 * ⚠ AND THE POPOVER MUST BE SHUT BEFORE ANY SHOT. It is 42rem wide and sits OVER
 * the viewport. The first version of this measurement read 3,749 px for the ink
 * flip and 474 px for an 86-degree turn, and the 474 was the card's own readout
 * changing from 0 to 80 degrees. With the popover closed the same two moves read
 * 6,052 and 10,822.
 */
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import sharp from "sharp"

let pass = 0, fail = 0
const say = (ok, what, detail) => {
  if (ok) { pass++; console.log(`PASS  ${what} — ${detail}`) }
  else { fail++; console.log(`FAIL  ${what} — ${detail}`) }
}

const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage()
const errs = []
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)))
await page.goto(LAB_URL, { waitUntil: "domcontentloaded" })

/* WAIT FOR THE ENGINE. A 9-second sleep once screenshotted the words "Starting
 * the 3D engine" and reported 460 ink px as a finding. */
let ready = null
for (let i = 0; i < 60; i++) {
  if (await page.evaluate(() => typeof window.__revealHarness?.setProgress === "function")) { ready = i; break }
  await page.waitForTimeout(1000)
}
say(ready !== null, "the 3D engine started before anything was measured",
  ready === null ? "still on the placeholder after 60s" : `ready after ~${ready}s`)
if (ready === null) { await b.close(); process.exit(1) }

const box = await (await page.$("canvas")).boundingBox()
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.42)
await page.mouse.down()
for (let i = 0; i <= 26; i++) {
  await page.mouse.move(box.x + box.width * (0.3 + 0.36 * i / 26), box.y + box.height * (0.42 + 0.15 * Math.sin(i / 3)))
}
await page.mouse.up()
await page.waitForTimeout(4000)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.waitForTimeout(1500)

const cs = await page.$$("canvas")
let vp = null, best = -1
for (const el of cs) {
  const bb = await el.boundingBox()
  if (bb && bb.x > 400 && bb.width * bb.height > best) { best = bb.width * bb.height; vp = el }
}
const cb = await vp.boundingBox()
const clip = { x: Math.round(cb.x), y: Math.round(cb.y), width: Math.round(cb.width), height: Math.round(cb.height * 0.70) }

const isOpen = () => page.evaluate(() => !!document.querySelector('[aria-label="Draw-in timing"]'))
const toggle = async () => {
  await page.evaluate(() => document.querySelector("[data-animation-drawin]")?.click()) // PANEL-2: the dock's Draw-in header
  await page.waitForTimeout(800)
}
const shut = async () => { if (await isOpen()) await toggle() }
const open = async () => { if (!(await isOpen())) await toggle() }
const shot = async (tag) => {
  await shut(); await page.waitForTimeout(900)
  const f = `/tmp/formgate-${tag}.png`
  await page.screenshot({ path: f, clip })
  return sharp(f).greyscale().raw().toBuffer()
}
const diff = (a, c) => { let d = 0; for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - c[k]) > 8) d++; return d }
const hit = async (t) => {
  await open()
  await page.evaluate((t) => {
    const d = document.querySelector('[aria-label="Draw-in timing"]')
    ;[...d.querySelectorAll("button")].find((b) => b.textContent.trim() === t)?.click()
  }, t)
  await page.waitForTimeout(1300)
}

await open()
const present = await page.evaluate(() => {
  const d = document.querySelector('[aria-label="Draw-in timing"]')
  const btn = (t) => [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === t)
  return { lit: !!btn("Lit object"), flat: !!btn("Flat ink"), turn: !!d.querySelector('input[aria-label="Turn"]') }
})
say(present.lit && present.flat && present.turn,
  "the form card is reachable from a drawing, without the debug surface",
  `Lit object=${present.lit} Flat ink=${present.flat} Turn slider=${present.turn}`)

const LIT = await shot("lit")
const LIT2 = await shot("lit2")
const floor = diff(LIT, LIT2)
say(floor === 0, "CONTROL — the same state photographed twice is identical", `noise floor ${floor} px`)

await hit("Flat ink")
const FLAT = await shot("flat")
const inkMove = diff(LIT, FLAT)
say(inkMove > 2000, "shading: Lit object and Flat ink are different pictures",
  `${inkMove} px differ, floor ${floor}, bar 2000`)

await hit("Lit object")
const BACK = await shot("back")
say(diff(LIT, BACK) === 0, "CONTROL — going back to Lit object restores the exact frame",
  `${diff(LIT, BACK)} px against the original, needs 0`)

await hit("Flat ink")
const FLATBASE = await shot("flatbase")
await open()
const sl = await page.$('input[aria-label="Turn"]')
const sb = await sl.boundingBox()
await page.mouse.click(sb.x + sb.width * 0.95, sb.y + sb.height / 2)
await page.waitForTimeout(1400)
const deg = await page.evaluate(() => document.querySelector('input[aria-label="Turn"]')?.value)
const TURNED = await shot("turned")
const turnMove = diff(FLATBASE, TURNED)
/* THE TURN IS JUDGED ON FLAT INK ON PURPOSE. Rotating round tubes about their
 * own vertical axis barely changes a silhouette; the flat face is where the
 * thickness becomes the picture, which is what `FlatState.yaw`'s own doc says
 * the turn exists to show. */
say(turnMove > 4000, `turn: flat ink at ${deg} degrees is a different picture from flat ink at 0`,
  `${turnMove} px differ, floor ${floor}, bar 4000`)

await page.reload({ waitUntil: "domcontentloaded" })
for (let i = 0; i < 60; i++) {
  if (await page.evaluate(() => typeof window.__revealHarness?.setProgress === "function")) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(2500)
await open()
const after = await page.evaluate(() => {
  const d = document.querySelector('[aria-label="Draw-in timing"]')
  const on = (t) => { const x = [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === t); return x ? /bg-foreground/.test(x.className) : null }
  return { flatOn: on("Flat ink"), turn: d.querySelector('input[aria-label="Turn"]')?.value }
})
say(after.flatOn === true && after.turn === deg,
  "the form survives a reload, both dials",
  `flat ink on=${after.flatOn}, turn=${after.turn} against ${deg} before the reload`)

say(errs.length === 0, "no uncaught page errors during the run", errs.length ? errs.slice(0, 2).join(" | ") : "clean")

await b.close()
console.log(`\n${fail === 0 ? `ALL ${pass} FORM-CHANNEL ASSERTIONS PASS (controls included)` : `${fail} of ${pass + fail} FORM-CHANNEL ASSERTIONS FAILED`}`)
process.exit(fail === 0 ? 0 : 1)
