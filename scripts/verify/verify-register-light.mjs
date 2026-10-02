// Register lighting — capture pass.
//
// Drives the REAL hero-beat page at /desk-doodles (which is what the register
// toggle actually lights) and captures the standing form in BOTH registers
// across a sweep of orbit angles, so the light can be judged by eye rather
// than asserted from source.
//
// Standing rule: HEADED Chrome with the Metal ANGLE backend. Headless silently
// pauses the rAF loop here, which would produce frames of a frozen scene.
//
// WHAT MAKES IT EXIT 1 (F113 finding 8, Codex 2026-09-18). It used to be a
// capture script with an orbit-discovery guard and nothing after it: Codex
// replaced the park `scrubTo(solidT)` with `scrubTo(0)`, discovery still found
// orbit, and every frame was taken at the wrong transport position with exit 0.
// Console and page errors were printed and never counted. Now, per register:
//   1. PARK. After the park settles, the page itself must report phase `orbit`,
//      the scrub input at `solidT`, and a paused transport (the Play button
//      reads "Play"). Read from the DOM the page renders, not from the variable
//      this script wrote.
//   2. EVERY FRAME. Re-read the phase after each pose (a remount can move it),
//      and measure the captured PNG: ink pixels (luma below INK, the same 150 as
//      `assert-register-light.mjs`) over the upper 76% of the canvas must be at
//      least MIN_INK_SHARE of that area. The empty grid measures 0.
//   3. ERRORS. Any collected console error or page error fails the run.
// Every failure is printed, the run finishes its captures so the frames can be
// looked at, and the exit code is 1 when anything failed.
//
// Usage: node scripts/verify/verify-register-light.mjs [outDir]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync } from "node:fs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import path from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const OUT = process.argv[2] || "docs/verification/register-light"

// Orbit poses. Head-on is the one that used to read as a flat cut-out (a
// directional light shades a flat camera-facing face perfectly uniformly), so
// it is the acceptance shot; the raked angles show whether the form has real
// tonal range across the face and a silhouette that separates.
const POSES = [
  { name: "a-headon", az: 0, el: 0, fill: 1.0 },
  { name: "b-quarter", az: 26, el: 12, fill: 1.0 },
  { name: "c-quarter-high", az: 34, el: 26, fill: 1.0 },
  { name: "d-side", az: 62, el: 8, fill: 1.05 },
  { name: "e-low", az: 18, el: -14, fill: 1.0 },
  { name: "f-close", az: 20, el: 10, fill: 0.72 },
]

/** Same bar as `assert-register-light.mjs`: below the grid's lightest line. */
const INK = 150
/** CALIBRATED 2026-09-22 on the 12 frames committed in `7e26a144`, the fix for
 *  the empty-stage captures: the smallest lit solid there is 0.689% of the
 *  measured area (free-stroke_d-side), the largest 2.619% (desk-doodles_f-close),
 *  and the empty grid is 0. 0.25% sits under the smallest by a factor of 2.7. */
const MIN_INK_SHARE = 0.0025

/** Ink share of the upper 76% of a captured frame. The lab viewport's transport
 *  chrome sits in the lower part and is HTML, not the render. */
async function inkShare(file) {
  const img = await loadImage(file)
  const W = img.width
  const H = Math.round(img.height * 0.76)
  if (!W || !H) return 0
  const c = createCanvas(W, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, W, H).data
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < INK) n++
  }
  return n / (W * H)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const failures = []
  const fail = (msg) => {
    failures.push(msg)
    console.log(`FAIL  ${msg}`)
  }
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 240))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 240)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 60000,
  })
  // The page measures the flat word's footprint once on mount and holds the
  // scene while it does; wait that out before driving the camera.
  await page.waitForTimeout(2500)

  // The WebGL canvas only — the lab viewport draws its own transport/debug
  // chrome into the same stage, which is not what is being judged.
  const gl = page.locator("main canvas").first()

  for (const reg of ["Desk Doodles", "Free Stroke"]) {
    await page.getByRole("group", { name: "Visual register" }).getByRole("button", { name: reg }).click()
    await page.waitForTimeout(1200)

    /* 🔴 `setProgress(1)` PHOTOGRAPHS AN EMPTY STAGE. PORTED FROM THE GATE.
     *
     * The comment that used to sit here said the page "only re-applies its own
     * pose when its state changes, so once the register click has settled these
     * stick". That is still true of the CAMERA and no longer true of the
     * REVEAL. `/desk-doodles` now OWNS the reveal clock: it writes
     * `revealRef.current = sample.reveal` and `HostRevealTick` copies that into
     * the playhead EVERY FRAME, so `setProgress(1)` is overwritten before the
     * next paint. At the transport's t = 0 the beat's own reveal is 0.
     *
     * MEASURED 2026-09-05, and it had been shipping blanks: every one of the 12
     * captures was the empty grid. `free-stroke_a-headon` was **79,125 bytes**
     * when it was committed on 08-24 and came back **2,573**, and the tell was
     * that each FS/DD pair had gone byte-identical in SIZE (6027/6027,
     * 7014/7014). Two registers that exist to look different cannot compress
     * identically. They were the same empty picture.
     *
     * `assert-register-light.mjs` diagnosed this and fixed itself; nobody
     * carried the fix across to the capture half. Ask the beat for the state
     * instead of fighting it: seek the transport into `orbit`, where the reveal
     * is complete and the mark is the LIT SOLID this file is about. During
     * `breath` it is a flat drawing with no shading to photograph at all. The
     * camera stays the harness's to drive, because `orbitView` is re-issued by
     * the page only on a React render and a parked transport does not
     * re-render. */
    const scrubTo = async (t) => {
      await page.evaluate((v) => {
        const el = document.querySelector("[data-hero-scrub]")
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        set.call(el, String(v))
        el.dispatchEvent(new Event("input", { bubbles: true }))
      }, t)
    }
    const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
    let solidT = null
    for (let t = 0.25; t < endT; t += 0.25) {
      await scrubTo(t)
      const ph = await page.evaluate(
        () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
      )
      if (ph === "orbit") { solidT = t; break }
    }
    if (solidT === null) {
      console.log(`FAIL  ${reg}: the beat has no \`orbit\` phase to park on — the phase names moved`)
      process.exit(1)
    }
    await scrubTo(solidT)
    await page.waitForTimeout(900)
    const readState = () =>
      page.evaluate(() => ({
        phase: document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
        scrub: Number(document.querySelector("[data-hero-scrub]")?.value),
        play: document.querySelector("[data-hero-play]")?.textContent?.trim() ?? null,
      }))
    const st = await readState()
    const parkedOk = st.phase === "orbit" && Math.abs(st.scrub - solidT) < 0.006 && st.play === "Play"
    if (!parkedOk) {
      fail(
        `${reg}: the park did not hold. Asked for ${solidT.toFixed(2)}s in "orbit", the page reports ` +
          `phase ${JSON.stringify(st.phase)}, scrub ${st.scrub}, button ${JSON.stringify(st.play)}`,
      )
    } else {
      console.log(`  ${reg}: parked at ${solidT.toFixed(2)}s of ${endT.toFixed(2)}s, the page reports "orbit", paused`)
    }

    const tag = reg.toLowerCase().replace(/\s+/g, "-")
    for (const p of POSES) {
      await page.evaluate(
        (q) => window.__captureHarness.orbitView(q.az, q.el, q.fill),
        p,
      )
      // Two rAF ticks so the orbit lands and the frame is drawn.
      await page.waitForTimeout(320)
      const file = path.join(OUT, `${tag}_${p.name}.png`)
      await gl.screenshot({ path: file })
      const ph = (await readState()).phase
      const share = await inkShare(file)
      const pct = (100 * share).toFixed(3)
      if (ph !== "orbit") fail(`${tag}_${p.name}: phase ${JSON.stringify(ph)} at capture, not "orbit"`)
      if (!(share >= MIN_INK_SHARE)) {
        fail(`${tag}_${p.name}: ink ${pct}% of the frame, under ${100 * MIN_INK_SHARE}%; the lit solid is not in it`)
      } else {
        console.log(`  ${tag}_${p.name}: ink ${pct}%`)
      }
    }
  }

  console.log(`frames -> ${OUT}`)
  console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):` : "console errors: none")
  for (const e of errors.slice(0, 10)) console.log("  " + e)
  if (errors.length) fail(`${errors.length} console or page error(s) during the capture`)
  await browser.close()
  if (failures.length) {
    console.log(`FAIL  ${failures.length} problem(s); these frames are not the lit solid this file promises`)
    process.exit(1)
  }
  console.log(`PASS  ${POSES.length * 2} frames, both registers parked in "orbit", every frame carries the solid`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
