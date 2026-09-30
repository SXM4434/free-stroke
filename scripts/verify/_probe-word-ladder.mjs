// _PROBE-WORD-LADDER — photograph "any text" at a ladder of lengths, both laws.
//
// Sebs, 2026-08-02: *"the 3d text is fully distorted worse when u type ur own
// text."*
//
// The ladder is the instrument. One text is a sample and a sample cannot show a
// LENGTH-dependent defect, which is exactly what this one is: the shipped law
// squeezed the word to a fixed span while the nib stayed put, so the damage
// only appears past a certain number of characters and a screenshot of "Desk
// Doodles" looks perfect forever.
//
// Both arms come from ONE build, switched by the Scale pill:
//   fit    — the parked prior law, the defect
//   fixed  — hold the cap height, take another line
// A "before" captured from an older build differs by everything that changed
// since; this repo has already had an unlabelled assert judge a 3.8-day-old
// capture as today's.
//
// ⚠ EACH ARM GETS A FRESH PAGE, AND THAT IS MEASURED, NOT TIDINESS. Run as one
// long session, `fit` first, three of the `fixed` rungs came back as EMPTY GRIDS
// with correct bounds and a correct `draw` phase logged beside them
// (`word-ladder/v6`, `v7`). The same rungs in a `--laws=fixed` run rendered
// perfectly, and switching the pill by hand mid-session also renders perfectly
// — so it is contamination between the arms of this script and not a defect in
// the page. Rather than photograph a state no user reaches, each arm reloads.
//
// ⚠ THE CARVE IS TURNED OFF FOR EVERY FRAME. A separate, live defect makes the
// finished mark render with white chunks missing, and that is another lane's.
// This ladder judges letterform COLLAPSE — counters closing, letters fusing —
// so the carve is set to 0 and cannot be mistaken for it.
//
// Usage: node scripts/verify/_probe-word-ladder.mjs [--label=run] [--laws=fit,fixed]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, rmSync, writeFileSync, existsSync, renameSync } from "node:fs"
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
const LAWS = arg("laws", "fit,fixed").split(",")
const OUT = join(ROOT, "docs", "verification", "word-ladder", LABEL)
/**
 * ⚠ THE CAPTURE IS STAGED, AND THAT IS THE WHOLE POINT OF THIS CONSTANT.
 *
 * PARKED PRIOR: `main()` opened with `rmSync(OUT, { recursive: true })` and then
 * spent several minutes refilling it. That is fine on a run that finishes and
 * catastrophic on one that does not, and this directory's frames are COMMITTED:
 * `docs/verification/word-ladder/gate` holds 41 tracked files that
 * `assert-hero-word-legible` shells this script to rewrite. Measured 2026-08-28
 * by killing a run 12 s in — 41 files on disk before, 2 after, `git status`
 * reporting 39 deleted. Lane N8 restored them by hand twice the same night.
 *
 * `_probe-drawin-film.mjs`'s own header already named the law this broke:
 * *"Destroying evidence is strictly worse than writing bad evidence, because a
 * wrong frame can be re-graded and a deleted one cannot."*
 *
 * So the run writes here and the stored set is replaced only once every frame
 * exists. A run that dies partway — a kill, a session limit, a page that never
 * settles — leaves the committed evidence untouched and its own debris behind
 * under a dotted name, where the next run clears it.
 *
 * The swap is on COMPLETION, not on the `pass` flag. A capture that finished and
 * photographed a defect is real evidence and the gate is meant to grade it; only
 * an INCOMPLETE set is worthless, and only that case keeps the prior frames.
 *
 * The alternative weighed and not taken: refuse to wipe any directory whose
 * contents are tracked in git unless a flag says otherwise. It guards the same
 * files, but it asks git a question on every run and it still leaves a
 * half-written set behind when the flag IS passed. Staging fixes the failure
 * mode itself rather than gating it.
 */
const STAGE = join(ROOT, "docs", "verification", "word-ladder", `.${LABEL}.staging`)
// >= 1440 x 1440 per the standing rule.
const VIEW = { width: 1600, height: 1600 }

/** The ladder. Short to long, and every rung is a real thing someone types. */
export const LADDER = [
  { id: "01-short", text: "ok" },
  { id: "02-hero", text: "Desk Doodles" },
  { id: "03-name", text: "Sebastian" },
  { id: "04-phrase", text: "Hello world" },
  { id: "05-medium", text: "Sebastian Mendez" },
  { id: "06-pangram", text: "the quick brown fox jumps" },
  { id: "07-long", text: "Design engineering that ships" },
  { id: "08-mixed", text: "Ship it! 42% faster (v2.0)" },
]

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** One arm: a fresh page, the law selected, every rung photographed. */
async function runLaw(browser, law, dir) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2500)

  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info")
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  say(!/SwiftShader/i.test(renderer), `${law}: real GPU, not SwiftShader`, renderer)

  await page.click(`[data-word-source="font"]`)
  await page.waitForTimeout(1200)
  say(
    (await page.locator(`[data-word-source="font"]`).getAttribute("aria-pressed")) === "true",
    `${law}: the ANY TEXT source actually took`,
  )
  await page.click(`[data-word-scale="${law}"]`)
  await page.waitForTimeout(800)
  say(
    (await page.locator(`[data-word-scale="${law}"]`).getAttribute("aria-pressed")) === "true",
    `${law}: the law actually took`,
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
    await page.waitForTimeout(280)
  }

  /**
   * TYPE THE WORD AND WAIT FOR THE GEOMETRY TO STOP MOVING.
   *
   * ⚠ NOT A FIXED TIMEOUT, AND THAT COST THREE CAPTURE RUNS. A word rebuilds
   * the implicit surface, and a three-line block takes longer than a one-line
   * one; a flat 900ms photographed some rungs mid-build and wrote empty grids
   * into a verification folder, where they look exactly like a rendering
   * defect. The wait is on the artefact instead: poll the bounds the viewport
   * publishes until three consecutive reads agree, then give the camera's
   * settle-watcher its frame. A capture that cannot tell "not built yet" from
   * "broken" is not an instrument.
   */
  const setText = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-word-input]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, tt)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    let last = null
    let stable = 0
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(120)
      const b = await page.evaluate(() => {
        const bb = window.__captureHarness?.bounds?.()
        return bb ? `${bb.radius}|${bb.center.x}|${bb.center.y}` : null
      })
      if (b !== null && b === last) {
        stable += 1
        if (stable >= 3) break
      } else {
        stable = 0
      }
      last = b
    }
    await page.waitForTimeout(450)
  }

  const rows = []
  for (const rung of LADDER) {
    await setText(rung.text)
    /* RE-READ THE DRAW SPAN PER RUNG. The beat is laid out from the WORD —
     * `letterCount` and `letterSilentAfter` are motion parameters written from
     * the measured letter map — so a new word relays the timeline and the draw
     * phase moves. A time computed once from "Desk Doodles" parks a longer
     * word's playhead somewhere else. */
    const rungSpan = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
    )
    await seek(rungSpan.at + rungSpan.duration * 0.98)
    await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0 }))
    await page.waitForTimeout(420)

    const state = await page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      const b = window.__captureHarness?.bounds?.()
      return {
        phase: el?.getAttribute("data-hero-phase"),
        phaseT: Number(el?.getAttribute("data-hero-phase-t")),
        bounds: b ? { r: b.radius, x: b.center.x, y: b.center.y } : null,
        metrics: JSON.parse(
          document.querySelector("[data-word-metrics]")?.getAttribute("data-word-metrics") ?? "null",
        ),
      }
    })
    const buf = await page.locator("[data-hero-stage]").screenshot()
    writeFileSync(join(dir, `${rung.id}.png`), buf)
    say(state.phase === "draw", `${law}/${rung.id} parked in DRAW`, `${state.phase} ${(state.phaseT * 100).toFixed(1)}%`)
    rows.push({ ...rung, ...state, bytes: buf.length })
    const m = state.metrics
    console.log(
      `  ${law.padEnd(5)} ${rung.id.padEnd(11)} cap ${String(m?.capPx?.toFixed(0)).padStart(4)}  ` +
        `R ${m?.ratio?.toFixed(4)}  lines ${m?.lineCount}  letters ${String(m?.letterCount).padStart(2)}  ` +
        `bounds r ${state.bounds ? state.bounds.r.toFixed(3) : "null"}  ${buf.length} B`,
    )
  }

  say(errors.length === 0, `${law}: no page errors`, errors.join(" | ") || "0")
  await context.close()
  return { renderer, rows }
}

async function main() {
  /* Only the STAGING directory is wiped at the top of a run. `OUT` is not
   * touched until every frame below exists. */
  rmSync(STAGE, { recursive: true, force: true })
  mkdirSync(STAGE, { recursive: true })

  const browser = await chromium.launch()

  const results = { laws: {} }
  for (const law of LAWS) {
    const dir = join(STAGE, law)
    mkdirSync(dir, { recursive: true })
    results.laws[law] = await runLaw(browser, law, dir)
  }
  await browser.close()
  writeFileSync(join(STAGE, "ladder.json"), JSON.stringify(results, null, 2))

  /* ---- A/B CONTACT SHEETS + 6x CROPS ------------------------------------ */
  if (LAWS.includes("fit") && LAWS.includes("fixed")) {
    for (const rung of LADDER) {
      try {
        execFileSync(
          FFMPEG,
          [
            "-y",
            "-i", join(STAGE, "fit", `${rung.id}.png`),
            "-i", join(STAGE, "fixed", `${rung.id}.png`),
            "-filter_complex", "[0:v][1:v]hstack=inputs=2",
            join(STAGE, `ab-${rung.id}.png`),
          ],
          { stdio: "ignore" },
        )
      } catch (e) {
        console.warn(`ffmpeg ab ${rung.id}:`, e.message)
      }
    }
  }
  for (const law of LAWS) {
    for (const rung of LADDER) {
      try {
        execFileSync(
          FFMPEG,
          [
            "-y",
            "-i", join(STAGE, law, `${rung.id}.png`),
            // The middle third of the word, blown up with nearest-neighbour so
            // a closed counter reads as a closed counter and not as a blur.
            "-vf", "crop=iw/3:ih/4:iw/3:ih*3/8,scale=iw*6:ih*6:flags=neighbor",
            join(STAGE, law, `${rung.id}-zoom6x.png`),
          ],
          { stdio: "ignore" },
        )
      } catch (e) {
        console.warn(`ffmpeg zoom ${law}/${rung.id}:`, e.message)
      }
    }
  }

  /* ---- THE SWAP. The only moment `OUT` is written at all. ---------------- */
  rmSync(OUT, { recursive: true, force: true })
  renameSync(STAGE, OUT)

  console.log(`\nframes: ${OUT}`)
  console.log(pass ? "\nCAPTURE CLEAN" : "\nCAPTURE PROBLEMS ABOVE")
  process.exit(pass ? 0 : 1)
}

/* Only when RUN, never when imported — `LADDER` is the shared definition of the
 * rungs and the gate imports it, which used to fire a whole capture run as a
 * side effect of asking what the ladder is. */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
