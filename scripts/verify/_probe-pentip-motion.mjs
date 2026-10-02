// _PROBE-PENTIP-MOTION — does the front ADVANCE, or does it JUMP?
//
// Sebs: *"IT'S LIKE ITS USING SOME STUPID SWEEP REVEAL"*, and *"the 2d drawing
// animation still doesnt draw like someone actually drawing the strokes."*
//
// ── THE HYPOTHESIS THIS WAS BUILT TO TEST, AND THE ANSWER, WHICH IS NO ──────
//
// The SHAPE of the moving end is a still-frame property and the 7x crops settle
// it. This was written for the other half: `setDrawRange` moves the boundary in
// whole MARCHING-CUBES TRIANGLES, so a smoothly advancing playhead ought to
// produce a mark that sits still and then lurches — which is what "jank" would
// mean if it were a motion defect rather than a shape one.
//
// **IT IS NOT ONE, AND THE ARITHMETIC SAYS SO BEFORE THE PIXELS DO.** The
// implicit field's cell is `radiusXY / resolution` = 11.29 / 4 = **2.82 stroke
// units**, and a triangle is about one cell. Against that:
//
//     the scrub input's own step   0.01 s  ->  8.33 stroke units of arc
//     one frame of real-time play  1/60 s  ->  13.89 stroke units of arc
//
// Every increment the beat can actually express moves the pen THREE TO FIVE
// TRIANGLES. Triangle quantisation is therefore below the resolution of the
// transport and of the frame rate, and no viewer has ever seen it. Sebs's word
// is about the shape.
//
// ⚠ AND THE FIRST RUN OF THIS PROBE REPORTED THE OPPOSITE, WHICH IS WHY THE
// PARAGRAPH ABOVE EXISTS. Stepping a window of 0.006 of the draw across 48
// samples asks for 0.58 ms per step; the range input's step is **0.01 s**, so
// 45 of the 48 seeks landed on the SAME playhead value and the mark was frozen
// on 94 % of steps — IN EVERY ARM, INCLUDING THE PER-FRAGMENT ONE. That is the
// instrument measuring its own input quantisation and reading it as a property
// of the reveal. A dead instrument reads exactly like a result.
//
// ── SO WHAT IT NOW ASSERTS ────────────────────────────────────────────────
//
//  1. The window it steps is COARSER than the transport's own step, printed,
//     so the reading cannot be the input's quantisation again.
//  2. The reveal advances smoothly in BOTH arms — this is the REGRESSION guard
//     that matters, because the fix rasterises and discards triangles ahead of
//     the pen and could plausibly have introduced flicker at the front.
//  3. The two arms move the SAME total area over the window (the tip changes
//     the shape of the end, not the rate the word is written at).
//
// Usage: node scripts/verify/_probe-pentip-motion.mjs [--steps=24] [--window=0.12]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "motion")
const OUT = join(ROOT, "docs", "verification", "pentip", LABEL)
const STEPS = parseInt(arg("steps", "24"), 10)
/** Fraction of the draw phase the window spans. Short, so the pen stays inside
 *  a couple of strokes; long enough that each step clears the transport's own
 *  granularity, which is asserted rather than assumed. */
const WINDOW = parseFloat(arg("window", "0.12"))
const START = parseFloat(arg("start", "0.42"))
const VIEW = { width: 1600, height: 1600 }
const ARMS = ["off", "cut", "nib", "quill"]
/** A step smaller than this share of the mean step is the mark standing still. */
const FROZEN_SHARE = 0.25
/** How many steps may stand still before the reveal is judged to be lurching. */
const FROZEN_MAX = 0.15

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function ink(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  let n = 0
  for (let p = 0; p < luma.length; p++) if (luma[p] < cut) n++
  return n
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(2500)

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  /* THE TRANSPORT'S OWN GRANULARITY, READ OFF THE CONTROL. Below this a seek is
   * a no-op and every arm freezes identically — which is what the first run of
   * this probe measured and reported as a finding. */
  const scrubStep = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").step))
  const stepSec = (span.duration * WINDOW) / STEPS
  console.log(`  transport step ${scrubStep} s · this probe's step ${stepSec.toFixed(4)} s`)
  say(
    stepSec >= scrubStep * 2,
    "the probe's step clears the TRANSPORT's own granularity",
    `${stepSec.toFixed(4)} s vs ${scrubStep} s (must be >= 2x, or every arm freezes identically and the reading is the input)`,
  )

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(90)
  }

  const out = {}
  for (const mode of ARMS) {
    const took = await page.evaluate((m) => window.__captureHarness.setPenTip(m), mode)
    say(took === true, `${mode} — the tip shape took`, String(took))
    const areas = []
    for (let i = 0; i <= STEPS; i++) {
      const u = START + (WINDOW * i) / STEPS
      await seek(span.at + span.duration * u)
      areas.push(await ink(await page.locator("[data-hero-stage]").screenshot()))
    }
    const d = []
    for (let i = 1; i < areas.length; i++) d.push(areas[i] - areas[i - 1])
    const mean = d.reduce((a, b) => a + b, 0) / d.length
    const frozen = d.filter((x) => x < FROZEN_SHARE * mean).length
    /* A step counts as BACKWARD only if it is more negative than a twentieth
     * of the mean step. The area is a luminance threshold on an antialiased
     * render, so a single pixel flipping either side of it is noise, not the
     * front reversing — and a rule that calls one pixel a reversal is a rule
     * that will be ignored the first time it fires. */
    const back = d.filter((x) => x < -0.05 * mean).length
    const sorted = [...d].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    out[mode] = {
      samples: d.length,
      totalAdvancePx: areas[areas.length - 1] - areas[0],
      meanStepPx: mean,
      frozenSteps: frozen,
      frozenFrac: frozen / d.length,
      backwardSteps: back,
      biggestStepPx: sorted[sorted.length - 1],
      p95StepPx: p95,
      burstiness: mean > 0 ? p95 / mean : 0,
      areas,
    }
    console.log(
      `  ${mode.padEnd(6)} steps ${d.length}  mean ${mean.toFixed(1)} px  frozen ${frozen} (${((frozen / d.length) * 100).toFixed(0)} %)  backward ${back}  p95/mean ${(p95 / mean).toFixed(2)}`,
    )
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  /* EVERY WINDOW CARRIES ITS SAMPLE COUNT AND A ROW REFUSES ZERO. A sibling
   * lane's latency probe once reported "267 ms → 0 ms, 266x" because a mid-run
   * reload had killed its sampler: a dead instrument reads exactly like a
   * perfect result. */
  for (const m of ARMS) say(out[m].samples === STEPS, `${m} — the window actually sampled`, `${out[m].samples} steps`)

  /* ---- THE REGRESSION GUARD, which is what this probe is actually for ----
   *
   * The fix extends the draw range PAST the pen and lets the fragment test cut
   * it back. If that margin were ever short, or the field stale, the front
   * would flicker or step BACKWARDS — both of which are worse than the blunt
   * end being replaced, and neither of which a still frame shows. */
  for (const m of ARMS) {
    say(
      out[m].frozenFrac <= FROZEN_MAX,
      `${m} — the front ADVANCES rather than lurching`,
      `${(out[m].frozenFrac * 100).toFixed(0)} % of steps stood still (max ${FROZEN_MAX * 100} %)`,
    )
    say(out[m].backwardSteps === 0, `${m} — the front never goes BACKWARDS`, `${out[m].backwardSteps} steps`)
  }
  /* And the tip must change the SHAPE of the end, not the RATE the word is
   * written at. A shape dial that also moved the pacing would be a second,
   * hidden timing control. */
  const ref = out.off.totalAdvancePx
  for (const m of ARMS) {
    const rel = Math.abs(out[m].totalAdvancePx - ref) / ref
    say(rel < 0.03, `${m} — the word is written at the SAME rate as the prior`, `${(rel * 100).toFixed(2)} % apart over the window`)
  }

  writeFileSync(
    join(OUT, "motion.json"),
    JSON.stringify({ span, START, WINDOW, STEPS, scrubStep, stepSec, out }, null, 2),
  )
  await context.close()
  await browser.close()
  console.log(`\njson: ${join(OUT, "motion.json")}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
