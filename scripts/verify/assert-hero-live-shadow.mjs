// THE CONTACT SHADOW, ON THE LIVE BEAT — no flatten override anywhere.
//
// `assert-hero-flatstate.mjs` proves the channel is wired by DRIVING it:
// `setFlatten({shadow: 0 -> 1})` moves the ground tone under the mark from
// 249.79 to 244.73 at el 35. That is the right test for "is the uniform
// connected", and it is not a test of the BEAT — an override passes whether or
// not `sample.shadow` ever reaches the render.
//
// This reads the pool at two positions of the page's OWN transport, inside the
// `land` phase, where the model ramps `shadow` 0 -> 1 on its own clock. Nothing
// is injected. If the tone under the mark moves between them, the beat's own
// shadow value is reaching the render.
//
// ── WHY THE CAMERA HAS TO BE LIFTED, AND WHY THAT IS NOT AN OVERRIDE ───────
// The shadow's entire arrival happens while the camera is parked DEAD-ON at
// el 0, and a contact pool is a horizontal plane — edge-on at el 0, worth
// nothing. So the two frames are taken with the transport PAUSED and the
// camera raised through the page's own `__captureHarness.orbitView`, which is
// the same imperative camera call the page itself makes every frame. The pose
// is a camera; `shadow` is still whatever the model says at that playhead.
//
// That constraint is also the finding: **K4's one piece of news lands where it
// cannot be seen.** The beat is 0.26s past the landing before the tilt lifts
// the camera far enough for the pool to exist on screen, by which time the
// arrival is over. The el-0 control takes exactly the same two playheads without
// lifting the camera and requires the tone NOT to move, which is both the
// instrument's calibration and the demonstration of the problem.
//
// ── AND IT NOW RUNS ON THE BARE INVOCATION (2026-08-07) ────────────────────
// It was `--control=el0`, and no sweep passed it — so the one arm that can show
// the drop row is measuring a POOL rather than any old frame-to-frame wobble was
// the arm nothing ran (`docs/explainers/21-losing-your-work.md` §7; explainer 31
// counted nineteen gates like this). The flag is DELETED per explainer 29 §5.
//
// COST, MEASURED: 10.5 s bare. The el-0 arm reuses the SAME page, the same
// phase scan and the same two playheads — only the camera pose differs — so it
// is two extra seeks and two extra screenshots, ~2 s. Nothing to schedule.
//
// Usage:
//   node scripts/verify/assert-hero-live-shadow.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
/** The lifted pose the pool can be seen from, and the dead-on one it cannot. */
const EL = 35
const EL_CONTROL = 0
const OUT = join(ROOT, "docs", "verification", "hero-live-shadow")

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
}

/**
 * The GROUND under the mark: the band immediately below the ink's bounding box,
 * which is where a contact pool falls. Ink itself is excluded so the statistic
 * cannot be moved by the mark changing.
 */
async function groundTone(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const lum = (p) => 0.2126 * data[p * 4] + 0.7152 * data[p * 4 + 1] + 0.0722 * data[p * 4 + 2]
  let x0 = Infinity, x1 = -1, y1 = -1, ink = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (lum(y * W + x) > 150) continue
      ink++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  }
  if (!Number.isFinite(x0)) return null
  // A band under the mark, one third of the mark's own width tall.
  const band = Math.max(12, Math.round((x1 - x0) * 0.06))
  let sum = 0
  let n = 0
  for (let y = y1 + 2; y < Math.min(H, y1 + 2 + band); y++) {
    for (let x = x0; x <= x1; x++) {
      const l = lum(y * W + x)
      if (l <= 150) continue // never average ink into the ground
      sum += l
      n++
    }
  }
  return { tone: n ? sum / n : null, n, ink, box: { x0, x1, y1 } }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
  await page.waitForTimeout(3000)

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  const seek = async (t) => {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    await page.waitForTimeout(400)
  }

  /* FIND THE TWO PLAYHEADS OFF THE PAGE'S OWN READOUT rather than off a beat
   * table this file does not own: the first frame of `land` (the face has just
   * arrived, the shadow has not) and its last (the shadow has landed). Every
   * hardcoded second in this beat's tooling has been wrong at least once —
   * storyboard §11.8. */
  let first = null
  let last = null
  for (let t = 0; t < endT; t += 0.02) {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "land") {
      if (first === null) first = t
      last = t
    } else if (first !== null) break
  }
  if (first === null) {
    console.error("no `land` phase on the transport — the beat's phase names moved")
    process.exit(2)
  }
  console.log(`land runs ${first.toFixed(2)}s .. ${last.toFixed(2)}s · camera lifted to el ${EL}, control at el ${EL_CONTROL}\n`)

  const shotAt = async (t, name, el) => {
    await seek(t)
    // The camera, through the page's OWN imperative call. The transport is
    // paused, so the page's per-sample `orbitView` does not run again and this
    // pose stands.
    const took = await page.evaluate((e) => window.__captureHarness.orbitView(0, e, 1), el)
    if (!took) throw new Error("orbitView refused — the camera harness moved")
    await page.waitForTimeout(450)
    const png = await page.screenshot({ clip: box })
    writeFileSync(join(OUT, `${name}.png`), png)
    return groundTone(png)
  }

  const before = await shotAt(first, "land-start", EL)
  const after = await shotAt(last, "land-end", EL)

  const drop = before.tone - after.tone
  record(
    `the LIVE beat's own shadow reaches the ground — el ${EL}`,
    drop >= 1,
    `ground tone under the mark ${before.tone.toFixed(2)} at t=${first.toFixed(2)} -> ${after.tone.toFixed(2)} at t=${last.toFixed(2)}` +
      ` (darker by ${drop.toFixed(2)}; needs >= 1).` +
      `\n      No flatten override was set at any point; the shadow value is whatever the model computed at that playhead.` +
      `\n      Sampled over ${after.n} ground px in a band under the ink; ink pixels are excluded so the mark cannot move this number.`,
  )
  record(
    "the mark itself did not change between the two frames",
    Math.abs(before.ink - after.ink) / Math.max(1, before.ink) < 0.02,
    `ink ${before.ink} -> ${after.ink} px (needs < 2 % apart). Both are the settled solid dead-on, so anything the ` +
      `ground did is the pool and not the silhouette.`,
  )
  record("console clean", errors.length === 0, `${errors.length} errors${errors.length ? ": " + errors.join(" | ") : ""}`)

  /* ── THE CONTROL · same two playheads, camera NOT lifted ─────────────────
   *
   * A horizontal contact pool is EDGE-ON at el 0, so whatever the model's
   * `shadow` value does between these two frames must NOT reach the ground band
   * from there. If it did, the row above would be reading something else — a
   * lighting change, a silhouette wobble, an exposure drift — and its green
   * would mean nothing about a pool.
   *
   * This is also the file's headline finding, run rather than argued: K4's one
   * piece of news lands 0.26 s before the tilt makes it visible at all. */
  const cBefore = await shotAt(first, "land-start-control-el0", EL_CONTROL)
  const cAfter = await shotAt(last, "land-end-control-el0", EL_CONTROL)
  const cDrop = cBefore.tone - cAfter.tone
  const controlOk = Math.abs(cDrop) < 0.5
  if (!controlOk) results.push({ name: "control", pass: false, detail: "" })
  console.log(
    `${controlOk ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD — the SAME two playheads with the camera DEAD-ON at el ${EL_CONTROL} ` +
      `move the ground by nothing\n      ground tone ${cBefore.tone.toFixed(2)} -> ${cAfter.tone.toFixed(2)} ` +
      `(Δ ${cDrop.toFixed(2)}, needs |Δ| < 0.5) against ${drop.toFixed(2)} at el ${EL}. ` +
      `${controlOk ? "As required" : "THE ROW ABOVE IS NOT MEASURING A POOL"}: a horizontal pool is edge-on at el 0, so a drop ` +
      `there would mean the lifted row's green is about something other than the contact shadow.` +
      `\n      This is the finding too — the shadow's whole arrival happens while the camera is parked dead-on.`,
  )

  console.log(`\nframes: ${OUT}`)
  const failed = results.filter((r) => !r.pass)
  console.log(failed.length ? `\n${failed.length} FAILED` : "\nall rows passed")
  await browser.close()
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
