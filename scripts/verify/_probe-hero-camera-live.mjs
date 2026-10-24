// DOES THE CAMERA PROGRAM REACH THE RENDERER? — the real entry path, no stills.
//
// `assert-hero-camera.mjs` judges the MODEL, off the sampler, in plain node.
// That is the right place to judge a camera program and it is where every
// number in this lane comes from. What it cannot show is that the model reaches
// the screen: `page.tsx:923` calls `__captureHarness.orbitView(sample.az,
// sample.el, sample.fill)`, and a change to `lib/hero-motion.ts` is only real
// if that call receives it.
//
// So this drives the page's OWN scrub slider — the same `[data-hero-scrub]`
// hook the capture uses, not a synthesized one — with `orbitView` wrapped so
// every pose the renderer is handed is recorded, and compares the recorded
// series against `sampleHeroMotion` frame for frame.
//
// IT CANNOT REPORT A FALSE GREEN. The comparison is against exact model values
// at the same playhead positions, so a page that is not consuming the model at
// all produces a mismatch rather than a pass. And it prints the two series so
// the tilt->rise handover is visible as numbers rather than asserted.
//
// Run it through the guard, which fails if a sibling lane saves mid-run:
//   node scripts/verify/_run-clean.mjs scripts/verify/_probe-hero-camera-live.mjs
import { chromium } from "./lib/browser.mjs"
import { loadTs } from "./_ts-load.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const { DEFAULT_HERO_MOTION, sampleHeroMotion, phaseOffsets, totalDuration } =
  loadTs("lib/hero-motion.ts")
const P = DEFAULT_HERO_MOTION
const off = phaseOffsets(P)

// The tilt + rise arc, which is the whole subject: `solid` (parked) through
// the end of `standup`, plus the descend out of the hold.
const WINDOWS = [
  { name: "tilt + rise", from: off.tilt - 2 / P.fps, to: off.orbit },
  { name: "hold + descend", from: off.descend - 2 / P.fps, to: off.returnTurn },
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
const page = await context.newPage()
const errors = []
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
})
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

let bad = 0
try {
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
  await page.waitForTimeout(3500)

  // Wrap the one call the camera program reaches the renderer through.
  await page.evaluate(() => {
    const h = window.__captureHarness
    window.__camLog = []
    const real = h.orbitView.bind(h)
    h.orbitView = (az, el, fill) => {
      window.__camLog.push([az, el, fill])
      return real(az, el, fill)
    }
  })

  const scrubber = page.locator("[data-hero-scrub]")
  const total = await scrubber.evaluate((el) => parseFloat(el.max))
  console.log(
    `timeline on the page: ${total.toFixed(3)}s · model totalDuration: ${totalDuration(P).toFixed(3)}s` +
      `${Math.abs(total - totalDuration(P)) < 0.01 ? "  MATCH" : "  *** MISMATCH ***"}`,
  )
  if (Math.abs(total - totalDuration(P)) >= 0.01) bad++

  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(value))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  for (const w of WINDOWS) {
    console.log(`\n${w.name.toUpperCase()} — what the RENDERER was handed, against the model`)
    console.log("   t      phase        model az/el/fill          received az/el/fill        d(el)")
    let prevEl = null
    for (let t = w.from; t <= w.to + 1e-9; t += 1 / P.fps) {
      const tc = Math.min(t, w.to - 1e-6)
      await page.evaluate(() => {
        window.__camLog.length = 0
      })
      await setPlayhead(tc)
      await page.waitForTimeout(70)
      const log = await page.evaluate(() => window.__camLog.slice(-1)[0] || null)
      const m = sampleHeroMotion(P, tc)
      const got = log || [NaN, NaN, NaN]
      const err = Math.max(
        Math.abs(got[0] - m.az),
        Math.abs(got[1] - m.el),
        100 * Math.abs(got[2] - m.fill),
      )
      if (!(err < 0.01)) bad++
      const d = prevEl === null ? 0 : got[1] - prevEl
      prevEl = got[1]
      console.log(
        `  ${tc.toFixed(3)} ${m.phase.padEnd(11)} ` +
          `${m.az.toFixed(2).padStart(7)}${m.el.toFixed(2).padStart(7)}${m.fill.toFixed(3).padStart(7)}   ` +
          `${got[0].toFixed(2).padStart(7)}${got[1].toFixed(2).padStart(7)}${got[2].toFixed(3).padStart(7)}   ` +
          `${d.toFixed(2).padStart(6)}  ${err < 0.01 ? "" : "*** MISMATCH ***"}`,
      )
    }
  }
} finally {
  await context.close()
  await browser.close()
}

console.log(`\nconsole errors: ${errors.length}`)
for (const e of errors.slice(0, 5)) console.log("  " + e)
console.log(bad === 0 && errors.length === 0 ? "\nTHE MODEL REACHES THE RENDERER" : `\n${bad} MISMATCHES`)
process.exit(bad === 0 && errors.length === 0 ? 0 : 1)
