// FILM THE WIND-UP AND THE TURN, on BOTH arms, and film the panel with it.
//
// `assert-hero-windup.mjs` judges the motion model. This drives the real page:
// it flips the panel's own "The wind-up" pills, scrubs the beat's own transport
// across the tense and the turn, and writes frames plus an mp4 per arm. Motion
// defects do not exist in a still, and a model that is right does not prove a
// page that renders it.
//
// It also screenshots the panel on four states — the shipped reads and the three
// parked ones this lane gated dials behind — so "the dial is hidden where it is
// inert" is a picture rather than a claim.
//
// Usage: node scripts/verify/_run-clean.mjs scripts/verify/verify-hero-windup.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const { DEFAULT_HERO_MOTION, phaseOffsets } = loadTs("lib/hero-motion.ts")
const OFF = phaseOffsets(DEFAULT_HERO_MOTION)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
/* STAGED. This directory holds 102 committed panels and films. A kill 14 s into
 * the unstaged version left 0 of them on disk and `git status` reporting 102
 * deleted, measured 2026-08-28. The run writes to the staging dir and the stored
 * set is replaced only once every panel and film exists. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-windup")
const EV = stageEvidence(FINAL)
const OUT = EV.dir
// 1440 square: the stage survives either dock state at this size, which is the
// clipping bug §11.3.2 cost a whole gate reading.
const VIEW = { width: 1440, height: 1440 }

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(1500)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await page.waitForTimeout(70)
  }
  const clickPill = async (attr, value) => {
    const sel = `[data-read-${attr}="${value}"]`
    const el = await page.$(sel)
    if (!el) return false
    await el.click()
    await page.waitForTimeout(250)
    return true
  }
  // The Dial's own label span, not the row's textContent: a Dial renders
  // `<div><div><Label/><span value/></div><input/>…</div>`, so the label is the
  // header row's first child. The first version of this read the whole
  // enclosing section and every "does this dial exist" check compared a
  // paragraph of hint copy to a word — it reported the back-curve dial missing
  // on the arm that shows it.
  const dialLabels = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-hero-panel] input[type="range"]')]
        .map((i) => i.previousElementSibling?.firstElementChild?.textContent?.trim() ?? "")
        .filter(Boolean),
    )

  /* ---- 1 · THE PANEL, on four states ------------------------------------- */
  const panel = await page.$("[data-hero-panel]")
  // Two shots per state: the column scrolls, so one screenshot of its box shows
  // the reads and never the dials — and the dials are the half this lane
  // changed. Also asserts nothing overflows the column's own width, which is
  // how the first version of the "Coming back" row shipped with its second pill
  // clipped at the panel edge.
  const shot = async (name) => {
    const target = panel ?? page
    await page.evaluate(() => {
      document.querySelector("[data-hero-panel]").scrollTop = 0
    })
    await page.waitForTimeout(120)
    await target.screenshot({ path: join(OUT, `panel-${name}-top.png`) })
    await page.evaluate(() => {
      const el = document.querySelector("[data-hero-panel]")
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(120)
    await target.screenshot({ path: join(OUT, `panel-${name}-dials.png`) })
    await page.evaluate(() => {
      document.querySelector("[data-hero-panel]").scrollTop = 0
    })
  }
  const overflow = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-hero-panel]")
      const box = el.getBoundingClientRect()
      const over = []
      for (const n of el.querySelectorAll("*")) {
        const r = n.getBoundingClientRect()
        if (r.width > 0 && r.right > box.right - 1) over.push((n.textContent ?? "").trim().slice(0, 40))
      }
      return over
    })

  const shippedDials = await dialLabels()
  await shot("00-shipped")

  await clickPill("park", "prior")
  const driftDials = await dialLabels()
  await shot("01-camera-drifts")
  await clickPill("park", "parked")

  await clickPill("turn", "prior")
  const fadeDials = await dialLabels()
  await shot("02-turn-fades")
  await clickPill("turn", "turn")

  await clickPill("rise", "prior")
  const priorRiseDials = await dialLabels()
  await shot("03-rise-travels")
  await clickPill("rise", "riseOut")

  const gained = (a, b) => b.filter((x) => !a.includes(x))
  console.log(`\n  shipped panel dials: ${shippedDials.length}`)
  console.log(`  + camera drifts:  ${gained(shippedDials, driftDials).join(", ") || "none"}`)
  console.log(`  + turn fades:     ${gained(shippedDials, fadeDials).join(", ") || "none"}`)
  console.log(`  + rise travels:   ${gained(shippedDials, priorRiseDials).join(", ") || "none"}`)

  say(
    gained(shippedDials, driftDials).length >= 3,
    "the parked-camera dials come BACK when the camera drifts",
    `${gained(shippedDials, driftDials).length} dials appear`,
  )
  say(
    gained(shippedDials, fadeDials).length >= 3,
    "the ramp's dials come BACK when the turn is a fade",
    `${gained(shippedDials, fadeDials).length} dials appear`,
  )
  say(
    priorRiseDials.includes("Overshoot"),
    "the back-curve dial comes BACK on the even-at-both-ends rise",
    priorRiseDials.includes("Overshoot") ? "Overshoot present" : "missing",
  )
  say(
    !shippedDials.includes("Overshoot"),
    "…and is hidden on the shipped rise, where it is a 0/not-0 switch and not a coefficient",
    shippedDials.includes("Overshoot") ? "still shown" : "hidden",
  )
  const over = await overflow()
  say(
    over.length === 0,
    "nothing in the control column runs past its own right edge",
    over.length ? over.join(" | ") : "0 elements",
  )

  /* ---- 2 · THE FILM, both arms -------------------------------------------- */
  // A window wide enough to carry the last of the hold, the whole release and
  // the turn through its edge, so the two arms can be compared frame for frame.
  const from = OFF.anticipation - 0.2
  const to = OFF.land + 0.1
  const fps = DEFAULT_HERO_MOTION.fps
  const arms = [
    ["uncoils", "overlap"],
    ["snaps", "prior"],
  ]
  for (const [name, id] of arms) {
    const ok = await clickPill("release", id)
    say(ok, `the panel can reach the "${name}" wind-up`, ok ? id : "pill not found")
    const dir = join(OUT, name)
    mkdirSync(dir, { recursive: true })
    let i = 0
    for (let t = from; t <= to; t += 1 / fps, i++) {
      await seek(t)
      await page
        .locator("[data-hero-stage]")
        .screenshot({ path: join(dir, `${String(i).padStart(4, "0")}.png`) })
    }
    const enc = spawnSync(
      "ffmpeg",
      [
        "-y", "-framerate", "10", "-i", join(dir, "%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=720:-2",
        join(OUT, `${name}.mp4`),
      ],
      { stdio: "ignore" },
    )
    say(enc.status === 0, `filmed the "${name}" arm`, `${i} frames -> ${name}.mp4 (played at 1/3 speed)`)
  }
  await clickPill("release", "overlap")

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await browser.close()

  /* THE SWAP, on completion and not on the `pass` flag: a capture that finished
   * and photographed a defect is evidence, only an incomplete one is worthless. */
  EV.commit()
  console.log(`\nframes + films: ${FINAL}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
