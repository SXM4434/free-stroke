// _PROBE-PENTIP-SWEEP — CAPTURE HALF, four arms, one page load.
//
// Sebs's state, asserted off the DOM rather than assumed, exactly as
// `_probe-drawin-sweep.mjs` establishes it: LOOK = Desk Doodles, ENGINE = Free
// Stroke, wobble 0.40, endpoint PROTRUDE.
//
// FOUR ARMS, AND THE NAMES ARE LOAD-BEARING. `assert-drawin-pentip.mjs` reads
// this directory and reports the `free-stroke` / `desk-doodles` pair, so:
//
//   free-stroke       Free Stroke engine, the tip shape as SHIPPED
//   free-stroke-off   Free Stroke engine, tip `off` — the PARKED PRIOR, i.e.
//                     the raw per-triangle `setDrawRange` boundary that
//                     explainer 18 shipped and that Sebs is complaining about
//   free-stroke-nib   the OTHER shipped shape, so the default is a measured pick
//   desk-doodles      the reference engine, which rebuilds from arc-length
//                     clipped strokes and therefore has a real end
//
// All three Free Stroke arms are captured in ONE page load, on the same wall
// clock, against the same build. Explainer 20 §2: *"A ratio between two numbers taken
// in different sessions is not a measurement."*
//
// ⚠ deviceScaleFactor 2, ON PURPOSE. The mark is about thirteen device pixels
// wide at scale 1, and the instrument that reads these frames measures a
// transition across it in whole pixels — which is why its two synthetic
// controls collapsed to 2 px and 5 px and stopped being able to tell a cut from
// a nib. Doubling the raster does not change the mark; it changes how many
// samples the ruler has across it.
//
// ⚠ 201 SAMPLES, AND THE DEFAULT USED TO BE 33, WHICH WROTE EVIDENCE ITS OWN
// GATE CANNOT JUDGE. `assert-drawin-pentip.mjs` throws away every playhead that
// falls on a stroke end, inside a ribbon fold, or on a crowded ribbon, and it
// requires 8 survivors before it will report a verdict. Measured 2026-09-04 on
// a clean capture of this tree, same server, same build, minutes apart:
//
//   samples   playheads kept, per arm            "enough playheads to judge"
//   33        3 · 3 · 3 · 3       of 24          FAIL on all four arms
//   201       35 · 35 · 35 · 31   of 192         PASS on all four arms
//
// Every control row and every fit row passed at 33. The only thing missing was
// the draw itself. The rejection rate is a property of the WORD — where its
// strokes end, where it folds, where it crosses itself — so it does not improve
// with a better capture, only with more of it.
//
// That is why every stored capture in `docs/verification/pentip/` that this
// gate has ever graded green was taken at 201: `run`, `fix-base`, `fix-after`,
// `ship-dsf1`, `tipshape-sweep`, `gate-repair-dense`. The one at 33 is `gate`,
// and F41 is the note about `gate` being ungradeable. A default that writes a
// set the grader refuses is a silent degradation in the capture half, so the
// default now matches the density the grader was calibrated on.
//
// Usage: node scripts/verify/_probe-pentip-sweep.mjs [--label=run] [--samples=201]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync, readdirSync, renameSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const SAMPLES = parseInt(arg("samples", "201"), 10)
const DSF = parseFloat(arg("dsf", "2"))
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/pentip/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 8317 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "pentip", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
// >= 1440 x 1440 per the standing rule: a shorter viewport lets the DialKit
// dock squeeze the stage and CLIP the mark.
const VIEW = { width: 1600, height: 1600 }

const ARMS = [
  { key: "free-stroke", engine: "free-stroke", tip: null },
  { key: "free-stroke-off", engine: "free-stroke", tip: "off" },
  /* THE OTHER SHIPPED SHAPE, captured so the DEFAULT is a measured pick rather
   * than a taste. `nib` is the honest ballpoint (the union of the nib's own
   * stamps); `quill` adds the edge lag that makes Desk Doodles' end a point.
   * Both are real pens and which one the beat wants is Sebs's call, so both are
   * on disk with the reference engine beside them. */
  { key: "free-stroke-nib", engine: "free-stroke", tip: "nib" },
  { key: "desk-doodles", engine: "desk-doodles", tip: null },
]

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: DSF,
    recordVideo: { dir: OUT, size: VIEW },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2000)

  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)

  const state = await page.evaluate(() => {
    const txt = (el) => (el?.textContent ?? "").trim()
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) {
        wobble = Number(inp.value)
        break
      }
    }
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    const btns = [...document.querySelectorAll("button")].filter((b) => LABELS[txt(b).toLowerCase()])
    for (const b of btns) {
      const bg = getComputedStyle(b).backgroundColor
      const transparent = bg === "rgba(0, 0, 0, 0)" || bg === "transparent"
      if (!transparent) endpoint = LABELS[txt(b).toLowerCase()]
    }
    return { wobble, endpoint, tip: window.__captureHarness.penTip?.() ?? null }
  })
  console.log("live state:", JSON.stringify(state))
  say(state.wobble === 0.4, "wobble is 0.40 — his setting", String(state.wobble))
  say(state.endpoint === "protrude", "endpoint is PROTRUDE — his setting", String(state.endpoint))
  say(!!state.tip, "the page reports a shipped tip shape", String(state.tip))
  const shippedTip = state.tip

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  console.log(`draw phase: at ${span.at.toFixed(3)}s, ${span.duration.toFixed(3)}s long`)
  writeFileSync(join(OUT, "span.json"), JSON.stringify(span, null, 2))

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(140)
  }

  const meta = { span, samples: SAMPLES, view: VIEW, dsf: DSF, shippedTip, engines: {} }

  /* ── HOT-RELOAD RESILIENCE, AND WHY THE UNIT IS THE ARM ───────────────────
   *
   * This runs against the live dev server while other work lands in the tree,
   * and every save remounts the page: `window.__captureHarness` goes away and
   * the next call throws "Cannot read properties of undefined (reading
   * 'setPenTip')", or the seek dies with "Execution context was destroyed".
   * Measured 2026-08-28 over three consecutive bare runs: three deaths, at
   * lines 168, 177 and 178, none of them past the first arm's sweep. So
   * `assert-drawin-pentip.mjs`, whose only failing row is that its frames are 24
   * days older than lib/, had no way back to green — the tool that writes those
   * frames could not finish.
   *
   * THE ARM IS THE UNIT because the whole point of an arm is that its 33 frames
   * are one continuous scrub of one engine at one tip, on one build. Re-cropping
   * a bed halfway through would file frames from two builds under one label,
   * which is the defect this directory's PROVENANCE row exists to catch, arriving
   * by the back door. So a disturbed arm is captured again from its first frame.
   *
   * The `say()` rows stay OUTSIDE the retry: they assert the state took, and a
   * row printed four times because the page reloaded is noise, not evidence. */
  async function reestablish() {
    await page.goto(HERO_URL, { waitUntil: "networkidle" })
    await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
    await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
    await page.waitForTimeout(2000)
    await page.click(`[data-register-option="desk-doodles"]`)
    await page.waitForTimeout(400)
  }
  async function armReady(armSpec, wantTip) {
    const alive = await page.evaluate(() => !!window.__captureHarness).catch(() => false)
    if (!alive) {
      console.log(`[pentip] harness vanished (hot reload) — re-establishing before ${armSpec.key}`)
      await reestablish()
    }
    await page.click(`[data-engine-option="${armSpec.engine}"]`)
    // The Desk Doodles engine rebuilds the whole word on a switch.
    await page.waitForTimeout(3000)
    const fam = await page.evaluate(() =>
      document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family"),
    )
    const okTip = await page.evaluate((m) => window.__captureHarness.setPenTip(m), wantTip)
    const gotTip = await page.evaluate(() => window.__captureHarness.penTip())
    return { fam, okTip, gotTip }
  }

  for (const armSpec of ARMS) {
    const wantTip = armSpec.tip ?? shippedTip
    const dir = join(OUT, armSpec.key)
    mkdirSync(dir, { recursive: true })
    let reveals = []
    let last = null
    for (let attempt = 0; ; attempt++) {
      try {
        last = await armReady(armSpec, wantTip)
        reveals = []
        for (let k = 0; k < SAMPLES; k++) {
          const t = span.at + (span.duration * k) / (SAMPLES - 1)
          await seek(t)
          const phase = await page.evaluate(() => {
            const el = document.querySelector("[data-hero-phase]")
            return { phase: el?.getAttribute("data-hero-phase"), t: Number(el?.getAttribute("data-hero-phase-t")) }
          })
          reveals.push({ k, t, phase: phase.phase, phaseT: phase.t, tip: wantTip })
          const buf = await page.locator("[data-hero-stage]").screenshot()
          writeFileSync(join(dir, `${String(k).padStart(3, "0")}.png`), buf)
        }
        break
      } catch (e) {
        if (attempt >= 4) throw e
        console.log(`[pentip] retry ${armSpec.key} ${attempt + 1} — ${String(e).split("\n")[0]}`)
        await page.waitForTimeout(1500)
      }
    }
    say(last.fam === armSpec.engine, `${armSpec.key} — the engine pill actually switched`, String(last.fam))
    say(last.okTip === true && last.gotTip === wantTip, `${armSpec.key} — the tip shape actually took`, `${last.gotTip}`)
    meta.engines[armSpec.key] = reveals

    try {
      execFileSync(
        FFMPEG,
        ["-y", "-framerate", "8", "-i", join(dir, "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, `scrub-${armSpec.key}.mp4`)],
        { stdio: "ignore" },
      )
    } catch (e) {
      console.warn("ffmpeg scrub failed:", e.message)
    }
  }

  /* ---- REAL-TIME PLAY, FILMED, ON HIS ENGINE, BOTH SHAPES ---------------
   * A still cannot show whether the front ADVANCES smoothly. The parked prior
   * moves the boundary in whole marching-cubes triangles; the built shape moves
   * it per fragment. That is a motion property and only a film can carry it. */
  await page.click(`[data-engine-option="free-stroke"]`)
  await page.waitForTimeout(2500)
  const resetBtn = async () => {
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "reset") b.click()
      })
    })
    await page.waitForTimeout(700)
  }
  const playOnce = async () => {
    await resetBtn()
    await page.waitForTimeout(400)
    await page.click("[data-hero-play]")
    await page.waitForTimeout((span.duration + 1.2) * 1000)
    await page.evaluate(() => {
      document.querySelectorAll("button").forEach((b) => {
        if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
      })
    })
    await page.waitForTimeout(400)
  }
  // warm take (shader compile + first build are not the draw-in)
  await page.evaluate((m) => window.__captureHarness.setPenTip(m), shippedTip)
  await playOnce()
  const playMarks = []
  for (const m of ["off", shippedTip]) {
    await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
    playMarks.push({ mode: m, at: Date.now() })
    await playOnce()
  }
  meta.playMarks = playMarks

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2))
  await context.close()
  await browser.close()

  for (const f of readdirSync(OUT).filter((f) => f.endsWith(".webm"))) {
    renameSync(join(OUT, f), join(OUT, "play.webm"))
    break
  }
  try {
    if (existsSync(join(OUT, "play.webm"))) {
      execFileSync(FFMPEG, ["-y", "-i", join(OUT, "play.webm"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "play.mp4")], { stdio: "ignore" })
    }
  } catch (e) {
    console.warn("ffmpeg play failed:", e.message)
  }

  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes + video: ${FINAL}`)
  console.log(pass ? "\nCAPTURE CLEAN" : "\nCAPTURE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
