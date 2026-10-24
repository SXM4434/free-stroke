// _PROBE-DRAWIN-SWEEP — CAPTURE HALF. Reproduce Sebs's exact state and film it.
//
// Sebs, 2026-08-01: *"WHEN THE ENGINE IS FREE STROKE THE 2D DRAW-IN IT STILL
// JANK, IT'S LIKE ITS USING SOME STUPID SWEEP REVEAL, AND THE SPECIAL DRAWING
// ANIMATION IN DESK DOODLES IS A LOT BETTER"*.
//
// So the state to reproduce is NOT the default one a harness happens to land
// on: LOOK = Desk Doodles, ENGINE = Free Stroke, wobble 0.40, endpoint
// PROTRUDE — and every one of those is ASSERTED off the live DOM here rather
// than assumed, because three of the four are page defaults that a sibling
// lane could move without this script noticing.
//
// This half only CAPTURES. `_probe-drawin-order.mjs` reads the frames back and
// decides sweep-vs-pen-draw, so the (slow) capture can be reused while the
// (fast) statistics are iterated on.
//
// Usage: node scripts/verify/_probe-drawin-sweep.mjs [--label=run] [--samples=33]
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
const SAMPLES = parseInt(arg("samples", "33"), 10)
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-sweep/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 153 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-sweep", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
// >= 1440 x 1440 per the standing rule: a shorter viewport lets the DialKit
// dock squeeze the stage and CLIP the mark, which has already caused one wrong
// diagnosis on this beat.
const VIEW = { width: 1600, height: 1600 }

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
    deviceScaleFactor: 1,
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

  /* ---- HIS STATE, ASSERTED OFF THE DOM ---------------------------------- */
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)

  const state = await page.evaluate(() => {
    const txt = (el) => (el?.textContent ?? "").trim()
    const active = (sel) => {
      const els = [...document.querySelectorAll(sel)]
      return els.map((e) => ({ id: e.getAttribute("data-register-option") ?? e.getAttribute("data-engine-option"), pressed: e.getAttribute("aria-pressed"), style: e.getAttribute("style") ?? "" }))
    }
    // The wobble slider: find the range input whose sibling label mentions wobble.
    let wobble = null
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      const t = (row?.textContent ?? "").toLowerCase()
      if (t.includes("wobble")) { wobble = Number(inp.value); break }
    }
    // Endpoint pill: it carries NO aria-pressed and NO data attribute — the
    // active option is encoded only as `background: var(--reg-accent)` while the
    // others are `transparent`. So read the COMPUTED background, which is the
    // only channel the page actually publishes. (`long-overshoot` renders as
    // the label "long".)
    const LABELS = { clean: "clean", protrude: "protrude", long: "long-overshoot", kink: "kink" }
    let endpoint = null
    const btns = [...document.querySelectorAll("button")].filter((b) => LABELS[txt(b).toLowerCase()])
    for (const b of btns) {
      const bg = getComputedStyle(b).backgroundColor
      const transparent = bg === "rgba(0, 0, 0, 0)" || bg === "transparent"
      if (!transparent) endpoint = LABELS[txt(b).toLowerCase()]
    }
    return {
      registers: active("[data-register-option]"),
      engines: active("[data-engine-option]"),
      wobble,
      endpoint,
      engineFamilyAttr: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
    }
  })
  console.log("live state:", JSON.stringify({ wobble: state.wobble, endpoint: state.endpoint, engineFamily: state.engineFamilyAttr }))
  say(state.wobble === 0.4, "wobble is 0.40 — his setting", String(state.wobble))
  say(state.endpoint === "protrude", "endpoint is PROTRUDE — his setting", String(state.endpoint))

  const span = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-draw-span]")
    return JSON.parse(el.getAttribute("data-hero-draw-span"))
  })
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

  const meta = { span, samples: SAMPLES, view: VIEW, engines: {} }

  for (const engine of ["free-stroke", "desk-doodles"]) {
    await page.click(`[data-engine-option="${engine}"]`)
    // The Desk Doodles engine rebuilds the whole word on a switch.
    await page.waitForTimeout(3000)
    const fam = await page.evaluate(() =>
      document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family"),
    )
    say(fam === engine, `engine pill actually switched to ${engine}`, String(fam))

    const dir = join(OUT, engine)
    mkdirSync(dir, { recursive: true })
    const reveals = []
    for (let k = 0; k < SAMPLES; k++) {
      const t = span.at + (span.duration * k) / (SAMPLES - 1)
      await seek(t)
      const phase = await page.evaluate(() => {
        const el = document.querySelector("[data-hero-phase]")
        return { phase: el?.getAttribute("data-hero-phase"), t: Number(el?.getAttribute("data-hero-phase-t")) }
      })
      reveals.push({ k, t, phase: phase.phase, phaseT: phase.t })
      const buf = await page.locator("[data-hero-stage]").screenshot()
      writeFileSync(join(dir, `${String(k).padStart(3, "0")}.png`), buf)
    }
    meta.engines[engine] = reveals

    // A DENSE MP4 OF THE SCRUB, so the reveal can be watched rather than argued.
    try {
      execFileSync(
        FFMPEG,
        ["-y", "-framerate", "8", "-i", join(dir, "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, `scrub-${engine}.mp4`)],
        { stdio: "ignore" },
      )
    } catch (e) {
      console.warn("ffmpeg scrub failed:", e.message)
    }
  }

  /* ---- REAL-TIME PLAY, FILMED, ON HIS ENGINE ---------------------------- */
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
  await resetBtn()
  // warm take (shader compile + first build are not the draw-in)
  await page.click("[data-hero-play]")
  await page.waitForTimeout((span.duration + 1.0) * 1000)
  await page.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => {
      if ((b.textContent ?? "").trim().toLowerCase() === "pause") b.click()
    })
  })
  await resetBtn()
  await page.waitForTimeout(500)
  await page.click("[data-hero-play]")
  await page.waitForTimeout(13000)

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2))
  await context.close()
  await browser.close()

  for (const f of readdirSync(OUT).filter((f) => f.endsWith(".webm"))) {
    renameSync(join(OUT, f), join(OUT, "play-free-stroke.webm"))
    break
  }
  try {
    if (existsSync(join(OUT, "play-free-stroke.webm"))) {
      execFileSync(FFMPEG, ["-y", "-i", join(OUT, "play-free-stroke.webm"), "-c:v", "libx264", "-pix_fmt", "yuv420p", join(OUT, "play-free-stroke.mp4")], { stdio: "ignore" })
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
